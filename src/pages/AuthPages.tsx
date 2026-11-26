import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Link2,
  Loader2,
  Moon,
  QrCode,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase/config';
import { useApp } from '../context/AppContext';
import { AmbientAurora, GlassButton, PageTransition } from '../components/GlassUI';

type AuthMode = 'login' | 'signup' | 'forgot';

function mapAuthError(err: unknown): { message: string; enableHint?: boolean } {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return {
      message:
        'Email/Password sign-in is not yet enabled in your Firebase project. Sign in with Google below, or enable Email/Password in Firebase Console → Authentication → Sign-in method.',
      enableHint: true,
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return { message: 'Invalid email or password. Double-check your credentials and try again.' };
  }
  if (code === 'auth/email-already-in-use') {
    return { message: 'An account with this email already exists. Try signing in instead.' };
  }
  if (code === 'auth/weak-password') {
    return { message: 'Password must be at least 6 characters long.' };
  }
  if (code === 'auth/popup-closed-by-user') {
    return { message: 'Sign-in popup was closed before completing authentication.' };
  }
  return { message: err instanceof Error ? err.message : 'Authentication failed. Please try again.' };
}

export const AuthPage: React.FC<{ mode: AuthMode }> = ({ mode }) => {
  const navigate = useNavigate();
  const { notify, theme, toggleTheme } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      notify('Welcome to PulseQR', 'success', 'Signed in with Google.');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(mapAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        notify('Signed in', 'success', 'Welcome back to your QR workspace.');
        navigate('/dashboard');
      } else if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMsg('Please enter your full name.');
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Ignore verification email rate errors
        }
        notify(
          'Account created',
          'success',
          'We sent a verification link to your inbox. Verify to unlock all QR writes.'
        );
        navigate('/dashboard');
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setSuccessMsg('Password reset link sent. Check your email inbox and spam folder.');
        notify('Reset link sent', 'success');
      }
    } catch (err) {
      setErrorMsg(mapAuthError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create your workspace'
        : 'Reset your password';

  const subtitle =
    mode === 'login'
      ? 'Sign in to manage dynamic QR endpoints, custom branding, and live scan telemetry.'
      : mode === 'signup'
        ? 'Launch unlimited dynamic QR codes across 18 formats with instant URL editing.'
        : 'Enter your account email and we will send a secure password recovery link.';

  return (
    <div className="min-h-screen relative flex flex-col justify-center bg-[#F5F7FC] dark:bg-[#050711] text-slate-900 dark:text-slate-100 px-4 py-10 overflow-hidden">
      <AmbientAurora />

      <div className="w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to PulseQR
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-2xl glass-panel text-slate-600 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </div>

        <PageTransition className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Modern SaaS Showcase Panel */}
          <div className="hidden lg:flex lg:col-span-6 glass-panel rounded-[28px] p-9 flex-col justify-between relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-45"
              style={{
                background:
                  'radial-gradient(circle, rgba(59,130,246,0.5), rgba(139,92,246,0.35), transparent 70%)',
              }}
            />

            <div className="relative">
              <div className="inline-flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-md">
                  <QrCode className="w-5 h-5" />
                </span>
                <span className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                  PulseQR
                </span>
              </div>

              <h2 className="mt-8 font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white leading-tight">
                Dynamic QR infrastructure designed for modern teams.
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Replace static printed links with programmable endpoints, branded print exports, and
                real-time analytics.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  {
                    icon: Link2,
                    title: 'Edit destinations anytime',
                    desc: 'Update URLs without changing printed packaging or signage.',
                  },
                  {
                    icon: BarChart3,
                    title: 'Real-time scan intelligence',
                    desc: 'Monitor daily trends, device class, browsers, and top cities.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Firebase-backed security',
                    desc: 'Isolated workspace records with verified authentication and atomic counters.',
                  },
                ].map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div key={feat.title} className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl glass-panel flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {feat.title}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {feat.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="relative pt-6 border-t border-slate-900/6 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
              18 QR Formats · 2048px Print PNG &amp; SVG · Offline-Ready PWA
            </p>
          </div>

          {/* Right Frosted Glass Form Card */}
          <div className="lg:col-span-6 glass-panel rounded-[28px] p-7 sm:p-10 flex flex-col justify-center">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {subtitle}
            </p>

            {mode !== 'forgot' && (
              <div className="mt-7">
                <GlassButton
                  variant="glass"
                  size="lg"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </GlassButton>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-900/8 dark:border-white/[0.1]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 rounded-full bg-white/80 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400">
                      or continue with email
                    </span>
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    {mode === 'login' && (
                      <Link
                        to="/forgot-password"
                        className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-4 py-3 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <GlassButton
                type="submit"
                variant="gradient"
                size="lg"
                disabled={loading}
                className="w-full mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login'
                  ? 'Sign In to Workspace'
                  : mode === 'signup'
                    ? 'Create Free Account'
                    : 'Send Reset Link'}
              </GlassButton>
            </form>

            <div className="mt-7 pt-5 border-t border-slate-900/6 dark:border-white/[0.08] text-center text-xs text-slate-600 dark:text-slate-400">
              {mode === 'login' ? (
                <>
                  New to PulseQR?{' '}
                  <Link
                    to="/signup"
                    className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </PageTransition>
      </div>
    </div>
  );
};
