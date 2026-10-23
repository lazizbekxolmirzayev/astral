import { describe, expect, it } from 'vitest';
import { circularSpeedKmS, createSandboxSimulation, customScenario } from './sandboxSimulation';

describe('custom sandbox scenario', () => {
  it('computes the familiar 29.8 km/s circular speed at 1 AU around 1 solar mass', () => {
    expect(circularSpeedKmS(1, 1)).toBeCloseTo(29.78, 1);
  });

  it('keeps a user-built circular orbit stable', () => {
    const info = customScenario([
      { name: 'star', massSolar: 1, xAu: 0, yAu: 0, vxKmS: 0, vyKmS: 0 },
      { name: 'rock', massSolar: 3e-6, xAu: 1, yAu: 0, vxKmS: 0, vyKmS: circularSpeedKmS(1, 1) },
    ]);
    const sim = createSandboxSimulation('empty-space', info);
    for (let i = 0; i < 600; i++) sim.advance(1 / 60, 1);
    const snap = sim.snapshot();
    expect(snap.elapsedDays).toBeGreaterThan(300);
    expect(Math.abs(snap.energyDriftPercent)).toBeLessThan(0.01);
  });

  it('rejects invalid bodies instead of simulating them', () => {
    expect(() => customScenario([
      { name: 'a', massSolar: 1, xAu: 0, yAu: 0, vxKmS: 0, vyKmS: 0 },
      { name: 'a', massSolar: 1, xAu: 1, yAu: 0, vxKmS: 0, vyKmS: 0 },
    ])).toThrow();
  });
});
