import { describe, expect, it } from 'vitest';
import { circularSpeedKmS, createSandboxSimulation, customScenario } from './sandboxSimulation';

function drift(vFactor: number) {
  const info = customScenario([
    { name: 'Sun', massSolar: 1, xAu: 0, yAu: 0, vxKmS: 0, vyKmS: 0 },
    { name: 'P', massSolar: 3e-6, xAu: 1, yAu: 0, vxKmS: 0, vyKmS: circularSpeedKmS(1, 1) * vFactor },
  ]);
  const sim = createSandboxSimulation('empty-space', info);
  let worst = 0;
  for (let i = 0; i < 600; i += 1) {
    sim.advance(1 / 60, 1);
    worst = Math.max(worst, Math.abs(sim.snapshot().energyDriftPercent));
  }
  return worst;
}

describe('custom scenario step size', () => {
  it('keeps energy drift small on a circular orbit', () => {
    expect(drift(1)).toBeLessThan(1e-4);
  });
  it('keeps energy drift small on an eccentric orbit', () => {
    expect(drift(0.6)).toBeLessThan(1e-2);
  });
});
