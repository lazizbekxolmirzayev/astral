import { describe, expect, it } from 'vitest';
import { catalogEntries } from '@/data/catalog/entries';
import { catalogScenario, createSandboxSimulation } from './sandboxSimulation';

describe('catalogue records as simulator scenarios', () => {
  it.each(catalogEntries.map((entry) => [entry.id, entry] as const))('%s builds or is cleanly rejected', (_id, entry) => {
    const info = catalogScenario(entry);
    // Galaxies and pulsars have no n-body scenario (no catalogued mass to integrate).
    if (entry.type === 'galaxy' || entry.type === 'pulsar') {
      expect(info).toBeNull();
      return;
    }
    expect(info, `${entry.id} should be simulatable`).not.toBeNull();
    const sim = createSandboxSimulation('empty-space', info!);
    for (let frame = 0; frame < 300; frame++) sim.advance(1 / 60, 1);
    const snap = sim.snapshot();
    expect(Number.isFinite(snap.energyDriftPercent)).toBe(true);
    expect(Number.isFinite(snap.elapsedDays)).toBe(true);
    expect(snap.elapsedDays).toBeGreaterThan(0);
    if (entry.type === 'black_hole' || entry.type === 'exoplanet') {
      expect(Math.abs(snap.energyDriftPercent), `${entry.id} energy drift`).toBeLessThan(1);
    }
  });
});
