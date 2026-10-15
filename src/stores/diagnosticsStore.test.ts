import { beforeEach, describe, expect, it } from 'vitest';
import { simulation } from '@/lib/simulation';
import {
  DIAGNOSTICS_INTERVAL_MS,
  invalidateDiagnostics,
  publishDiagnostics,
  useDiagnosticsStore,
} from './diagnosticsStore';

/**
 * The panel's data path, tested without a browser. `publishDiagnostics` takes
 * its own timestamp, so the throttle and the warning list are pure logic; only
 * the frame loop that calls it needs a rendered page.
 */

const panel = () => useDiagnosticsStore.getState();

const rowOf = (id: string) => panel().bodies.find((body) => body.id === id);

beforeEach(() => {
  simulation.reset();
  invalidateDiagnostics();
  useDiagnosticsStore.setState({
    elapsedDays: 0,
    energyDriftPercent: 0,
    momentumDriftPercent: 0,
    stepsPerSecond: 0,
    bodies: [],
    warnings: [],
    ready: false,
  });
});

describe('publishDiagnostics', () => {
  it('publishes on the first call and stays silent inside the interval', () => {
    expect(panel().ready).toBe(false);

    publishDiagnostics(1_000);
    const first = panel();
    expect(first.ready).toBe(true);
    // Every planet, and not the Sun: kinematics is measured against it.
    expect(first.bodies.map((body) => body.id)).toEqual([
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]);

    simulation.advance(1, 10);
    publishDiagnostics(1_000 + DIAGNOSTICS_INTERVAL_MS - 1);
    expect(panel().elapsedDays).toBe(first.elapsedDays);

    publishDiagnostics(1_000 + DIAGNOSTICS_INTERVAL_MS);
    expect(panel().elapsedDays).toBeGreaterThan(first.elapsedDays);
  });

  it('reports the epoch as bound, with speeds just under escape', () => {
    publishDiagnostics(1_000);

    expect(panel().warnings).toEqual([]);
    // A near-circular orbit runs at escape speed ÷ √2, so 0.71 is the signature
    // of a healthy planet; 1 would mean it is leaving.
    for (const body of panel().bodies) {
      expect(body.boundRatio).toBeGreaterThan(0.5);
      expect(body.boundRatio).toBeLessThan(1);
    }
    expect(rowOf('earth')!.speedKmPerSecond).toBeGreaterThan(29);
    expect(rowOf('earth')!.speedKmPerSecond).toBeLessThan(31);
  });

  it('names the planet a speed-up throws out of the system', () => {
    publishDiagnostics(1_000);

    simulation.speedUp('earth', 1.5);
    invalidateDiagnostics();
    publishDiagnostics(2_000);

    const warning = panel().warnings.find((entry) => entry.id === 'earth');
    expect(warning).toBeDefined();
    expect(warning!.kind).toBe('unbound');
    // Escape speed measured, not invented: 42.1 km/s at 1 AU.
    expect(rowOf('earth')!.escapeKmPerSecond).toBeGreaterThan(41);
    expect(rowOf('earth')!.escapeKmPerSecond).toBeLessThan(43);
    // Injected energy is real energy: drift jumps, and the panel shows it.
    // Earth is a small fraction of the system's total, so the jump is small but
    // strictly positive — the sign is the point, not the size.
    expect(panel().energyDriftPercent).toBeGreaterThan(0);
  });

  it('clears warnings and drift on reset', () => {
    simulation.speedUp('earth', 1.5);
    simulation.advance(10, 100);
    publishDiagnostics(1_000);
    expect(panel().warnings.length).toBeGreaterThan(0);

    simulation.reset();
    invalidateDiagnostics();
    publishDiagnostics(2_000);

    expect(panel().warnings).toEqual([]);
    expect(panel().elapsedDays).toBe(0);
    expect(panel().energyDriftPercent).toBe(0);
    expect(panel().momentumDriftPercent).toBe(0);
  });
});
