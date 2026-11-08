import type { Destination, DestinationId, Launcher, LaunchTarget, LaunchTargetId, Part } from '../models/catalog';
import { DESTINATIONS } from './destinations';
import { INSTRUMENTS } from './instruments';
import { LAUNCHERS, LAUNCH_TARGETS } from './launch';
import { ADCS, BATTERIES, BUSES, COMMS, OBCS, PROPULSION, SOLAR_ARRAYS } from './parts';

export { ADCS, BATTERIES, BUSES, COMMS, DESTINATIONS, INSTRUMENTS, LAUNCHERS, LAUNCH_TARGETS, OBCS, PROPULSION, SOLAR_ARRAYS };

/** Every spacecraft part, instruments included. */
export const PARTS: readonly Part[] = [...BUSES, ...PROPULSION, ...SOLAR_ARRAYS, ...BATTERIES, ...COMMS, ...OBCS, ...ADCS, ...INSTRUMENTS];

const partMap: ReadonlyMap<string, Part> = new Map(PARTS.map((part) => [part.id, part]));
const launcherMap: ReadonlyMap<string, Launcher> = new Map(LAUNCHERS.map((launcher) => [launcher.id, launcher]));
const destinationMap: ReadonlyMap<DestinationId, Destination> = new Map(DESTINATIONS.map((destination) => [destination.id, destination]));
const targetMap: ReadonlyMap<LaunchTargetId, LaunchTarget> = new Map(LAUNCH_TARGETS.map((target) => [target.id, target]));

export const getPart = (id: string): Part | undefined => partMap.get(id);
export const getLauncher = (id: string): Launcher | undefined => launcherMap.get(id);
export const getDestination = (id: DestinationId): Destination | undefined => destinationMap.get(id);
export const getLaunchTarget = (id: LaunchTargetId): LaunchTarget | undefined => targetMap.get(id);
