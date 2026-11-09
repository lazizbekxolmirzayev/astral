'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { focusRing } from '@/components/ui/FocusRing';
import { cn } from '@/lib/utils';
import type { Evaluation } from '@/mission/engine';
import { formatQuantity } from '@/mission/format';
import { buildIndicators, type Indicator, type IndicatorId } from '@/mission/view';
import { ToneIcon, useText } from './primitives';
import { TONE_STYLES, barPercent } from './tone';

const PAIR_LABELS: Record<Exclude<IndicatorId, 'readiness'>, { used: string; limit: string }> = {
  mass: { used: 'massUsed', limit: 'massLimit' },
  power: { used: 'powerUsed', limit: 'powerLimit' },
  battery: { used: 'batteryUsed', limit: 'batteryLimit' },
  deltaV: { used: 'deltaVUsed', limit: 'deltaVLimit' },
  data: { used: 'dataUsed', limit: 'dataLimit' },
  cost: { used: 'costUsed', limit: 'costLimit' },
};

function Row({ indicator }: { indicator: Indicator }) {
  const t = useTranslations('mission.panel');
  const tone = useTranslations('mission.tone');
  const { locale } = useText();
  const styles = TONE_STYLES[indicator.tone];

  if (indicator.id === 'readiness') return null;
  const labels = PAIR_LABELS[indicator.id];
  const unavailable = indicator.used === null;
  const percent = barPercent(indicator.fraction);

  return (
    <li className={cn('rounded-xl border px-3 py-2', styles.border, styles.surface)} data-indicator={indicator.id} data-tone={indicator.tone}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <ToneIcon tone={indicator.tone} />
          {t(indicator.id)}
        </span>
        <span className={cn('font-mono text-[10px] uppercase tracking-[0.14em]', styles.text)}>{tone(indicator.tone)}</span>
      </div>
      {unavailable ? (
        <p className="mt-1 text-xs text-foreground/65">{t('unavailable')}</p>
      ) : (
        <>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 text-xs">
            <div>
              <dt className="text-foreground/60">{t(labels.used)}</dt>
              <dd className="font-mono text-sm">{formatQuantity(indicator.used, indicator.unit, locale)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-foreground/60">{t(labels.limit)}</dt>
              <dd className="font-mono text-sm">{indicator.limit === null ? t('noLimit') : formatQuantity(indicator.limit, indicator.unit, locale)}</dd>
            </div>
          </dl>
          {indicator.fraction === null ? null : (
            <div
              role="progressbar"
              aria-label={t(indicator.id)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div className={cn('h-full rounded-full transition-[width] duration-300', styles.bar)} style={{ width: `${percent}%` }} />
            </div>
          )}
        </>
      )}
    </li>
  );
}

function Readiness({ indicator, status }: { indicator: Indicator; status: Evaluation['status'] }) {
  const t = useTranslations('mission.panel');
  const readiness = useTranslations('mission.readiness');
  const styles = TONE_STYLES[indicator.tone];
  const problems = (indicator.errors ?? 0) + (indicator.warnings ?? 0);
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', styles.border, styles.surface)} data-indicator="readiness" data-tone={indicator.tone}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">{t('readiness')}</p>
      <p className={cn('mt-1 flex items-center gap-2 text-base font-semibold', styles.text)}>
        <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-full', styles.led)} />
        <ToneIcon tone={indicator.tone} />
        {readiness(status)}
      </p>
      <p className="mt-1 text-xs text-foreground/70">
        {problems === 0 ? t('allClear') : [indicator.errors ? t('errors', { count: indicator.errors }) : null, indicator.warnings ? t('warnings', { count: indicator.warnings }) : null].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

/**
 * The always-visible resource panel: seven indicators read from the resource engine.
 * The evaluation is passed in, never stored here, so the panel is always a direct
 * reflection of the current mission document.
 */
export function LiveResourcePanel({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations('mission.panel');
  const indicators = useMemo(() => buildIndicators(evaluation), [evaluation]);
  const readiness = indicators.find((indicator) => indicator.id === 'readiness');
  if (!readiness) return null;
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-cyan/80">{t('title')}</h2>
      <Readiness indicator={readiness} status={evaluation.status} />
      <ul className="flex flex-col gap-2">
        {indicators.map((indicator) => (indicator.id === 'readiness' ? null : <Row key={indicator.id} indicator={indicator} />))}
      </ul>
    </section>
  );
}

/** Small-screen strip pinned to the bottom: one chip per indicator, expandable to the full panel. */
export function ResourceBar({ evaluation }: { evaluation: Evaluation }) {
  const t = useTranslations('mission.panel');
  const [open, setOpen] = useState(false);
  const indicators = useMemo(() => buildIndicators(evaluation), [evaluation]);
  const { locale } = useText();
  const readiness = useTranslations('mission.readiness');

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-panel-border bg-[rgba(8,11,17,0.97)] backdrop-blur-sm lg:hidden">
      {open ? (
        <div id="resource-sheet" className="max-h-[65vh] overflow-y-auto border-b border-panel-border p-3">
          <LiveResourcePanel evaluation={evaluation} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto" aria-label={t('title')}>
          {indicators.map((indicator) => (
            <li key={indicator.id} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]', TONE_STYLES[indicator.tone].border, TONE_STYLES[indicator.tone].surface)} data-tone={indicator.tone}>
              <ToneIcon tone={indicator.tone} />
              <span className="uppercase tracking-[0.1em]">{t(indicator.id)}</span>
              {indicator.id === 'readiness' ? <span className="font-mono">{readiness(evaluation.status)}</span> : indicator.used !== null ? <span className="font-mono">{formatQuantity(indicator.used, indicator.unit, locale)}</span> : null}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="resource-sheet"
          aria-label={open ? t('collapse') : t('expand')}
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-panel-border', focusRing())}
        >
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
    </div>
  );
}
