'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function ReportButton({ shareToken }: { shareToken: string }) {
  const t = useTranslations('sharing');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function report() {
    if (status === 'sending' || status === 'sent') return;
    setStatus('sending');
    try {
      const response = await fetch(`/api/experiments/share/${shareToken}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'other' }),
      });
      setStatus(response.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void report()} disabled={status === 'sending' || status === 'sent'} className="rounded border border-panel-border px-3 py-1.5 text-xs text-foreground/65 hover:border-red-400/50 hover:text-red-300 disabled:opacity-50">
        {status === 'sent' ? t('reported') : status === 'sending' ? t('sending') : t('report')}
      </button>
      {status === 'error' ? <span role="alert" className="text-xs text-red-300">{t('reportFailed')}</span> : null}
    </div>
  );
}
