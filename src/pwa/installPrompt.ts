export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type PromptListener = (prompt: BeforeInstallPromptEvent | null) => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<PromptListener>();

function notify() {
  listeners.forEach((listener) => listener(deferredPrompt));
}

// This listener is registered as soon as the application module is evaluated,
// before React mounts, so Chromium's one-shot event cannot be missed.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function subscribeInstallPrompt(listener: PromptListener) {
  listeners.add(listener);
  listener(deferredPrompt);
  return () => listeners.delete(listener);
}

export async function waitForInstallPrompt(timeoutMs = 2500) {
  if (deferredPrompt) return deferredPrompt;
  return new Promise<BeforeInstallPromptEvent | null>((resolve) => {
    let unsubscribe = () => {};
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);
    unsubscribe = subscribeInstallPrompt((prompt) => {
      if (!prompt) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(prompt);
    });
  });
}

export async function requestNativeInstall(prompt = deferredPrompt) {
  if (!prompt) return null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice;
}
