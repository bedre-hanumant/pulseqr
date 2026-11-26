import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  PlusSquare,
  Printer,
  QrCode,
  RefreshCw,
  Settings,
  Shield,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { AmbientAurora, PageTransition } from './GlassUI';

interface DashboardLayoutProps {
  title: string;
  breadcrumb: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title,
  breadcrumb,
  primaryAction,
  children,
}) => {
  const { user, profile, isAdmin, theme, toggleTheme, logout, notify, refreshAuthUser } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pulseqr_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseqr_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/create', label: 'Create QR', icon: PlusSquare },
    { to: '/my-qrs', label: 'My QR Codes', icon: QrCode },
    { to: '/bulk-print', label: 'Bulk Print Cards', icon: Printer },
    { to: '/manage-cards', label: 'Manage QR Cards', icon: CreditCard },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/profile', label: 'Profile', icon: UserCircle2 },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/contact', label: 'Support', icon: MessageSquare },
  ];

  if (isAdmin) {
    navItems.push({ to: '/admin', label: 'Admin Panel', icon: Shield });
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setVerifying(true);
    try {
      await sendEmailVerification(user);
      notify('Verification email sent', 'success', `Check ${user.email} and click the verification link.`);
    } catch (err) {
      notify('Could not send email', 'error', err instanceof Error ? err.message : 'Try again shortly.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerifying(true);
    try {
      await refreshAuthUser();
      notify('Status refreshed', 'info', 'Account verification state updated.');
    } finally {
      setVerifying(false);
    }
  };

  const renderSidebarBody = (isCollapsedDesktop: boolean) => (
    <div className="flex flex-col h-full">
      <div
        className={`h-16 px-4 flex items-center border-b border-slate-900/5 dark:border-white/[0.07] ${
          isCollapsedDesktop ? 'justify-center' : 'justify-between'
        }`}
      >
        {!isCollapsedDesktop && (
          <Link
            to="/"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(99,102,241,0.55)]">
              <QrCode className="w-4 h-4" />
            </span>
            <span>PulseQR</span>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden lg:inline-flex p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          aria-label={isCollapsedDesktop ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsedDesktop ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsedDesktop ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={isCollapsedDesktop ? item.label : undefined}
              className={`group relative flex items-center rounded-2xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                isCollapsedDesktop ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'
              } ${
                active
                  ? 'bg-gradient-to-r from-blue-600/15 via-violet-500/12 to-cyan-500/10 text-blue-700 dark:text-white border border-blue-500/25 dark:border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                  active ? 'text-blue-600 dark:text-cyan-400' : ''
                }`}
              />
              {!isCollapsedDesktop && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3.5 border-t border-slate-900/5 dark:border-white/[0.07] space-y-3">
        <div className={isCollapsedDesktop ? 'flex justify-center' : ''}>
          <PWAInstallButton iconOnly={isCollapsedDesktop} />
        </div>

        <div
          className={`flex items-center pt-1 ${
            isCollapsedDesktop ? 'flex-col gap-2' : 'justify-between gap-2'
          }`}
        >
          <div className={`flex items-center min-w-0 ${isCollapsedDesktop ? '' : 'gap-2.5'}`}>
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover border border-white/60 dark:border-white/15 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-violet-600 to-pink-500 text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-xs">
                {(profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}
            {!isCollapsedDesktop && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {profile?.name || user?.displayName || 'Workspace Member'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex relative bg-[#F5F7FC] dark:bg-[#050711] text-slate-900 dark:text-slate-100">
      <AmbientAurora subtle />

      {/* Collapsible Desktop Glass Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 glass-sidebar sticky top-0 h-screen transition-[width] duration-250 ease-out z-30 ${
          collapsed ? 'w-[82px]' : 'w-[264px]'
        }`}
      >
        {renderSidebarBody(collapsed)}
      </aside>

      {/* Mobile Glass Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] glass-modal h-full">
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}

      {/* Workspace Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 glass-nav px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                Workspace / {breadcrumb}
              </p>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl glass-panel text-slate-600 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all active:scale-95 cursor-pointer"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
            {primaryAction}
          </div>
        </header>

        {/* Email Verification Glass Banner */}
        {user && !user.emailVerified && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4">
            <div className="max-w-7xl mx-auto rounded-[20px] glass-panel border-amber-400/40 dark:border-amber-500/30 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-amber-900 dark:text-amber-200">
                <MailCheck className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Verify your email address (<strong>{user.email}</strong>) to create and edit dynamic QR codes.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleResendVerification}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleCheckVerification}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl glass-panel text-amber-900 dark:text-amber-200 hover:bg-white/90 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          <PageTransition key={location.pathname}>{children}</PageTransition>
        </main>
      </div>

      {/* Floating Glass Action Button (Quick Create QR) */}
      {location.pathname !== '/create' && (
        <Link
          to="/create"
          aria-label="Quick create dynamic QR code"
          title="Quick Create Dynamic QR"
          className="fixed bottom-6 right-6 z-40 btn-gradient-border rounded-full! p-[2px]! group"
        >
          <span className="flex items-center justify-center w-13 h-13 rounded-full bg-slate-950/90 dark:bg-slate-900/90 backdrop-blur-xl text-white transition-transform duration-200 group-hover:scale-105">
            <Plus className="w-5 h-5" />
          </span>
        </Link>
      )}
    </div>
  );
};
