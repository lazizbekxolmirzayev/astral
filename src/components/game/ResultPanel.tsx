'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { pickText } from '@/mission';
import { stageTitle } from '@/mission/sim';
import { gameStore } from '@/game/gameStore';
import { formatBits, formatNumber } from '@/game/format';
import { useSimSnapshot } from './useSimSnapshot';

const BADGE = {
  success: { color: '#34d399', ring: 'border-emerald-300/60 shadow-[0_0_60px_rgba(52,211,153,0.35)]' },
  partial: { color: '#fbbf24', ring: 'border-amber-300/60 shadow-[0_0_60px_rgba(251,191,36,0.3)]' },
  failure: { color: '#f87171', ring: 'border-red-300/60 shadow-[0_0_60px_rgba(248,113,113,0.35)]' },
} as const;

/** The result screen: what the simulation concluded, why, and what to do next. */
export function ResultPanel({ missionId }: { missionId: string | null }) {
  const t = useTranslations('game.result');
  const locale = useLocale();
  const { plan, sim } = useSimSnapshot();
  const outcome = sim?.outcome;
  if (!plan || !sim || !outcome) return null;
  const badge = BADGE[outcome.kind];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]" data-testid="result-panel">
      <div className={`max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl border bg-[linear-gradient(160deg,rgba(8,14,26,0.94),rgba(10,10,24,0.9))] p-5 sm:p-7 ${badge.ring}`}>
        <p data-testid="outcome" data-outcome={outcome.kind} className="text-center text-3xl font-extrabold uppercase tracking-[0.2em] sm:text-4xl" style={{ color: badge.color, textShadow: `0 0 30px ${badge.color}` }}>{t(outcome.kind)}</p>
        <p className="mt-2 text-center text-sm text-white/75">{pickText(outcome.summary, locale)}</p>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-white/50">{t('science')}</p><p className="mt-1 text-xl font-semibold text-amber-200">{formatNumber(outcome.sciencePoints, locale, 1)}</p><p className="text-[10px] text-white/45">{t('of', { nominal: formatNumber(outcome.scienceNominal, locale, 1) })}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-white/50">{t('data')}</p><p className="mt-1 text-xl font-semibold text-cyan-100">{formatBits(outcome.deliveredBits, locale)}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-white/50">{t('days')}</p><p className="mt-1 text-xl font-semibold text-white">{formatNumber(outcome.operationsDays, locale, 1)}</p></div>
        </div>

        {outcome.requirements.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">{t('requirements')}</p>
            <ul className="mt-1.5 space-y-1 text-[12px]">
              {outcome.requirements.map((check) => (
                <li key={check.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5" data-requirement={check.met ? 'met' : 'missed'}>
                  <span className="text-white/75">{check.kind}: {formatNumber(check.actual, locale, 1)} {check.unit} / {formatNumber(check.limit, locale, 1)}</span>
                  <span className={check.met ? 'text-emerald-300' : 'text-red-300'}>{check.met ? t('met') : t('missed')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">{t('why')}</p>
          <ul className="mt-1.5 space-y-1 text-[12px] text-white/75">
            {outcome.reasons.slice(0, 6).map((reason, index) => (
              <li key={index} className="leading-snug">• {pickText(reason, locale)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-white/40">{t('stage', { stage: pickText(stageTitle(plan, outcome.endedIn), locale) })}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" data-action="improve" onClick={() => gameStore.getState().redesign()} className="flex-1 rounded-xl border border-cyan-300/60 bg-cyan-400/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50 transition hover:bg-cyan-400/35">{t('improve')}</button>
          <button type="button" data-action="new-mission" onClick={() => gameStore.getState().newMission()} className="flex-1 rounded-xl border border-violet-300/50 bg-violet-400/15 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-50 transition hover:bg-violet-400/30">{t('again')}</button>
          {missionId ? <Link href={`/missions/${missionId}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:text-white">{t('report')}</Link> : null}
        </div>
      </div>
    </div>
  );
}
