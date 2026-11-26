import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { QRCanvas } from '../components/QRCanvas';
import {
  EmptyStateGlass,
  GlassButton,
  GlassSkeleton,
} from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import { deleteQRCode, subscribeUserQRCodes, updateQRCode } from '../firebase/firestore';
import { uploadImageAsset } from '../firebase/storage';
import { getDynamicRedirectUrl, getQRTypeConfig, getShortUrl, QR_TYPES } from '../js/qrFormats';
import { downloadQRPng, downloadQRSvg } from '../js/exportQr';
import type { QRCodeRecord, QRStatus } from '../types';

export const MyQRCodesPage: React.FC = () => {
  const { user, notify, confirm } = useApp();
  const [qrcodes, setQrcodes] = useState<QRCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QRStatus>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Edit modal state
  const [editing, setEditing] = useState<QRCodeRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editColor, setEditColor] = useState('#0F172A');
  const [editBg, setEditBg] = useState('#FFFFFF');
  const [editLogo, setEditLogo] = useState('');
  const [editStatus, setEditStatus] = useState<QRStatus>('active');
  const [editExpiry, setEditExpiry] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeUserQRCodes(
      user.uid,
      (rows) => {
        setQrcodes(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return qrcodes.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (typeFilter !== 'all' && item.qrType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.qrId.toLowerCase().includes(q) ||
        item.currentLink.toLowerCase().includes(q)
      );
    });
  }, [qrcodes, search, statusFilter, typeFilter]);

  const openEditModal = (qr: QRCodeRecord) => {
    if (qr.status === 'archived') {
      notify('Archived QR locked', 'info', 'Archived codes are immutable. Contact an admin to restore.');
      return;
    }
    setEditing(qr);
    setEditTitle(qr.title);
    setEditLink(qr.currentLink);
    setEditColor(qr.customColor);
    setEditBg(qr.bgColor);
    setEditLogo(qr.logo);
    setEditStatus(qr.status);
    setEditExpiry(qr.expiryDate);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateQRCode(editing.qrId, {
        title: editTitle,
        currentLink: editLink,
        customColor: editColor,
        bgColor: editBg,
        logo: editLogo,
        status: editStatus,
        expiryDate: editExpiry,
      });
      notify('QR Code updated', 'success', 'All future scans now route to the updated destination.');
      setEditing(null);
    } catch (err) {
      notify('Update failed', 'error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTogglePause = async (qr: QRCodeRecord) => {
    if (qr.status === 'archived') return;
    const nextStatus: QRStatus = qr.status === 'active' ? 'paused' : 'active';
    try {
      await updateQRCode(qr.qrId, { status: nextStatus });
      notify(
        nextStatus === 'active' ? 'QR Code resumed' : 'QR Code paused',
        'info',
        `${qr.title} is now ${nextStatus}.`
      );
    } catch (err) {
      notify('Action failed', 'error', err instanceof Error ? err.message : 'Check permissions.');
    }
  };

  const handleDelete = async (qr: QRCodeRecord) => {
    const ok = await confirm({
      title: `Delete "${qr.title}"?`,
      message:
        'Printed QR codes pointing to this ID will stop resolving immediately. This action cannot be undone.',
      confirmLabel: 'Delete QR Code',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteQRCode(qr.qrId);
      notify('QR Code deleted', 'success');
    } catch (err) {
      notify('Delete failed', 'error', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleEditLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const { url } = await uploadImageAsset(file, 'logos', user.uid);
      setEditLogo(url);
      notify('Logo updated', 'success');
    } catch (err) {
      notify('Logo upload failed', 'error', err instanceof Error ? err.message : 'Try a smaller file.');
    }
  };

  const copyText = async (val: string, label: string) => {
    await navigator.clipboard.writeText(val);
    notify(`${label} copied`, 'success');
  };

  return (
    <DashboardLayout
      title="My QR Codes"
      breadcrumb="My QR Codes"
      primaryAction={
        <Link to="/create" className="btn-gradient-border inline-flex">
          <span className="btn-gradient-inner px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" />
            Create QR
          </span>
        </Link>
      }
    >
      {/* Frosted Search & Filter Bar */}
      <div className="glass-panel rounded-[24px] p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, QR ID, or destination URL..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl glass-input text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel">
            {(['all', 'active', 'paused', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl capitalize transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl glass-input text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="all">All 18 Types</option>
            {QR_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Elegant Hover-Lift QR Cards */}
      {loading ? (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <GlassSkeleton key={n} className="h-52 rounded-[26px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 glass-panel rounded-[26px]">
          <EmptyStateGlass
            icon={QrCode}
            title={qrcodes.length === 0 ? 'No QR codes created yet' : 'No matching QR codes'}
            description={
              qrcodes.length === 0
                ? 'Generate your first dynamic QR code to start routing destinations and tracking scans.'
                : 'Adjust your search query or status filter to locate other dynamic codes.'
            }
            action={
              qrcodes.length === 0 ? (
                <Link to="/create" className="btn-gradient-border inline-flex">
                  <span className="btn-gradient-inner px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Create First QR
                  </span>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filtered.map((qr) => {
            const redirectUrl = getDynamicRedirectUrl(qr.qrId);
            const shortUrl = getShortUrl(qr.qrId);
            return (
              <div
                key={qr.qrId}
                className="glass-panel glass-card-interactive rounded-[26px] p-5 sm:p-6 flex flex-col sm:flex-row gap-5 justify-between"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className="p-2.5 rounded-[20px] border border-slate-200/80 dark:border-white/15 shadow-sm shrink-0"
                    style={{ backgroundColor: qr.bgColor }}
                  >
                    <QRCanvas
                      value={redirectUrl}
                      fgColor={qr.customColor}
                      bgColor={qr.bgColor}
                      logo={qr.logo}
                      size={108}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-950 dark:text-white truncate">
                      {qr.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                      <span>{getQRTypeConfig(qr.qrType).label}</span>
                      <span>·</span>
                      <span
                        className={
                          qr.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : qr.status === 'paused'
                              ? 'text-amber-600 dark:text-amber-400 font-semibold'
                              : 'text-slate-500 font-medium'
                        }
                      >
                        {qr.status.charAt(0).toUpperCase() + qr.status.slice(1)}
                      </span>
                      <span>·</span>
                      <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                        {(qr.scanCount || 0).toLocaleString()} scans
                      </span>
                    </p>

                    <p
                      className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 truncate"
                      title={qr.currentUrl || qr.currentLink}
                    >
                      Destination:{' '}
                      <span className="font-mono-tabular">
                        {qr.currentUrl || qr.currentLink || 'Unassigned'}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular truncate">
                      ID: {qr.qrId}
                      {qr.cardNumber ? ` · ${qr.cardNumber}` : ''}
                      {qr.expiryDate
                        ? ` · Expires ${new Date(qr.expiryDate).toLocaleDateString()}`
                        : ''}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <GlassButton variant="primary" size="sm" onClick={() => openEditModal(qr)}>
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Link
                      </GlassButton>
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => copyText(redirectUrl, 'Redirect link')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </GlassButton>
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => copyText(shortUrl, 'Short URL')}
                      >
                        Short URL
                      </GlassButton>
                      <Link
                        to={`/manage/${encodeURIComponent(qr.qrId)}?from=dashboard`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl glass-panel text-xs font-semibold hover:bg-white/90 dark:hover:bg-slate-800/80 whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Quick Edit
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Right Utility Stack */}
                <div className="flex sm:flex-col items-center justify-end sm:justify-between gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-900/6 dark:border-white/[0.08] pt-3 sm:pt-0 sm:pl-4 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      downloadQRPng(
                        {
                          value: redirectUrl,
                          fgColor: qr.customColor,
                          bgColor: qr.bgColor,
                          logo: qr.logo,
                        },
                        qr.qrId,
                        false
                      )
                    }
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Download PNG (1024px)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadQRPng(
                        {
                          value: redirectUrl,
                          fgColor: qr.customColor,
                          bgColor: qr.bgColor,
                          logo: qr.logo,
                        },
                        qr.qrId,
                        true
                      )
                    }
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Download High-Res Printable PNG (2048px)"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadQRSvg(
                        {
                          value: redirectUrl,
                          fgColor: qr.customColor,
                          bgColor: qr.bgColor,
                          logo: qr.logo,
                        },
                        qr.qrId
                      )
                    }
                    className="px-2 py-1.5 rounded-xl text-[11px] font-mono-tabular font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Download Vector SVG"
                  >
                    SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePause(qr)}
                    disabled={qr.status === 'archived'}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
                    title={qr.status === 'active' ? 'Pause QR' : 'Resume QR'}
                  >
                    {qr.status === 'active' ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(qr)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete QR"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Frosted Glass Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[28px] glass-modal p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-900/8 dark:border-white/[0.1]">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white">
                  Edit Dynamic QR Code
                </h2>
                <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                  ID: {editing.qrId} (permanent printed link)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Current Destination URL / Payload
                </label>
                <textarea
                  rows={3}
                  maxLength={2048}
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  placeholder="https://g.page/r/your-business/review"
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as QRStatus)}
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived (Locks edits)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="datetime-local"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Foreground Hex
                  </label>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-slate-200 dark:border-white/15 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Background Hex
                  </label>
                  <input
                    type="color"
                    value={editBg}
                    onChange={(e) => setEditBg(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-slate-200 dark:border-white/15 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl glass-panel text-xs font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  {editLogo ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleEditLogoUpload} />
                </label>
                {editLogo && (
                  <button
                    type="button"
                    onClick={() => setEditLogo('')}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    Remove logo
                  </button>
                )}
              </div>

              <div className="pt-5 border-t border-slate-900/8 dark:border-white/[0.1] flex items-center justify-end gap-3">
                <GlassButton variant="glass" onClick={() => setEditing(null)}>
                  Cancel
                </GlassButton>
                <GlassButton type="submit" variant="gradient" disabled={savingEdit}>
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
