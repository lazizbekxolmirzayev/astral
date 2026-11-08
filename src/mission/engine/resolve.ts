import { DEFAULT_CATALOG, type CatalogLookup } from '../catalog';
import type { Adcs, Battery, Bus, Comms, Destination, Instrument, Launcher, LaunchTarget, Obc, Propulsion, SolarArray } from '../models/catalog';
import type { Mission } from '../models/mission';
import { FATAL_ISSUE_CODES, validateMissionReferences, type MissionIssue } from '../validation';

export type Selected<T> = { part: T; quantity: number };

/** A mission with every id replaced by its catalog item. Everything the engine reads comes from here. */
export type ResolvedDesign = {
  mission: Mission;
  destination: Destination;
  deliveryTarget: LaunchTarget;
  launcher: Launcher;
  bus: Bus;
  propulsion: Propulsion | null;
  solarArrays: Selected<SolarArray>[];
  batteries: Selected<Battery>[];
  comms: Selected<Comms>[];
  computers: Selected<Obc>[];
  attitude: Selected<Adcs>[];
  instruments: Selected<Instrument>[];
};

export type Resolution = { design: ResolvedDesign; referenceIssues: MissionIssue[] } | { design: null; referenceIssues: MissionIssue[] };

/**
 * Looks every id up in the catalog. If an id is unknown or sits in the wrong slot,
 * nothing can be computed and the issues are returned instead; softer problems
 * (an incompatible bus, an over-full tank) are returned alongside the design so the
 * engine still computes and reports them.
 */
export function resolveDesign(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): Resolution {
  const referenceIssues = validateMissionReferences(mission, catalog);
  if (referenceIssues.some((issue) => FATAL_ISSUE_CODES.includes(issue.code))) return { design: null, referenceIssues };

  const destination = catalog.getDestination(mission.objective.destinationId);
  const deliveryTarget = destination && catalog.getLaunchTarget(destination.deliveryTarget);
  const launcher = catalog.getLauncher(mission.launch.vehicleId);
  const bus = catalog.getPart(mission.spacecraft.busId);
  if (!destination || !deliveryTarget || !launcher || bus?.category !== 'bus') return { design: null, referenceIssues };

  const propulsionPart = mission.spacecraft.propulsionId ? catalog.getPart(mission.spacecraft.propulsionId) : null;
  const design: ResolvedDesign = {
    mission,
    destination,
    deliveryTarget,
    launcher,
    bus,
    propulsion: propulsionPart?.category === 'propulsion' ? propulsionPart : null,
    solarArrays: [],
    batteries: [],
    comms: [],
    computers: [],
    attitude: [],
    instruments: [],
  };

  for (const { itemId, quantity } of mission.spacecraft.parts) {
    const part = catalog.getPart(itemId);
    if (!part) continue;
    switch (part.category) {
      case 'solar-array': design.solarArrays.push({ part, quantity }); break;
      case 'battery': design.batteries.push({ part, quantity }); break;
      case 'comms': design.comms.push({ part, quantity }); break;
      case 'obc': design.computers.push({ part, quantity }); break;
      case 'adcs': design.attitude.push({ part, quantity }); break;
      case 'instrument': design.instruments.push({ part, quantity }); break;
      default: break; // bus and propulsion are chosen in their own fields; validation reports them
    }
  }
  return { design, referenceIssues };
}
