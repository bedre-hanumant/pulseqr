import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getQRCodeById, recordQRScanAtomic } from '../firebase/firestore';
import { parseClientEnvironment } from '../js/deviceParser';
import { AmbientAurora, PageTransition } from '../components/GlassUI';

export const RedirectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams<{ id?: string }>();
  const qrId = (searchParams.get('id') || paramId || '').trim();
  const token = (searchParams.get('token') || '').trim();

  const [state, setState] = useState<'loading' | 'not_found' | 'error'>('loading');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function resolveAndOpenQuickEdit() {
      if (!qrId) {
        setState('not_found');
        return;
      }

      try {
        const record = await getQRCodeById(qrId);
        if (!record) {
          setState('not_found');
          return;
        }

        // Record scan telemetry once before opening /manage/{qrId}
        if (record.status === 'active') {
          const env = parseClientEnvironment();
          try {
            await recordQRScanAtomic(record, env);
          } catch (scanErr) {
            console.error('Scan telemetry write failed:', scanErr);
          }
        }

        const params = new URLSearchParams();
        params.set('scanned', '1');
        if (token) params.set('token', token);

        navigate(`/manage/${encodeURIComponent(record.qrId)}?${params.toString()}`, {
          replace: true,
        });
      } catch {
        setState('error');
      }
    }

    resolveAndOpenQuickEdit();
  }, [qrId, token, navigate]);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F5F7FC] dark:bg-[#050711] p-6">
      <AmbientAurora />
      <PageTransition className="w-full max-w-md">
        <div className="glass-modal rounded-[28px] p-8 text-center">
          {state === 'loading' && (
            <>
              <Loader2 className="w-9 h-9 mx-auto text-blue-600 dark:text-cyan-400 animate-spin" />
              <h1 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
                Opening Quick QR Edit
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Identifying QR{' '}
                <span className="font-mono-tabular font-semibold">{qrId}</span>...
              </p>
            </>
          )}

          {(state === 'not_found' || state === 'error') && (
            <>
              <AlertTriangle className="w-10 h-10 mx-auto text-rose-500" />
              <h1 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
                {state === 'not_found' ? 'QR Code Not Found' : 'Unable to Load QR Code'}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {state === 'not_found'
                  ? 'We could not locate a dynamic QR code matching that identifier.'
                  : 'Please check your internet connection and try scanning again.'}
              </p>
              <Link to="/" className="mt-6 btn-gradient-border inline-flex">
                <span className="btn-gradient-inner px-5 py-2.5 text-sm font-semibold">
                  Go to Home
                </span>
              </Link>
            </>
          )}
        </div>
      </PageTransition>
    </div>
  );
};
