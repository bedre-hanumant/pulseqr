import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Copy,
  Edit3,
  Plus,
  Printer,
  QrCode,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DashboardLayout } from '../components/DashboardLayout';
import { EditLinkModal } from '../components/EditLinkModal';
import {
  AnimatedNumber,
  EmptyStateGlass,
  GlassSkeleton,
} from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import { subscribeUserQRCodes, subscribeUserScans } from '../firebase/firestore';
import { getQRTypeConfig, getShortUrl } from '../js/qrFormats';
import type { QRCodeRecord, ScanEventRecord } from '../types';

export const DashboardPage: React.FC = () => {
  const { user, theme, notify } = useApp();
  const [qrcodes, setQrcodes] = useState<QRCodeRecord[]>([]);
  const [scans, setScans] = useState<ScanEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQr, setEditingQr] = useState<QRCodeRecord | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let qrsLoaded = false;
    let scansLoaded = false;

    const finishIfReady = () => {
      if (qrsLoaded && scansLoaded) setLoading(false);
    };

    const unsubQRs = subscribeUserQRCodes(
      user.uid,
      (rows) => {
        setQrcodes(rows);
        qrsLoaded = true;
        finishIfReady();
      },
      () => {
        qrsLoaded = true;
        finishIfReady();
      }
    );

    const unsubScans = subscribeUserScans(
      user.uid,
      (rows) => {
        setScans(rows);
        scansLoaded = true;
        finishIfReady();
      },
      () => {
        scansLoaded = true;
        finishIfReady();
      }
    );

    return () => {
      unsubQRs();
      unsubScans();
    };
  }, [user]);

  const metrics = useMemo(() => {
    const totalCodes = qrcodes.length;
    const activeCodes = qrcodes.filter((q) => q.status === 'active').length;
    const totalScans = qrcodes.reduce((sum, q) => sum + (q.scanCount || 0), 0);
    const avgScans = totalCodes > 0 ? totalScans / totalCodes : 0;
    return { totalCodes, activeCodes, totalScans, avgScans };
  }, [qrcodes]);

  const sparklineData = useMemo(() => {
    const now = new Date();
    const days: { key: string; label: string; scans: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString([], { weekday: 'short' }),
        scans: 0,
      });
    }
    scans.forEach((s) => {
      const dt = s.timestamp?.toDate();
      if (!dt) return;
      const target = days.find((d) => d.key === dt.toISOString().slice(0, 10));
      if (target) target.scans += 1;
    });
    return days;
  }, [scans]);

  const topCodes = useMemo(() => {
    return [...qrcodes].sort((a, b) => (b.scanCount || 0) - (a.scanCount || 0)).slice(0, 5);
  }, [qrcodes]);

  const recentScans = useMemo(() => scans.slice(0, 7), [scans]);

  const copyLink = async (qrId: string) => {
    await navigator.clipboard.writeText(getShortUrl(qrId));
    notify('Dynamic link copied', 'success', getShortUrl(qrId));
  };

  const statCards = [
    {
      label: 'Total QR Codes',
      value: metrics.totalCodes,
      decimals: 0,
      note: 'Dynamic endpoints active',
      icon: QrCode,
      accent: 'from-blue-500/18 to-cyan-500/12 text-blue-600 dark:text-cyan-400',
    },
    {
      label: 'Total Scans',
      value: metrics.totalScans,
      decimals: 0,
      note: 'Verified atomic redirects',
      icon: Activity,
      accent: 'from-violet-500/18 to-pink-500/12 text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Active QR Codes',
      value: metrics.activeCodes,
      decimals: 0,
      note: 'Resolving traffic live',
      icon: Zap,
      accent: 'from-cyan-500/18 to-emerald-500/12 text-cyan-600 dark:text-emerald-400',
    },
    {
      label: 'Avg. Scans per QR',
      value: metrics.avgScans,
      decimals: 1,
      note: 'Mean campaign velocity',
      icon: TrendingUp,
      accent: 'from-pink-500/18 to-blue-500/12 text-pink-600 dark:text-pink-400',
    },
  ];

  return (
    <DashboardLayout
      title="Overview"
      breadcrumb="Dashboard"
      primaryAction={
        <Link to="/create" className="btn-gradient-border inline-flex">
          <span className="btn-gradient-inner px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" />
            New QR Code
          </span>
        </Link>
      }
    >
      {/* Animated Glass KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="glass-panel glass-card-interactive rounded-[24px] p-6 relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <div
                  className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${stat.accent} flex items-center justify-center shrink-0`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              {loading ? (
                <GlassSkeleton className="mt-3 h-9 w-24" />
              ) : (
                <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
                  <AnimatedNumber value={stat.value} decimals={stat.decimals} />
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stat.note}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions & 7-Day Velocity Widget */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/create"
            className="glass-panel glass-card-interactive rounded-[22px] p-5 flex flex-col justify-between gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600/15 to-cyan-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Create Dynamic QR
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                18 formats · Brand logo
              </p>
            </div>
          </Link>

          <Link
            to="/bulk-print"
            className="glass-panel glass-card-interactive rounded-[22px] p-5 flex flex-col justify-between gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600/15 to-pink-500/15 text-violet-600 dark:text-pink-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Bulk Print Cards
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                300 DPI A4 PDF · 1,000+ QRs
              </p>
            </div>
          </Link>

          <Link
            to="/analytics"
            className="glass-panel glass-card-interactive rounded-[22px] p-5 flex flex-col justify-between gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-blue-600/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Scan Telemetry
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Devices · Cities · Trends
              </p>
            </div>
          </Link>
        </div>

        {/* 7-Day Mini Scan Velocity Sparkline */}
        <div className="lg:col-span-5 glass-panel rounded-[24px] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                7-Day Scan Pulse
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                Live redirect velocity
              </p>
            </div>
            <Link
              to="/analytics"
              className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
            >
              Deep dive
            </Link>
          </div>

          <div className="h-24 w-full mt-3">
            {loading ? (
              <GlassSkeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashSparkStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="50%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                    <linearGradient id="dashSparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      backgroundColor:
                        theme === 'dark' ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.94)',
                      borderColor:
                        theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
                      borderRadius: 14,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="scans"
                    stroke="url(#dashSparkStroke)"
                    strokeWidth={2.5}
                    fill="url(#dashSparkFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="mt-7 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Performing QR Codes */}
        <div className="lg:col-span-7 glass-panel rounded-[26px] overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-900/6 dark:border-white/[0.08] flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Top Performing QR Codes
            </h2>
            <Link
              to="/my-qrs"
              className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
            >
              Manage all
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3.5">
              {[1, 2, 3, 4].map((i) => (
                <GlassSkeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : topCodes.length === 0 ? (
            <EmptyStateGlass
              icon={QrCode}
              title="No dynamic QR codes yet"
              description="Create your first dynamic QR code to start routing links and collecting live scan analytics."
              action={
                <Link to="/create" className="btn-gradient-border inline-flex">
                  <span className="btn-gradient-inner px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Create First QR Code
                  </span>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900/6 dark:border-white/[0.07] text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-6 font-medium">QR Code</th>
                    <th className="py-3.5 px-4 font-medium">Type</th>
                    <th className="py-3.5 px-4 font-medium">Status</th>
                    <th className="py-3.5 px-4 font-medium text-right">Scans</th>
                    <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/5 dark:divide-white/[0.06] text-sm">
                  {topCodes.map((qr) => (
                    <tr
                      key={qr.qrId}
                      className="hover:bg-white/50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-4 px-6 max-w-[220px]">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {qr.title}
                        </p>
                        <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {qr.qrId}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {getQRTypeConfig(qr.qrType).label}
                      </td>
                      <td className="py-4 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            qr.status === 'active'
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : qr.status === 'paused'
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-slate-500 dark:text-slate-400 font-medium'
                          }
                        >
                          {qr.status.charAt(0).toUpperCase() + qr.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono-tabular font-semibold text-slate-950 dark:text-white">
                        {(qr.scanCount || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingQr(qr)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600/12 dark:bg-cyan-400/15 text-blue-700 dark:text-cyan-300 text-xs font-semibold hover:bg-blue-600/20 transition-colors cursor-pointer whitespace-nowrap"
                            title="Edit destination URL immediately"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit Link
                          </button>
                          <button
                            type="button"
                            onClick={() => copyLink(qr.qrId)}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Copy dynamic redirect link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/manage/${encodeURIComponent(qr.qrId)}?from=dashboard`}
                            target="_blank"
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors"
                            title="Open Quick QR Edit page"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Scan Activity Feed */}
        <div className="lg:col-span-5 glass-panel rounded-[26px] overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-900/6 dark:border-white/[0.08] flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Recent Scan Activity
            </h2>
            <Link
              to="/analytics"
              className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
            >
              Full log
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3.5">
              {[1, 2, 3, 4].map((i) => (
                <GlassSkeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentScans.length === 0 ? (
            <EmptyStateGlass
              icon={Activity}
              title="Waiting for first scan"
              description="Open any dynamic redirect link or scan a printed code to watch live telemetry stream in."
            />
          ) : (
            <div className="divide-y divide-slate-900/5 dark:divide-white/[0.06]">
              {recentScans.map((scan) => (
                <div
                  key={scan.scanId}
                  className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/40 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {scan.qrTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {scan.deviceType} · {scan.browser} · {scan.city}, {scan.country}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                    {scan.timestamp
                      ? scan.timestamp.toDate().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <EditLinkModal
        qr={editingQr}
        onClose={() => setEditingQr(null)}
        onSaved={() => notify('Destination link updated', 'success', 'Changes are live immediately.')}
      />
    </DashboardLayout>
  );
};
