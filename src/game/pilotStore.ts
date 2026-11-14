import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { compareLaunchers } from '@/mission/launchView';
import { evaluateMission } from '@/mission/engine';
import type { SimPlan } from '@/mission/sim';
import { isAiRole } from './crew';
import { DEFAULT_DIFFICULTY, DIFFICULTY_RULES, type Difficulty } from './difficulty';
import { altitudeOf, autopilot, referencePitch, createFlight, createVehicle, rateFlight, stepFlight, type Flight, type FlightRating, type FlightStatus, type PilotInput } from './pilot/model';

/**
 * Who flies the ascent. `off` is the film of the ascent (the scripted climb), `auto` the reference pilot, `assist` flies
 * the first stage as a gravity turn and separates it, leaving the throttle and the second stage's steering to the person,
 * and `manual` leaves everything to the person.
 */
export type PilotMode = 'off' | 'auto' | 'assist' | 'manual';
export const PILOT_MODES: readonly PilotMode[] = ['assist', 'manual', 'auto', 'off'];
export type Warp = 1 | 2 | 4 | 8;
export const WARPS: readonly Warp[] = [1, 2, 4, 8];

const STEP_S = 0.05;
/** The AI power tech lets the person steer this far (radians) from the reference flight path while the air is thick. */
const GUARD_BAND = (5 * Math.PI) / 180;
/** Real seconds the scene keeps the outcome on screen (explosion or orbit) before the mission goes on. */
export const OUTCOME_HOLD_S = 3.4;
/** Pitch changes by this many degrees per second while a key is held. */
export const PITCH_RATE_DEG = 14;

export type PilotState = {
  mode: PilotMode;
  /** The flight in progress (mutated every frame; read it, do not hold on to it). */
  flight: Flight | null;
  /** Counts up with every update so a display can refresh. */
  tick: number;
  throttle: number;
  pitchCommand: number;
  separateRequested: boolean;
  warp: Warp;
  /** Players at the stations: a station without a player is run by the AI crew member (engines: throttle, power: stress guard). */
  crewCount: number;
  /** Real seconds since the person last touched the throttle or the pitch. */
  throttleIdle: number;
  pitchIdle: number;
  /** What the AI crew is doing right now, for the console. */
  aiAction: 'throttle' | 'guard' | null;
  /** The power station's load limiter: keeps the steering near the safe path while the air is thick (always on when the AI sits there). */
  limiter: boolean;
  /** Live flights wait on the pad until someone throws the ignition switch (the AI engineer does it after 3 s if nobody sits there). */
  requireIgnition: boolean;
  setRequireIgnition: (on: boolean) => void;
  ignited: boolean;
  ignitionIdle: number;
  ignite: () => void;
  /** The captain's gravity-turn switch: the vehicle follows its own flight path instead of the pitch command. */
  pathHold: boolean;
  setPathHold: (on: boolean) => void;
  /** The difficulty level: sets the starting mode, whether the limiter is forced and whether the angle is advised. */
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
  setLimiter: (on: boolean) => void;
  setCrewCount: (count: number) => void;
  /** Real seconds since the flight ended, null while it flies. */
  endedFor: number | null;
  rating: FlightRating | null;
  setMode: (mode: PilotMode) => void;
  setThrottle: (value: number) => void;
  /** Turns the commanded pitch by `degrees` (positive toward the horizon). */
  nudgePitch: (degrees: number) => void;
  requestSeparate: () => void;
  setWarp: (warp: Warp) => void;
  /** Builds the vehicle for the mission of this plan and puts it on the pad with the engine at full thrust. */
  begin: (plan: SimPlan) => boolean;
  /** Advances the flight by real seconds. */
  update: (realSeconds: number) => void;
  reset: () => void;
};

/** The vehicle of a mission: sized from the launcher's capacity to the destination, carrying the design's launch mass. */
export function vehicleOf(plan: SimPlan) {
  const evaluation = evaluateMission(plan.mission);
  const row = compareLaunchers(plan.mission, evaluation).find((entry) => entry.selected);
  const payload = evaluation.details?.mass.launch.value ?? 0;
  const capacity = Math.max(row?.capacityKg ?? payload * 1.3, payload, 500);
  return createVehicle(capacity, payload, plan.mission.launch.vehicleId.includes('heavy'));
}

