import { describe, expect, it } from 'vitest';
import { galaxyMarkers, LY_PER_GALAXY_UNIT, MILKY_WAY_RADIUS, SUN_GALAXY_POSITION, universeDistance, universeMarkers } from './universeLayout';

describe('galaxy layout', () => {
  it('places Sagittarius A* at the galactic centre, 26,000 ly from the Sun', () => {
    const sgr = galaxyMarkers().find((m) => m.id === 'sagittarius-a-star')!;
    expect(Math.hypot(...sgr.position)).toBeLessThan(0.5); // origin, within 250 ly
    const d = Math.hypot(...sgr.position.map((v, i) => v - SUN_GALAXY_POSITION[i]!) as [number, number, number]);
    expect(d * LY_PER_GALAXY_UNIT).toBeGreaterThan(25_500);
    expect(d * LY_PER_GALAXY_UNIT).toBeLessThan(26_500);
  });
  it('puts every Milky Way marker inside the disc and keeps unique ids', () => {
    const markers = galaxyMarkers();
    expect(new Set(markers.map((m) => m.id)).size).toBe(markers.length);
    // The Magellanic Clouds are satellites, outside the disc by design.
    for (const m of markers.filter((marker) => marker.kind !== 'galaxy')) expect(Math.hypot(...m.position)).toBeLessThan(MILKY_WAY_RADIUS * 1.2);
  });
  it('keeps nearby stars at their real distance from the Sun', () => {
    const sirius = galaxyMarkers().find((m) => m.id === 'sirius-a')!;
    const d = Math.hypot(...sirius.position.map((v, i) => v - SUN_GALAXY_POSITION[i]!) as [number, number, number]);
    expect(d * LY_PER_GALAXY_UNIT).toBeCloseTo(8.6, 0);
  });
});

describe('universe layout', () => {
  it('keeps the distance order and puts the Milky Way at the origin', () => {
    const m = universeMarkers();
    expect(m.find((x) => x.id === 'milky-way')!.position).toEqual([0, 0, 0]);
    const r = (id: string) => Math.hypot(...m.find((x) => x.id === id)!.position);
    expect(r('lmc')).toBeLessThan(r('andromeda'));
    expect(r('andromeda')).toBeLessThan(r('whirlpool'));
    expect(r('whirlpool')).toBeLessThan(r('m87-star'));
    expect(universeDistance(0)).toBe(0);
  });
});

describe('galaxy marker overlap', () => {
  it('draws stars smaller than the gap to their nearest neighbour, so they never merge', () => {
    const markers = galaxyMarkers().filter((m) => m.kind !== 'black_hole');
    for (const a of markers) {
      for (const b of markers) {
        if (a.id >= b.id) continue;
        const gap = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);
        expect(gap, `${a.id} vs ${b.id}`).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });
});
