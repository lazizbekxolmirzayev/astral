'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from 'zustand';
import { altitudeOf, referencePitch, downrangeOf, fuelFraction, hintOf, orbitOf, speedOf, TARGET_ALTITUDE_M, type HintKey } from '@/game/pilot/model';
import { OUTCOME_HOLD_S, PILOT_MODES, PITCH_RATE_DEG, pilotStore, usePilot, WARPS, type PilotMode } from '@/game/pilotStore';
import { Dial, GuardedSwitch, Lamp, Lcd, Lever, Plate, Selector, Stick, Tank, Toggle } from './CockpitParts';
import { onlineStore } from '@/game/online';
import { simStore } from '@/stores/simStore';
import { PLAYER_COLORS, isAiRole, type CrewRole } from '@/game/crew';
import { crewStore, useCrewStore } from '@/game/crewStore';

const THROTTLE_RATE = 0.7; // per second while a key is held
const km = (meters: number, digits = 0) => (Number.isFinite(meters) ? (meters / 1000).toFixed(digits) : '∞');

/** Held keys and on-screen buttons share one set, read every frame. */
const held = new Set<string>();

/**
 * The pilot's seat: runs the manually flown ascent (starts it when the launch stage begins, advances it every frame, and
 * hands the result back to the mission simulation) and shows the controls and instruments.
 */
