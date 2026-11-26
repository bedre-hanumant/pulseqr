import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { AmbientAurora, GlassButton, PageTransition } from '../components/GlassUI';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F5F7FC] dark:bg-[#050711] p-6">
      <AmbientAurora />
      <PageTransition className="w-full max-w-md">
        <div className="glass-modal rounded-[28px] p-9 text-center">
          <p className="font-mono-tabular text-5xl font-bold text-aurora">404</p>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-white">
            Page not found
          </h1>
          <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The page or dynamic QR route you requested does not exist or has been moved.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link to="/" className="btn-gradient-border inline-flex">
              <span className="btn-gradient-inner px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return Home
              </span>
            </Link>
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-2xl glass-panel text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </PageTransition>
    </div>
  );
};

export const ServerErrorPage: React.FC = () => {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F5F7FC] dark:bg-[#050711] p-6">
      <AmbientAurora />
      <PageTransition className="w-full max-w-md">
        <div className="glass-modal rounded-[28px] p-9 text-center">
          <p className="font-mono-tabular text-5xl font-bold text-rose-600 dark:text-rose-400">
            500
          </p>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-white">
            Service interruption
          </h1>
          <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            An unexpected error prevented PulseQR from completing your request. Please reload or
            return to the dashboard.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <GlassButton variant="gradient" onClick={() => window.location.reload()}>
              <RotateCcw className="w-4 h-4" />
              Try Again
            </GlassButton>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-2xl glass-panel text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all"
            >
              Home
            </Link>
          </div>
        </div>
      </PageTransition>
    </div>
  );
};
