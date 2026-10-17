import { describe, expect, it } from 'vitest';
import { cloneState } from '@/physics/gravity';
import { createSandboxSimulation, SANDBOX_PRESETS } from './sandboxSimulation';

describe('sandbox presets', () => {
  it.each(SANDBOX_PRESETS)('%s initializes, advances, and resets exactly', (preset) => {
    const sandbox = createSandboxSimulation(preset);
    const initial = cloneState(sandbox.state);

    expect(sandbox.state.ids.length).toBeGreaterThanOrEqual(0);
    expect(sandbox.advance(1 / 60, 1)).toBeGreaterThan(0);
    expect(sandbox.snapshot().elapsedDays).toBeGreaterThan(0);

    sandbox.reset();
    expect(Array.from(sandbox.state.ids)).toEqual(Array.from(initial.ids));
    expect(Array.from(sandbox.state.gm)).toEqual(Array.from(initial.gm));
    expect(Array.from(sandbox.state.positions)).toEqual(Array.from(initial.positions));
    expect(Array.from(sandbox.state.velocities)).toEqual(Array.from(initial.velocities));
    expect(sandbox.snapshot().elapsedDays).toBe(0);
  });

  it('provides finite drift diagnostics and the relevant model-module outputs', () => {
    const stable = createSandboxSimulation('stable-system');
    expect(stable.snapshot().warnings).toEqual([]);
    expect(Number.isFinite(stable.snapshot().energyDriftPercent)).toBe(true);
    expect(Number.isFinite(stable.snapshot().angularMomentumDriftPercent)).toBe(true);

    const impact = createSandboxSimulation('asteroid-impact');
    expect(impact.info.impact?.energyJoules).toBeGreaterThan(0);
    expect(Number.isFinite(impact.info.impact?.tntMegatons)).toBe(true);

    const blackHole = createSandboxSimulation('black-hole');
    expect(blackHole.info.blackHole?.validity.status).toBe('valid');
    expect(blackHole.info.blackHole?.validity.distanceInSchwarzschildRadii).toBe(12);

    const empty = createSandboxSimulation('empty-space');
    expect(empty.snapshot().energyAvailable).toBe(false);
    expect(empty.snapshot().warnings).toEqual([]);
  });
});
