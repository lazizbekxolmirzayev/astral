import { BUSES, LAUNCHERS, LAUNCH_SITES, getDestination } from '../catalog';
import type { DestinationId } from '../models/catalog';
import { MISSION_SCHEMA_VERSION, missionSchema, type Mission } from '../models/mission';
import type { DefaultMissionOptions } from './defaults';

/**
 * A mission with only the compulsory choices made: a bus that can fly to the
 * destination, the cheapest launcher that can reach it, the default orbit, and
 * nothing else. It is deliberately incomplete, so the resource engine reports
 * what is still missing (power, radio, computer, attitude control) until the
 * player has built it.
 */
export function createBlankMission(destinationId: DestinationId, options: DefaultMissionOptions): Mission {
  const destination = getDestination(destinationId);
  if (!destination) throw new Error(`catalog has no destination "${destinationId}"`);
  const bus = BUSES.find((candidate) => candidate.destinations.includes(destinationId));
  if (!bus) throw new Error(`no bus can fly to ${destinationId}`);
  const launcher = [...LAUNCHERS]
    .filter((candidate) => candidate.capacity[destination.deliveryTarget] !== undefined)
    .sort((a, b) => a.cost.value - b.cost.value)[0];
  if (!launcher) throw new Error(`no launcher can reach ${destination.deliveryTarget}`);

  // First site that hosts the launcher; the player can change it in the Launch tab.
  const site = LAUNCH_SITES.find((candidate) => candidate.launcherIds.includes(launcher.id)) ?? LAUNCH_SITES[0];
  if (!site) throw new Error('the catalog has no launch site');

  return missionSchema.parse({
    schemaVersion: MISSION_SCHEMA_VERSION,
    id: options.id,
    revision: 0,
    ownerId: options.ownerId ?? null,
    title: options.title,
    status: 'draft',
    createdAt: options.now,
    updatedAt: options.now,
    seed: options.seed ?? 1,
    objective: { destinationId, requirements: [] },
    spacecraft: { busId: bus.id, propulsionId: null, propellantMassKg: 0, parts: [] },
    launch: { vehicleId: launcher.id, siteId: site.id },
    orbit: { ...destination.defaultOrbit },
    plannedOperationsDays: 180,
  });
}
