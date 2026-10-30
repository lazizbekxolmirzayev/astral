'use client';

import { useTranslations } from 'next-intl';
import type { Analysis, ResourceId } from '@/mission/types';

type Row = {
  id: ResourceId;
  used: number;
  limit: number;
  unit: string;
  /** Science is the one resource where more is better. */
  higherIsBetter?: boolean;
};

const WARNING_SHARE = 0.9;

function rows(analysis: Analysis): Row[] {
  return [
    { id: 'mass', used: analysis.mass.wetKg, limit: analysis.mass.launcherCapacityKg, unit: 'kg' },
    { id: 'power', used: analysis.power.loadW, limit: analysis.power.averageW, unit: 'W' },
    { id: 'budget', used: analysis.budget.totalM, limit: analysis.budget.capM, unit: '$M' },
    { id: 'data', used: analysis.data.generatedGbPerDay, limit: analysis.data.downlinkGbPerDay, unit: 'Gb/d' },
    { id: 'time', used: analysis.time.launchMonth, limit: analysis.time.deadlineMonths, unit: 'mo' },
    { id: 'science', used: analysis.science.potential, limit: analysis.science.required, unit: 'pts', higherIsBetter: true },
  ];
}

const format = (value: number) => (Math.abs(value) >= 100 ? Math.round(value).toLocaleString('en-US') : Number(value.toFixed(1)).toString());

function status(row: Row): 'ok' | 'tight' | 'over' {
  if (row.higherIsBetter) return row.used >= row.limit ? 'ok' : 'over';
  if (row.used > row.limit) return 'over';
  return row.used > row.limit * WARNING_SHARE ? 'tight' : 'ok';
}

const BAR = { ok: 'bg-emerald-400', tight: 'bg-amber-400', over: 'bg-rose-500' } as const;
const TEXT = { ok: 'text-emerald-300', tight: 'text-amber-300', over: 'text-rose-300' } as const;

/** Always visible, so every design choice shows its knock-on effects at once. */
export function ResourcePanel({ analysis }: { analysis: Analysis }) {
  const t = useTranslations('mission');
  return (
    <aside aria-label={t('resources.title')} className="rounded-2xl border border-panel-border bg-white/[0.03] p-4 lg:sticky lg:top-20">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/80">{t('resources.title')}</h2>
      <ul className="mt-3 space-y-3">
        {rows(analysis).map((row) => {
          const state = status(row);
          const share = row.limit > 0 ? Math.min(1, row.used / row.limit) : 1;
          return (
            <li key={row.id} data-testid={`resource-${row.id}`} data-status={state}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-foreground/85">{t(`resources.${row.id}.label`)}</span>
                <span className={`font-mono ${TEXT[state]}`}>{format(row.used)} / {format(row.limit)} {t(`units.${unitKey(row.unit)}`)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className={`h-full rounded-full transition-all ${BAR[state]}`} style={{ width: `${share * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-foreground/60">{t(`resources.${row.id}.help`)}</p>
              <span className="sr-only">{t(`resources.status.${state}`)}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function unitKey(unit: string) {
  return { kg: 'kg', W: 'watt', $M: 'million', 'Gb/d': 'gbPerDay', mo: 'months', pts: 'points' }[unit] ?? 'points';
}
