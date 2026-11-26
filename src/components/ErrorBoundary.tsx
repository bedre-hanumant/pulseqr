import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { AmbientAurora } from './GlassUI';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        readable = `Database access error (${parsed.operationType} on ${parsed.path || 'resource'}): ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PulseQR ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen relative flex items-center justify-center bg-[#F5F7FC] dark:bg-[#050711] p-6">
          <AmbientAurora />
          <div className="w-full max-w-lg rounded-[28px] glass-modal p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">
              Something went wrong
            </h1>
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {this.state.message}
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-gradient-border inline-flex cursor-pointer"
              >
                <span className="btn-gradient-inner px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap">
                  <RotateCcw className="w-4 h-4" />
                  Reload Application
                </span>
              </button>
              <a
                href="/"
                className="px-5 py-2.5 rounded-2xl glass-panel text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all whitespace-nowrap"
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
