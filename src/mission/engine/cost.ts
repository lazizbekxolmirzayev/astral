import type { Quantity } from '../models/quantity';
import { toBase } from '../units';
import { derive, type Derived } from './derived';
import type { ResolvedDesign } from './resolve';

export type CostResult = {
  spacecraft: Derived;
  launch: Derived;
  operations: Derived;
  total: Derived;
  /** Days that operations cost is charged for: cruise plus planned operations. */
  chargedDays: number;
};

/**
 * Mission cost = spacecraft hardware + launch + (cruise + operations days) × daily operations cost.
 * Every price is a game-balance value, so the total is always "fictional".
 * Propellant has no price in the catalog and is therefore not charged.
 */
export function computeCost(design: ResolvedDesign): CostResult {
  const { mission, bus, propulsion, launcher, destination } = design;
  const model = 'cost' as const;

  const inputs: Quantity[] = [bus.cost];
  let hardware = toBase(bus.cost);
  if (propulsion) {
    hardware += toBase(propulsion.cost);
    inputs.push(propulsion.cost);
  }
  for (const group of [design.solarArrays, design.batteries, design.comms, design.computers, design.attitude, design.instruments]) {
    for (const { part, quantity } of group) {
      hardware += toBase(part.cost) * quantity;
      inputs.push(part.cost);
    }
  }
  const chargedDays = toBase(destination.cruiseDuration) / 86_400 + mission.plannedOperationsDays;
  const operations = toBase(destination.operationsCostPerDay) * chargedDays;

  const spacecraft = derive(hardware, 'USD', model, 'sum of part prices × quantity', inputs);
  const launch = derive(toBase(launcher.cost), 'USD', model, `price of ${launcher.id}`, [launcher.cost]);
  const ops = derive(operations, 'USD', model, 'operations cost per day × (cruise + operations days)', [destination.operationsCostPerDay]);
  const total = derive(hardware + toBase(launcher.cost) + operations, 'USD', model, 'spacecraft + launch + operations', [spacecraft, launch, ops]);
  return { spacecraft, launch, operations: ops, total, chargedDays };
}
