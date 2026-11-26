import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Pause,
  Play,
  Printer,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { EditLinkModal } from '../components/EditLinkModal';
import {
  AnimatedNumber,
  EmptyStateGlass,
  GlassButton,
  GlassSkeleton,
} from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import {
  deleteQRCode,
  fetchQRCardsPage,
  getBatchCards,
  getQRCardCounts,
  getResolvedDestination,
  importBulkCSVQRCards,
  subscribePrintBatches,
  updateQRCode,
  type CsvCardImportRow,
  type CsvImportSummary,
} from '../firebase/firestore';
import { getShortUrl } from '../js/qrFormats';
import type { PrintBatchRecord, QRCodeRecord, QRStatus } from '../types';

function parseCsvRows(text: string): CsvCardImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Detect optional header line
  const firstLower = lines[0].toLowerCase();
  const hasHeader =
    firstLower.includes('card') || firstLower.includes('qr') || firstLower.includes('url');
  const startIndex = hasHeader ? 1 : 0;

  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  const rows: CsvCardImportRow[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.every((c) => !c)) continue;
    rows.push({
      rowNumber: i + 1,
      cardNumber: cols[0] || '',
      qrId: cols[1] || '',
      destinationUrl: cols[2] || '',
    });
  }
  return rows;
}

