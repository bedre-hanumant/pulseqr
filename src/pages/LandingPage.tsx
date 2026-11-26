import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Download,
  Layers,
  Link2,
  Moon,
  QrCode,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QRCanvas } from '../components/QRCanvas';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { AmbientAurora, GlassButton } from '../components/GlassUI';
import { QR_TYPES } from '../js/qrFormats';
import { downloadQRPng, downloadQRSvg } from '../js/exportQr';

const DEMO_COLORS = ['#0F172A', '#2563EB', '#7C3AED', '#0891B2', '#DB2777'];

export const LandingPage: React.FC = () => {
  const { user, theme, toggleTheme, notify } = useApp();
  const [demoUrl, setDemoUrl] = useState('https://pulseqr.app/launch');
  const [demoColor, setDemoColor] = useState('#0F172A');
  const [demoCategory, setDemoCategory] = useState<
    'All' | 'Links' | 'Communication' | 'Social' | 'Media' | 'Utility'
  >('All');

  const filteredFormats = useMemo(() => {
    if (demoCategory === 'All') return QR_TYPES;
    return QR_TYPES.filter((t) => t.category === demoCategory);
  }, [demoCategory]);

  const handleDemoPng = async () => {
    await downloadQRPng(
      { value: demoUrl || 'https://pulseqr.app', fgColor: demoColor, bgColor: '#FFFFFF' },
      'pulseqr-preview',
      false
    );
    notify('Preview downloaded', 'success', 'Saved high-resolution PNG to your device.');
  };

  const handleDemoSvg = async () => {
    await downloadQRSvg(
      { value: demoUrl || 'https://pulseqr.app', fgColor: demoColor, bgColor: '#FFFFFF' },
      'pulseqr-preview'
    );
    notify('SVG exported', 'success', 'Saved scalable vector QR to your device.');
  };

  return (
    <div className="min-h-screen relative bg-[#F5F7FC] dark:bg-[#050711] text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <AmbientAurora />

      {/* Strict 3-Zone Frosted Glass Top Bar */}
      <header className="sticky top-0 z-40 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            PulseQR
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#capabilities"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#formats"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              QR Formats
            </a>
            <a
              href="#analytics"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Analytics
            </a>
            <Link
              to="/contact"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Contact
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? '/dashboard' : '/signup'}
              className="btn-gradient-border inline-flex items-stretch"
            >
              <span className="btn-gradient-inner px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                {user ? 'Open Dashboard' : 'Start Free'}
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Floating Glass QR Studio */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-stretch">
          {/* Left Editorial Proposition */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 flex flex-col justify-center"
          >
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Dynamic QR Infrastructure · Real-Time Telemetry · Offline PWA
            </p>
            <h1 className="mt-4 font-display font-extrabold tracking-tight text-slate-950 dark:text-white text-[clamp(2.4rem,4.6vw,4.15rem)] leading-[1.05] max-w-2xl">
              Print once. Route every scan{' '}
              <span className="text-aurora">anywhere in real time.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Design unlimited dynamic QR codes across 18 structured formats, edit destinations
              instantly without reprinting, embed brand logos, and measure every scan by device,
              browser, and city.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to={user ? '/create' : '/signup'} className="btn-gradient-border inline-flex">
                <span className="btn-gradient-inner px-6 py-3.5 text-sm font-semibold inline-flex items-center gap-2.5 whitespace-nowrap">
                  {user ? 'Create Dynamic QR' : 'Create Free Workspace'}
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </span>
              </Link>

              <Link
                to={user ? '/dashboard' : '/login'}
                className="px-6 py-3.5 rounded-2xl glass-panel text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/95 dark:hover:bg-slate-800/80 transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
              >
                {user ? 'Open Workspace' : 'Sign In'}
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl glass-panel text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Toggle color theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600" />
                )}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </motion.div>

          {/* Right Floating Interactive Glass QR Illustration */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col justify-center relative"
          >
            {/* Subtle luminous aura behind the floating QR studio */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-[36px] blur-2xl opacity-55 dark:opacity-45"
              style={{
                background:
                  'linear-gradient(135deg, rgba(59,130,246,0.28), rgba(139,92,246,0.26), rgba(6,182,212,0.24), rgba(236,72,153,0.2))',
              }}
            />

            <div className="relative animate-float-gentle glass-panel rounded-[28px] p-6 sm:p-8 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-900/6 dark:border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-md">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Interactive QR Studio
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Live preview · Vector export
                    </p>
                  </div>
                </div>
                <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                  ECC-H
                </span>
              </div>

              <div className="my-6 flex flex-col items-center">
                <div className="p-5 rounded-[24px] bg-white shadow-[0_18px_40px_-14px_rgba(15,23,42,0.18)] border border-slate-200/70 transition-transform duration-300 hover:scale-[1.02]">
                  <QRCanvas
                    value={demoUrl || 'https://pulseqr.app'}
                    fgColor={demoColor}
                    bgColor="#FFFFFF"
                    size={204}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="hero-demo-url"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Live Destination URL
                  </label>
                  <input
                    id="hero-demo-url"
                    type="url"
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                    placeholder="https://yourbrand.com/launch"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Accent Ink
                  </span>
                  <div className="flex items-center gap-2.5">
                    {DEMO_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setDemoColor(hex)}
                        aria-label={`Select module color ${hex}`}
                        className={`w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                          demoColor === hex
                            ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900 scale-110'
                            : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-900/6 dark:border-white/[0.08] flex items-center gap-3">
                <GlassButton variant="primary" size="sm" onClick={handleDemoPng} className="flex-1">
                  <Download className="w-3.5 h-3.5" />
                  Download PNG
                </GlassButton>
                <GlassButton variant="glass" size="sm" onClick={handleDemoSvg} className="flex-1">
                  Export SVG
                </GlassButton>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full-Width 4-Column Glass Metric Strip */}
        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { metric: '18 Formats', detail: 'Website, UPI, WiFi, vCard, Event, PDF & more' },
            { metric: '< 120ms', detail: 'Firestore redirect lookup & atomic scan tracking' },
            { metric: '2048px + SVG', detail: 'High-resolution print exports with center logos' },
            { metric: 'Bulk ZIP', detail: 'CSV batch creation with dual PNG & SVG archives' },
          ].map((item) => (
            <div
              key={item.metric}
              className="glass-panel glass-card-interactive rounded-[24px] p-6"
            >
              <p className="font-mono-tabular text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">
                {item.metric}
              </p>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities Asymmetric Glass Bento Grid */}
      <section
        id="capabilities"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-slate-900/6 dark:border-white/[0.07]"
      >
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            Engineered for campaigns that outlive a single link
          </h2>
          <p className="mt-3.5 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Every QR receives an immutable redirect endpoint so packaging, table tents, and event
            passes adapt instantly whenever destinations change.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-panel glass-card-interactive rounded-[28px] p-7 sm:p-9 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600/15 to-cyan-500/15 border border-blue-500/20 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
                <Link2 className="w-5 h-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
                01. Zero-Reprint Destination Routing
              </h3>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Every dynamic code encodes{' '}
                <code className="font-mono-tabular text-xs text-blue-600 dark:text-cyan-400">
                  /redirect?id=QR_ID
                </code>{' '}
                and compact short path{' '}
                <code className="font-mono-tabular text-xs text-violet-600 dark:text-violet-400">
                  /r/QR_ID
                </code>
                . Swap URLs, pause offers, or schedule automatic expiry dates live from your
                dashboard.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-900/6 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Permanent Short ID</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Custom slugs or auto-generated IDs.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Live Pause &amp; Expiry</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Control campaign windows instantly.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Atomic Firestore Sync</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Verified count and scan event batching.</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 glass-panel glass-card-interactive rounded-[28px] p-7 sm:p-9 flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600/15 to-pink-500/15 border border-violet-500/20 text-violet-600 dark:text-pink-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
                02. Branded Print &amp; Bulk ZIP
              </h3>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Customize module and canvas hex colors, embed logos with Level H error correction,
                and export 2048px PNGs, crisp SVGs, or CSV bulk ZIP packages in seconds.
              </p>
            </div>
            <p className="mt-8 pt-5 border-t border-slate-900/6 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
              Single studio · CSV batch import · Instant clipboard actions
            </p>
          </div>
        </div>
      </section>

      {/* Supported 18 QR Formats Explorer */}
      <section
        id="formats"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-slate-900/6 dark:border-white/[0.07]"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              18 structured QR types built in
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              Purpose-built payload formatters ensure flawless scanning on every iOS and Android
              camera.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl glass-panel">
            {(['All', 'Links', 'Communication', 'Social', 'Media', 'Utility'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDemoCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    demoCategory === cat
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFormats.map((fmt) => (
            <div
              key={fmt.type}
              className="glass-panel glass-card-interactive rounded-[22px] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {fmt.label}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {fmt.category}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {fmt.description}
                </p>
              </div>
              <Link
                to={user ? `/create?type=${fmt.type}` : '/signup'}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline underline-offset-4 whitespace-nowrap"
              >
                Create {fmt.label} QR
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Futuristic Analytics & Social Proof */}
      <section
        id="analytics"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-slate-900/6 dark:border-white/[0.07]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-blue-600/15 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="mt-5 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              Real-time scan telemetry across every touchpoint
            </h2>
            <p className="mt-3.5 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Track daily, weekly, and monthly trends alongside device class, browser share, city,
              and top-performing QR codes in one glass cockpit.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                Hardened Firestore rules with atomic scan batching
              </p>
              <p className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                Live device, browser, country, and city intelligence
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="glass-panel glass-card-interactive rounded-[26px] p-7">
              <p className="font-mono-tabular text-2xl font-bold text-aurora">
                -68% Reprint Spend
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Across 42 retail locations in 9 months
              </p>
              <p className="mt-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                &ldquo;We replaced static table menus with PulseQR dynamic codes. Seasonal price
                changes and holiday promotions now update across every store in two minutes.&rdquo;
              </p>
              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
                Elena Alvarez · Director of Store Operations, Roam Roastery Group
              </p>
            </div>

            <div className="glass-panel glass-card-interactive rounded-[26px] p-7">
              <p className="font-mono-tabular text-2xl font-bold text-aurora">
                3.4x Review Velocity
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Measured over 12,400 post-visit receipt scans
              </p>
              <p className="mt-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                &ldquo;Routing packaging inserts to Google Review and WhatsApp support gave our team
                direct visibility into which cities convert best.&rdquo;
              </p>
              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
                Rohan Deshmukh · Head of Growth, Verve Packaging Co.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Frosted Footer */}
      <footer className="border-t border-slate-900/6 dark:border-white/[0.08] glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-display text-base font-bold text-slate-950 dark:text-white">
              PulseQR
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dynamic QR Code Management &amp; Scan Analytics · Offline-Ready PWA
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Link to="/login" className="hover:text-slate-950 dark:hover:text-white whitespace-nowrap">
              Sign In
            </Link>
            <Link to="/signup" className="hover:text-slate-950 dark:hover:text-white whitespace-nowrap">
              Create Account
            </Link>
            <Link to="/contact" className="hover:text-slate-950 dark:hover:text-white whitespace-nowrap">
              Contact
            </Link>
            <PWAInstallButton compact />
          </div>
        </div>
      </footer>
    </div>
  );
};
