import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileDown,
  FileImage,
  Grid2x2,
  Layers,
  Loader2,
  Move,
  Printer,
  RotateCcw,
  Scissors,
  Sliders,
  Trash2,
  Upload,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import {
  AnimatedNumber,
  EmptyStateGlass,
  GlassButton,
  GlassSkeleton,
  SuccessCheckAnimation,
} from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import {
  deletePrintBatch,
  generateBulkPrintBatch,
  getBatchCards,
  subscribePrintBatches,
  type GeneratedCardSummary,
} from '../firebase/firestore';
import { uploadImageAsset } from '../firebase/storage';
import {
  CARD_DIMENSION_PRESETS,
  DEFAULT_GOOGLE_REVIEW_QR_BOX,
  DEFAULT_GOOGLE_REVIEW_TEMPLATE,
  drawCompositeCard,
  generatePrintPDF,
  generatePrintPNGSheets,
  loadImage,
  PAPER_SIZES,
  parseTemplateFile,
  type PrintSheetSettings,
} from '../js/printCardEngine';
import type { BulkOperationLog, PaperSize, PrintBatchRecord } from '../types';

const QUANTITY_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export const BulkPrintCardsPage: React.FC = () => {
  const { user, isAdmin, notify, confirm } = useApp();
  const [activeTab, setActiveTab] = useState<'studio' | 'batches'>('studio');

  // Template state (defaults to the uploaded Google Review NFC/QR card template)
  const [templateSrc, setTemplateSrc] = useState<string>(DEFAULT_GOOGLE_REVIEW_TEMPLATE);
  const [templateLabel, setTemplateLabel] = useState<string>('Google Review NFC/QR Card (Uploaded Template)');
  const [templateUploadedUrl, setTemplateUploadedUrl] = useState<string>(DEFAULT_GOOGLE_REVIEW_TEMPLATE);
  const [parsingTemplate, setParsingTemplate] = useState(false);

  // Print sheet & card geometry
  const [batchName, setBatchName] = useState('Google Review Cards — Batch 01');
  const [cardPrefix, setCardPrefix] = useState('GRV');
  const [startCardNumber, setStartCardNumber] = useState(1);
  const [cardCount, setCardCount] = useState<number>(25);
  const [defaultUrl, setDefaultUrl] = useState<string>('');

  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [paperWidthMm, setPaperWidthMm] = useState<number>(210);
  const [paperHeightMm, setPaperHeightMm] = useState<number>(297);
  const [cardWidthMm, setCardWidthMm] = useState<number>(85);
  const [cardHeightMm, setCardHeightMm] = useState<number>(85);
  const [cols, setCols] = useState<number>(2);
  const [rows, setRows] = useState<number>(3);
  const [gapMm, setGapMm] = useState<number>(6);
  const [cropMarks, setCropMarks] = useState<boolean>(true);
  const [showCardNumberCaption, setShowCardNumberCaption] = useState<boolean>(false);

  // QR Placement calibration (% relative to template artwork)
  const [qrXPercent, setQrXPercent] = useState<number>(DEFAULT_GOOGLE_REVIEW_QR_BOX.xPercent);
  const [qrYPercent, setQrYPercent] = useState<number>(DEFAULT_GOOGLE_REVIEW_QR_BOX.yPercent);
  const [qrSizePercent, setQrSizePercent] = useState<number>(DEFAULT_GOOGLE_REVIEW_QR_BOX.sizePercent);
  const [qrColor, setQrColor] = useState<string>('#0F172A');
  const [qrBgColor, setQrBgColor] = useState<string>('#FFFFFF');

  // Interactive drag on card preview
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [draggingQr, setDraggingQr] = useState(false);

  // Generation & export progress
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [lastBatch, setLastBatch] = useState<PrintBatchRecord | null>(null);
  const [lastGeneratedCards, setLastGeneratedCards] = useState<GeneratedCardSummary[]>([]);
  const [operationLogs, setOperationLogs] = useState<BulkOperationLog[]>([]);

  // Batch Manager state
  const [batches, setBatches] = useState<PrintBatchRecord[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchActionId, setBatchActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setBatchesLoading(true);
    const unsub = subscribePrintBatches(
      user.uid,
      isAdmin,
      (rows) => {
        setBatches(rows);
        setBatchesLoading(false);
      },
      () => setBatchesLoading(false)
    );
    return () => unsub();
  }, [user, isAdmin]);

  // Live composite canvas preview
  useEffect(() => {
    let cancelled = false;
    const renderPreview = async () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const img = await loadImage(templateSrc);
        if (cancelled) return;

        // Render preview at crisp 720px on the longest edge matching exact card aspect ratio
        const aspect = Math.max(0.25, Math.min(4, cardWidthMm / Math.max(1, cardHeightMm)));
        const targetW = aspect >= 1 ? 720 : Math.round(720 * aspect);
        const targetH = aspect >= 1 ? Math.round(720 / aspect) : 720;
        canvas.width = targetW;
        canvas.height = targetH;

        await drawCompositeCard(ctx, img, 'sample-preview-001', 0, 0, targetW, targetH, {
          qrXPercent,
          qrYPercent,
          qrSizePercent,
          qrColor,
          qrBgColor,
          cardNumber: `${cardPrefix || 'GRV'}-${String(startCardNumber).padStart(4, '0')}`,
          showCardNumberCaption,
        });
      } catch {
        // Fallback render ignored if template is mid-change
      }
    };
    renderPreview();
    return () => {
      cancelled = true;
    };
  }, [
    templateSrc,
    cardWidthMm,
    cardHeightMm,
    qrXPercent,
    qrYPercent,
    qrSizePercent,
    qrColor,
    qrBgColor,
    cardPrefix,
    startCardNumber,
    showCardNumberCaption,
  ]);

  // Compute sheet math & fit warnings
  const sheetMath = useMemo(() => {
    const cardsPerSheet = Math.max(1, cols * rows);
    const totalSheets = Math.ceil(cardCount / cardsPerSheet);
    const usedW = cols * cardWidthMm + Math.max(0, cols - 1) * gapMm;
    const usedH = rows * cardHeightMm + Math.max(0, rows - 1) * gapMm;
    const marginX = (paperWidthMm - usedW) / 2;
    const marginY = (paperHeightMm - usedH) / 2;
    const fitsPaper = marginX >= 2 && marginY >= 2;
    return { cardsPerSheet, totalSheets, usedW, usedH, marginX, marginY, fitsPaper };
  }, [cols, rows, cardCount, cardWidthMm, cardHeightMm, gapMm, paperWidthMm, paperHeightMm]);

  const handlePaperChange = (nextPaper: PaperSize) => {
    setPaperSize(nextPaper);
    if (nextPaper !== 'Custom') {
      const preset = PAPER_SIZES[nextPaper];
      setPaperWidthMm(preset.widthMm);
      setPaperHeightMm(preset.heightMm);
    }
  };

  const applyCardPreset = (preset: (typeof CARD_DIMENSION_PRESETS)[number]) => {
    setCardWidthMm(preset.widthMm);
    setCardHeightMm(preset.heightMm);
    setCols(preset.cols);
    setRows(preset.rows);
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setParsingTemplate(true);
    try {
      const parsed = await parseTemplateFile(file);
      setTemplateSrc(parsed.dataUrl);
      setTemplateLabel(`${file.name} (${parsed.fileType} · ${parsed.width}×${parsed.height}px)`);

      // Persist clean template reference for batch reprinting
      if (parsed.dataUrl.length <= 450000) {
        setTemplateUploadedUrl(parsed.dataUrl);
      } else {
        try {
          const uploaded = await uploadImageAsset(file, 'templates', user.uid);
          setTemplateUploadedUrl(uploaded.url);
        } catch {
          // Compact JPEG fallback for Firestore templateUrl if Storage is unavailable
          const img = await loadImage(parsed.dataUrl);
          const c = document.createElement('canvas');
          const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.round(img.naturalWidth * scale);
          c.height = Math.round(img.naturalHeight * scale);
          const ctx = c.getContext('2d');
          ctx?.drawImage(img, 0, 0, c.width, c.height);
          setTemplateUploadedUrl(c.toDataURL('image/jpeg', 0.85));
        }
      }

      notify('Card template loaded', 'success', 'Drag or fine-tune the QR box to align perfectly.');
    } catch (err) {
      notify(
        'Template load failed',
        'error',
        err instanceof Error ? err.message : 'Upload a PNG, JPG, SVG, or PDF file.'
      );
    } finally {
      setParsingTemplate(false);
    }
  };

  const handleResetDefaultTemplate = () => {
    setTemplateSrc(DEFAULT_GOOGLE_REVIEW_TEMPLATE);
    setTemplateUploadedUrl(DEFAULT_GOOGLE_REVIEW_TEMPLATE);
    setTemplateLabel('Google Review NFC/QR Card (Uploaded Template)');
    setQrXPercent(DEFAULT_GOOGLE_REVIEW_QR_BOX.xPercent);
    setQrYPercent(DEFAULT_GOOGLE_REVIEW_QR_BOX.yPercent);
    setQrSizePercent(DEFAULT_GOOGLE_REVIEW_QR_BOX.sizePercent);
    setCardWidthMm(85);
    setCardHeightMm(85);
    setCols(2);
    setRows(3);
    notify('Google Review template restored', 'info', 'QR code centered in placeholder.');
  };

  const updateQrPosFromPointer = (clientX: number, clientY: number) => {
    const el = previewContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * 100;
    const relY = ((clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(0, Math.min(100 - qrSizePercent, relX - qrSizePercent / 2));
    const clampedY = Math.max(0, Math.min(100 - qrSizePercent, relY - qrSizePercent / 2));
    setQrXPercent(Number(clampedX.toFixed(1)));
    setQrYPercent(Number(clampedY.toFixed(1)));
  };

  const buildCurrentPrintSettings = (nameOverride?: string): PrintSheetSettings => ({
    templateSrc,
    paperSize,
    paperWidthMm,
    paperHeightMm,
    cardWidthMm,
    cardHeightMm,
    rows,
    cols,
    gapMm,
    cropMarks,
    qrXPercent,
    qrYPercent,
    qrSizePercent,
    qrColor,
    qrBgColor,
    showCardNumberCaption,
    batchName: nameOverride || batchName,
  });

  const handleGenerateBatch = async (autoExport: 'none' | 'pdf' | 'png' = 'none') => {
    if (!user) return;
    if (!user.emailVerified) {
      notify('Email verification required', 'error', 'Verify your email in the banner above to create bulk QR batches.');
      return;
    }
    if (!sheetMath.fitsPaper) {
      notify(
        'Grid exceeds paper bounds',
        'error',
        `Reduce rows/columns or card dimensions so cards fit within ${paperWidthMm}×${paperHeightMm} mm.`
      );
      return;
    }

    setGenerating(true);
    setProgressPercent(2);
    setProgressLabel(`Generating ${cardCount.toLocaleString()} unique Dynamic QR cards...`);
    setOperationLogs([]);

    try {
      const result = await generateBulkPrintBatch({
        owner: user.uid,
        batchName: batchName.trim() || 'Google Review Cards',
        cardCount,
        startCardNumber,
        cardPrefix,
        paperSize,
        paperWidthMm,
        paperHeightMm,
        cardWidthMm,
        cardHeightMm,
        rows,
        cols,
        qrXPercent,
        qrYPercent,
        qrSizePercent,
        templateUrl: templateUploadedUrl || DEFAULT_GOOGLE_REVIEW_TEMPLATE,
        defaultUrl: defaultUrl.trim(),
        qrColor,
        qrBgColor,
        onProgress: (done, total, text) => {
          setProgressPercent(Math.round((done / Math.max(1, total)) * (autoExport === 'none' ? 100 : 45)));
          setProgressLabel(text);
        },
      });

      setLastBatch(result.batch);
      setLastGeneratedCards(result.cards);
      setOperationLogs(result.logs);
      setStartCardNumber((prev) => prev + cardCount);

      notify(
        `${result.cards.length.toLocaleString()} Dynamic QR Cards Created`,
        'success',
        `Saved in Firestore under batch ${result.batch.batchId}.`
      );

      if (autoExport === 'pdf') {
        setExporting('pdf');
        await generatePrintPDF(result.cards, buildCurrentPrintSettings(result.batch.batchName), (cur, tot, lbl) => {
          setProgressPercent(45 + Math.round((cur / Math.max(1, tot)) * 55));
          setProgressLabel(lbl);
        });
        notify('Print-Ready PDF Downloaded', 'success', `${sheetMath.totalSheets} A4/sheet page(s) with 300 DPI cards & crop marks.`);
      } else if (autoExport === 'png') {
        setExporting('png');
        await generatePrintPNGSheets(result.cards, buildCurrentPrintSettings(result.batch.batchName), (cur, tot, lbl) => {
          setProgressPercent(45 + Math.round((cur / Math.max(1, tot)) * 55));
          setProgressLabel(lbl);
        });
        notify('300 DPI PNG Sheets Downloaded', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Batch generation failed.';
      setOperationLogs((prev) => [...prev, { status: 'error', message: msg }]);
      notify('Generation failed', 'error', msg);
    } finally {
      setGenerating(false);
      setExporting(null);
    }
  };

  const handleExportLastBatch = async (format: 'pdf' | 'png') => {
    if (lastGeneratedCards.length === 0 || !lastBatch) return;
    setExporting(format);
    setProgressPercent(5);
    setProgressLabel(`Preparing 300 DPI ${format.toUpperCase()} sheets...`);
    try {
      const settings = buildCurrentPrintSettings(lastBatch.batchName);
      if (format === 'pdf') {
        await generatePrintPDF(lastGeneratedCards, settings, (c, t, l) => {
          setProgressPercent(Math.round((c / Math.max(1, t)) * 100));
          setProgressLabel(l);
        });
        notify('300 DPI PDF downloaded', 'success');
      } else {
        await generatePrintPNGSheets(lastGeneratedCards, settings, (c, t, l) => {
          setProgressPercent(Math.round((c / Math.max(1, t)) * 100));
          setProgressLabel(l);
        });
        notify('300 DPI PNG sheets downloaded', 'success');
      }
    } catch (err) {
      notify('Export failed', 'error', err instanceof Error ? err.message : 'Could not render sheets.');
    } finally {
      setExporting(null);
    }
  };

  // Batch Manager Actions
  const handleBatchDownload = async (batch: PrintBatchRecord, format: 'pdf' | 'png') => {
    if (!user) return;
    setBatchActionId(batch.batchId);
    setExporting(format);
    setProgressPercent(5);
    setProgressLabel(`Loading ${batch.cardCount.toLocaleString()} cards from Firestore for ${batch.batchName}...`);

    try {
      const cards = await getBatchCards(batch.batchId, user.uid, isAdmin);
      if (cards.length === 0) {
        notify('No cards found in batch', 'error', 'Cards in this batch may have been deleted.');
        return;
      }

      const settings: PrintSheetSettings = {
        templateSrc: batch.templateUrl || DEFAULT_GOOGLE_REVIEW_TEMPLATE,
        paperSize: batch.paperSize,
        paperWidthMm: batch.paperWidthMm,
        paperHeightMm: batch.paperHeightMm,
        cardWidthMm: batch.cardWidthMm,
        cardHeightMm: batch.cardHeightMm,
        rows: batch.rows,
        cols: batch.cols,
        gapMm: 6,
        cropMarks: true,
        qrXPercent: batch.qrXPercent,
        qrYPercent: batch.qrYPercent,
        qrSizePercent: batch.qrSizePercent,
        qrColor: batch.qrColor,
        qrBgColor: batch.qrBgColor,
        batchName: batch.batchName,
      };

      const printable = cards.map((c) => ({ qrId: c.qrId, cardNumber: c.cardNumber }));
      if (format === 'pdf') {
        await generatePrintPDF(printable, settings, (cur, tot, lbl) => {
          setProgressPercent(Math.round((cur / Math.max(1, tot)) * 100));
          setProgressLabel(lbl);
        });
        notify('Batch PDF Ready', 'success', `Downloaded ${printable.length} cards using exact original QR IDs.`);
      } else {
        await generatePrintPNGSheets(printable, settings, (cur, tot, lbl) => {
          setProgressPercent(Math.round((cur / Math.max(1, tot)) * 100));
          setProgressLabel(lbl);
        });
        notify('Batch 300 DPI PNGs Ready', 'success', `Downloaded high-resolution sheets for ${batch.batchName}.`);
      }
    } catch (err) {
      notify('Reprint failed', 'error', err instanceof Error ? err.message : 'Unable to generate print sheets.');
    } finally {
      setBatchActionId(null);
      setExporting(null);
    }
  };

  const handleLoadBatchToStudio = (batch: PrintBatchRecord) => {
    setBatchName(`${batch.batchName} (Copy)`);
    setPaperSize(batch.paperSize);
    setPaperWidthMm(batch.paperWidthMm);
    setPaperHeightMm(batch.paperHeightMm);
    setCardWidthMm(batch.cardWidthMm);
    setCardHeightMm(batch.cardHeightMm);
    setRows(batch.rows);
    setCols(batch.cols);
    setQrXPercent(batch.qrXPercent);
    setQrYPercent(batch.qrYPercent);
    setQrSizePercent(batch.qrSizePercent);
    setQrColor(batch.qrColor);
    setQrBgColor(batch.qrBgColor);
    setDefaultUrl(batch.defaultUrl || '');
    if (batch.templateUrl) {
      setTemplateSrc(batch.templateUrl);
      setTemplateUploadedUrl(batch.templateUrl);
      setTemplateLabel(`Loaded from batch ${batch.batchId}`);
    }
    setActiveTab('studio');
    notify('Batch settings loaded into Studio', 'info', 'Ready to generate a new run or adjust layout.');
  };

  const handleDeleteBatch = async (batch: PrintBatchRecord) => {
    if (!user) return;
    const ok = await confirm({
      title: `Delete batch "${batch.batchName}"?`,
      message: `This will permanently delete batch ${batch.batchId} AND all ${batch.cardCount.toLocaleString()} dynamic QR cards inside it from Firestore.`,
      confirmLabel: 'Delete Batch & Cards',
      danger: true,
    });
    if (!ok) return;

    setBatchActionId(batch.batchId);
    try {
      const removed = await deletePrintBatch(batch.batchId, user.uid, isAdmin, true);
      notify('Batch deleted', 'success', `Removed batch and ${removed.toLocaleString()} QR card records.`);
    } catch (err) {
      notify('Delete failed', 'error', err instanceof Error ? err.message : 'Could not delete batch.');
    } finally {
      setBatchActionId(null);
    }
  };

  const totalBatchCards = useMemo(
    () => batches.reduce((sum, b) => sum + (b.cardCount || 0), 0),
    [batches]
  );

  return (
    <DashboardLayout
      title="Bulk Print Cards"
      breadcrumb="Bulk Print Cards"
      primaryAction={
        <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Print Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'batches'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Batch Manager ({batches.length})
          </button>
        </div>
      }
    >
      {/* Live Progress Banner */}
      {(generating || exporting) && (
        <div className="mb-6 glass-panel rounded-[24px] p-5 border-blue-500/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-cyan-400 animate-spin shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                  {progressLabel || 'Processing print batch...'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  300 DPI print compositor active · Dynamic endpoints stored in Cloud Firestore
                </p>
              </div>
            </div>
            <span className="font-mono-tabular text-sm font-bold text-blue-600 dark:text-cyan-400 shrink-0">
              {progressPercent}%
            </span>
          </div>
          <div className="mt-3.5 h-2 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-violet-500 to-cyan-400 transition-all duration-200"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {activeTab === 'studio' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Left Configuration Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Card Template Upload & Base Selection */}
            <section className="glass-panel rounded-[26px] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-950 dark:text-white">
                    01. Card Design Template
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Preserves all logos, stars, colors, text, and NFC graphics verbatim. Replaces only the QR placeholder.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaultTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Google Review Template
                </button>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <label className="flex-1 flex items-center justify-center gap-3 px-5 py-4 rounded-2xl border border-dashed border-blue-500/40 dark:border-cyan-400/35 bg-blue-500/[0.04] hover:bg-blue-500/[0.08] transition-colors cursor-pointer">
                  {parsingTemplate ? (
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-cyan-400 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-blue-600 dark:text-cyan-400 shrink-0" />
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {parsingTemplate ? 'Rendering template at 300 DPI...' : 'Upload Custom Template (PNG, JPG, SVG, PDF)'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Active: {templateLabel}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,application/pdf,.png,.jpg,.jpeg,.svg,.pdf"
                    className="hidden"
                    onChange={handleTemplateUpload}
                  />
                </label>
              </div>
            </section>

            {/* 2. Batch Quantity & Dynamic Link Defaults */}
            <section className="glass-panel rounded-[26px] p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white">
                  02. Batch Volume &amp; Dynamic Card Defaults
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Every generated card receives a permanent Quick QR Edit endpoint (<span className="font-mono-tabular">/manage/&#123;qrId&#125;</span>) stored in Firestore.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  One-Click Card Quantity
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {QUANTITY_PRESETS.map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setCardCount(qty)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono-tabular font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        cardCount === qty
                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                          : 'glass-panel text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800'
                      }`}
                    >
                      {qty.toLocaleString()} cards
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Batch Name
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Google Review NFC Cards — Batch 01"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Custom Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={cardCount}
                    onChange={(e) => setCardCount(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Card Serial Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={cardPrefix}
                    onChange={(e) => setCardPrefix(e.target.value.toUpperCase())}
                    placeholder="GRV"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Card Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={startCardNumber}
                    onChange={(e) => setStartCardNumber(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Initial Destination URL
                  </label>
                  <input
                    type="text"
                    maxLength={2048}
                    value={defaultUrl}
                    onChange={(e) => setDefaultUrl(e.target.value)}
                    placeholder="Optional (leave empty)"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                  />
                </div>
              </div>
            </section>

            {/* 3. Paper Size, Card Dimensions & Sheet Grid */}
            <section className="glass-panel rounded-[26px] p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Grid2x2 className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                    03. Paper Size, Card Dimensions &amp; Sheet Layout
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    All exports render at true 300 DPI with centered margins and vector printer crop marks.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Paper Size
                  </label>
                  <select
                    value={paperSize}
                    onChange={(e) => handlePaperChange(e.target.value as PaperSize)}
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  >
                    {(Object.keys(PAPER_SIZES) as PaperSize[]).map((ps) => (
                      <option key={ps} value={ps}>
                        {PAPER_SIZES[ps].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Quick Card Size Presets
                  </label>
                  <select
                    onChange={(e) => {
                      const preset = CARD_DIMENSION_PRESETS[Number(e.target.value)];
                      if (preset) applyCardPreset(preset);
                    }}
                    defaultValue="0"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  >
                    {CARD_DIMENSION_PRESETS.map((p, idx) => (
                      <option key={p.label} value={idx}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {paperSize === 'Custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Custom Paper Width (mm)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={1500}
                      step="0.1"
                      value={paperWidthMm}
                      onChange={(e) => setPaperWidthMm(Math.max(50, Number(e.target.value) || 210))}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Custom Paper Height (mm)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={1500}
                      step="0.1"
                      value={paperHeightMm}
                      onChange={(e) => setPaperHeightMm(Math.max(50, Number(e.target.value) || 297))}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Card W (mm)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={400}
                    step="0.1"
                    value={cardWidthMm}
                    onChange={(e) => setCardWidthMm(Math.max(20, Number(e.target.value) || 85))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Card H (mm)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={400}
                    step="0.1"
                    value={cardHeightMm}
                    onChange={(e) => setCardHeightMm(Math.max(20, Number(e.target.value) || 54))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Columns
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={cols}
                    onChange={(e) => setCols(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Rows
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={rows}
                    onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Gap (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step="0.5"
                    value={gapMm}
                    onChange={(e) => setGapMm(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-900/6 dark:border-white/[0.08]">
                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cropMarks}
                    onChange={(e) => setCropMarks(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <Scissors className="w-3.5 h-3.5 text-slate-500" />
                  Include hairline printer crop marks
                </label>

                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCardNumberCaption}
                    onChange={(e) => setShowCardNumberCaption(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  Print subtle serial number under QR
                </label>
              </div>

              {!sheetMath.fitsPaper && (
                <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Grid ({sheetMath.usedW.toFixed(1)} × {sheetMath.usedH.toFixed(1)} mm) exceeds{' '}
                    {paperSize} ({paperWidthMm} × {paperHeightMm} mm). Reduce rows, columns, or gap.
                  </span>
                </div>
              )}
            </section>

            {/* 4. QR Placement & Style Calibration */}
            <section className="glass-panel rounded-[26px] p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  04. QR Placeholder Calibration
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setQrXPercent(DEFAULT_GOOGLE_REVIEW_QR_BOX.xPercent);
                    setQrYPercent(DEFAULT_GOOGLE_REVIEW_QR_BOX.yPercent);
                    setQrSizePercent(DEFAULT_GOOGLE_REVIEW_QR_BOX.sizePercent);
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Snap to Google Review QR Box
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Horizontal X</span>
                    <span className="font-mono-tabular font-semibold">{qrXPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    step={0.5}
                    value={qrXPercent}
                    onChange={(e) => setQrXPercent(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Vertical Y</span>
                    <span className="font-mono-tabular font-semibold">{qrYPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    step={0.5}
                    value={qrYPercent}
                    onChange={(e) => setQrYPercent(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">QR Size</span>
                    <span className="font-mono-tabular font-semibold">{qrSizePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={65}
                    step={0.5}
                    value={qrSizePercent}
                    onChange={(e) => setQrSizePercent(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/15 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">QR Modules</p>
                    <p className="text-[11px] font-mono-tabular text-slate-500">{qrColor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={qrBgColor}
                    onChange={(e) => setQrBgColor(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/15 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">QR Backing</p>
                    <p className="text-[11px] font-mono-tabular text-slate-500">{qrBgColor}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Generation Action Bar */}
            <div className="glass-panel rounded-[26px] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  Output: <strong className="font-mono-tabular text-slate-950 dark:text-white">{cardCount.toLocaleString()}</strong> unique dynamic cards
                </span>
                <span>
                  Sheets: <strong className="font-mono-tabular text-slate-950 dark:text-white">{sheetMath.totalSheets}</strong> × {paperSize} ({sheetMath.cardsPerSheet}/sheet) · 300 DPI
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <GlassButton
                  variant="gradient"
                  disabled={generating || exporting !== null || !sheetMath.fitsPaper}
                  onClick={() => handleGenerateBatch('pdf')}
                  className="flex-1 min-w-[200px]"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Generate {cardCount.toLocaleString()} Cards &amp; Download PDF
                </GlassButton>

                <GlassButton
                  variant="glass"
                  disabled={generating || exporting !== null || !sheetMath.fitsPaper}
                  onClick={() => handleGenerateBatch('png')}
                >
                  <FileImage className="w-4 h-4" />
                  Generate &amp; PNG (300 DPI)
                </GlassButton>

                <GlassButton
                  variant="glass"
                  disabled={generating || exporting !== null || !sheetMath.fitsPaper}
                  onClick={() => handleGenerateBatch('none')}
                >
                  <Layers className="w-4 h-4" />
                  Save Batch Only
                </GlassButton>
              </div>
            </div>

            {/* Post-Generation Success & Logs Panel */}
            {lastBatch && (
              <section className="glass-panel rounded-[26px] p-6 space-y-4 border-emerald-500/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <SuccessCheckAnimation size={44} />
                    <div>
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                        Batch Ready: {lastBatch.batchName}
                      </h3>
                      <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                        {lastBatch.batchId} · {lastGeneratedCards.length.toLocaleString()} dynamic cards saved
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/manage-cards?batch=${encodeURIComponent(lastBatch.batchId)}`}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
                  >
                    Open in Manage QR Cards →
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <GlassButton
                    variant="primary"
                    size="sm"
                    disabled={exporting !== null}
                    onClick={() => handleExportLastBatch('pdf')}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download A4 Print PDF
                  </GlassButton>
                  <GlassButton
                    variant="glass"
                    size="sm"
                    disabled={exporting !== null}
                    onClick={() => handleExportLastBatch('png')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download 300 DPI PNG Sheets
                  </GlassButton>
                </div>

                {operationLogs.length > 0 && (
                  <div className="rounded-2xl glass-input p-3.5 max-h-40 overflow-y-auto space-y-1.5">
                    {operationLogs.map((log, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        <span className="font-mono-tabular text-slate-700 dark:text-slate-200">
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right Sticky Live Card & A4 Sheet Imposition Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
            <div className="glass-panel rounded-[26px] p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                    Live Print Card Preview (300 DPI)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click or drag on card to reposition QR code
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-blue-600 dark:text-cyan-400">
                  <Move className="w-3.5 h-3.5" />
                  {cardWidthMm}×{cardHeightMm} mm
                </span>
              </div>

              <div
                ref={previewContainerRef}
                onPointerDown={(e) => {
                  setDraggingQr(true);
                  updateQrPosFromPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (draggingQr) updateQrPosFromPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => setDraggingQr(false)}
                onPointerLeave={() => setDraggingQr(false)}
                className="relative rounded-[20px] overflow-hidden border border-slate-200/90 dark:border-white/15 shadow-lg bg-white cursor-crosshair select-none touch-none"
              >
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-auto block"
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                <span>QR Box: X {qrXPercent}% · Y {qrYPercent}% · Size {qrSizePercent}%</span>
                <span>/manage/&#123;qrId&#125;</span>
              </div>
            </div>

            {/* Sheet Imposition Diagram */}
            <div className="glass-panel rounded-[26px] p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  {paperSize} Sheet Imposition
                </h3>
                <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                  {cols} cols × {rows} rows ({sheetMath.cardsPerSheet}/sheet)
                </span>
              </div>

              <div className="flex justify-center py-2">
                <div
                  className="relative bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 rounded-lg shadow-inner overflow-hidden"
                  style={{
                    width: 170,
                    height: Math.round(170 * (paperHeightMm / Math.max(1, paperWidthMm))),
                  }}
                >
                  {Array.from({ length: Math.min(rows * cols, 60) }).map((_, idx) => {
                    const r = Math.floor(idx / cols);
                    const c = idx % cols;
                    const leftPct = ((sheetMath.marginX + c * (cardWidthMm + gapMm)) / paperWidthMm) * 100;
                    const topPct = ((sheetMath.marginY + r * (cardHeightMm + gapMm)) / paperHeightMm) * 100;
                    const wPct = (cardWidthMm / paperWidthMm) * 100;
                    const hPct = (cardHeightMm / paperHeightMm) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute rounded-[2px] bg-gradient-to-br from-blue-600/20 via-violet-500/15 to-cyan-500/20 border border-blue-500/45 flex items-center justify-center text-[8px] font-mono-tabular text-blue-700 dark:text-cyan-300"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${wPct}%`,
                          height: `${hPct}%`,
                        }}
                      >
                        #{idx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                Margins: <span className="font-mono-tabular">{Math.max(0, sheetMath.marginX).toFixed(1)} mm</span> H ·{' '}
                <span className="font-mono-tabular">{Math.max(0, sheetMath.marginY).toFixed(1)} mm</span> V ·{' '}
                {cropMarks ? 'Crop marks ON' : 'Crop marks OFF'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Batch Manager */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="glass-panel rounded-[24px] p-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Print Batches</p>
              <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
                <AnimatedNumber value={batches.length} />
              </p>
            </div>
            <div className="glass-panel rounded-[24px] p-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Printed Cards</p>
              <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
                <AnimatedNumber value={totalBatchCards} />
              </p>
            </div>
            <div className="glass-panel rounded-[24px] p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Print Resolution</p>
                <p className="mt-2 text-2xl font-bold font-mono-tabular text-blue-600 dark:text-cyan-400">
                  300 DPI
                </p>
              </div>
              <GlassButton variant="gradient" size="sm" onClick={() => setActiveTab('studio')}>
                New Batch
              </GlassButton>
            </div>
          </div>

          <div className="glass-panel rounded-[26px] overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-900/6 dark:border-white/[0.08] flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">
                Print Batch Manager
              </h2>
              <Link
                to="/manage-cards"
                className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
              >
                Manage All Individual Cards →
              </Link>
            </div>

            {batchesLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <GlassSkeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : batches.length === 0 ? (
              <EmptyStateGlass
                icon={Printer}
                title="No print batches generated yet"
                description="Create your first bulk Google Review NFC/QR card batch in Print Studio to download 300 DPI PDF & PNG sheets."
                action={
                  <GlassButton variant="gradient" onClick={() => setActiveTab('studio')}>
                    Open Print Studio
                  </GlassButton>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900/6 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-4 px-6 font-medium">Batch Name &amp; ID</th>
                      <th className="py-4 px-4 font-medium">Layout</th>
                      <th className="py-4 px-4 font-medium text-right">Cards</th>
                      <th className="py-4 px-4 font-medium">Created</th>
                      <th className="py-4 px-6 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/5 dark:divide-white/[0.06] text-sm">
                    {batches.map((b) => {
                      const busy = batchActionId === b.batchId;
                      return (
                        <tr
                          key={b.batchId}
                          className="hover:bg-white/45 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-4 px-6">
                            <p className="font-semibold text-slate-950 dark:text-white">
                              {b.batchName}
                            </p>
                            <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 mt-0.5">
                              {b.batchId}
                            </p>
                          </td>
                          <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {b.paperSize} · {b.cardWidthMm}×{b.cardHeightMm} mm · {b.cols}×{b.rows}
                          </td>
                          <td className="py-4 px-4 text-right font-mono-tabular font-semibold text-slate-950 dark:text-white">
                            {b.cardCount.toLocaleString()}
                          </td>
                          <td className="py-4 px-4 text-xs font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {b.createdAt
                              ? b.createdAt.toDate().toLocaleDateString([], {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Just now'}
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busy || exporting !== null}
                                onClick={() => handleBatchDownload(b, 'pdf')}
                                className="px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:bg-white/90 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                title="Download Print-Ready PDF (300 DPI)"
                              >
                                PDF
                              </button>
                              <button
                                type="button"
                                disabled={busy || exporting !== null}
                                onClick={() => handleBatchDownload(b, 'png')}
                                className="px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                title="Download 300 DPI PNG Sheets"
                              >
                                PNG
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleLoadBatchToStudio(b)}
                                className="px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                title="Reprint / Load Settings in Studio"
                              >
                                Reprint
                              </button>
                              <Link
                                to={`/manage-cards?batch=${encodeURIComponent(b.batchId)}`}
                                className="px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800"
                              >
                                Cards
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeleteBatch(b)}
                                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
                                title="Delete Batch & Cards"
                              >
                                {busy ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
