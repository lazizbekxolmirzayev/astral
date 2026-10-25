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
    <section className="border-t border-panel-border bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.06),transparent_30%)] p-4" aria-labelledby="diagnostics-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="diagnostics-title" className="text-[10px] uppercase tracking-[0.22em] text-foreground/60">{t('title')}</h2>
        <div role="group" aria-label={t('viewAs')} className="flex gap-1 rounded-full border border-panel-border bg-background/40 p-1">
          {(['text', 'table'] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`rounded-full px-2 py-1 text-[10px] transition-colors ${view === mode ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-foreground/60'} ${focusRing()}`}>
              {t(mode === 'text' ? 'viewReadout' : 'viewTable')}
            </button>
          ))}
        </div>
      </div>

      {!diagnostics.ready ? <p className="mt-3 text-xs text-foreground/50">{t('waiting')}</p> : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
            <div className="rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.92),rgba(9,12,18,0.78))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"><dt className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">{t('elapsed')}</dt><dd className="mt-1 font-mono text-foreground/90">{t('elapsedValue', { days: diagnostics.elapsedDays.toFixed(1) })}</dd></div>
            <div className="rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.92),rgba(9,12,18,0.78))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"><dt className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">{t('energyDrift')}</dt><dd className="mt-1 font-mono text-foreground/90">{diagnostics.energyDriftPercent.toExponential(2)}%</dd></div>
            <div className="rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.92),rgba(9,12,18,0.78))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"><dt className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">{t('momentumDrift')}</dt><dd className="mt-1 font-mono text-foreground/90">{diagnostics.momentumDriftPercent.toExponential(2)}%</dd></div>
            <div className="rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.92),rgba(9,12,18,0.78))] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"><dt className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">{t('stepsPerSecond')}</dt><dd className="mt-1 font-mono text-foreground/90">{diagnostics.stepsPerSecond}</dd></div>
          </dl>
          {view === 'table' ? (
            <div className="mt-3 overflow-x-auto rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.9),rgba(9,12,18,0.78))] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
              <table className="w-full text-left text-[10px]"><caption className="sr-only">{t('tableCaption')}</caption><thead><tr className="text-foreground/50"><th>{t('columnBody')}</th><th>{t('distance')}</th><th>{t('speed')}</th><th>{t('ratioGlyph')}</th></tr></thead>
                <tbody>{diagnostics.bodies.map((body) => <tr key={body.id}><th scope="row" className="py-1 font-medium">{body.id}</th><td>{body.distanceAu.toFixed(3)} {t('unitAu')}</td><td>{body.speedKmPerSecond.toFixed(2)} km/s</td><td>{body.boundRatio.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-3 rounded-[18px] border border-panel-border bg-[linear-gradient(180deg,rgba(15,19,29,0.9),rgba(9,12,18,0.78))] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">{t('stability')}</h3>
            {diagnostics.warnings.length === 0 ? <p className="mt-2 text-xs text-foreground/50">{t('allBound')}</p> : <ul className="mt-2 space-y-1 text-xs text-amber-300">{diagnostics.warnings.map((warning) => <li key={`${warning.id}-${warning.kind}`}>{warning.id} {t(warning.kind === 'unbound' ? 'warningUnbound' : 'warningDistance', { measured: warning.measured.toFixed(2), limit: warning.limit.toFixed(2), unit: warning.kind === 'unbound' ? 'AU/day' : 'AU' })}</li>)}</ul>}
          </div>
          {dev ? <button type="button" disabled={!selectedId} onClick={() => selectedId && simulation.speedUp(selectedId, 1.5)} title={t('kickHint', { factor: '1.5' })} className={`mt-3 rounded-full border border-panel-border bg-background/50 px-3 py-1.5 text-[11px] disabled:opacity-40 ${focusRing()}`}>{t('kick')}</button> : null}
        </>
      )}
    </section>
  );
}
