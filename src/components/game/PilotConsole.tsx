'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from 'zustand';
import { autopilot, altitudeOf, downrangeOf, fuelFraction, hintOf, orbitOf, speedOf, TARGET_ALTITUDE_M, type HintKey } from '@/game/pilot/model';
import { OUTCOME_HOLD_S, PILOT_MODES, PITCH_RATE_DEG, pilotStore, usePilot, WARPS, type PilotMode } from '@/game/pilotStore';
import { onlineStore } from '@/game/online';
import { simStore } from '@/stores/simStore';
import { CREW_ROLES, PLAYER_COLORS, isAiRole, type CrewRole } from '@/game/crew';
import { crewStore, useCrewStore } from '@/game/crewStore';
import { usePlayerName } from './CrewPanel';

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
  const advisedDeg = 90 - (autopilot(flight).pitchCommand * 180) / Math.PI;
  const offDeg = elevationDeg - advisedDeg;

  return (
    <section data-testid="pilot-console" aria-label={t('title')} className="absolute inset-x-2 bottom-2 z-30 mx-auto w-auto max-w-[660px] rounded-2xl border border-cyan-300/25 bg-[linear-gradient(170deg,rgba(6,12,24,0.88),rgba(6,8,18,0.8))] p-3 shadow-[0_0_40px_rgba(0,160,255,0.12)] backdrop-blur-md sm:bottom-3">
      {ended ? (
        <p data-testid="pilot-result" className={`mb-2 text-center text-sm font-bold uppercase tracking-[0.2em] ${flight.status === 'orbit' ? 'text-emerald-300' : 'text-red-300'}`}>
          {flight.status === 'orbit' ? t(`result.${pilot.rating?.grade ?? 'good'}`) : t(`fail.${flight.reason ?? 'ground'}`)}
        </p>
      ) : (
        <p data-testid="pilot-hint" className={`mb-2 text-center text-[12px] font-medium ${hint === 'stress' ? 'animate-pulse text-red-300' : hint === 'stage' || hint === 'circularize' || hint === 'cut' ? 'text-amber-200' : 'text-cyan-100/90'}`}>{t(`hint.${hint}`)}</p>
      )}
      <Duties />
      <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-3">
        {/* throttle */}
        <div className="flex w-14 flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-[0.16em] text-white/50">{t('throttle')}</span>
          <div className="relative h-24 w-5 overflow-hidden rounded-full border border-white/15 bg-black/50" aria-hidden>
            <div className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-orange-500 to-amber-200" style={{ height: `${flight.thrust > 0 ? Math.max(flight.thrust, pilot.throttle) * 100 : pilot.throttle * 100}%`, opacity: flight.thrust > 0 ? 1 : 0.45 }} />
          </div>
          <input aria-label={t('throttle')} data-testid="pilot-throttle" type="range" min={0} max={100} value={Math.round(pilot.throttle * 100)} disabled={ended || mode === 'auto'} onChange={(event) => pilot.setThrottle(Number(event.target.value) / 100)} className="w-14 accent-orange-400" />
          <span className="font-mono text-[11px] text-white" data-testid="pilot-throttle-value">{Math.round(pilot.throttle * 100)}%</span>
        </div>

        {/* instruments */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
          <Reading label={t('altitude')} value={`${km(altitude, 1)} km`} testId="pilot-altitude" />
          <Reading label={t('speed')} value={`${(speedOf(flight) / 1000).toFixed(2)} km/s`} testId="pilot-speed" />
          <Reading label={t('climb')} value={`${Math.round(flight.vr)} m/s`} />
          <Reading label={t('apogee')} value={`${km(orbit.apoapsis)} km`} testId="pilot-apogee" />
          <Reading label={t('perigee')} value={`${km(orbit.periapsis)} km`} testId="pilot-perigee" tone={orbit.periapsis >= 150_000 ? 'good' : undefined} />
          <Reading label={t('target')} value={`${km(TARGET_ALTITUDE_M)} km`} />
          <Meter label={t('fuel1')} fraction={fuel1} color="#fb923c" />
          <Meter label={t('fuel2')} fraction={fuel2} color="#38bdf8" />
          <Meter label={t('stress')} fraction={stress} color={stress > 0.7 ? '#f87171' : '#a3e635'} />
          <Reading label={t('pitch')} value={`${Math.round(elevationDeg)}°`} />
          <Reading label={t('advised')} value={`${Math.round(advisedDeg)}°`} testId="pilot-advised" tone={Math.abs(offDeg) <= 3 ? 'good' : undefined} />
          <Reading label={t('downrange')} value={`${km(downrangeOf(flight))} km`} />
          <Reading label={t('time')} value={`T+${Math.floor(flight.t / 60)}:${String(Math.floor(flight.t % 60)).padStart(2, '0')}`} />
        </dl>

        {/* actions */}
        <div className="flex w-[92px] flex-col gap-1.5">
          <div className="flex gap-1.5">
            <HoldButton name="pitchUp" label={t('pitchUp')} disabled={ended || mode === 'auto' || (mode === 'assist' && flight.stage === 1)}>▲</HoldButton>
            <HoldButton name="pitchDown" label={t('pitchDown')} disabled={ended || mode === 'auto' || (mode === 'assist' && flight.stage === 1)}>▼</HoldButton>
          </div>
          <button type="button" data-action="pilot-stage" disabled={ended || flight.stage === 2 || mode === 'auto'} onClick={() => pilot.requestSeparate()} className="rounded-lg border border-amber-300/50 bg-amber-400/15 px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-100 enabled:hover:bg-amber-400/25 disabled:opacity-35">{t('stage')} <kbd className="ml-0.5 opacity-60">E</kbd></button>
          <div className="flex gap-1.5">
            <button type="button" data-action="pilot-cut" disabled={ended || mode === 'auto'} onClick={() => pilot.setThrottle(0)} className="flex-1 rounded-lg border border-white/20 bg-white/5 px-1 py-1 text-[10px] font-semibold uppercase text-white/80 disabled:opacity-35">{t('cut')}</button>
            <button type="button" data-action="pilot-full" disabled={ended || mode === 'auto'} onClick={() => pilot.setThrottle(1)} className="flex-1 rounded-lg border border-white/20 bg-white/5 px-1 py-1 text-[10px] font-semibold uppercase text-white/80 disabled:opacity-35">{t('full')}</button>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
        <p className="hidden text-[10px] text-white/45 sm:block">{t('keys')}</p>
        <div className="flex items-center gap-1" role="group" aria-label={t('warp')}>
          <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-white/45">{t('warp')}</span>
          {WARPS.map((value) => (
            <button key={value} type="button" data-action={`pilot-warp-${value}`} aria-pressed={warp === value} onClick={() => pilot.setWarp(value)} className={`rounded-full border px-2 py-0.5 text-[10px] ${warp === value ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 text-white/60'}`}>×{value}</button>
          ))}
        </div>
      </div>
      <span hidden data-testid="pilot-active" data-hold={hasFlight ? 'true' : 'false'} />
    </section>
  );
}

