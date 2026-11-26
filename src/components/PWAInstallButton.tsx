import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean; iconOnly?: boolean }> = ({
  compact = false,
  iconOnly = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Install PulseQR App"
        className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white font-semibold shadow-[0_8px_24px_-8px_rgba(79,70,229,0.55)] hover:brightness-110 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
          iconOnly ? 'p-2.5 w-10 h-10' : compact ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm w-full'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        {!iconOnly && <span>Install App</span>}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        title={isIOS ? 'Install on iOS' : 'Install PulseQR App'}
        className={`inline-flex items-center justify-center gap-2 rounded-2xl glass-panel text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 font-medium transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
          iconOnly ? 'p-2.5 w-10 h-10' : compact ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm w-full'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0 text-blue-600 dark:text-cyan-400" />
        {!iconOnly && <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-[28px] glass-modal p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Install PulseQR
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside leading-relaxed">
                <li>Tap the <strong>Share</strong> icon in your Safari toolbar.</li>
                <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> to launch PulseQR in standalone mode.</li>
              </ol>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Open your browser menu or click the install icon in the address bar and select{' '}
                <strong>Install PulseQR</strong> for offline access and standalone launch.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-2xl glass-modal px-4 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-300"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>Offline Mode — Cached views active. Sync resumes automatically.</span>
    </div>
  );
};
