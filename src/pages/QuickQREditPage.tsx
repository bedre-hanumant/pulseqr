import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link2,
  Loader2,
  Lock,
  Moon,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sun,
  Unlock,
} from 'lucide-react';
import { auth } from '../firebase/config';
import {
  getOrCreateQREditToken,
  getPrintBatchName,
  getQRCodeById,
  getResolvedDestination,
  recordQRScanAtomic,
  rotateQREditToken,
  updateQRCode,
  updateQRCodeWithToken,
} from '../firebase/firestore';
import { getManageQrUrl } from '../js/qrFormats';
import { parseClientEnvironment } from '../js/deviceParser';
import { useApp } from '../context/AppContext';
import { QRCanvas } from '../components/QRCanvas';
import {
  AmbientAurora,
  AnimatedNumber,
  GlassButton,
  PageTransition,
  SuccessCheckAnimation,
} from '../components/GlassUI';
import type { QRCodeRecord, QRStatus } from '../types';

function isDirectNavigableUrl(link: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|sms:|upi:)/i.test(link.trim());
}

function formatDateTime(ts: QRCodeRecord['updatedAt'], fallbackDate?: Date | null): string {
  const date = fallbackDate ?? (ts ? ts.toDate() : null);
  if (!date || Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const QuickQREditPage: React.FC = () => {
  const { qrId: paramQrId } = useParams<{ qrId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const qrId = (paramQrId || '').trim();
  const urlToken = (searchParams.get('token') || '').trim();
  const alreadyScanned = searchParams.get('scanned') === '1';
  const fromDashboard = searchParams.get('from') === 'dashboard';

  const { user, isAdmin, authLoading, theme, toggleTheme, notify } = useApp();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [qr, setQr] = useState<QRCodeRecord | null>(null);
  const [resolvedBatchName, setResolvedBatchName] = useState('');
  const [localUpdatedAt, setLocalUpdatedAt] = useState<Date | null>(null);

  // Edit form state
  const [destinationInput, setDestinationInput] = useState('');
  const [statusInput, setStatusInput] = useState<QRStatus>('active');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Security & unlock state
  const [unlockTab, setUnlockTab] = useState<'token' | 'signin'>(urlToken ? 'token' : 'signin');
  const [activeToken, setActiveToken] = useState(urlToken);
  const [tokenInput, setTokenInput] = useState(urlToken);
  const [tokenError, setTokenError] = useState('');

  // Inline fast sign-in state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');

  // Owner/Admin secure edit token management
  const [ownerToken, setOwnerToken] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const processedScanRef = useRef(false);

  const isAuthorizedOwnerOrAdmin = Boolean(
    qr && user && user.emailVerified && (isAdmin || user.uid === qr.owner)
  );
  const hasTokenAccess = Boolean(activeToken && activeToken.length >= 16);
  const isEditUnlocked = isAuthorizedOwnerOrAdmin || hasTokenAccess;

  // Sync ?token= query param if URL changes
  useEffect(() => {
    if (urlToken) {
      setActiveToken(urlToken);
      setTokenInput(urlToken);
    }
  }, [urlToken]);

  // Fetch QR record and log scan when opened via scan
  useEffect(() => {
    let active = true;

    async function loadQr() {
      if (!qrId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');
      setNotFound(false);

      try {
        const record = await getQRCodeById(qrId);
        if (!active) return;

        if (!record) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const currentDest = getResolvedDestination(record);
        setQr(record);
        setDestinationInput(currentDest);
        setStatusInput(record.status);
        setResolvedBatchName(record.batchName || '');
        setLoading(false);

        // Record scan once when opened from a QR scan (skip if coming from /r/{id} which already logged it, or dashboard)
        if (!processedScanRef.current && !alreadyScanned && !fromDashboard && record.status === 'active') {
          processedScanRef.current = true;
          const env = parseClientEnvironment();
          recordQRScanAtomic(record, env)
            .then(() => {
              if (!active) return;
              setQr((prev) =>
                prev ? { ...prev, scanCount: (prev.scanCount || 0) + 1 } : prev
              );
            })
            .catch((err) => {
              console.error('Scan telemetry write failed:', err);
            });
        }
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load QR details.');
        setLoading(false);
      }
    }

    loadQr();
    return () => {
      active = false;
    };
  }, [qrId, alreadyScanned, fromDashboard]);

  // Backfill batch name for older batches when signed in
  useEffect(() => {
    if (!qr || !qr.batchId || qr.batchName || !user) return;
    let mounted = true;
    getPrintBatchName(qr.batchId).then((name) => {
      if (mounted && name) setResolvedBatchName(name);
    });
    return () => {
      mounted = false;
    };
  }, [qr, user]);

  const copyWithFeedback = useCallback(
    async (text: string, key: string, toastTitle: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        notify(toastTitle, 'success');
        setTimeout(() => setCopiedKey(null), 2000);
      } catch {
        notify('Unable to copy to clipboard', 'error');
      }
    },
    [notify]
  );

  const handleLoadOrCopySecureLink = async (mode: 'link' | 'token' | 'rotate') => {
    if (!qr || !isAuthorizedOwnerOrAdmin) return;
    setTokenBusy(true);
    try {
      const token =
        mode === 'rotate'
          ? await rotateQREditToken(qr.qrId, qr.owner)
          : ownerToken || (await getOrCreateQREditToken(qr.qrId, qr.owner));
      setOwnerToken(token);
      if (mode === 'rotate') {
        notify('Secure edit token rotated', 'success', 'Previous shared edit links are now revoked.');
      } else if (mode === 'link') {
        await copyWithFeedback(
          getManageQrUrl(qr.qrId, token),
          'secure-link',
          'Secure Quick Edit link copied'
        );
      } else {
        await copyWithFeedback(token, 'secure-token', 'Secure edit token copied');
      }
    } catch (err) {
      notify(
        'Token error',
        'error',
        err instanceof Error ? err.message : 'Could not retrieve edit token.'
      );
    } finally {
      setTokenBusy(false);
    }
  };

  const handleUnlockWithToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (cleaned.length < 16 || !/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
      setTokenError('Enter a valid secure edit token (at least 16 characters).');
      return;
    }
    setTokenError('');
    setSaveError('');
    setActiveToken(cleaned);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('token', cleaned);
    setSearchParams(nextParams, { replace: true });
    notify('Edit token applied', 'success', 'You can now save destination changes.');
  };

  const handleInlineSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      setSignInError('Please enter your email and password.');
      return;
    }
    setSigningIn(true);
    setSignInError('');
    try {
      await signInWithEmailAndPassword(auth, signInEmail.trim(), signInPassword);
      notify('Signed in', 'success', 'Workspace access verified.');
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('invalid-credential')
          ? 'Incorrect email or password.'
          : err instanceof Error
            ? err.message
            : 'Unable to sign in.';
      setSignInError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setSignInError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      notify('Signed in with Google', 'success');
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Google sign-in was cancelled.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qr || !isEditUnlocked) return;

    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const trimmed = destinationInput.trim();
      const normalized =
        trimmed && !/^(https?:\/\/|mailto:|tel:|sms:|upi:|WIFI:|BEGIN:)/i.test(trimmed)
          ? `https://${trimmed}`
          : trimmed;

      if (isAuthorizedOwnerOrAdmin) {
        await updateQRCode(qr.qrId, {
          currentUrl: normalized,
          currentLink: normalized,
          status: statusInput,
        });
      } else {
        await updateQRCodeWithToken(qr.qrId, activeToken, {
          currentUrl: normalized,
          status: statusInput,
        });
      }

      setDestinationInput(normalized);
      setQr((prev) =>
        prev
          ? {
              ...prev,
              currentUrl: normalized,
              currentLink: normalized,
              status: statusInput,
            }
          : prev
      );
      setLocalUpdatedAt(new Date());
      setSaveSuccess(true);
      notify('Link Updated Successfully', 'success', 'Future scans will use this destination immediately.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('insufficient')) {
        setSaveError(
          isAuthorizedOwnerOrAdmin
            ? 'You do not have permission to modify this QR code.'
            : 'Invalid or expired edit token. Verify the token or sign in as the QR owner.'
        );
      } else {
        setSaveError(raw || 'Could not save changes. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const currentSavedDestination = qr ? getResolvedDestination(qr).trim() : '';
  const manageUrl = qr ? getManageQrUrl(qr.qrId) : '';
  const displayBatchName =
    resolvedBatchName || qr?.batchName || (qr?.batchId ? qr.batchId : 'Standalone QR');
  const displayCardNumber = qr?.cardNumber || 'Standard QR';
  const isActive = qr?.status === 'active';

  return (
    <div className="min-h-screen relative bg-[#F5F7FC] dark:bg-[#050711] text-slate-900 dark:text-slate-100 pb-14">
      <AmbientAurora subtle />

      {/* Compact Glass Top Header */}
      <header className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(79,70,229,0.7)]">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <span className="text-sm font-bold tracking-tight text-slate-950 dark:text-white block">
              PulseQR
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Quick QR Edit
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all whitespace-nowrap"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-2xl glass-panel text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-3">
        <PageTransition>
          {loading ? (
            <div className="glass-modal rounded-[30px] p-12 text-center">
              <Loader2 className="w-9 h-9 mx-auto text-blue-600 dark:text-cyan-400 animate-spin" />
              <h1 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
                Identifying Dynamic QR...
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 font-mono-tabular">
                {qrId || 'Resolving'}
              </p>
            </div>
          ) : notFound || loadError || !qr ? (
            <div className="glass-modal rounded-[30px] p-10 text-center max-w-lg mx-auto mt-8">
              <AlertTriangle className="w-10 h-10 mx-auto text-rose-500" />
              <h1 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">
                {notFound ? 'QR Code Not Found' : 'Unable to Load QR Details'}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {notFound
                  ? `No dynamic QR code matches ID "${qrId}". Please scan a valid PulseQR code.`
                  : loadError}
              </p>
              <Link to="/" className="mt-6 btn-gradient-border inline-flex">
                <span className="btn-gradient-inner px-5 py-2.5 text-sm font-semibold">
                  Go to PulseQR Home
                </span>
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Main QR Overview & Live Metadata Glass Card */}
              <section className="glass-modal rounded-[30px] p-6 sm:p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
                  {/* QR Preview */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="p-3.5 rounded-[24px] border border-slate-200/80 dark:border-white/15 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.35)]"
                      style={{ backgroundColor: qr.bgColor || '#FFFFFF' }}
                    >
                      <QRCanvas
                        value={manageUrl}
                        fgColor={qr.customColor || '#0F172A'}
                        bgColor={qr.bgColor || '#FFFFFF'}
                        logo={qr.logo || ''}
                        size={148}
                      />
                    </div>
                    <p className="mt-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 text-center">
                      Permanent Printed QR
                    </p>
                  </div>

                  {/* Metadata Details */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              isActive
                                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                                : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]'
                            }`}
                          />
                          <span
                            className={
                              isActive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {isActive
                              ? 'Active'
                              : qr.status === 'paused'
                                ? 'Inactive (Paused)'
                                : 'Inactive (Archived)'}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">·</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            Dynamic QR
                          </span>
                        </div>
                        <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white truncate">
                          {qr.title || `QR Card ${qr.cardNumber || qr.qrId}`}
                        </h1>
                      </div>

                      {/* Quick Open Destination CTA */}
                      {currentSavedDestination ? (
                        isDirectNavigableUrl(currentSavedDestination) ? (
                          <a
                            href={currentSavedDestination}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-gradient-border inline-flex shrink-0"
                          >
                            <span className="btn-gradient-inner px-4 py-2.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap">
                              Open Destination
                              <ExternalLink className="w-4 h-4" />
                            </span>
                          </a>
                        ) : (
                          <GlassButton
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              copyWithFeedback(
                                currentSavedDestination,
                                'payload',
                                'Destination payload copied'
                              )
                            }
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy Payload
                          </GlassButton>
                        )
                      ) : (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          No destination assigned yet
                        </span>
                      )}
                    </div>

                    {/* Structured Metadata Grid */}
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-2xl glass-panel p-3.5">
                        <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            QR ID
                          </span>
                          <button
                            type="button"
                            onClick={() => copyWithFeedback(qr.qrId, 'qrid', 'QR ID copied')}
                            className="text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 cursor-pointer"
                            title="Copy QR ID"
                          >
                            {copiedKey === 'qrid' ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p
                          className="mt-1.5 text-sm font-bold font-mono-tabular text-slate-950 dark:text-white truncate"
                          title={qr.qrId}
                        >
                          {qr.qrId}
                        </p>
                      </div>

                      <div className="rounded-2xl glass-panel p-3.5">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <Layers className="w-3 h-3" />
                          Batch Name
                        </div>
                        <p
                          className="mt-1.5 text-sm font-semibold text-slate-950 dark:text-white truncate"
                          title={displayBatchName}
                        >
                          {displayBatchName}
                        </p>
                      </div>

                      <div className="rounded-2xl glass-panel p-3.5">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <CreditCard className="w-3 h-3" />
                          Card Number
                        </div>
                        <p
                          className="mt-1.5 text-sm font-bold font-mono-tabular text-slate-950 dark:text-white truncate"
                          title={displayCardNumber}
                        >
                          {displayCardNumber}
                        </p>
                      </div>

                      <div className="rounded-2xl glass-panel p-3.5">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <BarChart3 className="w-3 h-3" />
                          Total Scans
                        </div>
                        <p className="mt-1.5 text-sm font-bold font-mono-tabular text-slate-950 dark:text-white">
                          <AnimatedNumber value={qr.scanCount || 0} />
                        </p>
                      </div>
                    </div>

                    {/* Current Destination & Last Updated Bar */}
                    <div className="mt-3.5 rounded-2xl glass-panel px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                          Current Destination URL
                        </p>
                        {currentSavedDestination ? (
                          <p
                            className="mt-1 text-xs sm:text-sm font-mono-tabular font-semibold text-slate-900 dark:text-slate-100 break-all"
                          >
                            {currentSavedDestination}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 italic">
                            Not assigned yet — enter a URL below to activate immediately.
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 sm:text-right border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-900/8 dark:border-white/[0.08]">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last Updated
                        </p>
                        <p className="mt-0.5 text-xs font-mono-tabular font-semibold text-slate-800 dark:text-slate-200">
                          {formatDateTime(qr.updatedAt, localUpdatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick Edit Form OR Security Unlock Gate */}
              <section className="glass-modal rounded-[30px] p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-900/8 dark:border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                        isEditUnlocked
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-blue-600/15 text-blue-600 dark:text-cyan-400'
                      }`}
                    >
                      {isEditUnlocked ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                        {isEditUnlocked ? 'Quick QR Edit' : 'Verify Access to Edit Destination'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isAuthorizedOwnerOrAdmin
                          ? 'Authenticated as verified owner/admin — instant live updates enabled.'
                          : hasTokenAccess
                            ? 'Authorized with secure QR edit token — changes take effect immediately.'
                            : 'Editing is protected. Sign in as the owner or enter this QR’s secure edit token.'}
                      </p>
                    </div>
                  </div>

                  {isEditUnlocked && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      {isAuthorizedOwnerOrAdmin ? 'Account Verified' : 'Token Active'}
                    </span>
                  )}
                </div>

                {authLoading ? (
                  <div className="py-8 flex items-center justify-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-cyan-400" />
                    Checking security session...
                  </div>
                ) : isEditUnlocked ? (
                  <div className="mt-5 space-y-5">
                    {/* Animated Success Banner */}
                    <AnimatePresence>
                      {saveSuccess && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.28 }}
                          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/12 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5">
                            <SuccessCheckAnimation size={42} />
                            <div>
                              <p className="text-sm sm:text-base font-bold text-emerald-800 dark:text-emerald-300">
                                Link Updated Successfully
                              </p>
                              <p className="text-xs text-emerald-700/90 dark:text-emerald-200/80 mt-0.5">
                                Saved live to Firestore. Your printed QR code never changes — future scans use the new URL immediately.
                              </p>
                            </div>
                          </div>

                          {currentSavedDestination && isDirectNavigableUrl(currentSavedDestination) && (
                            <a
                              href={currentSavedDestination}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all whitespace-nowrap shrink-0"
                            >
                              Open Destination
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Simple Instant Form */}
                    <form onSubmit={handleSaveChanges} className="space-y-4">
                      <div>
                        <label
                          htmlFor="quick-edit-destination-url"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
                        >
                          Destination URL
                        </label>
                        <input
                          id="quick-edit-destination-url"
                          type="text"
                          maxLength={2048}
                          value={destinationInput}
                          onChange={(e) => {
                            setDestinationInput(e.target.value);
                            if (saveSuccess) setSaveSuccess(false);
                          }}
                          placeholder="https://g.page/r/your-business/review"
                          className="w-full px-4 py-3.5 rounded-2xl glass-input text-sm sm:text-base font-mono-tabular"
                        />
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Edit unlimited times. No need to generate or reprint a new QR code.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        {/* Quick Active / Inactive Toggle */}
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Status:
                          </span>
                          <div className="inline-flex rounded-2xl glass-panel p-1">
                            <button
                              type="button"
                              onClick={() => setStatusInput('active')}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                statusInput === 'active'
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                              }`}
                            >
                              Active
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatusInput('paused')}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                statusInput !== 'active'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                              }`}
                            >
                              Inactive
                            </button>
                          </div>
                        </div>

                        {/* Save + Open Destination Buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                          {currentSavedDestination && isDirectNavigableUrl(currentSavedDestination) && (
                            <a
                              href={currentSavedDestination}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl glass-panel text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all whitespace-nowrap"
                            >
                              <ExternalLink className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                              Open Destination
                            </a>
                          )}

                          <GlassButton
                            type="submit"
                            variant="gradient"
                            size="lg"
                            disabled={saving}
                            className="flex-1 sm:flex-none"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                Save Changes
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </GlassButton>
                        </div>
                      </div>

                      {saveError && (
                        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span>{saveError}</span>
                          {!isAuthorizedOwnerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveToken('');
                                setSaveError('');
                              }}
                              className="font-semibold underline whitespace-nowrap cursor-pointer text-left sm:text-right"
                            >
                              Change token or sign in
                            </button>
                          )}
                        </div>
                      )}
                    </form>

                    {/* Owner/Admin Secure Edit Token Bar */}
                    {isAuthorizedOwnerOrAdmin && (
                      <div className="pt-4 border-t border-slate-900/8 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                            Secure Edit Token
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Share a token-authorized link so clients or staff can update this card without logging in.
                          </p>
                          {ownerToken && (
                            <p className="mt-1.5 text-xs font-mono-tabular text-blue-700 dark:text-cyan-300 break-all">
                              {ownerToken}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <GlassButton
                            variant="glass"
                            size="sm"
                            disabled={tokenBusy}
                            onClick={() => handleLoadOrCopySecureLink('link')}
                          >
                            {copiedKey === 'secure-link' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            Copy Secure Edit Link
                          </GlassButton>
                          <GlassButton
                            variant="glass"
                            size="sm"
                            disabled={tokenBusy}
                            onClick={() => handleLoadOrCopySecureLink('token')}
                          >
                            {copiedKey === 'secure-token' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <KeyRound className="w-3.5 h-3.5" />
                            )}
                            Copy Token
                          </GlassButton>
                          <GlassButton
                            variant="glass"
                            size="sm"
                            disabled={tokenBusy}
                            onClick={() => handleLoadOrCopySecureLink('rotate')}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${tokenBusy ? 'animate-spin' : ''}`} />
                            Rotate
                          </GlassButton>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Security Unlock Gate: Fast Inline Sign-In OR Secure Edit Token */
                  <div className="mt-5 space-y-5">
                    {user && !isAuthorizedOwnerOrAdmin && (
                      <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                        {!user.emailVerified
                          ? `Signed in as ${user.email}, but your email is not yet verified. Verify your email or unlock using this QR’s secure edit token.`
                          : `Signed in as ${user.email}, which does not own this QR code. Unlock with this QR’s secure edit token below.`}
                      </div>
                    )}

                    {/* Segmented Unlock Method Switcher */}
                    <div className="inline-flex rounded-2xl glass-panel p-1 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setUnlockTab('token')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          unlockTab === 'token'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Secure Edit Token
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlockTab('signin')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          unlockTab === 'signin'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Owner / Admin Sign In
                      </button>
                    </div>

                    {unlockTab === 'token' ? (
                      <form onSubmit={handleUnlockWithToken} className="space-y-4">
                        <div>
                          <label
                            htmlFor="qr-edit-token-input"
                            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                          >
                            Enter Secure Edit Token
                          </label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              id="qr-edit-token-input"
                              type="text"
                              value={tokenInput}
                              onChange={(e) => {
                                setTokenInput(e.target.value);
                                setTokenError('');
                              }}
                              placeholder="tok_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className="flex-1 px-4 py-3 rounded-2xl glass-input text-sm font-mono-tabular"
                            />
                            <GlassButton type="submit" variant="gradient" size="md">
                              <Unlock className="w-4 h-4" />
                              Unlock Editing
                            </GlassButton>
                          </div>
                          {tokenError && (
                            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                              {tokenError}
                            </p>
                          )}
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            Each Dynamic QR has a unique secret edit token accessible to the QR owner in the dashboard.
                          </p>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <form onSubmit={handleInlineSignIn} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="email"
                            autoComplete="email"
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                            placeholder="Owner email address"
                            className="px-4 py-3 rounded-2xl glass-input text-sm"
                          />
                          <input
                            type="password"
                            autoComplete="current-password"
                            value={signInPassword}
                            onChange={(e) => setSignInPassword(e.target.value)}
                            placeholder="Password"
                            className="px-4 py-3 rounded-2xl glass-input text-sm"
                          />
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                            <GlassButton type="submit" variant="gradient" disabled={signingIn}>
                              {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                              Sign In &amp; Unlock
                            </GlassButton>
                            <GlassButton
                              type="button"
                              variant="glass"
                              disabled={signingIn}
                              onClick={handleGoogleSignIn}
                            >
                              Continue with Google
                            </GlassButton>
                          </div>
                        </form>
                        {signInError && (
                          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                            {signInError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
};
