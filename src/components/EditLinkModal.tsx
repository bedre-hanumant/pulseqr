import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, Link2, Loader2, X } from 'lucide-react';
import { GlassButton, SuccessCheckAnimation } from './GlassUI';
import {
  getOrCreateQREditToken,
  getResolvedDestination,
  updateQRCode,
} from '../firebase/firestore';
import { getManageQrUrl, getShortUrl } from '../js/qrFormats';
import type { QRCodeRecord, QRStatus } from '../types';

interface EditLinkModalProps {
  qr: QRCodeRecord | null;
  onClose: () => void;
  onSaved?: (updated: { qrId: string; currentUrl: string; status: QRStatus; cardNumber?: string }) => void;
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({ qr, onClose, onSaved }) => {
  const [url, setUrl] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [status, setStatus] = useState<QRStatus>('active');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copyingToken, setCopyingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    if (!qr) return;
    setUrl(getResolvedDestination(qr));
    setCardNumber(qr.cardNumber || '');
    setStatus(qr.status);
    setSavedOk(false);
    setErrorMsg('');
    setTokenCopied(false);
  }, [qr]);

  if (!qr) return null;

  const shortLink = getShortUrl(qr.qrId);
  const quickEditPath = `/manage/${encodeURIComponent(qr.qrId)}?from=dashboard`;

  const handleCopySecureEditLink = async () => {
    setCopyingToken(true);
    setErrorMsg('');
    try {
      const token = await getOrCreateQREditToken(qr.qrId, qr.owner);
      await navigator.clipboard.writeText(getManageQrUrl(qr.qrId, token));
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2400);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate secure edit link.');
    } finally {
      setCopyingToken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const trimmed = url.trim();
      const normalized =
        trimmed && !/^(https?:\/\/|mailto:|tel:|sms:|upi:|WIFI:|BEGIN:)/i.test(trimmed)
          ? `https://${trimmed}`
          : trimmed;

      await updateQRCode(qr.qrId, {
        currentUrl: normalized,
        currentLink: normalized,
        cardNumber: cardNumber.trim(),
        status,
      });

      setSavedOk(true);
      onSaved?.({
        qrId: qr.qrId,
        currentUrl: normalized,
        status,
        cardNumber: cardNumber.trim(),
      });
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save destination link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-link-modal-title"
    >
      <div className="w-full max-w-lg rounded-[28px] glass-modal p-7">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-900/8 dark:border-white/[0.1]">
          <div className="min-w-0">
            <h2
              id="edit-link-modal-title"
              className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2"
            >
              <Link2 className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
              Edit Dynamic Destination Link
            </h2>
            <p className="mt-1 text-xs font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
              {qr.qrId} {qr.cardNumber ? `· ${qr.cardNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {savedOk ? (
          <div className="py-8 flex flex-col items-center text-center">
            <SuccessCheckAnimation size={54} />
            <p className="mt-4 text-base font-bold text-slate-950 dark:text-white">
              Link Updated Successfully
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Printed card {qr.qrId} now serves the updated destination immediately.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="rounded-2xl glass-panel px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Permanent Quick Edit QR Endpoint
                  </p>
                  <p className="text-xs font-mono-tabular text-slate-800 dark:text-slate-200 truncate mt-0.5">
                    {shortLink}
                  </p>
                </div>
                <a
                  href={quickEditPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:bg-blue-500/10 shrink-0 whitespace-nowrap"
                  title="Open Quick QR Edit page"
                >
                  Open
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="pt-2 border-t border-slate-900/6 dark:border-white/[0.08] flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Need mobile editing without login?
                </span>
                <button
                  type="button"
                  disabled={copyingToken}
                  onClick={handleCopySecureEditLink}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {copyingToken ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : tokenCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  {tokenCopied ? 'Secure Link Copied' : 'Copy Secure Edit Link'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Destination URL (Editable Unlimited Times)
              </label>
              <input
                type="text"
                maxLength={2048}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://g.page/r/your-business/review"
                className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
              />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Changes take effect instantaneously with zero reprinting required. Leave empty to mark unassigned.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Card Number (Optional)
                </label>
                <input
                  type="text"
                  maxLength={64}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="CARD-0001"
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Card Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QRStatus)}
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                >
                  <option value="active">Active (Live Redirect)</option>
                  <option value="paused">Paused (Deactivated)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="pt-4 border-t border-slate-900/8 dark:border-white/[0.1] flex items-center justify-end gap-3">
              <GlassButton variant="glass" onClick={onClose}>
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="gradient" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Link Now
              </GlassButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
