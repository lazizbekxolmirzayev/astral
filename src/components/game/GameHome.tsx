'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BODY_IDS } from '@/mission/constants';
import { DEFAULT_MISSION_TITLES, DESTINATION_IDS, DESTINATIONS, LAUNCHERS, pickText } from '@/mission';
import { blip, isMuted, setMuted, setThrust, subscribeMuted, unlock } from '@/game/audio';
import { gameStore, useGameStore, type GamePhase } from '@/game/gameStore';
import { isWebGLAvailable } from '@/lib/webgl';
import { missionStore, useMissionStore } from '@/stores/missionStore';
import { useSimStore } from '@/stores/simStore';
import { AccountMenu } from '../ui/AccountMenu';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { FlightHud } from './FlightHud';
import { LabelLayer, type LabelSpec } from './labels';
import { HangarPanel } from './HangarPanel';
import { HelpBox } from './HelpBox';
import { LangSwitch } from './LangSwitch';
import { OnlineConsole } from './OnlineConsole';
import { SceneFade } from './SceneFade';
import { OnlineHost } from './OnlineHost';
import { RoomMenu } from './RoomMenu';
import { useOnline } from '@/game/online';
import { MapPanel } from './MapPanel';
import { ResultPanel } from './ResultPanel';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false, loading: () => null });

let webglProbe: boolean | null = null;
const getWebgl = () => (webglProbe ??= isWebGLAvailable());
const noSubscribe = () => () => undefined;

