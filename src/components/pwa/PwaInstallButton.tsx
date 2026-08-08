import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, MoreVertical, Share2, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

export const PwaInstallButton: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [showHelp, setShowHelp] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [justInstalled, setJustInstalled] = useState(false);

  const platform = useMemo(() => {
    const agent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(agent)) return 'ios';
    if (/android/.test(agent)) return 'android';
    return 'desktop';
  }, []);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setIsInstalling(false);
      setShowHelp(false);
      setJustInstalled(true);
      window.setTimeout(() => setJustInstalled(false), 5000);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const handleDisplayMode = () => setIsInstalled(isStandaloneMode());

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    displayMode.addEventListener?.('change', handleDisplayMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      displayMode.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') {
        setJustInstalled(true);
        window.setTimeout(() => setJustInstalled(false), 5000);
      } else {
        setShowHelp(true);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <>
      {!isOnline && (
        <div className="fixed left-1/2 top-3 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 shadow-lg">
          <WifiOff className="h-4 w-4" />
          <span>Offline mode — cached public content remains available</span>
        </div>
      )}

      {justInstalled && (
        <div className="fixed bottom-20 right-4 z-[120] flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-bold text-emerald-800 shadow-xl">
          <CheckCircle2 className="h-5 w-5" />
          Nexora Jobs installed successfully
        </div>
      )}

      {!isInstalled && (
        <button
          type="button"
          onClick={handleInstall}
          disabled={isInstalling}
          aria-label="Install Nexora Jobs app"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          className="fixed bottom-20 right-4 z-[90] flex items-center sm:bottom-4 gap-2 rounded-full bg-[#8e004b] px-4 py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(142,0,75,0.28)] transition-all hover:bg-[#b50062] hover:shadow-xl active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          <Download className={`h-4 w-4 ${isInstalling ? 'animate-bounce' : ''}`} />
          <span>{isInstalling ? 'Installing…' : 'Install App'}</span>
        </button>
      )}

      {showHelp && !isInstalled && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" className="w-full max-w-md rounded-3xl border border-[#e0bec6] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="Nexora Jobs" className="h-12 w-12 rounded-xl" />
                <div>
                  <h2 id="pwa-install-title" className="text-lg font-extrabold text-[#1c1b1b]">Install Nexora Jobs</h2>
                  <p className="text-xs text-[#594047]">Fast access, app-like display, and offline app shell.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close install instructions" className="rounded-full p-2 text-[#594047] hover:bg-[#f1edec]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4 rounded-2xl bg-[#fdf8f8] p-4 text-sm text-[#594047]">
              {platform === 'ios' ? (
                <>
                  <p className="font-bold text-[#1c1b1b]">On iPhone or iPad (Safari):</p>
                  <div className="flex items-start gap-3"><Share2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Tap the <strong>Share</strong> button in Safari.</span></div>
                  <div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</span></div>
                </>
              ) : platform === 'android' ? (
                <>
                  <p className="font-bold text-[#1c1b1b]">On Android (Chrome):</p>
                  <div className="flex items-start gap-3"><MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Open Chrome's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></div>
                  <div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Confirm <strong>Install</strong> when prompted.</span></div>
                </>
              ) : (
                <>
                  <p className="font-bold text-[#1c1b1b]">On desktop Chrome or Edge:</p>
                  <div className="flex items-start gap-3"><Download className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Click the install icon in the address bar, or open the browser menu and choose <strong>Install Nexora Jobs</strong>.</span></div>
                </>
              )}
            </div>

            <button type="button" onClick={() => setShowHelp(false)} className="mt-5 w-full rounded-full bg-[#e2007c] py-3 text-sm font-extrabold text-white hover:bg-[#8e004b]">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
