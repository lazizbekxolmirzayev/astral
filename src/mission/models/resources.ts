import type { ModelCardId } from '../modelCards';
import type { Provenance } from './quantity';

/**
 * The resource budget contract. The resource engine (src/mission/engine) fills it
 * in; the UI, the simulation and the scoring read it.
 */

export const RESOURCE_KEYS = ['mass', 'power', 'budget', 'data', 'comms', 'time'] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export type ResourceStatus = 'ok' | 'tight' | 'over';

export type ResourceLine = {
  /** Amount the design uses, in `unit`. */
  used: number;
  /** Amount available, same unit. `null` when nothing limits this resource (for example no cost requirement). */
  limit: number | null;
  /** (limit − used) / limit. Negative means over the limit; `null` when there is no limit. */
  margin: number | null;
  /** SI base unit of the line: kg, W, USD, bit (per day), bit/s, s. */
  unit: string;
  status: ResourceStatus;
  /** The weakest provenance among the inputs of the calculation. */
  provenance: Provenance;
  model: ModelCardId;
  /** One line saying what `used` and `limit` mean for this resource. */
  basis: string;
};

export type ResourceBudget = Record<ResourceKey, ResourceLine>;
