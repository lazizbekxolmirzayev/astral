import type { DestinationId } from '@/mission';

/**
 * Where things are on the game's solar-system map, as plain data.
 *
 * The map is a stylised, NOT-TO-SCALE picture (Earth, Moon, Mars and the Sun are drawn close together so
 * that every destination can be clicked in one view). Bodies and orbits keep their real order and
 * relationships; distances and sizes are artistic.
 */
export type Vec3 = [number, number, number];

export const MAP_EARTH = { position: [0, 0, 0] as Vec3, radius: 3.3 };
export const MAP_MOON = { orbitRadius: 13.5, angle: 0.75, tilt: 0.09, radius: 0.9 };
export const MAP_MARS = { position: [34, 0, -9] as Vec3, radius: 2.2 };
export const MAP_SUN = { position: [-42, 0, -14] as Vec3, radius: 9 };

/** Radii of the Earth-orbit rings and their tilt (radians) about the x axis. */
export const MAP_RINGS = {
  leo: { radius: 4.5, tilt: (51.6 * Math.PI) / 180 },
  sso: { radius: 5.25, tilt: (97.8 * Math.PI) / 180 },
  geo: { radius: 7.7, tilt: 0 },
  helio: { radius: 33, tilt: 0 },
} as const;

/** A point on a circle of `radius` that is tilted by `tilt` about the x axis, around `center`. */
export function ringPoint(radius: number, tilt: number, angle: number, center: Vec3 = [0, 0, 0]): Vec3 {
  const x = radius * Math.cos(angle);
  const z = radius * Math.sin(angle);
  return [center[0] + x, center[1] + z * Math.sin(tilt), center[2] + z * Math.cos(tilt)];
}

export function ringPoints(radius: number, tilt: number, center: Vec3 = [0, 0, 0], segments = 128): Vec3[] {
  return Array.from({ length: segments + 1 }, (_, index) => ringPoint(radius, tilt, (index / segments) * Math.PI * 2, center));
}

export type MapAnchor = {
  id: DestinationId;
  /** Where the marker sits and what the camera looks at. */
  position: Vec3;
  /** Camera position and target when this destination is focused. */
  camera: { position: Vec3; target: Vec3 };
};

const moonPosition = ringPoint(MAP_MOON.orbitRadius, MAP_MOON.tilt, MAP_MOON.angle);

const anchor = (id: DestinationId, position: Vec3, offset: Vec3, lookAt: Vec3 = position): MapAnchor => ({
  id,
  position,
  camera: { position: [lookAt[0] + offset[0], lookAt[1] + offset[1], lookAt[2] + offset[2]], target: lookAt },
});

export const MAP_ANCHORS: Record<DestinationId, MapAnchor> = {
  leo: anchor('leo', ringPoint(MAP_RINGS.leo.radius, MAP_RINGS.leo.tilt, 3.45), [-5, 3, 12], MAP_EARTH.position),
  sso: anchor('sso', ringPoint(MAP_RINGS.sso.radius, MAP_RINGS.sso.tilt, 1.45), [3, 4, 13], MAP_EARTH.position),
  geo: anchor('geo', ringPoint(MAP_RINGS.geo.radius, MAP_RINGS.geo.tilt, 0.25), [4, 7, 18], MAP_EARTH.position),
  moon: anchor('moon', moonPosition, [3, 2.5, 8]),
  mars: anchor('mars', MAP_MARS.position, [-4, 3, 9]),
  helio: anchor('helio', ringPoint(MAP_RINGS.helio.radius, MAP_RINGS.helio.tilt, 0.5, MAP_SUN.position), [-9, 7, 17]),
};

/** The whole map in one view. */
export const MAP_OVERVIEW = { position: [3, 15, 37] as Vec3, target: [5, 0, -3] as Vec3 };

/** Earth's orbit around the Sun as drawn on the map (reference line only). */
export const MAP_EARTH_ORBIT_RADIUS = Math.hypot(MAP_EARTH.position[0] - MAP_SUN.position[0], MAP_EARTH.position[2] - MAP_SUN.position[2]);