function MuteButton() {
  const t = useTranslations('game.topbar');
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  return (
    <button type="button" data-action="toggle-sound" aria-pressed={!muted} title={muted ? t('unmute') : t('mute')} aria-label={muted ? t('unmute') : t('mute')} onClick={() => { unlock(); setMuted(!muted); }} className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/70 backdrop-blur-md transition hover:border-white/40 hover:text-white">
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

const STEPS: GamePhase[] = ['map', 'hangar', 'flight', 'result'];

/** How long the finished flight stays on screen before the result card appears. */
const RESULT_DELAY_MS = 2600;
const FAILED_LAUNCH_DELAY_MS = 3800;

function Fallback() {
  const t = useTranslations('game');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#05070d] px-6 text-center">
      <p className="max-w-md text-sm text-white/70">{t('noWebgl')}</p>
      <Link href="/missions" className="rounded-xl border border-cyan-300/50 bg-cyan-400/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50">{t('noWebglAction')}</Link>
    </div>
  );
}

/**
 * The game: one full-screen 3D scene with the interface laid over it. The scene follows the phase (map,
 * hangar, flight, result); the design and the flight live in the mission and simulation stores.
 */
export function GameHome() {
  const t = useTranslations('game');
  const locale = useLocale();
  const webgl = useSyncExternalStore(noSubscribe, getWebgl, () => null);
  const phase = useGameStore((state) => state.phase);
  const missionId = useGameStore((state) => state.missionId);
  const mission = useMissionStore((state) => (missionId ? state.missions[missionId] : undefined));
  const stepPhase: GamePhase = phase === 'replay' ? 'result' : phase;
  const status = useSimStore((state) => state.status);
  const outcome = useSimStore((state) => state.sim?.outcome ?? null);
  const [ready, setReady] = useState(false);
  const onlineMode = useOnline((state) => state.mode);

  const focus = useGameStore((state) => state.focus);
  const hangarView = useGameStore((state) => state.hangarView);
  const rocketId = mission?.launch.vehicleId ?? null;
  const labels = useMemo<LabelSpec[]>(() => {
    if (phase === 'map') return DESTINATION_IDS.map((id) => ({ id: `dest:${id}`, testId: 'data-destination-label', text: pickText(DESTINATIONS.find((entry) => entry.id === id)!.name, locale), selected: focus === id }));
    if (phase === 'hangar') return LAUNCHERS.map((launcher) => ({ id: `rocket:${launcher.id}`, testId: 'data-rocket-label', text: pickText(launcher.name, locale), selected: rocketId === launcher.id }));
    if (phase === 'flight' || phase === 'replay') {
      const names = [
        { id: 'flight:craft', text: t('flight.labels.craft') },
        { id: 'flight:target', text: t('flight.labels.target') },
        ...BODY_IDS.map((body) => ({ id: `flight:body-${body}`, text: t(`flight.bodies.${body}`) })),
      ];
      return names.map((entry) => ({ ...entry, testId: 'data-flight-label', selected: entry.id === 'flight:craft' }));
    }
    return [];
  }, [phase, locale, focus, rocketId, t]);

  // When the flight ends, let the last moments play, then show the result.
  useEffect(() => {
    if (phase !== 'flight' || status !== 'finished') return;
    const delay = outcome?.kind === 'failure' && outcome.endedIn === 'launch' ? FAILED_LAUNCH_DELAY_MS : RESULT_DELAY_MS;
    const id = window.setTimeout(() => gameStore.getState().showResult(), delay);
    return () => window.clearTimeout(id);
  }, [phase, status, outcome]);

  const build = useCallback(() => {
    const focus = gameStore.getState().focus;
    if (!focus) return;
    unlock();
    blip(740);
    gameStore.getState().confirmDestination(pickText(DEFAULT_MISSION_TITLES[focus], locale));
  }, [locale]);

  const launch = useCallback(() => {
    unlock();
    blip(520, 0.15);
    gameStore.getState().launch();
  }, []);

  // silence the engine when the flight screen is left
  useEffect(() => {
    if (phase !== 'flight') setThrust(0);
  }, [phase]);

  // keep the missions list in step if the player came back from the Engineer pages
  useEffect(() => {
    const id = gameStore.getState().missionId;
    if (id && !missionStore.getState().missions[id]) gameStore.getState().newMission();
  }, []);

  return (
    <main className="relative h-full min-h-0 w-full overflow-hidden bg-[#05070d] text-foreground" data-game-phase={phase}>
      {webgl === false ? (
        <Fallback />
      ) : (
        <ErrorBoundary fallback={<Fallback />}>
          <div className="absolute inset-0" aria-hidden={phase === 'result'}>
            {webgl ? <GameCanvas onReady={() => setReady(true)} /> : null}
          </div>
        </ErrorBoundary>
      )}

      {webgl !== false ? (
        <>
          <LabelLayer labels={labels} />

          {/* top bar */}
          <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
            <div className="pointer-events-auto flex items-center gap-2.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(0,240,255,0.7)]" />
              <span className="text-sm font-semibold tracking-[0.22em] text-white">NEXUS</span>
              <ol className="ml-2 hidden items-center gap-1 sm:flex" aria-label={t('title')}>
                {STEPS.map((step, index) => (
                  <li key={step} aria-current={step === stepPhase ? 'step' : undefined} className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${step === stepPhase ? 'bg-cyan-400/20 text-cyan-100' : STEPS.indexOf(stepPhase) > index ? 'text-white/55' : 'text-white/30'}`}>
                    {index + 1} · {t(`steps.${step}`)}
                  </li>
                ))}
              </ol>
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5">
              <Link href="/universe" className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/70 backdrop-blur-md transition hover:border-white/40 hover:text-white">{t('topbar.universe')}</Link>
              <Link href={missionId ? `/missions/${missionId}` : '/missions'} title={t('topbar.engineerHint')} className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/70 backdrop-blur-md transition hover:border-white/40 hover:text-white">{t('topbar.engineer')}</Link>
              <RoomMenu />
              <LangSwitch />
              <HelpBox phase={phase === 'replay' ? 'result' : phase} />
              <MuteButton />
              <div className="hidden sm:block"><AccountMenu /></div>
            </div>
          </header>

          {/* the interface of the current phase; a key restarts its fade-in when the phase changes */}
          <div key={phase} className="game-phase-in pointer-events-none absolute inset-0">
            <div className="pointer-events-none absolute inset-0 [&>*:not(.pointer-events-none)]:pointer-events-auto [&_[data-nopointer]]:pointer-events-none">
              {phase === 'map' ? <MapPanel focus={focus} onBuild={build} /> : null}
              {phase === 'hangar' && mission ? <HangarPanel mission={mission} view={hangarView} onLaunch={launch} /> : null}
              {phase === 'flight' || phase === 'replay' ? <FlightHud replay={phase === 'replay'} rocket={LAUNCHERS.find((launcher) => launcher.id === rocketId)?.sizeClass ?? 'medium'} /> : null}
              {phase === 'result' ? <ResultPanel missionId={missionId} /> : null}
            </div>
          </div>

          <SceneFade />
          <OnlineHost />
          {onlineMode === 'client' ? <OnlineConsole /> : null}

          {!ready ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#05070d]" data-testid="game-loading">
              <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-cyan-200/80">{t('loading')}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