function Reading({ label, value, testId, tone }: { label: string; value: string; testId?: string; tone?: 'good' }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-white/50">{label}</dt>
      <dd className={`font-mono font-medium ${tone === 'good' ? 'text-emerald-300' : 'text-white'}`} data-testid={testId}>{value}</dd>
    </div>
  );
}

function Meter({ label, fraction, color }: { label: string; fraction: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between gap-2"><dt className="text-white/50">{label}</dt><dd className="font-mono text-white">{Math.round(Math.max(0, fraction) * 100)}%</dd></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: color }} /></div>
    </div>
  );
}

/** A button that counts as a held key while it is pressed (mouse or touch). */
function HoldButton({ name, label, disabled, children }: { name: string; label: string; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-action={`pilot-${name}`}
      disabled={disabled}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); held.add(name); }}
      onPointerUp={() => held.delete(name)}
      onPointerCancel={() => held.delete(name)}
      onPointerLeave={() => held.delete(name)}
      className="flex-1 touch-none rounded-lg border border-cyan-300/40 bg-cyan-400/10 py-1.5 text-sm text-cyan-100 enabled:active:bg-cyan-400/30 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/** Chooses who flies the ascent; changes are allowed on the pad and during the flight (except back to the film). */
export function PilotModeChips() {
  const t = useTranslations('game.pilot');
  const mode = useStore(pilotStore, (state) => state.mode);
  const flying = useStore(pilotStore, (state) => state.flight !== null);
  return (
    <div role="group" aria-label={t('modeLabel')} className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
      <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-white/45">{t('modeLabel')}</span>
      {PILOT_MODES.map((value: PilotMode) => (
        <button key={value} type="button" data-action={`pilot-mode-${value}`} aria-pressed={mode === value} title={t(`modeHint.${value}`)} disabled={flying && value === 'off'} onClick={() => pilotStore.getState().setMode(value)} className={`rounded-full border px-2 py-0.5 text-[10px] disabled:opacity-35 ${mode === value ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 bg-black/30 text-white/60 hover:text-white'}`}>{t(`mode.${value}`)}</button>
      ))}
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

const DUTY: Record<CrewRole, 'director' | 'propulsion' | 'power' | 'comms'> = { director: 'director', propulsion: 'propulsion', power: 'power', comms: 'comms' };

function DutyCard({ role, index, count, flying }: { role: CrewRole; index: number; count: number; flying: boolean }) {
  const t = useTranslations('game.pilot');
  const tRole = useTranslations('game.roles');
  const name = usePlayerName(index);
  const ai = isAiRole(role, count);
  const action = usePilot((state) => state.aiAction);
  const stress = usePilot((state) => state.flight?.stressRatio ?? 0);
  const active = flying && ((role === 'propulsion' && ai && action === 'throttle') || (role === 'power' && ai && action === 'guard'));
  const warn = flying && role === 'power' && stress > 0.7;
  return (
    <li data-testid={`duty-${role}`} className={`min-w-0 rounded-lg border px-2 py-1 ${warn ? 'border-red-400/60 bg-red-500/10' : active ? 'border-amber-300/50 bg-amber-300/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ai ? '#94a3b8' : PLAYER_COLORS[index] }} />
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/85">{tRole(`${DUTY[role]}.name`)}</span>
      </div>
      <p className="truncate text-[10px] text-white/55">{ai ? t('duty.ai') : name}</p>
      <p className={`truncate text-[10px] ${active || warn ? 'text-amber-200' : 'text-cyan-100/70'}`}>{t(`duty.${role}${active ? 'Active' : ''}`)}</p>
    </li>
  );
}

/** Who does what in the ascent: each station has its own part of the flight, and the AI crew member does a station's part when nobody sits there. */
function Duties() {
  const count = useCrewStore((state) => state.playerCount);
  const flying = usePilot((state) => state.flight?.status === 'flying');
  return (
    <ul data-testid="pilot-duties" className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {CREW_ROLES.map((role, index) => <DutyCard key={role} role={role} index={index} count={count} flying={!!flying} />)}
    </ul>
  );
}
