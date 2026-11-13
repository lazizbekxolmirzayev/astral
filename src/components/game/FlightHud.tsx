'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useStore } from 'zustand';
import { pickText } from '@/mission';
import { readTelemetry, stageTitle } from '@/mission/sim';
import { countdownSeconds, padWindowProgress } from './launchPath';
import { formatBits, formatDistance, formatLiftoffTime, formatNumber, formatSpeed } from '@/game/format';
import { ASCENT_SPEEDS } from '@/game/cinematic';
import { gameStore, LAUNCH_CAMERAS } from '@/game/gameStore';
import { simStore } from '@/stores/simStore';
import { FlightInstruments } from './Instruments';
import type { RocketClass } from './RocketModel';
import { Subtitles, VoiceDirector } from './VoiceDirector';
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
export function FlightHud({ rocket = 'medium' }: { rocket?: RocketClass }) {
  const t = useTranslations('game.flight');
  const locale = useLocale();
  const { plan, sim, status, clockT } = useSimSnapshot();
  const launchCamera = useStore(gameStore, (state) => state.launchCamera);
  const activeCamera = useStore(gameStore, (state) => state.activeCamera);
  const ascentSpeed = useStore(gameStore, (state) => state.ascentSpeed);
  const onAscent = Boolean(plan && sim && (plan.stageIds[sim.stageIndex] === 'pre-launch' || plan.stageIds[sim.stageIndex] === 'launch') && !sim.ended);
  // C cycles through the launch cameras
  useEffect(() => {
    if (!onAscent) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'c' || event.metaKey || event.ctrlKey || event.altKey) return;
      const state = gameStore.getState();
      const next = LAUNCH_CAMERAS[(LAUNCH_CAMERAS.indexOf(state.launchCamera) + 1) % LAUNCH_CAMERAS.length]!;
      state.setLaunchCamera(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAscent]);
  // Space pauses or resumes the flight (unless a button has the focus, which Space already activates)
  const flying = Boolean(plan && sim && !sim.ended);
  useEffect(() => {
    if (!flying) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select|button|a)$/i.test(target.tagName)) return;
      event.preventDefault();
      const state = simStore.getState();
      if (state.status === 'running') state.pause();
      else if (state.status === 'paused') state.resume();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flying]);
  if (!plan || !sim) return null;

  const stageId = plan.stageIds[sim.stageIndex]!;
  const tm = readTelemetry(plan, sim, clockT);
  const planned = stageId === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[stageId] ?? 0);
  const lost = Boolean(sim.ended && sim.outcome?.kind === 'failure');
  const log = sim.timeline.slice(-4).reverse();
  const running = status === 'running';
  const showCountdown = stageId === 'pre-launch' && !sim.ended;
  const elapsedInStage = sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t);
  const seconds = countdownSeconds(padWindowProgress(planned - elapsedInStage));
  const liftoff = stageId === 'launch' && elapsedInStage < 5 && !sim.ended;
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
        {stageId === 'cruise' || stageId === 'destination-arrival' ? <p data-testid="cruise-note" className="max-w-[min(520px,88vw)] text-center text-[11px] leading-snug text-white/60">{t('cruiseNote')}</p> : null}
        <p className="font-mono text-[11px] tracking-wider text-cyan-200/80" data-testid="mission-clock">{formatLiftoffTime(tm.elapsedS - (plan.stagePlannedS['pre-launch'] ?? 0))}</p>
      </div>

      {/* countdown / liftoff / lost */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        {showCountdown && seconds > 0 ? <p data-testid="countdown" className="font-mono text-7xl font-bold text-white drop-shadow-[0_0_30px_rgba(255,180,90,0.7)] sm:text-9xl">{t('tMinus', { seconds })}</p> : null}
        {liftoff ? <p className="animate-pulse text-5xl font-extrabold uppercase tracking-[0.3em] text-orange-200 drop-shadow-[0_0_30px_rgba(255,140,60,0.9)] sm:text-7xl">{t('liftoff')}</p> : null}
        {lost ? <p data-testid="mission-lost" className="text-4xl font-extrabold uppercase tracking-[0.25em] text-red-300 drop-shadow-[0_0_30px_rgba(255,60,60,0.8)] sm:text-6xl">{t('lost')}</p> : null}
      </div>

      <VoiceDirector rocket={rocket} />
      <Subtitles />
      <FlightInstruments />

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

      {/* crew window: the view from inside the nose */}
      {onAscent && activeCamera === 'crew' ? (
        <div aria-hidden data-testid="crew-window" className="pointer-events-none absolute inset-0 z-[5]" style={{ background: 'radial-gradient(ellipse 62% 58% at 50% 50%, transparent 62%, rgba(2,4,8,0.78) 82%, rgba(2,4,8,0.96) 100%)', boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.65)' }}>
          <div className="absolute left-1/2 top-1/2 h-[64%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[44%] border border-white/10" />
        </div>
      ) : null}

      {/* controls and launch cameras: under the stage header on a phone, in the top-right corner on a larger screen */}
      <div className="absolute inset-x-3 top-[150px] z-20 flex flex-col items-stretch gap-1.5 sm:inset-x-auto sm:right-3 sm:top-[68px] sm:items-end">
        <div className="flex justify-center gap-1.5 sm:justify-end">
          <button type="button" data-action={running ? 'pause' : 'resume'} disabled={sim.ended} onClick={() => (running ? simStore.getState().pause() : simStore.getState().resume())} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-md transition hover:border-white/40 hover:text-white disabled:opacity-30">{running ? t('pause') : t('resume')}</button>
        <button type="button" data-action="skip-stage" title={t('skipHint')} disabled={sim.ended} onClick={() => simStore.getState().skipStage()} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-md transition hover:border-white/40 hover:text-white disabled:opacity-30">{t('skip')} ⏭</button>
        </div>
        {onAscent ? (
          <div role="group" aria-label={t('ascentSpeed.label')} className="flex items-center justify-center gap-1 sm:justify-end">
            <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-white/45">{t('ascentSpeed.label')}</span>
            {ASCENT_SPEEDS.map((value) => (
              <button key={value} type="button" data-action={`ascent-speed-${value}`} aria-pressed={ascentSpeed === value} onClick={() => gameStore.getState().setAscentSpeed(value)} className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.1em] backdrop-blur-md transition ${ascentSpeed === value ? 'border-amber-300/70 bg-amber-400/20 text-amber-100' : 'border-white/15 bg-black/45 text-white/70 hover:border-white/40 hover:text-white'}`}>{value === 1 ? t('ascentSpeed.real') : `×${value}`}</button>
            ))}
          </div>
        ) : null}
        {onAscent ? (
          <div role="group" aria-label={t('camera.label')} className="flex gap-1 overflow-x-auto pb-0.5 sm:max-w-[330px] sm:flex-wrap sm:justify-end sm:overflow-visible">
            {LAUNCH_CAMERAS.map((mode) => {
            const selected = launchCamera === mode;
            return (
              <button key={mode} type="button" data-action={`camera-${mode}`} aria-pressed={selected} onClick={() => gameStore.getState().setLaunchCamera(mode)} className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] backdrop-blur-md transition ${selected ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 bg-black/45 text-white/70 hover:border-white/40 hover:text-white'}`}>{t(`camera.${mode}`)}</button>
            );
          })}
          </div>
        ) : null}
        {onAscent ? (
          <p className="hidden text-right sm:block text-[10px] tracking-[0.12em] text-white/45">{launchCamera === 'auto' && activeCamera ? `${t('camera.auto')} · ${t(`camera.${activeCamera}`)} · ` : ''}{t('camera.key')}</p>
        ) : null}
      </div>
    </>
  );
}
