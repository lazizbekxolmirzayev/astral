/**
 * The simulation engine wrapper: owns body state outside React.
 *
 * Nothing here is a React component and nothing here holds React state. The
 * scene reads `simulation.state` inside `useFrame` and writes mesh transforms,
 * so a frame costs zero re-renders. The UI-facing snapshot lives in
 * `stores/diagnosticsStore` and is published at a throttled rate instead.
 *
 * Units: AU, days, `gm` in AU³/day² (see `physics/gravity.ts`). Initial
 * conditions are the real JPL state vectors in `data/initialConditions.ts`.
 */

import { initialConditions } from '@/data/initialConditions';
import {
  type NBodyState,
  PhysicsInputError,
  cloneState,
  copyState,
  createState,
} from '@/physics/gravity';
import {
  DEFAULT_SOFTENING_AU,
  createTimestepAccumulator,
  stepVelocityVerlet,
} from '@/physics/integrator';
import { angularMomentum, driftPercent, kinematicsRelativeTo, totalEnergy } from '@/physics/diagnostics';

/**
 * Physics step in days. Small enough that Mercury's 87.97-day orbit gets ~1,760
 * steps per revolution, which keeps the energy oscillation flat (measured
 * 2e-11 % over 100 orbits at dt = 0.02 d in `physics/keplerTwoBody.test.ts`;
 * the century-long nine-body run in `simulation.test.ts` re-checks it here).
 */
export const FIXED_TIMESTEP_DAYS = 0.05;

/**
 * Hard cap on steps taken in one frame. At 1000× and 60 fps the sim needs ~667
 * steps per frame, so this leaves headroom without letting a stalled tab be
 * repaid with a backlog.
 */
export const MAX_STEPS_PER_FRAME = 2000;

/**
 * Playback pacing: simulated days advanced per real second at 1×.
 *
 * PROVENANCE: artistic. It is a viewing choice, not a physical constant — at 1×
 * Mercury completes an orbit in ~44 seconds and a year takes ~3 minutes, while
 * 1000× fits a century into ~18 seconds.
 */
export const SIMULATION_DAYS_PER_SECOND = 2;

/** The Sun is body 0 and is what the stability checks measure against. */
export const CENTRAL_BODY_INDEX = 0;
export const CENTRAL_BODY_ID = 'sun';

function baselines(state: NBodyState) {
  return {
    energy: totalEnergy(state, DEFAULT_SOFTENING_AU).total,
    momentum: angularMomentum(state).magnitude,
  };
}

const initial = cloneState(createState(initialConditions));
const state = cloneState(initial);

const accumulator = createTimestepAccumulator(FIXED_TIMESTEP_DAYS);

const indexById = new Map<string, number>(initial.ids.map((id, index) => [id, index]));

export type SimulationSnapshot = {
  elapsedDays: number;
  energyTotal: number;
  momentumMagnitude: number;
  energyDriftPercent: number;
  momentumDriftPercent: number;
  stepsPerSecond: number;
};

/**
 * Mutable module singleton. `elapsedDays` and the step counter are written every
 * frame; the drift baselines only change on `reset`.
 */
export const simulation = {
  state,
  initial,
  indexById,
  elapsedDays: 0,
  baseline: baselines(initial),
  /** Steps taken in the last full second, for the panel's cost read-out. */
  stepsThisSecond: 0,
  stepsPerSecond: 0,
  secondWindowStartMs: 0,

  indexFor(id: string): number {
    const index = indexById.get(id);
    if (index === undefined) throw new PhysicsInputError(`no body named "${id}" in the simulation`);
    return index;
  },

  /**
   * Advance the simulation by one rendered frame.
   *
   * `deltaSeconds` is real time since the last frame and `speed` the toolbar
   * multiplier; together they only decide how many fixed steps run, never how
   * large a step is. Returns the number of steps taken.
   */
  advance(deltaSeconds: number, speed: number): number {
    const elapsedDays = deltaSeconds * SIMULATION_DAYS_PER_SECOND * speed;
    const taken = accumulator.advance(elapsedDays, MAX_STEPS_PER_FRAME, () => {
      stepVelocityVerlet(state, FIXED_TIMESTEP_DAYS, DEFAULT_SOFTENING_AU);
      simulation.elapsedDays += FIXED_TIMESTEP_DAYS;
    });
    simulation.stepsThisSecond += taken;
    return taken;
  },

  /** Back to the epoch, bit for bit. */
  reset(): void {
    copyState(initial, state);
    simulation.elapsedDays = 0;
    simulation.baseline = baselines(initial);
    simulation.stepsThisSecond = 0;
    accumulator.reset();
  },

  /**
   * Add velocity to one body, in AU/day. Used by the stability-warning check and
   * by nothing in the shipped UI: injecting energy is a manual experiment, so it
   * is reported as drift rather than silently re-baselined.
   */
  nudgeVelocity(id: string, delta: readonly [number, number, number]): void {
    const index = simulation.indexFor(id);
    for (let axis = 0; axis < 3; axis += 1) {
      const value = delta[axis];
      if (!Number.isFinite(value)) {
        throw new PhysicsInputError(`nudge delta for "${id}" must be finite, got ${String(value)}`);
      }
      state.velocities[index * 3 + axis] += value;
    }
  },

  /**
   * Scale one body's velocity relative to the central mass by `factor`, leaving
   * its position untouched. A near-circular planet orbits at escape speed ÷ √2,
   * so 1.5 puts it just past parabolic — which is how the stability warning is
   * exercised by hand.
   */
  speedUp(id: string, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new PhysicsInputError(`speed factor must be finite and positive, got ${String(factor)}`);
    }
    const index = simulation.indexFor(id);
    for (let axis = 0; axis < 3; axis += 1) {
      const body = index * 3 + axis;
      const central = CENTRAL_BODY_INDEX * 3 + axis;
      const relative = (state.velocities[body] as number) - (state.velocities[central] as number);
      state.velocities[body] = (state.velocities[body] as number) + (factor - 1) * relative;
    }
  },

  /** Live energy and momentum, with drift against the epoch values. */
  snapshot(): SimulationSnapshot {
    const energy = totalEnergy(state, DEFAULT_SOFTENING_AU).total;
    const momentum = angularMomentum(state).magnitude;
    return {
      elapsedDays: simulation.elapsedDays,
      energyTotal: energy,
      momentumMagnitude: momentum,
      energyDriftPercent: driftPercent(energy, simulation.baseline.energy),
      momentumDriftPercent: driftPercent(momentum, simulation.baseline.momentum),
      stepsPerSecond: simulation.stepsPerSecond,
    };
  },

  /** Per-body distance, speed and escape speed relative to the Sun. */
  kinematics() {
    return kinematicsRelativeTo(state, CENTRAL_BODY_INDEX);
  },
};

/** Rolling steps/second figure, called from the frame driver once per frame. */
export function updateStepRate(nowMs: number): void {
  if (simulation.secondWindowStartMs === 0) simulation.secondWindowStartMs = nowMs;
  if (nowMs - simulation.secondWindowStartMs < 1000) return;
  simulation.stepsPerSecond = simulation.stepsThisSecond;
  simulation.stepsThisSecond = 0;
  simulation.secondWindowStartMs = nowMs;
}
