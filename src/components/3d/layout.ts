import type { Vec3 } from '@/physics/orbits';

/**
 * Visual layout for the viewport: what each body looks like, and how a real
 * position in AU becomes a scene position.
 *
 * PROVENANCE: colors, sphere radii and the radial compression below are
 * artistic — they are chosen to fit one screen and must never be shown as
 * numbers. The bodies' *positions* come from the real JPL state vectors
 * integrated by `lib/simulation.ts`; only the mapping from AU to scene units is
 * artistic, and it is applied identically to every body and to the orbit guide
 * lines, so relative geometry stays honest.
 *
 * Units: scene units (dimensionless).
 */
export const STAR_COUNT = 5000;
export const STAR_SHELL_MIN = 90;
export const STAR_SHELL_MAX = 160;
export const STAR_POINT_SIZE = 0.45;

export const SUN_RADIUS = 4.5;

/** Points per orbit polyline (the loop closes, so it draws segments + 1). */
export const ORBIT_SEGMENTS = 160;

/**
 * Radial compression exponent. Real planetary distances span 0.31–30.4 AU, a
 * 100× range that would put Mercury inside the Sun's drawn disc. Compressing the
 * radius as r^(1/3) keeps the order of the planets and the shape of each orbit
 * while fitting the screen: Mercury lands at 10.8 units, Neptune at 43.4.
 *
 * PROVENANCE: artistic.
 */
export const SCENE_RADIAL_EXPONENT = 1 / 3;

/** Scene units for a body at 1 AU. PROVENANCE: artistic. */
export const SCENE_RADIAL_SCALE = 14;

/**
 * Map a simulated position (AU, ecliptic J2000.0 with z out of the plane) to
 * scene units. Ecliptic z becomes scene y so the planets orbit in the scene's
 * horizontal plane, and ecliptic y is negated to keep the sense of revolution
 * counter-clockwise when viewed from the north.
 */
export function projectToScene(position: Vec3): [number, number, number] {
  const [x, y, z] = position;
  const radius = Math.hypot(x, y, z);
  if (radius < 1e-9) return [0, 0, 0];
  // scale = compressedRadius / radius = SCENE_RADIAL_SCALE · r^(e − 1)
  const scale = SCENE_RADIAL_SCALE * Math.pow(radius, SCENE_RADIAL_EXPONENT - 1);
  return [x * scale, z * scale, -y * scale];
}

/** Scene radius of a body sitting `distanceAu` from the Sun. */
export function sceneRadiusFor(distanceAu: number): number {
  return SCENE_RADIAL_SCALE * Math.pow(distanceAu, SCENE_RADIAL_EXPONENT);
}

type PlanetVisual = {
  id: string;
  name: string;
  /** Hex color, artistic choice. */
  color: string;
  /** Sphere radius in scene units, artistic and compressed. */
  radius: number;
};

/**
 * Planet names and their order from the Sun are real; the colors and drawn
 * radii are not. Bodies here must match `data/initialConditions.ts` ids.
 */
export const planets: readonly PlanetVisual[] = [
  { id: 'mercury', name: 'Mercury', color: '#9c8e82', radius: 0.38 },
  { id: 'venus', name: 'Venus', color: '#d8b46a', radius: 0.62 },
  { id: 'earth', name: 'Earth', color: '#3f7fd0', radius: 0.66 },
  { id: 'mars', name: 'Mars', color: '#c1543a', radius: 0.46 },
  { id: 'jupiter', name: 'Jupiter', color: '#c9a273', radius: 1.9 },
  { id: 'saturn', name: 'Saturn', color: '#dcc386', radius: 1.6 },
  { id: 'uranus', name: 'Uranus', color: '#7fc7cf', radius: 1.1 },
  { id: 'neptune', name: 'Neptune', color: '#3f5ecb', radius: 1.05 },
];

/** Where the camera starts, and where the toolbar reset returns it to. */
export const DEFAULT_CAMERA_POSITION = [0, 24, 56] as const;
export const DEFAULT_CAMERA_TARGET = [0, 0, 0] as const;

/** Sphere radius per selectable body, used to frame the camera. */
export const bodyRadiusById: Record<string, number> = {
  sun: SUN_RADIUS,
  ...Object.fromEntries(planets.map((planet) => [planet.id, planet.radius])),
};

/**
 * How far the camera may be from a body while its label stays visible. Scales
 * with the body so the Sun keeps its label at the default zoom and Mercury only
 * shows one when the camera closes in.
 *
 * PROVENANCE: artistic — scene units, not real distances.
 */
export function labelReach(radius: number): number {
  return Math.max(30, radius * 40);
}
