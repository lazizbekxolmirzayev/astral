import { describe, expect, it } from 'vitest';
import {
  celestialObjectListSchema,
  celestialObjectSchema,
  quantitySchema,
} from './celestialSchema';
import { solarSystem } from './solarSystem';
import type { CelestialObject, Quantity } from '@/types/celestial';

const quantityFields = [
  'mass',
  'radius',
  'semiMajorAxis',
  'orbitalPeriod',
  'rotationPeriod',
  'axialTilt',
  'eccentricity',
  'meanTemperature',
] as const satisfies readonly (keyof CelestialObject)[];

type QuantityField = (typeof quantityFields)[number];

function quantities(object: CelestialObject): Array<[QuantityField, Quantity]> {
  const found: Array<[QuantityField, Quantity]> = [];
  for (const field of quantityFields) {
    const quantity = object[field];
    if (quantity !== undefined) found.push([field, quantity]);
  }
  return found;
}

describe('solarSystem data', () => {
  it('parses with the Zod schema', () => {
    expect(solarSystem.length).toBeGreaterThan(0);
    celestialObjectListSchema.parse(solarSystem);
  });

  it('has the Sun and exactly eight planets', () => {
    const stars = solarSystem.filter((object) => object.type === 'star');
    const planets = solarSystem.filter((object) => object.type === 'planet');
    expect(stars).toHaveLength(1);
    expect(planets).toHaveLength(8);
    expect(stars[0]?.parentId).toBeNull();
    for (const planet of planets) {
      expect(planet.parentId).toBe(stars[0]?.id);
    }
  });

  it('has unique ids', () => {
    const ids = solarSystem.map((object) => object.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every quantity a non-empty unit and a provenance', () => {
    for (const object of solarSystem) {
      for (const [field, quantity] of quantities(object)) {
        const label = `${object.id}.${field}`;
        expect(quantity.unit.trim().length, `${label} has no unit`).toBeGreaterThan(0);
        expect(quantity.provenance, `${label} has no provenance`).toBeTruthy();
      }
    }
  });

  it('cites a source for every measured or derived value', () => {
    for (const object of solarSystem) {
      for (const [field, quantity] of quantities(object)) {
        if (
          quantity.provenance === 'measured' ||
          quantity.provenance === 'derived'
        ) {
          const label = `${object.id}.${field}`;
          expect(
            quantity.source,
            `${label} is ${quantity.provenance} but has no source`,
          ).toBeTruthy();
        }
      }
    }
  });

  it('holds only finite, physically usable numbers', () => {
    for (const object of solarSystem) {
      for (const [field, quantity] of quantities(object)) {
        const label = `${object.id}.${field}`;
        expect(Number.isFinite(quantity.value), `${label} is not finite`).toBe(
          true,
        );
        // Negative values are only meaningful for retrograde rotation.
        expect(
          quantity.value >= 0 || field === 'rotationPeriod',
          `${label} is negative`,
        ).toBe(true);
        if (quantity.uncertainty !== undefined) {
          expect(
            quantity.uncertainty >= 0,
            `${label} uncertainty is negative`,
          ).toBe(true);
        }
      }
    }
  });

  it('rejects a quantity that is missing its unit', () => {
    const missingUnit = {
      value: 1,
      provenance: 'artistic',
    } as unknown as Quantity;
    expect(quantitySchema.safeParse(missingUnit).success).toBe(false);

    const broken: CelestialObject = { ...solarSystem[0]!, mass: missingUnit };
    expect(celestialObjectSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a measured value without a source', () => {
    const result = quantitySchema.safeParse({
      value: 1,
      unit: 'kg',
      provenance: 'measured',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an object whose parentId points nowhere', () => {
    const result = celestialObjectListSchema.safeParse([
      { id: 'mars', name: 'Mars', type: 'planet', parentId: 'nope' },
    ]);
    expect(result.success).toBe(false);
  });
});
