import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { checkIsAdmin, ensureUserProfile } from '../firebase/firestore';
import type { ToastItem, UserProfile } from '../types';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface AppContextValue {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
  toasts: ToastItem[];
  notify: (title: string, variant?: ToastItem['variant'], description?: string) => void;
  dismissToast: (id: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  refreshAuthUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    opts: ConfirmOptions;
    resolver?: (val: boolean) => void;
  }>({
    open: false,
    opts: { title: '', message: '' },
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  const setThemeMode = useCallback((mode: 'light' | 'dark') => {
    setTheme(mode);
    try {
      localStorage.setItem('pulseqr_theme', mode);
    } catch {
      // Ignore storage errors
    }
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setThemeMode]);

  const notify = useCallback(
    (title: string, variant: ToastItem['variant'] = 'info', description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, variant, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, opts, resolver: resolve });
    });
  }, []);

  const handleConfirmClose = (accepted: boolean) => {
    const resolver = confirmState.resolver;
    setConfirmState({ open: false, opts: { title: '', message: '' } });
    resolver?.(accepted);
  };

  const syncProfile = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    try {
      const prof = await ensureUserProfile({
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || '',
        emailVerified: firebaseUser.emailVerified,
      });
      setProfile(prof);
      const adminFlag = await checkIsAdmin(
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.emailVerified
      );
      setIsAdmin(adminFlag);
    } catch (err) {
      console.error('Failed to sync user profile:', err);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await syncProfile(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [syncProfile]);

  const refreshAuthUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setUser(updated ? ({ ...updated } as User) : null);
    await syncProfile(auth.currentUser);
  }, [syncProfile]);

  const refreshProfile = useCallback(async () => {
    await syncProfile(auth.currentUser);
  }, [syncProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    notify('Signed out', 'info', 'Your session has ended cleanly.');
  }, [notify]);

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        authLoading,
        theme,
        toggleTheme,
        setThemeMode,
        toasts,
        notify,
        dismissToast,
        confirm,
        refreshAuthUser,
        refreshProfile,
        logout,
      }}
    >
      {children}

      {/* Global Glass Confirmation Dialog */}
      {confirmState.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[28px] glass-modal p-7">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {confirmState.opts.title}
            </h3>
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmState.opts.message}
            </p>
            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2.5 text-sm font-medium rounded-2xl glass-panel text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-5 py-2.5 text-sm font-semibold rounded-2xl text-white transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                  confirmState.opts.danger
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 shadow-[0_10px_24px_-10px_rgba(225,29,72,0.6)] hover:brightness-110'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-[0_10px_24px_-10px_rgba(79,70,229,0.6)] hover:brightness-110'
                }`}
              >
                {confirmState.opts.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
