import { DEFAULT_CATALOG, LAUNCHERS, LAUNCH_SITES, LAUNCH_TARGETS, type CatalogLookup } from './catalog';
import { createAssumptionReader } from './engine/assumptions';
import { deliveryInclinationDeg } from './engine/deltaV';
import type { Evaluation } from './engine';
import type { CheckStatus } from './engine/readiness';
import type { Launcher, LaunchSite, LaunchTarget, LaunchTargetId } from './models/catalog';
import type { Mission } from './models/mission';
import { valueIn } from './units';

/**
 * The comparison tables of the Launch tab. Pure: they read the mission and its
 * evaluation and return plain rows, so the screen shows the same numbers the
 * readiness report uses and has no rules of its own.
 */

export type LauncherRow = {
  launcher: Launcher;
  selected: boolean;
  /** Capacity to the target this mission's destination needs; null when the vehicle cannot deliver there. */
  capacityKg: number | null;
  /** (capacity − launch mass) / capacity for the current design; null when it cannot deliver. */
  margin: number | null;
  /** The current design fits within the capacity. */
  fits: boolean;
  /** The chosen site hosts this vehicle. */
  hostedAtSite: boolean;
  costMusd: number;
  reliability: number;
  /** Every target the vehicle can deliver to, with its capacity in kg. */
  capacities: Array<{ target: LaunchTarget; capacityKg: number }>;
  /** Sites that host the vehicle. */
  sites: LaunchSite[];
};

export function compareLaunchers(mission: Mission, evaluation: Evaluation, catalog: CatalogLookup = DEFAULT_CATALOG): LauncherRow[] {
  const destination = catalog.getDestination(mission.objective.destinationId);
  const launchMass = evaluation.details?.mass.launch.value ?? null;
  return LAUNCHERS.map((launcher) => {
    const capacity = destination ? launcher.capacity[destination.deliveryTarget] : undefined;
    const capacityKg = capacity ? valueIn(capacity, 'kg') : null;
    const margin = capacityKg !== null && launchMass !== null && capacityKg > 0 ? (capacityKg - launchMass) / capacityKg : null;
    return {
      launcher,
      selected: launcher.id === mission.launch.vehicleId,
      capacityKg,
      margin,
      fits: margin !== null && margin >= 0,
      hostedAtSite: LAUNCH_SITES.find((site) => site.id === mission.launch.siteId)?.launcherIds.includes(launcher.id) ?? false,
      costMusd: valueIn(launcher.cost, 'MUSD'),
      reliability: valueIn(launcher.reliability, '1'),
      capacities: LAUNCH_TARGETS.flatMap((target) => {
        const value = launcher.capacity[target.id as LaunchTargetId];
        return value ? [{ target, capacityKg: valueIn(value, 'kg') }] : [];
      }),
      sites: LAUNCH_SITES.filter((site) => site.launcherIds.includes(launcher.id)),
    };
  });
}

export type SiteRow = {
  site: LaunchSite;
  selected: boolean;
  latitudeDeg: number;
  longitudeDeg: number;
  minInclinationDeg: number;
  maxInclinationDeg: number;
  /** The chosen vehicle launches from this site. */
  hostsLauncher: boolean;
  /**
   * What this site does to the current orbit. `orbit`: the inclination the site can deliver and how far
   * the wanted one lies outside its corridor. `escape`: the site's inclination does not enter the model.
   * `geostationary`: the transfer orbit starts at the site's corridor edge and the apogee burn removes it.
   */
  reach:
    | { kind: 'orbit'; deliveryDeg: number; shortfallDeg: number; status: CheckStatus }
    | { kind: 'geostationary'; deliveryDeg: number }
    | { kind: 'escape' };
};

export function compareSites(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): SiteRow[] {
  const destination = catalog.getDestination(mission.objective.destinationId);
  const target = destination ? catalog.getLaunchTarget(destination.deliveryTarget) : undefined;
  const limitDeg = (createAssumptionReader().value('site-plane-change-limit') * 180) / Math.PI;
  return LAUNCH_SITES.map((site) => {
    const deliveryDeg = deliveryInclinationDeg(site, mission.orbit.inclinationDeg);
    const shortfallDeg = Math.abs(mission.orbit.inclinationDeg - deliveryDeg);
    const reach: SiteRow['reach'] =
      !target || target.kind === 'escape'
        ? { kind: 'escape' }
        : destination?.id === 'geo'
          ? { kind: 'geostationary', deliveryDeg }
          : { kind: 'orbit', deliveryDeg, shortfallDeg, status: shortfallDeg <= 1e-9 ? 'pass' : shortfallDeg > limitDeg ? 'fail' : 'warning' };
    return {
      site,
      selected: site.id === mission.launch.siteId,
      latitudeDeg: valueIn(site.latitude, 'deg'),
      longitudeDeg: valueIn(site.longitude, 'deg'),
      minInclinationDeg: valueIn(site.inclinationRange.min, 'deg'),
      maxInclinationDeg: valueIn(site.inclinationRange.max, 'deg'),
      hostsLauncher: site.launcherIds.includes(mission.launch.vehicleId),
      reach,
    };
  });
}

/** "28.56° N" / "80.58° W". */
export function formatCoordinate(degrees: number, axis: 'lat' | 'lon'): string {
  const [positive, negative] = axis === 'lat' ? ['N', 'S'] : ['E', 'W'];
  return `${Math.abs(degrees).toFixed(2)}° ${degrees >= 0 ? positive : negative}`;
}
