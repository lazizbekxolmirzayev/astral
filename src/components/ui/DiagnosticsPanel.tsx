'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { simulation } from '@/lib/simulation';
import { useDiagnosticsStore } from '@/stores/diagnosticsStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { focusRing } from './FocusRing';

type View = 'text' | 'table';

export function DiagnosticsPanel() {
  const t = useTranslations('diagnostics');
  const [view, setView] = useState<View>('text');
  const diagnostics = useDiagnosticsStore();
  const selectedId = useSelectionStore((state) => state.selectedId);
  const dev = process.env.NODE_ENV === 'development';

  return (
    <section className="border-t border-panel-border p-4" aria-labelledby="diagnostics-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="diagnostics-title" className="text-xs uppercase tracking-widest text-foreground/60">{t('title')}</h2>
        <div role="group" aria-label={t('viewAs')} className="flex gap-1">
          {(['text', 'table'] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`rounded px-2 py-1 text-[10px] ${view === mode ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-foreground/60'} ${focusRing()}`}>
              {t(mode === 'text' ? 'viewReadout' : 'viewTable')}
            </button>
          ))}
        </div>
      </div>

      {!diagnostics.ready ? <p className="mt-3 text-xs text-foreground/50">{t('waiting')}</p> : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-foreground/55">{t('elapsed')}</dt><dd>{t('elapsedValue', { days: diagnostics.elapsedDays.toFixed(1) })}</dd>
            <dt className="text-foreground/55">{t('energyDrift')}</dt><dd>{diagnostics.energyDriftPercent.toExponential(2)}%</dd>
            <dt className="text-foreground/55">{t('momentumDrift')}</dt><dd>{diagnostics.momentumDriftPercent.toExponential(2)}%</dd>
            <dt className="text-foreground/55">{t('stepsPerSecond')}</dt><dd>{diagnostics.stepsPerSecond}</dd>
          </dl>
          {view === 'table' ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[10px]"><caption className="sr-only">{t('tableCaption')}</caption><thead><tr className="text-foreground/50"><th>{t('columnBody')}</th><th>{t('distance')}</th><th>{t('speed')}</th><th>{t('ratioGlyph')}</th></tr></thead>
                <tbody>{diagnostics.bodies.map((body) => <tr key={body.id}><th scope="row" className="py-1 font-medium">{body.id}</th><td>{body.distanceAu.toFixed(3)} {t('unitAu')}</td><td>{body.speedKmPerSecond.toFixed(2)} km/s</td><td>{body.boundRatio.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-3 border-t border-panel-border/70 pt-2">
            <h3 className="text-[11px] text-foreground/60">{t('stability')}</h3>
            {diagnostics.warnings.length === 0 ? <p className="mt-1 text-xs text-foreground/50">{t('allBound')}</p> : <ul className="mt-1 space-y-1 text-xs text-amber-300">{diagnostics.warnings.map((warning) => <li key={`${warning.id}-${warning.kind}`}>{warning.id} {t(warning.kind === 'unbound' ? 'warningUnbound' : 'warningDistance', { measured: warning.measured.toFixed(2), limit: warning.limit.toFixed(2), unit: warning.kind === 'unbound' ? 'AU/day' : 'AU' })}</li>)}</ul>}
          </div>
          {dev ? <button type="button" disabled={!selectedId} onClick={() => selectedId && simulation.speedUp(selectedId, 1.5)} title={t('kickHint', { factor: '1.5' })} className={`mt-3 rounded border border-panel-border px-2 py-1 text-[11px] disabled:opacity-40 ${focusRing()}`}>{t('kick')}</button> : null}
        </>
      )}
    </section>
  );
}
