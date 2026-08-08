import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Laptop,
  MoreVertical,
  RefreshCw,
  Share2,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import {
  getInstallPrompt,
  requestNativeInstall,
  subscribeInstallPrompt,
  waitForInstallPrompt,
  type BeforeInstallPromptEvent,
} from '../../pwa/installPrompt';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type InstallPlatform = 'android' | 'ios' | 'desktop';

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

function detectPlatform(): InstallPlatform {
  const agent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) return 'ios';
  if (/android/.test(agent)) return 'android';
  return 'desktop';
}

export const PwaInstallButton: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => getInstallPrompt());
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [showHelp, setShowHelp] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [justInstalled, setJustInstalled] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<InstallPlatform>(() => detectPlatform());
  const [workerReady, setWorkerReady] = useState<'checking' | 'ready' | 'unsupported'>('checking');

  useEffect(() => {
    setIsInstalled(isStandaloneMode());
    const unsubscribePrompt = subscribeInstallPrompt(setInstallPrompt);

    const handleInstalled = () => {
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

    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    displayMode.addEventListener?.('change', handleDisplayMode);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setWorkerReady('ready'))
        .catch(() => setWorkerReady('unsupported'));
    } else {
      setWorkerReady('unsupported');
    }

    return () => {
      unsubscribePrompt();
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      displayMode.removeEventListener?.('change', handleDisplayMode);
    };
  }, []);

  const runNativeInstall = async (prompt: BeforeInstallPromptEvent) => {
    setIsInstalling(true);
    try {
      const choice = await requestNativeInstall(prompt);
      if (choice?.outcome === 'accepted') {
        setJustInstalled(true);
        window.setTimeout(() => setJustInstalled(false), 5000);
      } else {
        setShowHelp(true);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleInstall = async () => {
    const currentPlatform = detectPlatform();
    if (currentPlatform === 'ios') {
      setSelectedPlatform('ios');
      setShowHelp(true);
      return;
    }

    if (installPrompt) {
      await runNativeInstall(installPrompt);
      return;
    }

    // On a first visit Chrome may finish activating the service worker just
    // after the user taps. Give the native event a short chance to arrive.
    setIsInstalling(true);
    const prompt = await waitForInstallPrompt(2500);
    setIsInstalling(false);
    if (prompt) await runNativeInstall(prompt);
    else {
      setSelectedPlatform(detectPlatform());
      setShowHelp(true);
    }
  };

  const platformTabs: Array<{ id: InstallPlatform; label: string; icon: React.ReactNode }> = [
    { id: 'android', label: 'Android', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'ios', label: 'iPhone / iPad', icon: <Share2 className="h-4 w-4" /> },
    { id: 'desktop', label: 'Desktop', icon: <Laptop className="h-4 w-4" /> },
  ];

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
          className="fixed bottom-20 right-4 z-[90] flex items-center gap-2 rounded-full bg-[#8e004b] px-4 py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(142,0,75,0.28)] transition-all hover:bg-[#b50062] hover:shadow-xl active:scale-95 disabled:cursor-wait disabled:opacity-70 sm:bottom-4"
        >
          {isInstalling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{isInstalling ? 'Preparing install…' : 'Install App'}</span>
        </button>
      )}

      {showHelp && !isInstalled && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" className="w-full max-w-lg rounded-3xl border border-[#e0bec6] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Nexora Jobs" className="h-12 w-12 rounded-xl" />
                <div>
                  <h2 id="pwa-install-title" className="text-lg font-extrabold text-[#1c1b1b]">Install Nexora Jobs</h2>
                  <p className="text-xs text-[#594047]">Choose your device below and follow its install method.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close install instructions" className="rounded-full p-2 text-[#594047] hover:bg-[#f1edec]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-[#f1edec] p-1">
              {platformTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedPlatform(tab.id)}
                  className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all sm:text-xs ${
                    selectedPlatform === tab.id ? 'bg-white text-[#8e004b] shadow-sm' : 'text-[#594047] hover:text-[#1c1b1b]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-44 rounded-2xl bg-[#fdf8f8] p-4 text-sm text-[#594047]">
              {selectedPlatform === 'ios' ? (
                <div className="space-y-4">
                  <p className="font-bold text-[#1c1b1b]">Install on iPhone or iPad</p>
                  <div className="flex items-start gap-3"><Share2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Open this site in <strong>Safari</strong>, then tap the <strong>Share</strong> button.</span></div>
                  <div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Scroll and choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</span></div>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Apple does not allow websites to open the install prompt directly; Safari's Add to Home Screen action is required.</p>
                </div>
              ) : selectedPlatform === 'android' ? (
                <div className="space-y-4">
                  <p className="font-bold text-[#1c1b1b]">Install on Android</p>
                  {installPrompt && (
                    <button type="button" onClick={() => runNativeInstall(installPrompt)} disabled={isInstalling} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e2007c] py-3 font-extrabold text-white hover:bg-[#8e004b] disabled:opacity-60">
                      <Download className="h-4 w-4" /> Install Now
                    </button>
                  )}
                  <div className="flex items-start gap-3"><MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>If no prompt appears, open Chrome's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></div>
                  <div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Confirm <strong>Install</strong>. The app will appear in your launcher.</span></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="font-bold text-[#1c1b1b]">Install on desktop Chrome or Edge</p>
                  {installPrompt && (
                    <button type="button" onClick={() => runNativeInstall(installPrompt)} disabled={isInstalling} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e2007c] py-3 font-extrabold text-white hover:bg-[#8e004b] disabled:opacity-60">
                      <Download className="h-4 w-4" /> Install Now
                    </button>
                  )}
                  <div className="flex items-start gap-3"><Download className="mt-0.5 h-5 w-5 shrink-0 text-[#8e004b]" /><span>Click the install icon in the address bar, or open the browser menu and choose <strong>Install Nexora Jobs</strong>.</span></div>
                </div>
              )}
            </div>

            {!installPrompt && selectedPlatform !== 'ios' && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#e0bec6] bg-white px-3 py-2 text-[11px] text-[#594047]">
                <span>{workerReady === 'ready' ? 'App is ready. If the native prompt is hidden, refresh once or use the browser menu.' : 'Preparing offline installation support…'}</span>
                <button type="button" onClick={() => window.location.reload()} className="flex shrink-0 items-center gap-1 font-bold text-[#8e004b] hover:underline">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            )}

            <button type="button" onClick={() => setShowHelp(false)} className="mt-5 w-full rounded-full border border-[#8e004b] py-3 text-sm font-extrabold text-[#8e004b] hover:bg-[#ffd9e2]/40">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