export function PilotConsole() {
  const t = useTranslations('game.pilot');
  const tRole = useTranslations('game.crew.roles');
  const tCrew = useTranslations('game.crew');
  const crewNames = useCrewStore((state) => state.names);
  const aiAction = usePilot((state) => state.aiAction);
  const mode = usePilot((state) => state.mode);
  const hasFlight = usePilot((state) => state.flight !== null);
  const warp = usePilot((state) => state.warp);
  const [, setFrame] = useState(0);
  const last = useRef<number | null>(null);

  // the driver
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last.current === null ? 0 : Math.min(0.25, (now - last.current) / 1000);
      last.current = now;
      const pilot = pilotStore.getState();
      const { plan, sim } = simStore.getState();
      if (!plan || !sim) return;
      const stage = plan.stageIds[sim.stageIndex];
      if (stage !== 'launch' || sim.ended) {
        if (pilot.flight) pilot.reset();
        return;
      }
      if (pilot.crewCount !== crewStore.getState().playerCount) pilot.setCrewCount(crewStore.getState().playerCount);
      if (pilot.mode === 'off' || onlineStore.getState().mode !== 'off') return;
      if (!pilot.flight) { pilot.begin(plan); return; }
      // keys: throttle and pitch
      if (pilot.flight.status === 'flying' && pilot.mode !== 'auto') {
        if (held.has('throttleUp')) pilot.setThrottle(pilot.throttle + THROTTLE_RATE * dt);
        if (held.has('throttleDown')) pilot.setThrottle(pilot.throttle - THROTTLE_RATE * dt);
        if (pilot.mode === 'manual' || pilot.flight.stage === 2) {
          if (held.has('pitchUp')) pilot.nudgePitch(-PITCH_RATE_DEG * dt);
          if (held.has('pitchDown')) pilot.nudgePitch(PITCH_RATE_DEG * dt);
        }
      }
      pilot.update(dt);
      setFrame((value) => (value + 1) % 1_000_000);
      const after = pilotStore.getState();
      const flight = after.flight;
      if (flight && flight.status !== 'flying' && (after.endedFor ?? 0) >= OUTCOME_HOLD_S) {
        const failure = flight.status === 'orbit' ? null : flight.reason === 'stress' ? 'stress' : flight.reason === 'fuel' ? 'fuel' : 'ground';
        const state = simStore.getState();
        if (state.plan) simStore.setState({ plan: { ...state.plan, launch: { ...state.plan.launch, success: failure === null, pilot: { failure, grade: after.rating?.grade ?? null } } } });
        simStore.getState().skipStage();
        pilotStore.getState().reset();
        if (simStore.getState().status === 'paused') simStore.getState().resume();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); last.current = null; };
  }, []);

  // the keyboard
  useEffect(() => {
    const map: Record<string, string> = { w: 'throttleUp', arrowup: 'throttleUp', s: 'throttleDown', arrowdown: 'throttleDown', a: 'pitchUp', arrowleft: 'pitchUp', d: 'pitchDown', arrowright: 'pitchDown' };
    const onDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      const key = event.key.toLowerCase();
      const pilot = pilotStore.getState();
      if (!pilot.flight || pilot.flight.status !== 'flying') return;
      if (map[key]) { held.add(map[key]!); event.preventDefault(); return; }
      if (key === 'e') pilot.requestSeparate();
      else if (key === 'x') pilot.setThrottle(0);
      else if (key === 'z') pilot.setThrottle(1);
      else if (key === 'l' && !isAiRole('power', pilot.crewCount)) pilot.setLimiter(!pilot.limiter);
    };
    const onUp = (event: KeyboardEvent) => { const name = map[event.key.toLowerCase()]; if (name) held.delete(name); };
    const clear = () => held.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', clear); held.clear(); };
  }, []);

  const flight = pilotStore.getState().flight;
  if (!flight || mode === 'off') return null;
  const pilot = pilotStore.getState();
  const altitude = altitudeOf(flight);
  const orbit = orbitOf(flight);
  const hint: HintKey = hintOf(flight);
  const ended = flight.status !== 'flying';
  const fuel1 = fuelFraction(flight, 1);
  const fuel2 = fuelFraction(flight, 2);
  const stress = Math.min(1, flight.stressRatio);
  const elevationDeg = 90 - (flight.pitch * 180) / Math.PI;
  const advisedDeg = 90 - (referencePitch(flight) * 180) / Math.PI;
  const offDeg = elevationDeg - advisedDeg;
  const caution = !ended && (hint === 'stress' || hint === 'stage' || hint === 'circularize' || hint === 'cut');
  const fuelLow = !ended && (flight.stage === 1 ? fuel1 : fuel2) < 0.12;
  const guardActing = aiAction === 'guard';
  const stationColor = (role: CrewRole, index: number) => (isAiRole(role, crewCount) ? '#94a3b8' : PLAYER_COLORS[index]!);
  const stationSub = (role: CrewRole, index: number) => (isAiRole(role, crewCount) ? t('duty.ai') : crewNames[index]?.trim() || tCrew('player', { n: index + 1 }));
  const crewCount = pilot.crewCount;
  const aiPower = isAiRole('power', crewCount);
  const limiterOn = aiPower || pilot.limiter;

  return (
    <section data-testid="pilot-console" aria-label={t('title')} className="absolute inset-x-2 bottom-2 z-30 mx-auto w-auto max-w-[960px] rounded-xl border border-[#2d3648] p-2 shadow-[0_0_40px_rgba(0,0,0,0.6)] sm:bottom-3" style={{ background: 'linear-gradient(180deg,rgba(15,20,30,0.96),rgba(8,11,18,0.97))' }}>
      <div className="mb-1.5 flex items-center gap-2 rounded-md border border-[#1b2a22] bg-[#04100a] px-2 py-1">
        <Lamp on={caution || (ended && flight.status !== 'orbit')} color={ended && flight.status !== 'orbit' ? 'red' : 'amber'} label={t('lamp.caution')} flash={!ended && hint === 'stress'} />
        {ended ? (
          <p data-testid="pilot-result" className={`flex-1 text-center font-mono text-[12px] font-bold uppercase tracking-[0.18em] ${flight.status === 'orbit' ? 'text-emerald-300' : 'text-red-300'}`}>
            {flight.status === 'orbit' ? t(`result.${pilot.rating?.grade ?? 'good'}`) : t(`fail.${flight.reason ?? 'ground'}`)}
          </p>
        ) : (
          <p data-testid="pilot-hint" className={`flex-1 text-center font-mono text-[12px] ${hint === 'stress' ? 'animate-pulse text-red-300' : caution ? 'text-amber-200' : 'text-emerald-200/90'}`} style={{ textShadow: '0 0 6px rgba(74,222,128,0.35)' }}>{t(`hint.${hint}`)}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-[1.15fr_1.25fr_0.95fr_1.15fr]">
        {/* captain: where the nose points, and the stage */}
        <Plate testId="duty-director" title={tRole('director.name')} sub={stationSub('director', 0)} color={stationColor('director', 0)} ai={isAiRole('director', crewCount)}>
          <div className="flex items-center justify-around">
            <Dial value={elevationDeg} min={0} max={90} marker={advisedDeg} label={t('pitch')} unit="°" display={`${Math.round(elevationDeg)}`} ticks={6} testId="pilot-pitch" />
            <Stick label={t('stick')} disabled={ended || mode === 'auto' || (mode === 'assist' && flight.stage === 1)} onChange={(direction) => { held.delete('pitchUp'); held.delete('pitchDown'); if (direction < 0) held.add('pitchUp'); else if (direction > 0) held.add('pitchDown'); }} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-slate-400"><span>{t('advised')}</span><span data-testid="pilot-advised" className="font-mono" style={{ color: Math.abs(offDeg) <= 3 ? '#6ee7b7' : '#e2e8f0' }}>{Math.round(advisedDeg)}°</span></div>
          <div className="mt-1"><GuardedSwitch action="pilot-stage" label={t('stage')} cover={t('lift')} disabled={ended || flight.stage === 2 || mode === 'auto'} onThrow={() => pilot.requestSeparate()} /></div>
        </Plate>

        {/* engineer: the engines and the tanks */}
        <Plate testId="duty-propulsion" title={tRole('propulsion.name')} sub={stationSub('propulsion', 1)} color={stationColor('propulsion', 1)} lit={isAiRole('propulsion', crewCount) && aiAction === 'throttle'} ai={isAiRole('propulsion', crewCount)}>
          <div className="flex items-end justify-around gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <Lever testId="pilot-throttle" label={t('throttle')} value={pilot.throttle} disabled={ended || mode === 'auto'} onChange={(next) => pilot.setThrottle(next)} />
              <span className="font-mono text-[10px] text-amber-200" data-testid="pilot-throttle-value">{Math.round(pilot.throttle * 100)}%</span>
              <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t('throttle')}</span>
            </div>
            <Tank label={t('fuel1')} fraction={fuel1} color="#fb923c" />
            <Tank label={t('fuel2')} fraction={fuel2} color="#38bdf8" />
          </div>
          <button type="button" data-action="pilot-cut" aria-label={t('cut')} disabled={ended || mode === 'auto'} onClick={() => pilot.setThrottle(0)} className="mt-1.5 flex w-full items-center justify-between rounded-md border border-[#3b465c] bg-[#070a10] px-2 py-1 disabled:opacity-50">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-200">{t('cut')}</span>
            <span aria-hidden className="h-5 w-5 rounded-full border border-red-200/60 shadow-[0_3px_5px_rgba(0,0,0,0.7)]" style={{ background: 'radial-gradient(circle at 35% 30%,#fca5a5,#dc2626 55%,#7f1d1d)' }} />
          </button>
        </Plate>

        {/* power tech: the load on the structure */}
        <Plate testId="duty-power" title={tRole('power.name')} sub={stationSub('power', 2)} color={stationColor('power', 2)} lit={aiPower && aiAction === 'guard'} ai={aiPower}>
          <div className="flex justify-center"><Dial value={stress * 100} min={0} max={100} redFrom={70} label={t('stress')} unit="%" display={`${Math.round(stress * 100)}`} ticks={5} /></div>
          <div className="mt-1 flex justify-center gap-1">
            <Lamp on={stress > 0.7} color="red" label={t('lamp.overload')} flash />
            <Lamp on={limiterOn} color={guardActing ? 'amber' : 'green'} label={t('lamp.limiter')} />
          </div>
          <div className="mt-1.5"><Toggle action="pilot-limiter" label={t('limiter')} state={limiterOn ? t('on') : t('off')} title={t('limiterHint')} on={limiterOn} disabled={ended || mode === 'auto' || aiPower} onToggle={() => pilot.setLimiter(!pilot.limiter)} /></div>
        </Plate>

        {/* comms officer: the numbers and the lamps */}
        <Plate testId="duty-comms" title={tRole('comms.name')} sub={stationSub('comms', 3)} color={stationColor('comms', 3)} ai={isAiRole('comms', crewCount)}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <Lcd label={t('altitude')} value={`${km(altitude, 1)} km`} testId="pilot-altitude" />
            <Lcd label={t('speed')} value={`${(speedOf(flight) / 1000).toFixed(2)} km/s`} testId="pilot-speed" />
            <Lcd label={t('apogee')} value={`${km(orbit.apoapsis)} km`} testId="pilot-apogee" />
            <Lcd label={t('perigee')} value={`${km(orbit.periapsis)} km`} testId="pilot-perigee" tone={orbit.periapsis >= 150_000 ? 'good' : undefined} />
            <Lcd label={t('climb')} value={`${Math.round(flight.vr)} m/s`} />
            <Lcd label={t('time')} value={`T+${Math.floor(flight.t / 60)}:${String(Math.floor(flight.t % 60)).padStart(2, '0')}`} />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex gap-1">
              <Lamp on={orbit.periapsis >= 150_000} color="green" label={t('lamp.orbit')} />
              <Lamp on={flight.stage === 2} color="blue" label={t('lamp.stage2')} />
              <Lamp on={fuelLow} color="red" label={t('lamp.fuel')} flash />
            </div>
            <Selector label={t('warp')} value={warp} options={WARPS} labelOf={(value) => `×${value}`} onSelect={(value) => pilot.setWarp(value)} action={(value) => `pilot-warp-${value}`} />
          </div>
        </Plate>
      </div>
      <span hidden data-testid="pilot-active" data-hold={hasFlight ? 'true' : 'false'} />
    </section>
  );
}

/** The flight-mode selector: a rotary switch with its four positions. Going back to the film is locked once the flight began. */
export function PilotModeChips() {
  const t = useTranslations('game.pilot');
  const mode = useStore(pilotStore, (state) => state.mode);
  const flying = useStore(pilotStore, (state) => state.flight !== null);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#2d3648] px-2 py-0.5" style={{ background: 'linear-gradient(180deg,rgba(29,37,51,0.92),rgba(18,23,35,0.92))' }}>
      <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('modeLabel')}</span>
      <Selector label={t('modeLabel')} value={mode} options={PILOT_MODES} labelOf={(value) => t(`mode.${value}`)} onSelect={(value: PilotMode) => pilotStore.getState().setMode(value)} action={(value) => `pilot-mode-${value}`} disabledOf={(value) => flying && value === 'off'} />
    </div>
  );
}

/** The mission clock while a person flies: the flight's own time, counted from lift-off. */
export function PilotClock() {
  const tick = useStore(pilotStore, (state) => state.tick);
  void tick;
  const flight = pilotStore.getState().flight;
  const seconds = Math.floor(flight?.t ?? 0);
  return <p className="font-mono text-[11px] tracking-wider text-cyan-200/80" data-testid="mission-clock">T+ {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</p>;
}
