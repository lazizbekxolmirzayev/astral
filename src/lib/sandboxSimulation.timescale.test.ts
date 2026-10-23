import { describe, expect, it } from 'vitest';
import { createSandboxSimulation } from './sandboxSimulation';

describe('sandbox preset time scales', () => {
  it('keeps the black-hole orbit stable over several orbits', () => {
    const sim = createSandboxSimulation('black-hole');
    // ~12 s of real time at 1x covers about two orbits.
    for (let i = 0; i < 720; i++) sim.advance(1 / 60, 1);
    const snap = sim.snapshot();
    expect(snap.elapsedDays).toBeGreaterThan(0);
    expect(Math.abs(snap.energyDriftPercent)).toBeLessThan(1);
  });

  it('plays the asteroid approach over seconds, not microseconds', () => {
    const sim = createSandboxSimulation('asteroid-impact');
    for (let i = 0; i < 60; i++) sim.advance(1 / 60, 1);
    // 1 s of real time = ~0.002 simulated days, not the global 2 days/s.
    expect(sim.snapshot().elapsedDays).toBeLessThan(0.003);
    expect(sim.snapshot().elapsedDays).toBeGreaterThan(0.001);
  });
});

describe('impact collision detection', () => {
  it('freezes the run when the asteroid reaches Earth and reports the speed', () => {
    const sim = createSandboxSimulation('asteroid-impact');
    for (let i = 0; i < 60 * 30 && !sim.snapshot().collision; i++) sim.advance(1 / 60, 1);
    const hit = sim.snapshot().collision;
    expect(hit).toBeDefined();
    // Expected impact speed ~25 km/s relative plus a little gravitational acceleration.
    expect(hit!.speedKmS).toBeGreaterThan(24);
    expect(hit!.speedKmS).toBeLessThan(40);
    const frozenAt = sim.snapshot().elapsedDays;
    sim.advance(1, 1000);
    expect(sim.snapshot().elapsedDays).toBe(frozenAt);
    sim.reset();
    expect(sim.snapshot().collision).toBeUndefined();
  });
});
