/**
 * Fixed-timestep symplectic integrator — pure TypeScript, no React, no Three.js.
 *
 * Velocity Verlet (kick-drift-kick leapfrog): time-reversible and symplectic, so
 * the energy error oscillates around zero instead of growing secularly. That is
 * the whole reason the two-body tests in `keplerTwoBody.test.ts` can hold a
 * bounded drift over hundreds of orbits.
 *
 * Units: AU and days (see `gravity.ts`). `dt` must stay fixed for the
 * conservation properties to hold — variable steps break time-reversibility.
 */

import { type NBodyState, PhysicsInputError, accelerations } from './gravity';

/**
 * Softening length in AU used by the live simulation. Chosen well below the
 * smallest real separation in the system (Mercury's perihelion is 0.307 AU from
 * the Sun, NASA fact sheet) so it changes nothing observable here, but keeps the
 * equations finite if a body is ever nudged into the Sun.
 */
export const DEFAULT_SOFTENING_AU = 1e-4;

/** Above this, Mercury (88 d period) would not be resolved at all. */
export const MAX_TIMESTEP_DAYS = 5;

/** Practical floor: below this the step count per frame explodes. */
export const MIN_TIMESTEP_DAYS = 1e-6;

export function validateTimestep(dtDays: number): void {
  if (!Number.isFinite(dtDays)) {
    throw new PhysicsInputError(`timestep must be a finite number of days, got ${String(dtDays)}`);
  }
  if (dtDays <= 0) {
    throw new PhysicsInputError(`timestep must be > 0 days, got ${String(dtDays)}`);
  }
  if (dtDays < MIN_TIMESTEP_DAYS) {
    throw new PhysicsInputError(`timestep ${String(dtDays)} d is below the supported floor of ${String(MIN_TIMESTEP_DAYS)} d`);
  }
  if (dtDays > MAX_TIMESTEP_DAYS) {
    throw new PhysicsInputError(`timestep ${String(dtDays)} d exceeds the supported maximum of ${String(MAX_TIMESTEP_DAYS)} d`);
  }
}

/**
 * Scratch buffers, reused across steps. Held per state size rather than passed
 * around, because a frame loop must not allocate 9×3 floats 60 times a second.
 */
const scratchPool = new Map<number, { acceleration: Float64Array; nextAcceleration: Float64Array }>();

function scratchFor(size: number) {
  let entry = scratchPool.get(size);
  if (!entry) {
    entry = { acceleration: new Float64Array(size), nextAcceleration: new Float64Array(size) };
    scratchPool.set(size, entry);
  }
  return entry;
}

/** One velocity Verlet step of `dtDays`. Mutates `state` in place. */
export function stepVelocityVerlet(
  state: NBodyState,
  dtDays: number,
  softening: number = DEFAULT_SOFTENING_AU,
): NBodyState {
  validateTimestep(dtDays);
  const { acceleration, nextAcceleration } = scratchFor(state.positions.length);

  accelerations(state, softening, acceleration);

  const halfDt = 0.5 * dtDays;
  const halfDtSquared = 0.5 * dtDays * dtDays;
  for (let i = 0; i < state.positions.length; i += 1) {
    const v = state.velocities[i] as number;
    const a = acceleration[i] as number;
    state.positions[i] = (state.positions[i] as number) + v * dtDays + a * halfDtSquared;
    state.velocities[i] = v + a * halfDt;
  }

  accelerations(state, softening, nextAcceleration);
  for (let i = 0; i < state.velocities.length; i += 1) {
    state.velocities[i] = (state.velocities[i] as number) + ((nextAcceleration[i] as number) * halfDt);
  }
  return state;
}

/** Runs `steps` fixed steps. Used by tests and by the century-long checks. */
export function integrate(
  state: NBodyState,
  dtDays: number,
  steps: number,
  softening: number = DEFAULT_SOFTENING_AU,
): NBodyState {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new PhysicsInputError(`step count must be a non-negative integer, got ${String(steps)}`);
  }
  for (let step = 0; step < steps; step += 1) stepVelocityVerlet(state, dtDays, softening);
  return state;
}

/**
 * Frame-loop helper: turns a variable wall-clock delta into a whole number of
 * fixed physics steps and keeps the remainder for the next frame. The leftover
 * is what makes playback speed-independent — the integrator only ever sees `dt`.
 */
export function createTimestepAccumulator(dtDays: number) {
  validateTimestep(dtDays);
  let pending = 0;
  return {
    dtDays,
    /** Returns how many steps were actually taken. */
    advance(elapsedDays: number, maxSteps: number, onStep: () => void): number {
      if (!Number.isFinite(elapsedDays) || elapsedDays < 0) {
        // A negative or non-finite frame delta (tab switch, debugger) is dropped
        // rather than integrated backwards.
        return 0;
      }
      pending += elapsedDays;
      let taken = 0;
      while (pending >= dtDays && taken < maxSteps) {
        onStep();
        pending -= dtDays;
        taken += 1;
      }
      // If the cap was hit the backlog is discarded, so a stalled tab cannot
      // make the simulation spend every later frame catching up.
      if (taken === maxSteps) pending = 0;
      return taken;
    },
    reset(): void {
      pending = 0;
    },
    get pending(): number {
      return pending;
    },
  };
}

export type TimestepAccumulator = ReturnType<typeof createTimestepAccumulator>;
