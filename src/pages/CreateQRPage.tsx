import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Layers,
  Loader2,
  Printer,
  Trash2,
  Upload,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { QRCanvas } from '../components/QRCanvas';
import {
  EmptyStateGlass,
  GlassButton,
  SuccessCheckAnimation,
} from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import { createBulkQRCodes, createQRCode, sanitizeSlug } from '../firebase/firestore';
import { uploadImageAsset, uploadMediaFile } from '../firebase/storage';
import {
  getDynamicRedirectUrl,
  getQRTypeConfig,
  getShortUrl,
  QR_TYPES,
} from '../js/qrFormats';
import { downloadBulkQRZip, downloadQRPng, downloadQRSvg } from '../js/exportQr';
import type { QRCodeRecord, QRType } from '../types';

const COLOR_PRESETS = [
  { name: 'Obsidian', fg: '#0F172A', bg: '#FFFFFF' },
  { name: 'Cobalt', fg: '#2563EB', bg: '#FFFFFF' },
  { name: 'Violet', fg: '#7C3AED', bg: '#FFFFFF' },
  { name: 'Cyan', fg: '#0891B2', bg: '#FFFFFF' },
  { name: 'Rose', fg: '#DB2777', bg: '#FFFFFF' },
  { name: 'Inverted', fg: '#F8FAFC', bg: '#0F172A' },
];

