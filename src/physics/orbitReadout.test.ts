import { describe, expect, it } from 'vitest';
import { orbitReadout } from './orbitReadout';
import type { NBodyState } from './gravity';

const GM = 2.959122082855911e-4; // Sun, AU^3/day^2

function pair(r: number, speed: number): NBodyState {
  return {
    ids: ['sun', 'p'],
    gm: new Float64Array([GM, 0]),
    positions: new Float64Array([0, 0, 0, r, 0, 0]),
    velocities: new Float64Array([0, 0, 0, 0, speed, 0]),
  };
}

describe('orbitReadout', () => {
  it('circular orbit: e≈0, a=r, Kepler period', () => {
    const o = orbitReadout(pair(1, Math.sqrt(GM)), 1, 0)!;
    expect(o.bound).toBe(true);
    expect(o.eccentricity).toBeCloseTo(0, 9);
    expect(o.semiMajorAxisAu).toBeCloseTo(1, 9);
    expect(o.periodDays).toBeCloseTo(2 * Math.PI / Math.sqrt(GM), 6);
    expect(o.speedKmS).toBeCloseTo(29.78, 1);
  });
  it('escape speed gives a parabola: unbound, no period', () => {
    const o = orbitReadout(pair(1, Math.sqrt(2 * GM) * 1.01), 1, 0)!;
    expect(o.bound).toBe(false);
    expect(o.periodDays).toBeNull();
    expect(o.eccentricity).toBeGreaterThan(1);
  });
  it('eccentric orbit: periapsis and apoapsis bracket r', () => {
    const o = orbitReadout(pair(1, Math.sqrt(GM) * 0.8), 1, 0)!;
    expect(o.eccentricity).toBeCloseTo(0.36, 6);
    expect(o.apoapsisAu).toBeCloseTo(1, 9);
    expect(o.periapsisAu).toBeCloseTo((o.semiMajorAxisAu as number) * (1 - o.eccentricity), 9);
  });
  it('rejects the same body and bad indices', () => {
    expect(orbitReadout(pair(1, 0.01), 0, 0)).toBeNull();
    expect(orbitReadout(pair(1, 0.01), 5, 0)).toBeNull();
  });
});
