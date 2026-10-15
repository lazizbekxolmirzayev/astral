import { describe, expect, it } from 'vitest';
import {
  eccentricAnomaly,
  meanAnomaly,
  orbitPath,
  orbitPosition,
  spatialOrbitPosition,
  type OrbitElements,
} from './orbits';

const TWO_PI = Math.PI * 2;

const circular: OrbitElements = {
  semiMajorAxis: 10,
  eccentricity: 0,
  period: 20,
  phase: 0,
};

const eccentric: OrbitElements = {
  semiMajorAxis: 10,
  eccentricity: 0.2,
  period: 20,
  phase: 0.7,
};

const distance = ({ x, z }: { x: number; z: number }) => Math.hypot(x, z);

describe('meanAnomaly', () => {
  it('starts at the phase and gains exactly one revolution per period', () => {
    expect(meanAnomaly(eccentric, 0)).toBeCloseTo(0.7, 12);
    expect(meanAnomaly(eccentric, 20) - meanAnomaly(eccentric, 0)).toBeCloseTo(TWO_PI, 9);
    expect(meanAnomaly(eccentric, 5) - meanAnomaly(eccentric, 2)).toBeCloseTo(
      (TWO_PI * 3) / 20,
      9,
    );
  });
});

describe('eccentricAnomaly', () => {
  it("solves Kepler's equation for every mean anomaly", () => {
    for (let i = 0; i < 200; i += 1) {
      const M = (TWO_PI * i) / 200;
      for (const e of [0, 0.2, 0.5, 0.8]) {
        const E = eccentricAnomaly(M, e);
        expect(Math.abs(E - e * Math.sin(E) - M)).toBeLessThan(1e-9);
      }
    }
  });

  it("solves Kepler's equation for multi-orbit and negative M with high eccentricity", () => {
    for (const M of [10 * Math.PI + 0.5, -4 * Math.PI + 1.2, 50 * Math.PI]) {
      for (const e of [0.85, 0.95, 0.99]) {
        const E = eccentricAnomaly(M, e);
        expect(Math.abs(E - e * Math.sin(E) - M)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('orbitPosition', () => {
  it('holds a constant radius when eccentricity is zero', () => {
    for (let t = 0; t <= 20; t += 1.7) {
      expect(distance(orbitPosition(circular, t))).toBeCloseTo(10, 9);
    }
  });

  it('puts the focus at the origin: perihelion a(1-e), aphelion a(1+e)', () => {
    // Sampled on a grid, so the extremes are approached rather than hit exactly.
    const radii = Array.from({ length: 4000 }, (_, i) => distance(orbitPosition(eccentric, (20 * i) / 4000)));
    expect(Math.min(...radii)).toBeCloseTo(8, 4);
    expect(Math.max(...radii)).toBeCloseTo(12, 4);
  });

  it('is periodic and never returns NaN', () => {
    const a = orbitPosition(eccentric, 3.25);
    const b = orbitPosition(eccentric, 3.25 + 20);
    expect(a.x).toBeCloseTo(b.x, 8);
    expect(a.z).toBeCloseTo(b.z, 8);
    expect(Number.isFinite(a.x)).toBe(true);
  });

  it("moves fastest near perihelion (Kepler's second law)", () => {
    const step = 0.05;
    const arcAt = (t: number) => {
      const before = orbitPosition(eccentric, t - step);
      const after = orbitPosition(eccentric, t + step);
      return Math.hypot(after.x - before.x, after.z - before.z);
    };
    // Perihelion is where the mean anomaly is zero.
    const perihelion = (eccentric.period * (1 - eccentric.phase / TWO_PI)) % eccentric.period;
    const aphelion = (perihelion + eccentric.period / 2) % eccentric.period;

    expect(distance(orbitPosition(eccentric, perihelion))).toBeCloseTo(8, 6);
    expect(arcAt(perihelion)).toBeGreaterThan(arcAt(aphelion));
  });
});

describe('orbitPath', () => {
  it('returns a closed, finite polyline of segments + 1 points', () => {
    const path = orbitPath(eccentric, 64);
    expect(path).toHaveLength(65);
    expect(path[0]!.x).toBeCloseTo(path[64]!.x, 9);
    expect(path[0]!.z).toBeCloseTo(path[64]!.z, 9);
    for (const point of path) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    }
  });

  it('matches the analytic position at the same times', () => {
    const path = orbitPath(circular, 8);
    path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(orbitPosition(circular, (20 * i) / 8).x, 9);
      expect(point.z).toBeCloseTo(orbitPosition(circular, (20 * i) / 8).z, 9);
    });
  });
});

describe('spatialOrbitPosition', () => {
  it('respects initial phase offset', () => {
    const spatial: import('./orbits').SpatialOrbitElements = {
      ...eccentric,
      phase: 1.25,
      plane: {
        towardPerihelion: [1, 0, 0],
        quarterTurnAhead: [0, 0, 1],
      },
    };
    const planar = orbitPosition(spatial, 0);
    const pos3d = spatialOrbitPosition(spatial, 0);

    expect(pos3d[0]).toBeCloseTo(planar.x, 9);
    expect(pos3d[1]).toBeCloseTo(0, 9);
    expect(pos3d[2]).toBeCloseTo(planar.z, 9);
  });
});

