import type { Quantity } from '../models/quantity';
import { toBase } from '../units';
import { derive, marginOf, type Derived } from './derived';
import type { ResolvedDesign } from './resolve';

export type MassResult = {
  /** Structure and all subsystems without propellant. */
  dry: Derived;
  /** Instruments only. */
  payload: Derived;
  propellant: Derived;
  /** Wet mass at launch = dry + propellant. */
  launch: Derived;
  /** Mass the chosen launcher can deliver to the destination's delivery target. */
  launcherCapacity: Derived | null;
  /** Mass of instruments the bus structure can carry. */
  payloadLimit: Derived;
  launcherMargin: number | null;
  payloadMargin: number;
};

/** Mass budget: sums catalog masses and compares them with the launcher and the bus. */
export function computeMass(design: ResolvedDesign): MassResult {
  const { mission, bus, propulsion, destination, launcher } = design;
  const model = 'mass-budget' as const;

  const inputs: Quantity[] = [bus.mass];
  let dry = toBase(bus.mass);
  if (propulsion) {
    dry += toBase(propulsion.mass);
    inputs.push(propulsion.mass);
  }
  let payload = 0;
  const payloadInputs: Quantity[] = [];
  for (const group of [design.solarArrays, design.batteries, design.comms, design.computers, design.attitude, design.instruments]) {
    for (const { part, quantity } of group) {
      dry += toBase(part.mass) * quantity;
      inputs.push(part.mass);
    }
  }
  for (const { part, quantity } of design.instruments) {
    payload += toBase(part.mass) * quantity;
    payloadInputs.push(part.mass);
  }

  const propellantKg = mission.spacecraft.propellantMassKg;
  const dryResult = derive(dry, 'kg', model, 'sum of bus, propulsion and part masses (without propellant)', inputs);
  const payloadResult = derive(payload, 'kg', model, 'sum of instrument masses', payloadInputs);
  const propellantResult = derive(propellantKg, 'kg', model, 'propellant loaded at launch (player input)');
  const launchResult = derive(dry + propellantKg, 'kg', model, 'dry mass + propellant', [dryResult]);

  const capacityQuantity = launcher.capacity[destination.deliveryTarget];
  const capacity = capacityQuantity
    ? derive(toBase(capacityQuantity), 'kg', 'launch-fit', `capacity of ${launcher.id} to ${destination.deliveryTarget}`, [capacityQuantity])
    : null;
  const limit = derive(toBase(bus.payloadMassLimit), 'kg', model, `payload mass limit of ${bus.id}`, [bus.payloadMassLimit]);

  return {
    dry: dryResult,
    payload: payloadResult,
    propellant: propellantResult,
    launch: launchResult,
    launcherCapacity: capacity,
    payloadLimit: limit,
    launcherMargin: capacity ? marginOf(capacity.value, launchResult.value) : null,
    payloadMargin: marginOf(limit.value, payload),
  };
}
