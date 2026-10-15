'use client';

import { useState } from 'react';
import { AlignLeft, Gauge, ShieldCheck, Table2, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toKilometresPerSecond } from '@/physics/diagnostics';
import { simulation } from '@/lib/simulation';
import type { StabilityWarning } from '@/lib/stability';
import { invalidateDiagnostics, useDiagnosticsStore } from '@/stores/diagnosticsStore';
import { useSelectionStore } from '@/stores/selectionStore';

/**
 * Velocity multiplier for the development kick. 1.5 takes a near-circular orbit
 * from escape speed ÷ √2 to just past parabolic.
 *
 * PROVENANCE: artistic — it is a test input, not an astronomical value.
 */
const KICK_FACTOR = 1.5;

/** Bundlers inline NODE_ENV, so the whole block below disappears from prod. */
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/** Drift and ratios span many orders of magnitude, so switch notation to fit. */
function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const absolute = Math.abs(value);
  if (absolute >= 1e6 || absolute < 1e-3) return value.toExponential(2);
  return value.toFixed(4);
}

function formatDistance(value: number): string {
  return value < 1 ? value.toFixed(3) : value.toFixed(2);
}

function formatSpeed(value: number): string {
  return value < 100 ? value.toFixed(2) : value.toFixed(0);
}

/** The two units differ per warning kind, so the row formats its own numbers. */
function warningText(warning: StabilityWarning): { measured: string; limit: string; unit: string } {
  if (warning.kind === 'unbound') {
    return {
      measured: formatSpeed(toKilometresPerSecond(warning.measured)),
      limit: formatSpeed(toKilometresPerSecond(warning.limit)),
      unit: 'km/s',
    };
  }
  return {
    measured: formatDistance(warning.measured),
    limit: formatDistance(warning.limit),
    unit: 'AU',
  };
}

