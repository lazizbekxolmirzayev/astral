import { describe, expect, it } from 'vitest';
import { skyPositions } from '@/data/catalog/sky';
import { equatorialToGalactic } from './skyMath';

describe('equatorialToGalactic', () => {
  it('puts Sagittarius A* at the galactic centre', () => {
    const { lDeg, bDeg } = equatorialToGalactic(266.417, -29.008);
    expect(Math.min(lDeg, 360 - lDeg)).toBeLessThan(0.1);
    expect(Math.abs(bDeg)).toBeLessThan(0.1);
  });
  it('puts the north galactic pole at b = 90', () => {
    expect(equatorialToGalactic(192.85948, 27.12825).bDeg).toBeCloseTo(90, 3);
  });
  it('matches known galactic longitudes', () => {
    // Andromeda (M31): l ~ 121.2, b ~ -21.6. Cygnus X-1: l ~ 71.3, b ~ 3.1.
    const m31 = skyPositions['andromeda']!;
    const a = equatorialToGalactic(m31.raDeg, m31.decDeg);
    expect(a.lDeg).toBeCloseTo(121.2, 0);
    expect(a.bDeg).toBeCloseTo(-21.6, 0);
    const c = skyPositions['cygnus-x-1']!;
    const x = equatorialToGalactic(c.raDeg, c.decDeg);
    expect(x.lDeg).toBeCloseTo(71.3, 0);
    expect(x.bDeg).toBeCloseTo(3.1, 0);
  });
});
