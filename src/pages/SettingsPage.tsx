import React, { useState } from 'react';
import { Copy, Moon, Sun } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { GlassButton } from '../components/GlassUI';
import { useApp } from '../context/AppContext';

export const SettingsPage: React.FC = () => {
  const { theme, setThemeMode, notify } = useApp();
  const [defaultFg, setDefaultFg] = useState(
    () => localStorage.getItem('pulseqr_default_fg') || '#0F172A'
  );
  const [defaultBg, setDefaultBg] = useState(
    () => localStorage.getItem('pulseqr_default_bg') || '#FFFFFF'
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com';

  const handleSaveBrandDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pulseqr_default_fg', defaultFg);
    localStorage.setItem('pulseqr_default_bg', defaultBg);
    notify('Workspace defaults saved', 'success');
  };

  const copyText = async (val: string) => {
    await navigator.clipboard.writeText(val);
    notify('Copied to clipboard', 'success');
  };

  return (
    <DashboardLayout title="Settings" breadcrumb="Settings">
      <div className="max-w-3xl space-y-6">
        {/* Appearance */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-8">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Appearance &amp; Glass Theme
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Switch cleanly between luminous porcelain light glass and smoked obsidian dark glass.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3.5 max-w-md">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all cursor-pointer ${
                theme === 'light'
                  ? 'border-blue-500/60 bg-gradient-to-br from-blue-600/15 to-cyan-500/10 text-blue-700 shadow-xs'
                  : 'border-slate-900/8 dark:border-white/[0.08] glass-panel text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sun className="w-4 h-4" />
              Light Mode
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-violet-500/60 bg-gradient-to-br from-blue-600/20 via-violet-600/15 to-cyan-500/15 text-white shadow-xs'
                  : 'border-slate-900/8 dark:border-white/[0.08] glass-panel text-slate-600 dark:text-slate-300'
              }`}
            >
              <Moon className="w-4 h-4" />
              Dark Mode
            </button>
          </div>
        </div>

        {/* Dynamic Redirect Endpoints */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-8 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Dynamic Redirect Endpoints
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All printed QR codes resolve through these active routes and log scans atomically.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Standard Redirect Route
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-2.5 rounded-2xl glass-input text-xs font-mono-tabular truncate">
                  {origin}/redirect?id=QR_ID
                </code>
                <button
                  type="button"
                  onClick={() => copyText(`${origin}/redirect?id=QR_ID`)}
                  className="p-2.5 rounded-2xl glass-panel hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Quick QR Edit Route
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-2.5 rounded-2xl glass-input text-xs font-mono-tabular truncate">
                  {origin}/manage/QR_ID
                </code>
                <button
                  type="button"
                  onClick={() => copyText(`${origin}/manage/QR_ID`)}
                  className="p-2.5 rounded-2xl glass-panel hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Default Brand Palette */}
        <form onSubmit={handleSaveBrandDefaults} className="glass-panel rounded-[26px] p-6 sm:p-8 space-y-5">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Default QR Palette
          </h2>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Foreground Hex
              </label>
              <input
                type="color"
                value={defaultFg}
                onChange={(e) => setDefaultFg(e.target.value)}
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-white/15 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Background Hex
              </label>
              <input
                type="color"
                value={defaultBg}
                onChange={(e) => setDefaultBg(e.target.value)}
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-white/15 cursor-pointer"
              />
            </div>
          </div>
          <GlassButton type="submit" variant="primary" size="sm">
            Save Defaults
          </GlassButton>
        </form>

        {/* Progressive Web App Install */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Installable App &amp; Offline Support
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Install PulseQR on mobile or desktop for full-screen standalone launch and cached
              offline access.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <PWAInstallButton />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
