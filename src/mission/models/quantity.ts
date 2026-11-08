import { quantitySchema } from '@/data/celestialSchema';
import type { Provenance, Quantity } from '@/types/celestial';
import { dimensionOf, isUnit, type Dimension, type UnitSymbol } from '../units';

export type { Provenance, Quantity };

/**
 * Builds a `Quantity` with a unit checked at compile time. Reuses the project's
 * existing `Quantity` type, so every mission number carries a unit and a provenance
 * (measured | derived | estimated | fictional | artistic).
 */
export function q(
  value: number,
  unit: UnitSymbol,
  provenance: Provenance,
  source?: string,
  uncertainty?: number,
): Quantity {
  return {
    value,
    unit,
    provenance,
    ...(source === undefined ? {} : { source }),
    ...(uncertainty === undefined ? {} : { uncertainty }),
  };
}

/** The project's quantity schema, narrowed to units of one dimension. */
export function quantityOf(dimension: Dimension) {
  return quantitySchema.refine((quantity) => isUnit(quantity.unit) && dimensionOf(quantity.unit) === dimension, {
    message: `unit must be a ${dimension} unit`,
    path: ['unit'],
  });
}
