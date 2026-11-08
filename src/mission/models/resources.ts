/**
 * Shapes of the resource budget. The calculations that fill these in arrive with
 * the resource engine (Phase 2); only the contract is fixed here so the UI, the
 * simulation and the scoring can all be written against it.
 */

export const RESOURCE_KEYS = ['mass', 'power', 'budget', 'data', 'comms', 'time'] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export type ResourceStatus = 'ok' | 'tight' | 'over';

export type ResourceLine = {
  /** Amount the design uses, in the SI base unit of the resource's dimension. */
  used: number;
  /** Amount available (or required), same unit as `used`. */
  limit: number;
  /** (limit − used) / limit. Negative means the design is over the limit. */
  margin: number;
  status: ResourceStatus;
};

export type ResourceBudget = Record<ResourceKey, ResourceLine>;
