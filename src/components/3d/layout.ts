import type { Vec3 } from '@/physics/orbits';
import type { TextureLook } from './proceduralTextures';

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

export type PlanetVisual = {
  id: string;
  name: string;
  /** Hex color, artistic choice. */
  color: string;
  /** Sphere radius in scene units, artistic and compressed. */
  radius: number;
  /** Procedural surface; artistic, not imagery. */
  look: TextureLook;
  /** Atmosphere rim color, if the planet gets one. */
  atmosphere?: string;
  /** Ring system as multiples of the planet radius. */
  ring?: { inner: number; outer: number; color: string; tilt: number };
  /** Spin in radians per second (artistic). */
  spin: number;
};

/**
 * Planet names and their order from the Sun are real; the colors, drawn radii
 * and surface patterns are not. Bodies here must match `data/initialConditions.ts` ids.
 */
export const planets: readonly PlanetVisual[] = [
  { id: 'mercury', name: 'Mercury', color: '#9c8e82', radius: 0.38, spin: 0.05, look: { mode: 'blobs', palette: ['#4d4640', '#7d746b', '#a89d90', '#c9bfb2'], seed: 11, scale: 4, seaLevel: 0.5 } },
  { id: 'venus', name: 'Venus', color: '#d8b46a', radius: 0.62, spin: -0.03, atmosphere: '#f2cf8a', look: { mode: 'bands', palette: ['#b98a47', '#e3c27d', '#f3dca2', '#d8a95c'], seed: 21, turbulence: 0.8 } },
  { id: 'earth', name: 'Earth', color: '#3f7fd0', radius: 0.66, spin: 0.35, atmosphere: '#6fb2ff', look: { mode: 'blobs', palette: ['#0b2f66', '#1b5fae', '#2b86c9', '#4f8a3c', '#7da04c', '#a89868'], seed: 31, scale: 2.2, seaLevel: 0.55, clouds: 0.45 } },
  { id: 'mars', name: 'Mars', color: '#c1543a', radius: 0.46, spin: 0.33, atmosphere: '#e89a7a', look: { mode: 'blobs', palette: ['#6f2f1d', '#a8452b', '#c9693f', '#dba074'], seed: 41, scale: 3, seaLevel: 0.5 } },
  { id: 'jupiter', name: 'Jupiter', color: '#c9a273', radius: 1.9, spin: 0.7, look: { mode: 'bands', palette: ['#7a5b3e', '#c9a273', '#ecd9b8', '#b4835a', '#f0e2c8'], seed: 51, turbulence: 0.55 } },
  { id: 'saturn', name: 'Saturn', color: '#dcc386', radius: 1.6, spin: 0.62, ring: { inner: 1.35, outer: 2.45, color: '#d9c9a0', tilt: 0.47 }, look: { mode: 'bands', palette: ['#a98d57', '#dcc386', '#f1e2b4', '#c8aa6c'], seed: 61, turbulence: 0.25 } },
  { id: 'uranus', name: 'Uranus', color: '#7fc7cf', radius: 1.1, spin: -0.4, atmosphere: '#a6e6ee', ring: { inner: 1.5, outer: 1.85, color: '#9fbfc4', tilt: 1.4 }, look: { mode: 'bands', palette: ['#6bb7c1', '#8ad4dc', '#a6e6ee'], seed: 71, turbulence: 0.1 } },
  { id: 'neptune', name: 'Neptune', color: '#3f5ecb', radius: 1.05, spin: 0.45, atmosphere: '#6f8dff', look: { mode: 'bands', palette: ['#2a43a8', '#3f5ecb', '#6c8af0', '#2d4bb8'], seed: 81, turbulence: 0.45 } },
];

/** Surface pattern of the Sun; emissive, so only the pattern matters. */
export const SUN_LOOK: TextureLook = { mode: 'granules', palette: ['#c45a0a', '#f08a1c', '#ffc34d', '#fff0b0'], seed: 3, scale: 2.4 };

/** Where the camera starts, and where the toolbar reset returns it to. */
export const DEFAULT_CAMERA_POSITION = [0, 24, 56] as const;
export const DEFAULT_CAMERA_TARGET = [0, 0, 0] as const;

/** Sphere radius per selectable body, used to frame the camera. */
export type ScaleLevel = 'system' | 'galaxy' | 'universe';

export const SCALE_LEVELS: readonly ScaleLevel[] = ['system', 'galaxy', 'universe'];

/** Camera framing per scale (scene units, artistic). */
export const VIEWS: Record<ScaleLevel, { position: readonly [number, number, number]; target: readonly [number, number, number]; minDistance: number; maxDistance: number }> = {
  system: { position: DEFAULT_CAMERA_POSITION, target: DEFAULT_CAMERA_TARGET, minDistance: 2, maxDistance: 220 },
  galaxy: { position: [40, 120, 190], target: [0, 0, 0], minDistance: 0.012, maxDistance: 600 },
  universe: { position: [0, 130, 240], target: [0, 0, 0], minDistance: 0.5, maxDistance: 900 },
};

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
