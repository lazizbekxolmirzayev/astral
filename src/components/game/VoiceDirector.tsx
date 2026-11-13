'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';
import { SIM_ASSUMPTIONS } from '@/mission/sim/assumptions';
import { readTelemetry } from '@/mission/sim';
import { createAnnouncer, speakLine, stopSpeaking, subscribeSubtitle, subtitleSnapshot } from '@/game/voice';
import { simStore } from '@/stores/simStore';
import { SEPARATION } from './launchPath';
import { rocketDims, type RocketClass } from './RocketModel';

/**
 * Listens to the simulation and has mission control and the crew speak at the right moments. It renders
 * nothing; the subtitles are shown by `Subtitles`. Mounted for the length of a flight.
 */
export function VoiceDirector({ rocket }: { rocket: RocketClass }) {
  const t = useTranslations('game.voice');
  const locale = useLocale();
  useEffect(() => {
    const announcer = createAnnouncer();
    const hasBoosters = rocketDims(rocket).boosters > 0;
    const run = () => {
      const { plan, sim, clockT } = simStore.getState();
      if (!plan || !sim) return;
      const stage = plan.stageIds[sim.stageIndex]!;
      const elapsed = sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t);
      const needsTelemetry = stage === 'launch' || stage === 'orbit-insertion';
      const tm = needsTelemetry ? readTelemetry(plan, sim, clockT) : null;
      const lines = announcer.update({
        stage,
        stageElapsedS: elapsed,
        stageLengthS: plan.stagePlannedS[stage] ?? 0,
        altitudeKm: (tm?.altitudeM ?? 0) / 1000,
        speedKms: (tm?.speedMps ?? 0) / 1000,
        parkingKm: SIM_ASSUMPTIONS.parkingAltitudeKm,
        hasBoosters,
        separation: SEPARATION,
        lost: Boolean(sim.ended && sim.outcome?.kind === 'failure'),
      });
      for (const line of lines) speakLine(line.id, line.speaker, t(line.key, line.params ?? {}), locale, { skipIfBusy: line.key === 'count' });
    };
    const unsubscribe = simStore.subscribe(run);
    run();
    return () => {
      unsubscribe();
      stopSpeaking();
    };
  }, [t, locale, rocket]);
  return null;
}

/** The line being spoken, written out: who says it and what. */
export function Subtitles() {
  const t = useTranslations('game.voice.speakers');
  const line = useSyncExternalStore(subscribeSubtitle, subtitleSnapshot, () => null);
  if (!line) return null;
  return (
    <p data-testid="subtitle" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-[100px] z-30 mx-auto w-fit max-w-[min(640px,92vw)] rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-center text-[13px] text-white backdrop-blur-md min-[1060px]:bottom-[176px]">
      <span className={`mr-2 text-[10px] font-semibold uppercase tracking-[0.2em] ${line.speaker === 'crew' ? 'text-amber-300' : 'text-cyan-300'}`}>{t(line.speaker)}</span>
      {line.text}
    </p>
  );
}
