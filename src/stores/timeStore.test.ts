import { beforeEach, describe, expect, it } from 'vitest';
import { FIXED_TIMESTEP_DAYS, SIMULATION_DAYS_PER_SECOND, simulation } from '@/lib/simulation';
import { TIME_SPEEDS, stepSimulation, useTimeStore } from '@/stores/timeStore';

const store = () => useTimeStore.getState();

/** Elapsed simulated days, quantised to the fixed step. */
const days = () => simulation.elapsedDays;

/**
 * The engine only ever moves in whole fixed steps, so simulated time lands on
 * the largest multiple of `FIXED_TIMESTEP_DAYS` that fits the requested span;
 * the remainder waits in the accumulator for the next frame.
 */
function expectElapsedDays(expected: number): void {
  expect(days()).toBeLessThanOrEqual(expected + 1e-9);
  expect(expected - days()).toBeLessThan(FIXED_TIMESTEP_DAYS);
}

beforeEach(() => {
  simulation.reset();
  useTimeStore.setState({ playing: true, speed: 1 });
});

describe('playback controls drive the engine, not React state', () => {
  it('advances only while playing', () => {
    stepSimulation(0.5);
    expectElapsedDays(0.5 * SIMULATION_DAYS_PER_SECOND);
    const before = days();

    store().togglePlaying();
    stepSimulation(4);
    expect(days()).toBe(before);

    store().togglePlaying();
    stepSimulation(0.5);
    expectElapsedDays(before + 0.5 * SIMULATION_DAYS_PER_SECOND);
  });

  it('scales real seconds by every offered speed multiplier', () => {
    for (const speed of TIME_SPEEDS) {
      simulation.reset();
      useTimeStore.setState({ speed });
      // 0.05 s keeps even the 1000× case at or under the per-frame step cap.
      stepSimulation(0.05);
      expectElapsedDays(0.05 * SIMULATION_DAYS_PER_SECOND * speed);
    }
  });

  it('returns the clock to zero on reset and keeps play state and speed', () => {
    useTimeStore.setState({ speed: 10 });
    stepSimulation(3);
    expect(days()).toBeGreaterThan(0);

    store().reset();
    expect(days()).toBe(0);

    const after = store();
    expect(after.playing).toBe(true);
    expect(after.speed).toBe(10);
  });

  it('does not jump the clock across a pause gap', () => {
    stepSimulation(1);
    const before = days();
    store().togglePlaying();
    for (let frame = 0; frame < 120; frame += 1) stepSimulation(1 / 60); // two paused seconds
    expect(days()).toBe(before);
    store().togglePlaying();
    stepSimulation(0.5);
    expectElapsedDays(before + 0.5 * SIMULATION_DAYS_PER_SECOND);
  });

  it('only ever moves in whole fixed steps', () => {
    for (const delta of [1 / 60, 1 / 144, 0.7, 1 / 60]) stepSimulation(delta);
    const multiples = days() / FIXED_TIMESTEP_DAYS;
    expect(Math.abs(multiples - Math.round(multiples))).toBeLessThan(1e-6);
  });

  it('offers exactly the required speed multipliers', () => {
    expect(TIME_SPEEDS).toEqual([1, 10, 100, 1000]);
  });
});
