'use client';

import { useLocale, useTranslations } from 'next-intl';
import { pickText } from '@/mission';
import { readTelemetry, stageTitle } from '@/mission/sim';
import { countdownSeconds } from './launchPath';
import { formatBits, formatDistance, formatMissionTime, formatNumber, formatSpeed } from '@/game/format';
import { simStore } from '@/stores/simStore';
import { useSimSnapshot } from './useSimSnapshot';

const SEVERITY: Record<string, string> = { info: 'text-white/75', success: 'text-emerald-300', warning: 'text-amber-300', error: 'text-red-300' };

function Bar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

/** The flight screen's overlay: stage track, telemetry, event log, countdown and controls. All numbers come from the simulation. */
export function FlightHud() {
  const t = useTranslations('game.flight');
  const locale = useLocale();
  const { plan, sim, status, clockT } = useSimSnapshot();
  if (!plan || !sim) return null;

  const stageId = plan.stageIds[sim.stageIndex]!;
  const tm = readTelemetry(plan, sim, clockT);
  const planned = stageId === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[stageId] ?? 0);
  const progress = planned > 0 ? Math.min(1, (sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t)) / planned) : 1;
  const lost = Boolean(sim.ended && sim.outcome?.kind === 'failure');
  const log = sim.timeline.slice(-4).reverse();
  const running = status === 'running';
  const showCountdown = stageId === 'pre-launch' && !sim.ended;
  const seconds = countdownSeconds(progress);
  const liftoff = stageId === 'launch' && progress < 0.16 && !sim.ended;
  const ascent = stageId === 'pre-launch' || stageId === 'launch';

  return (
    <>
      {/* stage track */}
      <div className="pointer-events-none absolute inset-x-0 top-[64px] z-10 flex flex-col items-center gap-1.5 px-3">
        <ol className="flex items-center gap-1.5" aria-label={t('stage', { current: sim.stageIndex + 1, total: plan.stageIds.length })}>
          {plan.stageIds.map((id, index) => (
            <li key={id} title={pickText(stageTitle(plan, id), locale)} className={`h-1.5 rounded-full transition-all ${index < sim.stageIndex ? 'w-6 bg-emerald-400' : index === sim.stageIndex ? 'w-10 bg-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.9)]' : 'w-4 bg-white/20'}`} />
          ))}
        </ol>
        <p data-testid="stage-title" className="text-sm font-semibold uppercase tracking-[0.22em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{pickText(stageTitle(plan, stageId), locale)}</p>
        <p className="font-mono text-[11px] tracking-wider text-cyan-200/80" data-testid="mission-clock">{formatMissionTime(tm.elapsedS)}</p>
      </div>

      {/* countdown / liftoff / lost */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        {showCountdown && seconds > 0 ? <p data-testid="countdown" className="font-mono text-7xl font-bold text-white drop-shadow-[0_0_30px_rgba(255,180,90,0.7)] sm:text-9xl">{t('tMinus', { seconds })}</p> : null}
        {liftoff ? <p className="animate-pulse text-5xl font-extrabold uppercase tracking-[0.3em] text-orange-200 drop-shadow-[0_0_30px_rgba(255,140,60,0.9)] sm:text-7xl">{t('liftoff')}</p> : null}
        {lost ? <p data-testid="mission-lost" className="text-4xl font-extrabold uppercase tracking-[0.25em] text-red-300 drop-shadow-[0_0_30px_rgba(255,60,60,0.8)] sm:text-6xl">{t('lost')}</p> : null}
      </div>

      {/* telemetry */}
      <aside data-testid="telemetry" className="absolute bottom-3 left-3 z-20 w-[210px] rounded-2xl border border-white/10 bg-[linear-gradient(170deg,rgba(8,14,26,0.82),rgba(8,10,20,0.7))] p-3 backdrop-blur-md sm:w-[250px]">
        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">{t('telemetry')}</p>
        <dl className="mt-2 space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-2"><dt className="text-white/50">{tm.altitudeM !== null ? t('altitude') : t('distance')}</dt><dd className="font-medium text-white" data-testid="tm-distance">{ascent && tm.altitudeM !== null ? formatDistance(tm.altitudeM, locale) : formatDistance(tm.altitudeM ?? tm.distanceM, locale)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('speed')}</dt><dd className="font-medium text-white" data-testid="tm-speed">{formatSpeed(tm.speedMps, locale)}</dd></div>
          <div>
            <div className="flex justify-between gap-2"><dt className="text-white/50">{t('battery')}</dt><dd className="font-medium text-white">{formatNumber(tm.batteryFraction * 100, locale)}%</dd></div>
            <Bar fraction={tm.batteryFraction} color={tm.batteryFraction < 0.25 ? '#f87171' : '#34d399'} />
          </div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('generation')}</dt><dd className="font-medium text-white">{formatNumber(tm.powerGenerationW, locale)} / {formatNumber(tm.powerLoadW, locale)} W</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('health')}</dt><dd className={`font-medium ${tm.health < 0.5 ? 'text-red-300' : 'text-white'}`}>{formatNumber(tm.health * 100, locale)}%</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('dv')}</dt><dd className="font-medium text-white">{formatNumber(tm.dvRemaining, locale)} m/s</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('data')}</dt><dd className="font-medium text-white">{formatBits(tm.deliveredBits, locale)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('backlog')}</dt><dd className="font-medium text-white">{formatBits(tm.backlogBits, locale)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('science')}</dt><dd className="font-medium text-amber-200">{formatNumber(tm.sciencePoints, locale, 1)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/50">{t('contact')}</dt><dd className={`font-medium ${tm.inContact ? 'text-emerald-300' : 'text-white/60'}`}>{tm.inContact ? t('contactOn') : t('contactOff')}</dd></div>
        </dl>
        {tm.powerMode !== 'nominal' ? <p className="mt-2 rounded-md border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200" data-testid="power-mode">{t(`powerMode.${tm.powerMode}`)}</p> : null}
      </aside>

      {/* log */}
      <aside data-testid="mission-log" className="pointer-events-none absolute bottom-3 right-3 z-20 hidden w-[320px] sm:block">
        <p className="mb-1 text-right text-[10px] uppercase tracking-[0.24em] text-cyan-300/70">{t('log')}</p>
        <ul className="space-y-1">
          {log.map((entry, index) => (
            <li key={`${entry.t}-${index}`} className={`rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-[11px] leading-snug backdrop-blur-md ${SEVERITY[entry.severity] ?? ''}`} style={{ opacity: 1 - index * 0.22 }}>
              {pickText(entry.text, locale)}
            </li>
          ))}
        </ul>
      </aside>

      {/* controls */}
      <div className="absolute right-3 top-[68px] z-20 flex gap-1.5">
        <button type="button" data-action={running ? 'pause' : 'resume'} disabled={sim.ended} onClick={() => (running ? simStore.getState().pause() : simStore.getState().resume())} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-md transition hover:border-white/40 hover:text-white disabled:opacity-30">{running ? t('pause') : t('resume')}</button>
        <button type="button" data-action="skip-stage" title={t('skipHint')} disabled={sim.ended} onClick={() => simStore.getState().skipStage()} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-md transition hover:border-white/40 hover:text-white disabled:opacity-30">{t('skip')} ⏭</button>
      </div>
    </>
  );
}
