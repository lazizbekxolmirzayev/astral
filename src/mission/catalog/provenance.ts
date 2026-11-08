import { q, type Quantity } from '../models/quantity';
import type { UnitSymbol } from '../units';

/**
 * Shorthand for catalog numbers, so each value's provenance is visible at the
 * point where it is written.
 *
 * - `est`   typical performance of a technology class: an educational approximation,
 *           not the specification of any real product.
 * - `game`  game-balance value (price, science points, operations cost): made up so
 *           that trade-offs are interesting, never presented as a real figure.
 */
export const ESTIMATE_SOURCE =
  'Typical value for this technology class (cf. Wertz & Larson, SMAD; Sutton & Biblarz, Rocket Propulsion Elements). Educational approximation, not a product specification.';

export const GAME_SOURCE = 'Game-balance value. Not a real price, score or schedule.';

export const est = (value: number, unit: UnitSymbol): Quantity => q(value, unit, 'estimated', ESTIMATE_SOURCE);

export const game = (value: number, unit: UnitSymbol): Quantity => q(value, unit, 'fictional', GAME_SOURCE);
