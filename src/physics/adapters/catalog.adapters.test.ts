import { describe, expect, it } from 'vitest';
import { catalogToBlackHole } from './blackHole';
import { catalogToBody } from './body';
import { catalogToImpactor } from './impact';
import { catalogToStar } from './star';
import type { CatalogObject } from '@/types/catalog';

const EXAMPLE_STAR = {
  id: 'sun',
  type: 'star',
  mass: { value: 1.989e30, unit: 'kg' },
  position: [0, 0, 0],
  velocity: [0, 0, 0],
} satisfies CatalogObject;

const EXAMPLE_IMPACTOR = {
  id: 'asteroid-a',
  type: 'asteroid',
  radius: { value: 50, unit: 'm' },
  density: { value: 3000, unit: 'kg/m^3' },
  velocity: [0, 0, 20000],
  targetType: 'rocky',
  targetHasAtmosphere: true,
  distance: { value: 6371000, unit: 'm' },
} satisfies CatalogObject;

const EXAMPLE_BLACK_HOLE = {
  id: 'bh',
  type: 'star',
  mass: { value: 2e30, unit: 'kg' },
} satisfies CatalogObject;

describe('catalog adapters', () => {
  it('converts a star catalog record into a BodyDefinition', () => {
    const result = catalogToStar(EXAMPLE_STAR);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.id).toBe('sun');
    expect(result.value.gm).toBeGreaterThan(0);
  });

  it('converts a catalog asteroid into a valid impactor', () => {
    const result = catalogToImpactor(EXAMPLE_IMPACTOR);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.massKg).toBeGreaterThan(0);
    expect(result.value.impactVelocityMs).toBeCloseTo(20000, 8);
  });

  it('returns missing fields without guessing values', () => {
    const result = catalogToBlackHole(EXAMPLE_BLACK_HOLE);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.missing).toContain('radius');
    expect(result.missing).toContain('distance');
  });

  it('instantiates a simulator body from a catalog entry', () => {
    const result = catalogToBody({
      ...EXAMPLE_STAR,
      position: [1, 0, 0],
      velocity: [0, 29.78, 0],
      gm: { value: 1.3271244e20, unit: 'm^3/s^2' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.position).toHaveLength(3);
    expect(result.value.velocity).toHaveLength(3);
  });
});
