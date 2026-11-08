import type { ModelCardId } from '../modelCards';
import { q, type Provenance, type Quantity } from '../models/quantity';
import type { UnitSymbol } from '../units';

/**
 * A calculated number. It is a normal `Quantity` (value, unit, provenance, source)
 * plus the model card that explains how it was computed, so a result can never be
 * shown without its unit or its origin.
 */
export type Derived = Quantity & { readonly model: ModelCardId };

const RANK: Record<Provenance, number> = { measured: 4, derived: 3, estimated: 2, fictional: 1, artistic: 0 };

/**
 * The provenance a result inherits from its inputs: the weakest one wins. A result
 * computed only from measured or derived inputs is "derived"; one that touches an
 * estimated catalog value is "estimated"; one that touches a game-balance value is
 * "fictional". A calculation can therefore never look more real than its inputs.
 */
export function weakestProvenance(inputs: readonly Quantity[]): Provenance {
  let weakest: Provenance = 'derived';
  for (const input of inputs) {
    if (RANK[input.provenance] < RANK[weakest]) weakest = input.provenance;
  }
  return weakest;
}

/** Builds a calculated quantity. Throws on a non-finite value instead of letting NaN reach the UI. */
export function derive(value: number, unit: UnitSymbol, model: ModelCardId, basis: string, inputs: readonly Quantity[] = []): Derived {
  if (!Number.isFinite(value)) throw new RangeError(`${model}: ${basis} produced a non-finite value (${String(value)})`);
  return { ...q(value, unit, weakestProvenance(inputs), `${model}: ${basis}`), model };
}

/** (limit − used) / limit. With no capacity at all, −1 if something is needed and 0 if nothing is. */
export function marginOf(limit: number, used: number): number {
  if (limit > 0) return (limit - used) / limit;
  return used > 0 ? -1 : 0;
}
