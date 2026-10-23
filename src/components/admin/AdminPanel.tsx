'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { focusRing } from '@/components/ui/FocusRing';

type Report = { id: string; experimentId: string; reason: string; createdAt: string; experimentTitle: string | null; experimentVisibility: string | null };
type Audit = { id: string; actorId: string; action: string; targetId: string; createdAt: string };
type State = 'loading' | 'denied' | 'error' | 'ready';

type Loaded = { state: 'denied' | 'error' } | { state: 'ready'; reports: Report[]; audit: Audit[] };

async function fetchAdminData(): Promise<Loaded> {
  try {
    const [r, a] = await Promise.all([fetch('/api/admin/reports', { credentials: 'same-origin' }), fetch('/api/admin/audit', { credentials: 'same-origin' })]);
    if (r.status === 401 || r.status === 403) return { state: 'denied' };
    if (!r.ok || !a.ok) return { state: 'error' };
    return { state: 'ready', reports: ((await r.json()) as { data: Report[] }).data, audit: ((await a.json()) as { data: Audit[] }).data };
  } catch {
    return { state: 'error' };
  }
}

export function AdminPanel() {
  const t = useTranslations('admin');
  const [state, setState] = useState<State>('loading');
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [message, setMessage] = useState('');

  const apply = useCallback((result: Loaded) => {
    setState(result.state);
    if (result.state === 'ready') {
      setReports(result.reports);
      setAudit(result.audit);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminData().then((result) => { if (!cancelled) apply(result); });
    return () => { cancelled = true; };
  }, [apply]);

  async function act(path: string, method: string, body?: unknown) {
    setMessage('');
    const response = await apiFetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) setMessage(t('actionFailed'));
    apply(await fetchAdminData());
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8">
      <header className="border-b border-panel-border pb-4">
        <Link href="/" className="text-xs text-foreground/60 hover:text-accent-cyan">{t('back')}</Link>
        <h1 className="mt-2 text-xl font-semibold">{t('title')}</h1>
      </header>

      {state === 'loading' ? <p className="text-sm text-foreground/55">{t('loading')}</p> : null}
      {state === 'denied' ? <p role="alert" className="text-sm text-star-gold">{t('denied')}</p> : null}
      {state === 'error' ? <p role="alert" className="text-sm text-red-300">{t('error')}</p> : null}

      {state === 'ready' ? (
        <>
          {message ? <p role="alert" className="text-sm text-red-300">{message}</p> : null}
          <section aria-labelledby="reports-title">
            <h2 id="reports-title" className="text-sm font-semibold">{t('reports')}</h2>
            {reports.length === 0 ? <p className="mt-2 text-sm text-foreground/55">{t('noReports')}</p> : (
              <ul className="mt-3 space-y-3">
                {reports.map((report) => (
                  <li key={report.id} className="rounded-lg border border-panel-border p-4 text-sm">
                    <p className="font-medium">{report.experimentTitle ?? t('deleted')}</p>
                    <p className="mt-1 text-xs text-foreground/55">{t('reason')}: {t(`reasons.${report.reason}`)} · {report.createdAt.slice(0, 10)} · {report.experimentVisibility ?? '—'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {report.experimentVisibility && report.experimentVisibility !== 'private' ? (
                        <button type="button" onClick={() => act(`/api/admin/experiments/${report.experimentId}/unpublish`, 'POST')} className={`rounded border border-red-400/50 px-3 py-1.5 text-red-300 ${focusRing()}`}>{t('unpublish')}</button>
                      ) : null}
                      <button type="button" onClick={() => act(`/api/admin/reports/${report.id}`, 'PATCH', { status: 'reviewed' })} className={`rounded border border-panel-border px-3 py-1.5 ${focusRing()}`}>{t('markReviewed')}</button>
                      <button type="button" onClick={() => act(`/api/admin/reports/${report.id}`, 'PATCH', { status: 'dismissed' })} className={`rounded border border-panel-border px-3 py-1.5 ${focusRing()}`}>{t('dismiss')}</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="audit-title">
            <h2 id="audit-title" className="text-sm font-semibold">{t('audit')}</h2>
            {audit.length === 0 ? <p className="mt-2 text-sm text-foreground/55">{t('noAudit')}</p> : (
              <ul className="mt-3 space-y-1 font-mono text-[11px] text-foreground/65">
                {audit.map((entry) => <li key={entry.id}>{entry.createdAt.slice(0, 19).replace('T', ' ')} · {entry.action} · {entry.targetId}</li>)}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
