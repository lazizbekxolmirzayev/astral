'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { PLAYER_COLORS } from '@/game/crew';
import { MistakeList } from './MistakeList';
import { pickText } from '@/mission';
import { stageTitle } from '@/mission/sim';
import { gameStore, type FlightRecord } from '@/game/gameStore';
import { formatBits, formatMoney, formatNumber } from '@/game/format';
import { useSimSnapshot } from './useSimSnapshot';

const BADGE = {
  success: { color: '#34d399', ring: 'border-emerald-300/60 shadow-[0_0_60px_rgba(52,211,153,0.35)]' },
  partial: { color: '#fbbf24', ring: 'border-amber-300/60 shadow-[0_0_60px_rgba(251,191,36,0.3)]' },
  failure: { color: '#f87171', ring: 'border-red-300/60 shadow-[0_0_60px_rgba(248,113,113,0.35)]' },
} as const;

function formatRequirement(value: number, unit: string, locale: string): string {
  if (unit === 'USD') return formatMoney(value, locale);
  if (unit === '1') return `${formatNumber(value * 100, locale, 1)} %`;
  return `${formatNumber(value, locale, unit === 'pt' ? 1 : 0)} ${unit}`;
}

const GRADE_COLOR = { S: '#fde047', A: '#34d399', B: '#22d3ee', C: '#fbbf24', D: '#f87171' } as const;

function ScoreTab({ record }: { record: FlightRecord }) {
  const t = useTranslations('game.score');
  const tc = useTranslations('game.crew');
  const { score } = record;
  return (
    <div data-testid="score-tab">
      <div className="flex items-center justify-center gap-4">
        <p data-testid="grade" data-grade={score.grade} className="text-6xl font-black" style={{ color: GRADE_COLOR[score.grade], textShadow: `0 0 28px ${GRADE_COLOR[score.grade]}` }}>{score.grade}</p>
        <div>
          <p data-testid="score-total" className="text-3xl font-bold tabular-nums text-white">{score.total}</p>
          <p className="text-[11px] text-white/50">{t('of', { max: score.max })}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {score.lines.map((line) => (
          <li key={line.id} data-score-line={line.id}>
            <div className="flex items-baseline justify-between text-[12px]"><span className="text-white/75">{t(`line.${line.id}`)}</span><span className="tabular-nums text-white">{line.points} / {line.max}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${line.max > 0 ? (line.points / line.max) * 100 : 0}%` }} /></div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-white/40">{t('honest')}</p>
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">{t('crew')}</p>
        <ul className="mt-1.5 space-y-1.5">
          {score.players.map((player) => (
            <li key={player.player} data-player-score={player.player} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px]">
              <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-black" style={{ background: PLAYER_COLORS[player.player] }}>{player.player + 1}</span>
              <span className="min-w-0 flex-1 truncate text-white/85">{record.names[player.player]?.trim() || tc('player', { n: player.player + 1 })}{score.mvp === player.player ? <b className="ml-1.5 text-amber-300">★ {t('mvp')}</b> : null}<span className="block truncate text-[10px] text-white/45">{player.roles.map((role) => tc(`roles.${role}.name`)).join(' · ')}</span></span>
              <span className="text-[10px] text-white/50">{t('tasks', { done: player.tasks - player.missed, total: player.tasks })}</span>
              <span className={`w-10 text-right font-semibold tabular-nums ${player.points >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{player.points}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The result screen: what the simulation concluded, why, and what to do next. */
export function ResultPanel({ missionId }: { missionId: string | null }) {
  const t = useTranslations('game.result');
  const kindT = useTranslations('mission.requirements.kind');
  const locale = useLocale();
  const { plan, sim } = useSimSnapshot();
  const record = useSyncExternalStore(gameStore.subscribe, () => gameStore.getState().record, () => gameStore.getState().record);
  const [tab, setTab] = useState<'result' | 'score' | 'mistakes'>('result');
  const outcome = record?.outcome ?? sim?.outcome;
  if (!plan || !outcome) return null;
  const badge = BADGE[outcome.kind];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]" data-testid="result-panel">
      <div className={`max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl border bg-[linear-gradient(160deg,rgba(8,14,26,0.94),rgba(10,10,24,0.9))] p-5 sm:p-7 ${badge.ring}`}>
        <p data-testid="outcome" data-outcome={outcome.kind} className="text-center text-3xl font-extrabold uppercase tracking-[0.2em] sm:text-4xl" style={{ color: badge.color, textShadow: `0 0 30px ${badge.color}` }}>{t(outcome.kind)}</p>
        <p className="mt-2 text-center text-sm text-white/75">{pickText(outcome.summary, locale)}</p>

        {record ? (
          <div role="tablist" className="mt-4 grid grid-cols-3 gap-1">
            {(['result', 'score', 'mistakes'] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} data-action={`tab-${id}`} onClick={() => setTab(id)} className={`rounded-lg border px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] transition ${tab === id ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-50' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white'}`}>{id === 'mistakes' ? t('tabMistakes', { count: record.mistakes.length }) : t(`tab.${id}`)}</button>
            ))}
          </div>
        ) : null}
        {record && tab === 'score' ? <div className="mt-4"><ScoreTab record={record} /></div> : null}
        {record && tab === 'mistakes' ? <div className="mt-4"><MistakeList mistakes={record.mistakes} record={record} /></div> : null}

        {tab === 'result' || !record ? <>
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
                  <span className="text-white/75">{kindT(check.kind)}: <b className="font-medium text-white">{formatRequirement(check.actual, check.unit, locale)}</b> / {formatRequirement(check.limit, check.unit, locale)}</span>
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
        </> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {record ? <button type="button" data-action="watch-replay" onClick={() => gameStore.getState().startReplay()} className="w-full rounded-xl border border-amber-300/60 bg-amber-400/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-50 transition hover:bg-amber-400/35">▶ {t('watchVideo')}</button> : null}
          <button type="button" data-action="improve" onClick={() => gameStore.getState().redesign()} className="flex-1 rounded-xl border border-cyan-300/60 bg-cyan-400/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50 transition hover:bg-cyan-400/35">{t('improve')}</button>
          <button type="button" data-action="new-mission" onClick={() => gameStore.getState().newMission()} className="flex-1 rounded-xl border border-violet-300/50 bg-violet-400/15 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-50 transition hover:bg-violet-400/30">{t('again')}</button>
          {missionId ? <Link href={`/missions/${missionId}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:text-white">{t('report')}</Link> : null}
        </div>
      </div>
    </div>
  );
}