export const ManageQRCardsPage: React.FC = () => {
  const { user, isAdmin, notify, confirm } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters & search state
  const [searchMode, setSearchMode] = useState<'qrId' | 'cardNumber'>('qrId');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState<string>(searchParams.get('batch') || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | QRStatus>('all');
  const [pageSize, setPageSize] = useState<number>(25);

  // Cursor-based pagination state (supports 100,000+ QR cards efficiently)
  const [cards, setCards] = useState<QRCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const [hasMore, setHasMore] = useState(false);

  // Server-side counts & batches
  const [counts, setCounts] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  const [batches, setBatches] = useState<PrintBatchRecord[]>([]);

  // Modals
  const [editingCard, setEditingCard] = useState<QRCodeRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState(
    'Card Number,QR ID,Destination URL\nGRV-0001,,https://g.page/r/business-one/review\nGRV-0002,,https://g.page/r/business-two/review'
  );
  const [importBatchId, setImportBatchId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState<CsvImportSummary | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePrintBatches(user.uid, isAdmin, setBatches);
    return () => unsub();
  }, [user, isAdmin]);

  const loadCounts = useCallback(async () => {
    if (!user) return;
    const res = await getQRCardCounts(user.uid, isAdmin, batchFilter);
    setCounts(res);
  }, [user, isAdmin, batchFilter]);

  const loadPage = useCallback(
    async (targetPageIndex: number, cursorList: (QueryDocumentSnapshot<DocumentData> | null)[]) => {
      if (!user) return;
      setLoading(true);
      try {
        const cursor = cursorList[targetPageIndex] ?? null;
        const result = await fetchQRCardsPage({
          uid: user.uid,
          isAdmin,
          pageSize,
          cursor,
          searchMode: appliedSearch ? searchMode : 'all',
          searchValue: appliedSearch,
          batchIdFilter: batchFilter,
          statusFilter,
        });

        setCards(result.items);
        setHasMore(result.hasMore);
        setPageIndex(targetPageIndex);

        if (result.lastDoc) {
          setCursors((prev) => {
            const next = [...prev];
            next[targetPageIndex + 1] = result.lastDoc;
            return next;
          });
        }
      } catch (err) {
        notify('Query failed', 'error', err instanceof Error ? err.message : 'Unable to load QR cards.');
      } finally {
        setLoading(false);
      }
    },
    [user, isAdmin, pageSize, appliedSearch, searchMode, batchFilter, statusFilter, notify]
  );

  useEffect(() => {
    const resetCursors: (QueryDocumentSnapshot<DocumentData> | null)[] = [null];
    setCursors(resetCursors);
    loadPage(0, resetCursors);
    loadCounts();
  }, [loadPage, loadCounts]);

  const handleApplySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleBatchFilterChange = (val: string) => {
    setBatchFilter(val);
    if (val === 'all') {
      searchParams.delete('batch');
    } else {
      searchParams.set('batch', val);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleToggleStatus = async (card: QRCodeRecord) => {
    const next: QRStatus = card.status === 'active' ? 'paused' : 'active';
    try {
      await updateQRCode(card.qrId, { status: next });
      setCards((prev) => prev.map((c) => (c.qrId === card.qrId ? { ...c, status: next } : c)));
      loadCounts();
      notify(
        next === 'active' ? 'QR Card Activated' : 'QR Card Deactivated',
        'success',
        `${card.qrId} is now ${next}.`
      );
    } catch (err) {
      notify('Status update failed', 'error', err instanceof Error ? err.message : 'Check permissions.');
    }
  };

  const handleDeleteCard = async (card: QRCodeRecord) => {
    const ok = await confirm({
      title: `Delete QR Card ${card.cardNumber || card.qrId}?`,
      message: `Printed QR cards pointing to /r/${card.qrId} will immediately stop resolving. This cannot be undone.`,
      confirmLabel: 'Delete Card',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteQRCode(card.qrId);
      setCards((prev) => prev.filter((c) => c.qrId !== card.qrId));
      loadCounts();
      notify('QR Card deleted', 'success');
    } catch (err) {
      notify('Delete failed', 'error', err instanceof Error ? err.message : 'Error deleting card.');
    }
  };

  const handleExportCSV = async () => {
    if (!user) return;
    setExportingCsv(true);
    try {
      let exportItems = cards;
      if (batchFilter !== 'all') {
        exportItems = await getBatchCards(batchFilter, user.uid, isAdmin);
      }

      const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
      const header = 'Card Number,QR ID,Destination URL,Batch ID,Status,Scan Count,Dynamic Link';
      const rows = exportItems.map((c) =>
        [
          escape(c.cardNumber || ''),
          escape(c.qrId),
          escape(getResolvedDestination(c)),
          escape(c.batchId || ''),
          escape(c.status),
          String(c.scanCount || 0),
          escape(getShortUrl(c.qrId)),
        ].join(',')
      );

      const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        batchFilter !== 'all'
          ? `pulseqr-${batchFilter}-cards.csv`
          : `pulseqr-cards-page-${pageIndex + 1}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify('CSV exported', 'success', `Exported ${exportItems.length.toLocaleString()} QR card records.`);
    } catch (err) {
      notify('Export failed', 'error', err instanceof Error ? err.message : 'Could not export CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const sample = [
      'Card Number,QR ID,Destination URL',
      'GRV-0001,,https://g.page/r/example-cafe/review',
      'GRV-0002,,https://g.page/r/example-salon/review',
      'GRV-0003,existing-qr-id-here,https://g.page/r/updated-destination/review',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pulseqr-bulk-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunCsvImport = async () => {
    if (!user) return;
    if (!user.emailVerified) {
      notify('Verification required', 'error', 'Verify your email address before importing CSV cards.');
      return;
    }
    const parsedRows = parseCsvRows(csvText);
    if (parsedRows.length === 0) {
      notify('Empty CSV', 'error', 'Add at least one row with Card Number, QR ID (optional), and Destination URL.');
      return;
    }

    setImporting(true);
    setImportResult(null);
    setImportProgress({ done: 0, total: parsedRows.length });

    try {
      const summary = await importBulkCSVQRCards({
        owner: user.uid,
        isAdmin,
        rows: parsedRows,
        batchId: importBatchId,
        onProgress: (done, total) => setImportProgress({ done, total }),
      });
      setImportResult(summary);
      notify(
        'CSV Import Complete',
        summary.errorCount > 0 ? 'info' : 'success',
        `${summary.createdCount} created · ${summary.updatedCount} updated · ${summary.errorCount} errors.`
      );
      loadPage(0, [null]);
      loadCounts();
    } catch (err) {
      notify('Import failed', 'error', err instanceof Error ? err.message : 'Unable to process CSV.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <DashboardLayout
      title="Manage QR Cards"
      breadcrumb="Manage QR Cards"
      primaryAction={
        <div className="flex items-center gap-2.5">
          <GlassButton variant="glass" size="sm" onClick={() => { setImportResult(null); setImportOpen(true); }}>
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </GlassButton>
          <GlassButton variant="glass" size="sm" disabled={exportingCsv} onClick={handleExportCSV}>
            {exportingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </GlassButton>
          <Link to="/bulk-print" className="btn-gradient-border hidden sm:inline-flex">
            <span className="btn-gradient-inner px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap">
              <Printer className="w-3.5 h-3.5" />
              Bulk Print
            </span>
          </Link>
        </div>
      }
    >
      {/* Server-Aggregated KPI Strip (Scales to 100,000+ QR Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-panel rounded-[24px] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total QR Cards {batchFilter !== 'all' ? '(In Batch)' : '(Indexed Count)'}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
            <AnimatedNumber value={counts.total} />
          </p>
        </div>
        <div className="glass-panel rounded-[24px] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Live Cards</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            <AnimatedNumber value={counts.active} />
          </p>
        </div>
        <div className="glass-panel rounded-[24px] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Print Batches</p>
          <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
            <AnimatedNumber value={batches.length} />
          </p>
        </div>
      </div>

      {/* Indexed Search & Filter Bar */}
      <form
        onSubmit={handleApplySearch}
        className="mt-6 glass-panel rounded-[24px] p-4 sm:p-5 flex flex-col xl:flex-row items-stretch xl:items-center gap-3.5"
      >
        <div className="flex items-center gap-2 flex-1">
          <select
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value as 'qrId' | 'cardNumber')}
            className="px-3.5 py-2.5 rounded-2xl glass-input text-xs font-semibold shrink-0"
          >
            <option value="qrId">QR ID</option>
            <option value="cardNumber">Card #</option>
          </select>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value.trim()) setAppliedSearch('');
              }}
              placeholder={
                searchMode === 'qrId'
                  ? 'Exact QR ID (e.g. c-9xk2p8a1)'
                  : 'Card Number prefix (e.g. GRV-0042)'
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
            />
          </div>

          <GlassButton type="submit" variant="primary" size="sm">
            Find
          </GlassButton>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={batchFilter}
            onChange={(e) => handleBatchFilterChange(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl glass-input text-xs font-semibold max-w-[220px]"
          >
            <option value="all">All Batches</option>
            {batches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchName} ({b.cardCount})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | QRStatus)}
            className="px-3.5 py-2.5 rounded-2xl glass-input text-xs font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3.5 py-2.5 rounded-2xl glass-input text-xs font-semibold font-mono-tabular"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </form>

      {/* High-Density Paginated QR Cards Table */}
      <div className="mt-6 glass-panel rounded-[26px] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <GlassSkeleton key={n} className="h-12 w-full" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <EmptyStateGlass
            icon={QrCode}
            title="No QR cards match this filter"
            description="Generate bulk print cards, import a CSV sheet, or adjust your QR ID / Batch search filter."
            action={
              <div className="flex items-center gap-3">
                <Link to="/bulk-print" className="btn-gradient-border inline-flex">
                  <span className="btn-gradient-inner px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5" />
                    Generate Print Cards
                  </span>
                </Link>
                <GlassButton variant="glass" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV
                </GlassButton>
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/6 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-5 font-medium">Card # / QR ID</th>
                  <th className="py-3.5 px-4 font-medium">Batch</th>
                  <th className="py-3.5 px-4 font-medium">Destination URL</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium text-right">Scans</th>
                  <th className="py-3.5 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 dark:divide-white/[0.06] text-sm">
                {cards.map((card) => {
                  const dest = getResolvedDestination(card);
                  const shortUrl = getShortUrl(card.qrId);
                  return (
                    <tr
                      key={card.qrId}
                      className="hover:bg-white/45 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <p className="font-mono-tabular font-semibold text-slate-950 dark:text-white text-xs">
                          {card.cardNumber || card.title}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {card.qrId}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono-tabular text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {card.batchId || '—'}
                      </td>
                      <td className="py-3.5 px-4 max-w-[280px]">
                        {dest ? (
                          <p
                            className="text-xs font-mono-tabular text-slate-800 dark:text-slate-200 truncate"
                            title={dest}
                          >
                            {dest}
                          </p>
                        ) : (
                          <span className="text-xs italic text-amber-600 dark:text-amber-400">
                            Unassigned — click Edit Link
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            card.status === 'active'
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : card.status === 'paused'
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-slate-500 font-medium'
                          }
                        >
                          {card.status === 'active'
                            ? 'Active'
                            : card.status === 'paused'
                              ? 'Inactive'
                              : 'Archived'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold text-slate-950 dark:text-white">
                        {(card.scanCount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <GlassButton
                            variant="primary"
                            size="sm"
                            onClick={() => setEditingCard(card)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Link
                          </GlassButton>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(card)}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
                            title={card.status === 'active' ? 'Deactivate QR' : 'Activate QR'}
                          >
                            {card.status === 'active' ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(shortUrl);
                              notify('Dynamic card URL copied', 'success', shortUrl);
                            }}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
                            title="Copy /manage/{qrId} link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/manage/${encodeURIComponent(card.qrId)}?from=dashboard`}
                            target="_blank"
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-900/5 dark:hover:bg-white/10"
                            title="Open Quick QR Edit page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Delete QR"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Cursor Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-900/6 dark:border-white/[0.08] flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono-tabular">
            Page {pageIndex + 1} · Showing {cards.length} card(s)
          </span>
          <div className="flex items-center gap-2">
            <GlassButton
              variant="glass"
              size="sm"
              disabled={pageIndex === 0 || loading}
              onClick={() => loadPage(pageIndex - 1, cursors)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </GlassButton>
            <GlassButton
              variant="glass"
              size="sm"
              disabled={!hasMore || loading}
              onClick={() => loadPage(pageIndex + 1, cursors)}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </GlassButton>
          </div>
        </div>
      </div>

      {/* Reusable Edit Link Modal */}
      <EditLinkModal
        qr={editingCard}
        onClose={() => setEditingCard(null)}
        onSaved={(updated) => {
          setCards((prev) =>
            prev.map((c) =>
              c.qrId === updated.qrId
                ? {
                    ...c,
                    currentUrl: updated.currentUrl,
                    currentLink: updated.currentUrl,
                    status: updated.status,
                    cardNumber: updated.cardNumber ?? c.cardNumber,
                  }
                : c
            )
          );
          loadCounts();
          notify('Link updated immediately', 'success', `Printed card ${updated.qrId} now routes to the new URL.`);
        }}
      />

      {/* Bulk CSV Import & URL Update Modal */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-[28px] glass-modal p-7 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-900/8 dark:border-white/[0.1]">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  Bulk CSV Import &amp; Destination URL Updater
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Columns: <span className="font-mono-tabular">Card Number, QR ID (optional), Destination URL</span>. Leave QR ID empty to auto-generate; include existing QR IDs to update URLs without reprinting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl glass-panel text-xs font-semibold cursor-pointer hover:bg-white/90 dark:hover:bg-slate-800">
                  <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  Upload .CSV File
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileUpload} />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Download CSV Template
                </button>
              </div>

              <select
                value={importBatchId}
                onChange={(e) => setImportBatchId(e.target.value)}
                className="px-3 py-2 rounded-xl glass-input text-xs font-medium"
              >
                <option value="">Assign to Batch (Optional)</option>
                {batches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.batchName}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl glass-input text-xs font-mono-tabular"
              placeholder="Card Number,QR ID,Destination URL"
            />

            {importing && (
              <div className="rounded-2xl glass-panel p-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-cyan-400" />
                    Processing CSV rows in Firestore...
                  </span>
                  <span className="font-mono-tabular">
                    {importProgress.done} / {importProgress.total}
                  </span>
                </div>
                <div className="mt-2.5 h-2 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-violet-500 to-cyan-400 transition-all"
                    style={{
                      width: `${Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {importResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl glass-panel p-3">
                    <p className="text-[11px] text-slate-500">Created New</p>
                    <p className="text-lg font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400">
                      {importResult.createdCount}
                    </p>
                  </div>
                  <div className="rounded-2xl glass-panel p-3">
                    <p className="text-[11px] text-slate-500">Updated Existing</p>
                    <p className="text-lg font-bold font-mono-tabular text-blue-600 dark:text-cyan-400">
                      {importResult.updatedCount}
                    </p>
                  </div>
                  <div className="rounded-2xl glass-panel p-3">
                    <p className="text-[11px] text-slate-500">Errors</p>
                    <p className="text-lg font-bold font-mono-tabular text-rose-600 dark:text-rose-400">
                      {importResult.errorCount}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl glass-input p-3.5 max-h-48 overflow-y-auto space-y-1.5">
                  {importResult.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                      )}
                      <span className="font-mono-tabular text-slate-700 dark:text-slate-200 break-all">
                        {log.row ? `Row ${log.row}: ` : ''}
                        {log.cardNumber ? `[${log.cardNumber}] ` : ''}
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-900/8 dark:border-white/[0.1] flex items-center justify-end gap-3">
              <GlassButton variant="glass" onClick={() => setImportOpen(false)}>
                Close
              </GlassButton>
              <GlassButton variant="gradient" disabled={importing} onClick={handleRunCsvImport}>
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Run Bulk CSV Import
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