export const CreateQRPage: React.FC = () => {
  const { user, notify } = useApp();
  const [searchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'bulk' ? 'bulk' : 'single';
  const initialTypeParam = searchParams.get('type') as QRType | null;
  const validInitialType: QRType = QR_TYPES.some((t) => t.type === initialTypeParam)
    ? (initialTypeParam as QRType)
    : 'website';

  const [mode, setMode] = useState<'single' | 'bulk'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<
    'All' | 'Links' | 'Communication' | 'Social' | 'Media' | 'Utility'
  >('All');
  const [qrType, setQrType] = useState<QRType>(validInitialType);
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [customColor, setCustomColor] = useState(
    () => localStorage.getItem('pulseqr_default_fg') || '#0F172A'
  );
  const [bgColor, setBgColor] = useState(
    () => localStorage.getItem('pulseqr_default_bg') || '#FFFFFF'
  );
  const [logo, setLogo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdQR, setCreatedQR] = useState<QRCodeRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk state
  const [bulkInput, setBulkInput] = useState(
    'Spring Menu, https://example.com/menu, website\nStorefront Review, https://g.page/r/example/review, google_review\nEvent Check-In, https://example.com/rsvp, google_form'
  );
  const [bulkColor, setBulkColor] = useState('#0F172A');
  const [bulkBg, setBulkBg] = useState('#FFFFFF');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<QRCodeRecord[]>([]);

  const typeConfig = useMemo(() => getQRTypeConfig(qrType), [qrType]);
  const visibleTypes = useMemo(() => {
    if (selectedCategory === 'All') return QR_TYPES;
    return QR_TYPES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const builtPayload = useMemo(() => typeConfig.buildPayload(fieldValues), [typeConfig, fieldValues]);

  const previewUrl = useMemo(() => {
    if (createdQR) return getDynamicRedirectUrl(createdQR.qrId);
    if (customSlug.trim().length >= 3) {
      return getDynamicRedirectUrl(sanitizeSlug(customSlug));
    }
    return builtPayload || 'https://pulseqr.app';
  }, [createdQR, customSlug, builtPayload]);

  const handleFieldChange = (key: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadImageAsset(file, 'logos', user.uid);
      setLogo(url);
      notify('Logo added', 'success', 'Embedded cleanly with Level H error correction.');
    } catch (err) {
      notify('Logo upload failed', 'error', err instanceof Error ? err.message : 'Choose a smaller PNG or SVG.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingMedia(true);
    try {
      const url = await uploadMediaFile(file, user.uid);
      handleFieldChange('url', url);
      notify('File uploaded to Firebase Storage', 'success', 'URL populated automatically.');
    } catch (err) {
      notify(
        'Storage upload unavailable',
        'error',
        err instanceof Error
          ? `${err.message} You can paste any hosted URL directly instead.`
          : 'Enable Firebase Storage or paste a hosted link.'
      );
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!user.emailVerified) {
      notify('Verify email first', 'error', 'Verify your email address in the banner above before creating QR codes.');
      return;
    }
    if (!builtPayload) {
      notify('Destination required', 'error', `Please complete the required ${typeConfig.label} fields.`);
      return;
    }

    setSaving(true);
    try {
      const record = await createQRCode({
        owner: user.uid,
        title: title.trim() || `${typeConfig.label} QR`,
        customSlug: customSlug.trim() || undefined,
        originalLink: builtPayload,
        qrType,
        customColor,
        bgColor,
        logo,
        expiryDate,
      });
      setCreatedQR(record);
      notify('Dynamic QR created', 'success', `ID ${record.qrId} is now active and ready to print.`);
    } catch (err) {
      notify('Failed to create QR', 'error', err instanceof Error ? err.message : 'Check your input and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (text: string, tag: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(tag);
    notify('Copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleResetBuilder = () => {
    setCreatedQR(null);
    setTitle('');
    setCustomSlug('');
    setFieldValues({});
    setExpiryDate('');
  };

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBulkInput(text.trim());
  };

  const handleCreateBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!user.emailVerified) {
      notify('Verify email first', 'error', 'Verify your email before creating QR codes.');
      return;
    }

    const lines = bulkInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      notify('No entries found', 'error', 'Enter at least one line in Title, URL format.');
      return;
    }
    if (lines.length > 50) {
      notify('Batch capped at 50', 'error', 'Generate up to 50 dynamic QR codes per batch.');
      return;
    }

    const validTypes = new Set<string>(QR_TYPES.map((t) => t.type));
    const parsed = lines
      .map((line, index) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length === 1) {
          return {
            title: `Batch QR #${index + 1}`,
            url: parts[0],
            type: 'website' as QRType,
          };
        }
        const rawType = (parts[2] || 'website').toLowerCase();
        return {
          title: parts[0] || `Batch QR #${index + 1}`,
          url: parts[1] || '',
          type: (validTypes.has(rawType) ? rawType : 'website') as QRType,
        };
      })
      .filter((r) => r.url.length > 0);

    if (parsed.length === 0) {
      notify('Invalid CSV rows', 'error', 'Ensure each line contains a valid destination URL.');
      return;
    }

    setBulkLoading(true);
    try {
      const created = await createBulkQRCodes(
        parsed.map((row) => ({
          owner: user.uid,
          title: row.title,
          originalLink: /^https?:\/\//i.test(row.url) ? row.url : `https://${row.url}`,
          qrType: row.type,
          customColor: bulkColor,
          bgColor: bulkBg,
          logo: '',
          expiryDate: '',
        }))
      );
      setBulkResults(created);
      notify('Bulk batch created', 'success', `Generated ${created.length} dynamic QR codes.`);
    } catch (err) {
      notify('Bulk generation failed', 'error', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDownloadBulkZip = async () => {
    if (bulkResults.length === 0) return;
    await downloadBulkQRZip(
      bulkResults.map((qr) => ({
        filename: `${qr.qrId}-${qr.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`,
        options: {
          value: getDynamicRedirectUrl(qr.qrId),
          fgColor: qr.customColor,
          bgColor: qr.bgColor,
          logo: qr.logo,
        },
      }))
    );
    notify('ZIP downloaded', 'success', 'Includes both high-res PNG and scalable SVG for every code.');
  };

  return (
    <DashboardLayout
      title="Create Dynamic QR"
      breadcrumb="Create QR"
      primaryAction={
        <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'single'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Single Studio
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'bulk'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Bulk CSV
          </button>
        </div>
      }
    >
      {mode === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Builder Form */}
          <form onSubmit={handleCreateSingle} className="lg:col-span-7 space-y-6">
            {/* Step 1: Select QR Type */}
            <div className="glass-panel rounded-[26px] p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  1. Choose QR Code Type
                </h2>
                <div className="flex flex-wrap gap-1">
                  {(['All', 'Links', 'Communication', 'Social', 'Media', 'Utility'] as const).map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCategory(c)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                          selectedCategory === c
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-white/10'
                        }`}
                      >
                        {c}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {visibleTypes.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setQrType(item.type);
                      setFieldValues({});
                      setCreatedQR(null);
                    }}
                    className={`px-3.5 py-3 rounded-2xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      qrType === item.type
                        ? 'border-blue-500/60 bg-gradient-to-br from-blue-600/15 via-violet-500/12 to-cyan-500/10 text-blue-700 dark:text-white shadow-xs'
                        : 'border-slate-900/8 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Destination & Metadata */}
            <div className="glass-panel rounded-[26px] p-6 sm:p-7 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  2. {typeConfig.label} Destination Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {typeConfig.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Campaign / QR Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`e.g. ${typeConfig.label} Q4 Campaign`}
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Custom Short ID (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="auto-generated if blank"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {typeConfig.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={field.required}
                      value={fieldValues[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={fieldValues[field.key] || field.options?.[0]?.value || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      required={field.required}
                      value={fieldValues[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                    />
                  )}
                </div>
              ))}

              {(qrType === 'pdf' || qrType === 'image' || qrType === 'video') && (
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 cursor-pointer transition-all">
                    {uploadingMedia ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                    )}
                    Upload {qrType.toUpperCase()} to Firebase Storage
                    <input
                      type="file"
                      className="hidden"
                      accept={
                        qrType === 'pdf'
                          ? 'application/pdf'
                          : qrType === 'image'
                            ? 'image/*'
                            : 'video/*'
                      }
                      onChange={handleMediaUpload}
                    />
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Expiry Date (Optional — leave blank to never expire)
                </label>
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2.5 rounded-2xl glass-input text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Step 3: Styling & Logo */}
            <div className="glass-panel rounded-[26px] p-6 sm:p-7 space-y-5">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                3. Visual Styling &amp; Brand Logo
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setCustomColor(p.fg);
                      setBgColor(p.bg);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl glass-panel text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-xs"
                      style={{ backgroundColor: p.fg }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    QR Module Color
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-white/15 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-white/15 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 cursor-pointer transition-all">
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  )}
                  {logo ? 'Replace Center Logo' : 'Add Center Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>

                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo('')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Logo
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <GlassButton type="submit" variant="gradient" size="lg" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate Dynamic QR Code
              </GlassButton>
              {createdQR && (
                <GlassButton variant="glass" size="lg" onClick={handleResetBuilder}>
                  Create Another
                </GlassButton>
              )}
            </div>
          </form>

          {/* Sticky Frosted Live Preview & Export Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-2 rounded-[32px] blur-2xl opacity-45 dark:opacity-35"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(59,130,246,0.28), rgba(139,92,246,0.24), rgba(6,182,212,0.2))',
                }}
              />

              <div className="relative glass-panel rounded-[28px] p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between gap-4 border-b border-slate-900/6 dark:border-white/[0.08] pb-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                      {createdQR ? createdQR.title : title || 'Live QR Preview'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {createdQR
                        ? `Active Dynamic ID · ${createdQR.qrId}`
                        : 'Updates live as you configure'}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    {typeConfig.label}
                  </span>
                </div>

                {createdQR && (
                  <div className="flex flex-col items-center text-center pt-1">
                    <SuccessCheckAnimation size={42} />
                    <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Dynamic QR Code is live
                    </p>
                  </div>
                )}

                <div className="flex justify-center py-2">
                  <div
                    className="p-5 rounded-[24px] border border-slate-200/80 dark:border-white/15 shadow-[0_18px_40px_-14px_rgba(15,23,42,0.2)]"
                    style={{ backgroundColor: bgColor }}
                  >
                    <QRCanvas
                      value={previewUrl}
                      fgColor={customColor}
                      bgColor={bgColor}
                      logo={logo}
                      size={220}
                    />
                  </div>
                </div>

                {createdQR && (
                  <div className="space-y-3.5 pt-3 border-t border-slate-900/6 dark:border-white/[0.08]">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Dynamic Redirect Link
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3.5 py-2.5 rounded-2xl glass-input text-xs font-mono-tabular truncate text-slate-800 dark:text-slate-200">
                          {getDynamicRedirectUrl(createdQR.qrId)}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(getDynamicRedirectUrl(createdQR.qrId), 'redirect')}
                          className="p-2.5 rounded-2xl glass-panel hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer"
                          title="Copy redirect URL"
                        >
                          {copiedId === 'redirect' ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Short URL
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3.5 py-2.5 rounded-2xl glass-input text-xs font-mono-tabular truncate text-slate-800 dark:text-slate-200">
                          {getShortUrl(createdQR.qrId)}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(getShortUrl(createdQR.qrId), 'short')}
                          className="p-2.5 rounded-2xl glass-panel hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer"
                          title="Copy short URL"
                        >
                          {copiedId === 'short' ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          downloadQRPng(
                            {
                              value: getDynamicRedirectUrl(createdQR.qrId),
                              fgColor: customColor,
                              bgColor,
                              logo,
                            },
                            createdQR.qrId,
                            false
                          )
                        }
                      >
                        <Download className="w-3.5 h-3.5" />
                        PNG (1024px)
                      </GlassButton>
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() =>
                          downloadQRSvg(
                            {
                              value: getDynamicRedirectUrl(createdQR.qrId),
                              fgColor: customColor,
                              bgColor,
                              logo,
                            },
                            createdQR.qrId
                          )
                        }
                      >
                        <Download className="w-3.5 h-3.5" />
                        Vector SVG
                      </GlassButton>
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() =>
                          downloadQRPng(
                            {
                              value: getDynamicRedirectUrl(createdQR.qrId),
                              fgColor: customColor,
                              bgColor,
                              logo,
                            },
                            createdQR.qrId,
                            true
                          )
                        }
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print 2048px
                      </GlassButton>
                      <Link
                        to={`/redirect?id=${encodeURIComponent(createdQR.qrId)}`}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold hover:opacity-90 transition-opacity"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Test Scan
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Bulk CSV Generation Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleCreateBulk}
            className="lg:col-span-7 glass-panel rounded-[26px] p-6 sm:p-7 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Bulk Dynamic QR Generator
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  One entry per line:{' '}
                  <code className="font-mono-tabular">Title, Destination URL, Type</code>
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl glass-panel text-xs font-semibold cursor-pointer hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all">
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                Load CSV
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleBulkFile} />
              </label>
            </div>

            <textarea
              rows={9}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl glass-input text-xs font-mono-tabular leading-relaxed"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Batch Foreground Color
                </label>
                <input
                  type="color"
                  value={bulkColor}
                  onChange={(e) => setBulkColor(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-white/15 bg-transparent cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Batch Background Color
                </label>
                <input
                  type="color"
                  value={bulkBg}
                  onChange={(e) => setBulkBg(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-white/15 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            <GlassButton type="submit" variant="gradient" size="lg" disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Dynamic Batch
            </GlassButton>
          </form>

          <div className="lg:col-span-5 glass-panel rounded-[26px] p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-900/6 dark:border-white/[0.08]">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                  Generated Batch ({bulkResults.length})
                </h3>
                {bulkResults.length > 0 && (
                  <GlassButton variant="primary" size="sm" onClick={handleDownloadBulkZip}>
                    <FileArchive className="w-3.5 h-3.5" />
                    Download ZIP
                  </GlassButton>
                )}
              </div>

              {bulkResults.length === 0 ? (
                <EmptyStateGlass
                  icon={Layers}
                  title="Ready for bulk export"
                  description="Paste CSV rows or load a file to create up to 50 dynamic QR codes with a one-click PNG + SVG ZIP archive."
                />
              ) : (
                <ul className="mt-4 divide-y divide-slate-900/5 dark:divide-white/[0.06] max-h-[380px] overflow-y-auto">
                  {bulkResults.map((qr) => (
                    <li key={qr.qrId} className="py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {qr.title}
                        </p>
                        <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {qr.qrId} · {qr.currentLink}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(getDynamicRedirectUrl(qr.qrId), qr.qrId)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
