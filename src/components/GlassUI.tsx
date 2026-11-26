import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

/**
 * Floating luminous background aurora blobs (blue, purple, cyan, pink)
 * carefully tuned for both Light and Dark glassmorphism refraction.
 */
export const AmbientAurora: React.FC<{ subtle?: boolean }> = ({ subtle = false }) => {
  const opacity = subtle
    ? 'opacity-35 dark:opacity-25'
    : 'opacity-55 dark:opacity-40';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {/* Top-Left Blue + Purple Orb */}
      <div
        className={`animate-blob-1 absolute -top-28 -left-24 w-[460px] h-[460px] sm:w-[620px] sm:h-[620px] rounded-full blur-[110px] ${opacity}`}
        style={{
          background:
            'radial-gradient(circle at 35% 35%, rgba(59,130,246,0.52), rgba(139,92,246,0.34) 55%, transparent 75%)',
        }}
      />
      {/* Top-Right Cyan + Blue Orb */}
      <div
        className={`animate-blob-2 absolute top-12 -right-28 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full blur-[115px] ${opacity}`}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.44), rgba(59,130,246,0.28) 55%, transparent 75%)',
        }}
      />
      {/* Lower-Center Pink + Purple Orb */}
      <div
        className={`animate-blob-3 absolute -bottom-36 left-1/3 w-[440px] h-[440px] sm:w-[600px] sm:h-[600px] rounded-full blur-[125px] ${opacity}`}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(236,72,153,0.32), rgba(139,92,246,0.28) 52%, transparent 76%)',
        }}
      />
    </div>
  );
};

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gradient' | 'primary' | 'glass' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Tactile glassmorphism button with pointer-origin ripple micro-interaction
 * and optional animated gradient border for primary calls to action.
 */
export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'glass',
  size = 'md',
  className = '',
  children,
  onClick,
  disabled,
  type = 'button',
  ...rest
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        const rect = e.currentTarget.getBoundingClientRect();
        const sizePx = Math.max(rect.width, rect.height) * 0.45;
        const x = e.clientX - rect.left - sizePx / 2;
        const y = e.clientY - rect.top - sizePx / 2;
        const id = ++nextId.current;
        setRipples((prev) => [...prev, { id, x, y, size: sizePx }]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 560);
      }
      onClick?.(e);
    },
    [disabled, onClick]
  );

  const sizeClasses =
    size === 'sm'
      ? 'px-3.5 py-2 text-xs'
      : size === 'lg'
        ? 'px-6 py-3 text-sm'
        : 'px-4.5 py-2.5 text-sm';

  if (variant === 'gradient') {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={handleClick}
        className={`btn-gradient-border inline-flex items-stretch justify-center disabled:opacity-60 disabled:pointer-events-none cursor-pointer ${className}`}
        {...rest}
      >
        <span
          className={`btn-gradient-inner relative overflow-hidden w-full inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap ${sizeClasses}`}
        >
          {ripples.map((r) => (
            <span
              key={r.id}
              className="ripple-dot"
              style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
            />
          ))}
          {children}
        </span>
      </button>
    );
  }

  const variantClasses =
    variant === 'primary'
      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_10px_28px_-10px_rgba(79,70,229,0.6)] hover:brightness-110'
      : variant === 'danger'
        ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-[0_10px_24px_-10px_rgba(225,29,72,0.5)] hover:brightness-110'
        : variant === 'ghost'
          ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-900/5 dark:hover:bg-white/10'
          : 'glass-panel text-slate-800 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-slate-800/80';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
      {...rest}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-dot"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
      {children}
    </button>
  );
};

/**
 * Smooth animated numeric counter with tabular figures for dashboard KPIs.
 */
export const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  className?: string;
}> = ({ value, decimals = 0, className = '' }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const duration = 520;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString();

  return <span className={`font-mono-tabular ${className}`}>{formatted}</span>;
};

/**
 * Shimmering glass loading skeleton block.
 */
export const GlassSkeleton: React.FC<{ className?: string }> = ({ className = 'h-10 w-full' }) => (
  <div
    className={`glass-shimmer-bar rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 ${className}`}
    aria-hidden="true"
  />
);

/**
 * Smooth compositor-only page entrance wrapper.
 */
export const PageTransition: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

/**
 * Animated SVG success ring & checkmark for creation and submission celebrations.
 */
export const SuccessCheckAnimation: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <motion.div
    initial={{ scale: 0.75, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    className="mx-auto inline-flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 p-3 shadow-[0_0_32px_-8px_rgba(16,185,129,0.45)]"
  >
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <motion.circle
        cx="28"
        cy="28"
        r="24"
        stroke="url(#successGrad)"
        strokeWidth="2.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d="M17 28.5L24.5 36L39 20.5"
        stroke="url(#successGrad)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.36, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      />
      <defs>
        <linearGradient id="successGrad" x1="8" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  </motion.div>
);

/**
 * Elegant minimal glassmorphism empty state component.
 */
export const EmptyStateGlass: React.FC<{
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
    <div className="w-14 h-14 rounded-[20px] glass-panel flex items-center justify-center text-blue-600 dark:text-cyan-400 shadow-sm">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
      {description}
    </p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
