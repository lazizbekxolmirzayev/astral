import { BODIES, SI_EXACT, type BodyId } from './constants';
import { valueIn } from './units';
import { DEFAULT_CATALOG, type CatalogLookup } from './catalog';
import { describeOrbit } from './engine/orbit';
import type { Mission } from './models/mission';
import { spatialOrbitPath, spatialOrbitPosition, type SpatialOrbitElements, type Vec3 } from '@/physics/orbits';

/**
 * Geometry for the orbit picture. The path comes from the existing Kepler code in
 * `src/physics/orbits.ts` (the same ellipse maths the simulation guide lines use);
 * this module only chooses the units and the plane.
 *
 * Scene units: the central body's radius for planets and moons, and astronomical units
 * for the Sun (whose real size is far too small to see at that scale, so it is drawn
 * larger and flagged `bodyScaled`). The equatorial plane (the ecliptic for the Sun) is
 * the x–z plane; the orbit plane is tilted about the x axis (the line of nodes) by the inclination.
 */

export type OrbitLayout = {
  body: BodyId;
  /** Radius of the drawn body in scene units. */
  bodyRadius: number;
  /** True when the body is drawn larger than its true size relative to the orbit. */
  bodyScaled: boolean;
  unit: 'radii' | 'AU';
  path: Vec3[];
  periapsis: Vec3;
  apoapsis: Vec3;
  /** Circles in the reference plane that give a sense of scale: the equator, or Earth's orbit for a heliocentric mission. */
  references: Array<{ kind: 'equator' | 'earth-orbit'; radius: number }>;
  /** Largest distance from the centre, scene units; the camera is placed from it. */
  extent: number;
  inclinationDeg: number;
  eccentricity: number;
};

const SEGMENTS = 180;

export function layoutOrbit(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): OrbitLayout {
  const destination = catalog.getDestination(mission.objective.destinationId);
  if (!destination) throw new Error(`catalog has no destination "${mission.objective.destinationId}"`);
  const body = destination.centralBody;
  const geometry = describeOrbit(body, mission.orbit);
  const helio = body === 'sun';
  const unitLength = helio ? SI_EXACT.astronomicalUnitM : geometry.radius;

  const a = geometry.semiMajorAxis / unitLength;
  const eccentricity = (geometry.apoapsisRadius - geometry.periapsisRadius) / (geometry.apoapsisRadius + geometry.periapsisRadius);
  const tilt = (mission.orbit.inclinationDeg * Math.PI) / 180;
  const elements: SpatialOrbitElements = {
    semiMajorAxis: a,
    eccentricity,
    period: 1,
    phase: 0,
    plane: { towardPerihelion: [1, 0, 0], quarterTurnAhead: [0, Math.sin(tilt), Math.cos(tilt)] },
  };
  const apoapsisAt = elements.period / 2;
  const apoapsis = spatialOrbitPosition(elements, apoapsisAt);
  const extent = geometry.apoapsisRadius / unitLength;

  const bodyTrue = geometry.radius / unitLength;
  const bodyRadius = helio ? Math.max(bodyTrue, extent * 0.06) : bodyTrue;
  const references: OrbitLayout['references'] = helio ? [{ kind: 'earth-orbit', radius: BODIES.earth.orbit ? valueIn(BODIES.earth.orbit.semiMajorAxis, 'm') / SI_EXACT.astronomicalUnitM : 1 }] : [{ kind: 'equator', radius: 1 }];
  const referenceExtent = Math.max(extent, ...references.map((reference) => reference.radius));

  return {
    body,
    bodyRadius,
    bodyScaled: bodyRadius > bodyTrue * 1.0001,
    unit: helio ? 'AU' : 'radii',
    path: spatialOrbitPath(elements, SEGMENTS),
    periapsis: spatialOrbitPosition(elements, 0),
    apoapsis,
    references,
    extent: referenceExtent,
    inclinationDeg: mission.orbit.inclinationDeg,
    eccentricity,
  };
}