export function createPilotStore(): StoreApi<PilotState> {
  return createStore<PilotState>()((set, get) => ({
    mode: 'assist',
    flight: null,
    tick: 0,
    throttle: 1,
    pitchCommand: 0,
    separateRequested: false,
    warp: 2,
    crewCount: 1,
    throttleIdle: 99,
    pitchIdle: 99,
    aiAction: null,
    limiter: false,
    requireIgnition: false,
    setRequireIgnition: (on) => set({ requireIgnition: on }),
    ignited: true,
    ignitionIdle: 0,
    ignite: () => set({ ignited: true }),
    pathHold: false,
    setPathHold: (on) => set({ pathHold: on }),
    difficulty: DEFAULT_DIFFICULTY,
    setDifficulty: (difficulty) => set({ difficulty, mode: DIFFICULTY_RULES[difficulty].mode }),
    setLimiter: (on) => set({ limiter: on }),
    setCrewCount: (count) => set({ crewCount: count }),
    endedFor: null,
    rating: null,
    setMode: (mode) => set({ mode }),
    setThrottle: (value) => set({ throttle: Math.min(1, Math.max(0, value)), throttleIdle: 0 }),
    nudgePitch: (degrees) => set((state) => ({ pitchCommand: Math.min((110 * Math.PI) / 180, Math.max(-(20 * Math.PI) / 180, state.pitchCommand + (degrees * Math.PI) / 180)), pitchIdle: 0 })),
    requestSeparate: () => set({ separateRequested: true }),
    setWarp: (warp) => set({ warp }),
    begin: (plan) => {
      if (get().mode === 'off') return false;
      set({ flight: createFlight(vehicleOf(plan), plan.siteLatitudeRad), throttle: 1, pitchCommand: 0, separateRequested: false, ignited: !get().requireIgnition || get().mode === 'auto', ignitionIdle: 0, endedFor: null, rating: null, tick: 0 });
      return true;
    },
    update: (realSeconds) => {
      const state = get();
      const flight = state.flight;
      if (!flight) return;
      if (flight.status !== 'flying') {
        set({ endedFor: (state.endedFor ?? 0) + realSeconds, tick: state.tick + 1 });
        return;
      }
      if (!state.ignited) {
        // on the pad: nothing moves until the engines are lit
        const idle = state.ignitionIdle + realSeconds;
        if (isAiRole('propulsion', state.crewCount) && idle > 3) set({ ignited: true, ignitionIdle: 0, aiAction: 'throttle', tick: state.tick + 1 });
        else set({ ignitionIdle: idle, tick: state.tick + 1 });
        return;
      }
      const dt = Math.min(realSeconds, 0.25) * state.warp;
      let remaining = dt;
      let separate = state.separateRequested;
      let pitchCommand = state.pitchCommand;
      let throttle = state.throttle;
      let aiAction: PilotState['aiAction'] = null;
      const aiEngines = state.mode !== 'auto' && isAiRole('propulsion', state.crewCount) && state.throttleIdle + realSeconds > 3;
      const aiGuard = state.mode !== 'auto' && (isAiRole('power', state.crewCount) || state.limiter || DIFFICULTY_RULES[state.difficulty].forcedLimiter);
      while (remaining > 1e-9 && flight.status === 'flying') {
        const step = Math.min(STEP_S, remaining);
        remaining -= step;
        let input: PilotInput;
        if (state.mode === 'auto') input = autopilot(flight);
        else if (state.mode === 'assist') {
          input = { throttle: state.throttle, pitchCommand, hold: flight.stage === 1, separate: separate || (flight.stage === 1 && flight.prop1 <= 0) };
        } else input = { throttle: state.throttle, pitchCommand, hold: state.pathHold, separate };
        if (state.mode !== 'auto') {
          if (aiEngines) { input.throttle = autopilot(flight).throttle; throttle = input.throttle; aiAction = 'throttle'; }
          // the AI power tech eases the steering off when the vehicle is about to break up
          if (aiGuard && !input.hold && (altitudeOf(flight) < 45_000 || flight.stressRatio > 0.7)) {
            const reference = referencePitch(flight);
            const band = GUARD_BAND * Math.min(1, Math.max(0.05, 1 - flight.stressRatio / 0.6)); // the closer to the limit, the less freedom
            const clamped = Math.min(reference + band, Math.max(reference - band, input.pitchCommand));
            if (clamped !== input.pitchCommand) { input.pitchCommand = clamped; pitchCommand = clamped; aiAction = 'guard'; }
          }
        }
        const wasStage = flight.stage;
        stepFlight(flight, input, step);
        separate = false;
        // after the separation the person steers from where the vehicle points
        if (wasStage === 1 && flight.stage === 2) pitchCommand = flight.pitch;
      }
      const finalStatus = flight.status as FlightStatus;
      const ended = finalStatus !== 'flying';
      set({ tick: state.tick + 1, throttle, aiAction, throttleIdle: state.throttleIdle + realSeconds, pitchIdle: state.pitchIdle + realSeconds, separateRequested: false, pitchCommand: state.mode === 'auto' ? flight.pitchCommand : pitchCommand, rating: ended && finalStatus === 'orbit' ? rateFlight(flight) : state.rating, endedFor: ended ? 0 : null });
    },
    reset: () => set({ flight: null, tick: 0, endedFor: null, rating: null, separateRequested: false, throttle: 1, pitchCommand: 0 }),
  }));
}

export const pilotStore = createPilotStore();
export const usePilot = <T,>(selector: (state: PilotState) => T): T => useStore(pilotStore, selector);