export function DiagnosticsPanel() {
  const t = useTranslations('diagnostics');
  const tp = useTranslations('provenance');
  const tb = useTranslations('bodies');
  const locale = useLocale();
  const [showTable, setShowTable] = useState(false);

  const diagnostics = useDiagnosticsStore();
  const selectedId = useSelectionStore((state) => state.selectedId);

  const days = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    diagnostics.elapsedDays,
  );

  /** Only planets can be warned about — kinematics skips the central mass. */
  const canKick = selectedId !== null && diagnostics.bodies.some((body) => body.id === selectedId);

  function kick() {
    if (selectedId === null) return;
    simulation.speedUp(selectedId, KICK_FACTOR);
    // The warning should show on the very next frame, not up to 250 ms later.
    invalidateDiagnostics();
  }

  return (
    <section aria-label={t('title')} className="border-t border-panel-border">
      <h2 className="flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-widest text-foreground/60">
        {t('title')}
        <span
          role="radiogroup"
          aria-label={t('viewAs')}
          className="ml-auto flex gap-1 rounded border border-panel-border p-0.5 normal-case tracking-normal"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!showTable}
            onClick={() => setShowTable(false)}
            title={t('viewReadout')}
            className={`rounded p-0.5 transition-colors ${
              showTable ? 'text-foreground/50 hover:text-foreground' : 'bg-accent-cyan/15 text-accent-cyan'
            }`}
          >
            <AlignLeft size={12} aria-hidden />
            <span className="sr-only">{t('viewReadout')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={showTable}
            onClick={() => setShowTable(true)}
            title={t('viewTable')}
            className={`rounded p-0.5 transition-colors ${
              showTable ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-foreground/50 hover:text-foreground'
            }`}
          >
            <Table2 size={12} aria-hidden />
            <span className="sr-only">{t('viewTable')}</span>
          </button>
        </span>
      </h2>

      {diagnostics.ready ? null : <p className="px-4 pb-3 text-xs text-foreground/40">{t('waiting')}</p>}

      {diagnostics.ready ? (
        <div className="px-4 pb-3">
          {showTable ? (
            <table className="w-full border-collapse font-mono text-[10px]">
              <caption className="sr-only">{t('tableCaption')}</caption>
              <thead>
                <tr className="text-foreground/40">
                  <th scope="col" className="py-0.5 text-left font-normal">
                    {t('columnBody')}
                  </th>
                  <th scope="col" className="py-0.5 text-right font-normal" title={t('distance')}>
                    {t('unitAu')}
                  </th>
                  <th scope="col" className="py-0.5 text-right font-normal" title={t('speed')}>
                    km/s
                  </th>
                  <th scope="col" className="py-0.5 text-right font-normal" title={t('boundRatio')}>
                    {t('ratioGlyph')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.bodies.map((body) => (
                  <tr
                    key={body.id}
                    className={body.boundRatio >= 1 ? 'text-red-400' : 'text-foreground/80'}
                  >
                    <td className="py-0.5 pr-1 font-sans">{tb(body.id)}</td>
                    <td className="py-0.5 text-right">{formatDistance(body.distanceAu)}</td>
                    <td className="py-0.5 text-right">{formatSpeed(body.speedKmPerSecond)}</td>
                    <td className="py-0.5 text-right">{formatRatio(body.boundRatio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
              <dt className="text-foreground/50">{t('energyDrift')}</dt>
              <dd className="text-right font-mono">
                {formatRatio(diagnostics.energyDriftPercent)} %
              </dd>

              <dt className="text-foreground/50">{t('momentumDrift')}</dt>
              <dd className="text-right font-mono">
                {formatRatio(diagnostics.momentumDriftPercent)} %
              </dd>

              <dt className="text-foreground/50">{t('elapsed')}</dt>
              <dd className="text-right font-mono">{t('elapsedValue', { days })}</dd>

              <dt className="text-foreground/50">{t('stepsPerSecond')}</dt>
              <dd className="text-right font-mono">{diagnostics.stepsPerSecond}</dd>
            </dl>
          )}

          <p className="mt-2 font-mono text-[10px] leading-relaxed text-foreground/40">
            {t('valuesLabel')}: {tp('derived')} · {t('thresholdsLabel')}: {tp('artistic')}
          </p>
        </div>
      ) : null}

      {/* Announced politely: warnings are rare, the read-out above is not. */}
      <div role="status" aria-live="polite" className="border-t border-panel-border px-4 py-3">
        <h3 className="mb-1 text-[11px] uppercase tracking-wider text-foreground/50">
          {t('stability')}
        </h3>
        {diagnostics.warnings.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-foreground/60">
            <ShieldCheck size={12} aria-hidden className="text-accent-cyan" />
            {t('allBound')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {diagnostics.warnings.map((warning) => {
              const values = warningText(warning);
              return (
                <li
                  key={warning.id}
                  className="flex gap-1.5 rounded border border-red-400/40 bg-red-400/10 p-1.5 text-xs text-red-400"
                >
                  <TriangleAlert size={12} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    <strong className="font-semibold">{tb(warning.id)}</strong>{' '}
                    {t(warning.kind === 'unbound' ? 'warningUnbound' : 'warningDistance', {
                      measured: values.measured,
                      limit: values.limit,
                      unit: values.unit,
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {IS_DEVELOPMENT ? (
        <div className="border-t border-panel-border px-4 py-3">
          <button
            type="button"
            onClick={kick}
            disabled={!canKick}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-panel-border px-2 py-1 text-xs text-foreground/80 transition-colors enabled:hover:bg-panel-border enabled:hover:text-foreground disabled:opacity-40"
          >
            <Gauge size={13} aria-hidden />
            {t('kick')}
          </button>
          <p className="mt-1 text-[10px] leading-relaxed text-foreground/40">
            {canKick ? t('kickHint', { factor: KICK_FACTOR }) : t('kickNeedsBody')}
          </p>
          <p className="mt-1 text-[10px] text-star-gold">{t('devOnly')}</p>
        </div>
      ) : null}
    </section>
  );
}
