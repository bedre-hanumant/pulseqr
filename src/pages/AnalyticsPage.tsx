import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Globe2, Laptop, QrCode } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import {
  AnimatedNumber,
  EmptyStateGlass,
  GlassSkeleton,
} from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import { subscribeUserQRCodes, subscribeUserScans } from '../firebase/firestore';
import type { QRCodeRecord, ScanEventRecord } from '../types';

type TimeRange = 'daily' | 'weekly' | 'monthly';

const BROWSER_GRADIENTS = [
  'from-blue-500 to-cyan-400',
  'from-violet-500 to-pink-500',
  'from-cyan-500 to-emerald-400',
  'from-indigo-500 to-blue-400',
  'from-pink-500 to-rose-400',
];

export const AnalyticsPage: React.FC = () => {
  const { user, theme } = useApp();
  const [qrcodes, setQrcodes] = useState<QRCodeRecord[]>([]);
  const [scans, setScans] = useState<ScanEventRecord[]>([]);
  const [selectedQrId, setSelectedQrId] = useState<string>('all');
  const [range, setRange] = useState<TimeRange>('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeUserQRCodes(user.uid, (rows) => setQrcodes(rows));
    const unsub2 = subscribeUserScans(
      user.uid,
      (rows) => {
        setScans(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  const filteredScans = useMemo(() => {
    if (selectedQrId === 'all') return scans;
    return scans.filter((s) => s.qrId === selectedQrId);
  }, [scans, selectedQrId]);

  const timeSeriesData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; scans: number }[] = [];

    if (range === 'daily') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets.push({
          key,
          label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          scans: 0,
        });
      }
      filteredScans.forEach((s) => {
        const dt = s.timestamp?.toDate();
        if (!dt) return;
        const key = dt.toISOString().slice(0, 10);
        const target = buckets.find((b) => b.key === key);
        if (target) target.scans += 1;
      });
    } else if (range === 'weekly') {
      for (let w = 7; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(now.getDate() - w * 7);
        buckets.push({
          key: `w-${w}`,
          label: `Wk ${start.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
          scans: 0,
        });
      }
      filteredScans.forEach((s) => {
        const dt = s.timestamp?.toDate();
        if (!dt) return;
        const diffDays = Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
        const wkIdx = Math.floor(diffDays / 7);
        if (wkIdx >= 0 && wkIdx < 8) {
          buckets[7 - wkIdx].scans += 1;
        }
      });
    } else {
      for (let m = 5; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.push({
          key,
          label: d.toLocaleDateString([], { month: 'short', year: '2-digit' }),
          scans: 0,
        });
      }
      filteredScans.forEach((s) => {
        const dt = s.timestamp?.toDate();
        if (!dt) return;
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const target = buckets.find((b) => b.key === key);
        if (target) target.scans += 1;
      });
    }

    return buckets;
  }, [filteredScans, range]);

  const aggregateBy = (getter: (s: ScanEventRecord) => string) => {
    const map = new Map<string, number>();
    filteredScans.forEach((s) => {
      const k = getter(s) || 'Unknown';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  };

  const devices = useMemo(() => aggregateBy((s) => s.deviceType), [filteredScans]);
  const browsers = useMemo(() => aggregateBy((s) => s.browser), [filteredScans]);
  const locations = useMemo(() => aggregateBy((s) => `${s.city}, ${s.country}`), [filteredScans]);
  const topQRs = useMemo(
    () => [...qrcodes].sort((a, b) => (b.scanCount || 0) - (a.scanCount || 0)).slice(0, 6),
    [qrcodes]
  );

  const uniqueCities = useMemo(() => {
    const set = new Set(filteredScans.map((s) => `${s.city}|${s.country}`));
    return set.size;
  }, [filteredScans]);

  const mobilePct = useMemo(() => {
    if (filteredScans.length === 0) return 0;
    const mob = filteredScans.filter((s) => s.deviceType === 'Mobile').length;
    return Math.round((mob / filteredScans.length) * 100);
  }, [filteredScans]);

  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(13,18,34,0.92)' : 'rgba(255,255,255,0.95)',
    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)',
    borderRadius: 16,
    boxShadow: '0 16px 40px -12px rgba(0,0,0,0.35)',
    fontSize: 12,
  };

  return (
    <DashboardLayout
      title="Scan Analytics"
      breadcrumb="Analytics"
      primaryAction={
        <select
          value={selectedQrId}
          onChange={(e) => setSelectedQrId(e.target.value)}
          className="px-3.5 py-2 rounded-2xl glass-input text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[190px]"
        >
          <option value="all">All QR Codes</option>
          {qrcodes.map((q) => (
            <option key={q.qrId} value={q.qrId}>
              {q.title}
            </option>
          ))}
        </select>
      }
    >
      {/* Top Animated Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="glass-panel rounded-[24px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Recorded Scans
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-950 dark:text-white">
              <AnimatedNumber value={filteredScans.length} />
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600/15 to-cyan-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel rounded-[24px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Unique Regions
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-950 dark:text-white">
              <AnimatedNumber value={uniqueCities} />
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600/15 to-pink-500/15 text-violet-600 dark:text-pink-400 flex items-center justify-center">
            <Globe2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel rounded-[24px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Mobile Share
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-950 dark:text-white">
              <AnimatedNumber value={mobilePct} />%
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-emerald-500/15 text-cyan-600 dark:text-emerald-400 flex items-center justify-center">
            <Laptop className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Futuristic Multi-Stop Gradient Area Graph */}
      <div className="glass-panel rounded-[28px] p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Live Scan Telemetry
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
              {filteredScans.length.toLocaleString()} verified events across selected scope
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel">
            {(['daily', 'weekly', 'monthly'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl capitalize transition-all whitespace-nowrap cursor-pointer ${
                  range === r
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 w-full">
          {loading ? (
            <GlassSkeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="auroraStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="40%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="auroraFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.38} />
                    <stop offset="55%" stopColor="#3B82F6" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={axisColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="url(#auroraStroke)"
                  strokeWidth={3}
                  fill="url(#auroraFill)"
                  activeDot={{ r: 6, stroke: '#06B6D4', strokeWidth: 2, fill: '#FFFFFF' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Types */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-7">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Device Types</h3>
          <div className="mt-4 h-60">
            {devices.length === 0 ? (
              <EmptyStateGlass
                icon={Laptop}
                title="No device data yet"
                description="Device class splits appear once scans are logged."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={devices} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <defs>
                    <linearGradient id="deviceBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="55%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" stroke={axisColor} fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke={axisColor} fontSize={12} width={74} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    fill="url(#deviceBarGrad)"
                    radius={[0, 10, 10, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Browser Distribution */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-7">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Browsers</h3>
          <div className="mt-5 space-y-4">
            {browsers.length === 0 ? (
              <EmptyStateGlass
                icon={Globe2}
                title="No browser telemetry yet"
                description="Browser distribution populates automatically with each scan."
              />
            ) : (
              browsers.map((b, idx) => {
                const pct = Math.round((b.count / Math.max(1, filteredScans.length)) * 100);
                const grad = BROWSER_GRADIENTS[idx % BROWSER_GRADIENTS.length];
                return (
                  <div key={b.name}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {b.name}
                      </span>
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                        {b.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-900/6 dark:bg-white/[0.08] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Geography */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-7">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
            Top Cities &amp; Countries
          </h3>
          {locations.length === 0 ? (
            <EmptyStateGlass
              icon={Globe2}
              title="No locations yet"
              description="Geographic insights appear after your first dynamic QR scan."
            />
          ) : (
            <div className="mt-4 divide-y divide-slate-900/5 dark:divide-white/[0.06]">
              {locations.map((loc) => (
                <div key={loc.name} className="py-3 flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200 truncate">{loc.name}</span>
                  <span className="font-mono-tabular font-semibold text-slate-950 dark:text-white">
                    {loc.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Performing QRs */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-7">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
            Top Performing QR Codes
          </h3>
          {topQRs.length === 0 ? (
            <EmptyStateGlass
              icon={QrCode}
              title="No QR codes ranked"
              description="Create dynamic QR codes to compare their scan velocity."
            />
          ) : (
            <div className="mt-4 divide-y divide-slate-900/5 dark:divide-white/[0.06]">
              {topQRs.map((qr) => (
                <div
                  key={qr.qrId}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {qr.title}
                    </p>
                    <p className="text-xs font-mono-tabular text-slate-500 truncate">{qr.qrId}</p>
                  </div>
                  <span className="font-mono-tabular font-semibold text-slate-950 dark:text-white shrink-0">
                    {(qr.scanCount || 0).toLocaleString()} scans
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
