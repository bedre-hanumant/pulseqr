import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';
import { OfflineIndicator } from './components/PWAInstallButton';
import { AmbientAurora } from './components/GlassUI';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { CreateQRPage } from './pages/CreateQRPage';
import { MyQRCodesPage } from './pages/MyQRCodesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BulkPrintCardsPage } from './pages/BulkPrintCardsPage';
import { ManageQRCardsPage } from './pages/ManageQRCardsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ContactPage } from './pages/ContactPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { RedirectPage } from './pages/RedirectPage';
import { QuickQREditPage } from './pages/QuickQREditPage';
import { NotFoundPage, ServerErrorPage } from './pages/ErrorPages';

const FullscreenLoader: React.FC = () => (
  <div className="relative min-h-screen flex items-center justify-center bg-[#F5F7FC] dark:bg-[#050711] overflow-hidden">
    <AmbientAurora subtle />
    <div className="relative z-10 glass-panel rounded-[24px] p-5 flex items-center gap-3">
      <Loader2 className="w-5 h-5 text-blue-600 dark:text-cyan-400 animate-spin" />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 tracking-tight">
        Loading PulseQR...
      </span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authLoading } = useApp();
  if (authLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, authLoading } = useApp();
  if (authLoading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const GuestOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authLoading } = useApp();
  if (authLoading) return <FullscreenLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/login"
              element={
                <GuestOnlyRoute>
                  <AuthPage mode="login" />
                </GuestOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <GuestOnlyRoute>
                  <AuthPage mode="signup" />
                </GuestOnlyRoute>
              }
            />
            <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />

            {/* Public Dynamic QR Quick Edit & Legacy Scan Routes */}
            <Route path="/manage/:qrId" element={<QuickQREditPage />} />
            <Route path="/redirect" element={<RedirectPage />} />
            <Route path="/r/:id" element={<RedirectPage />} />

            {/* Authenticated SaaS Workspace Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <CreateQRPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-qrs"
              element={
                <ProtectedRoute>
                  <MyQRCodesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulk-print"
              element={
                <ProtectedRoute>
                  <BulkPrintCardsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manage-cards"
              element={
                <ProtectedRoute>
                  <ManageQRCardsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/contact" element={<ContactPage />} />

            {/* Admin Panel */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPanelPage />
                </AdminRoute>
              }
            />

            {/* Error Pages */}
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <ToastContainer />
          <OfflineIndicator />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
