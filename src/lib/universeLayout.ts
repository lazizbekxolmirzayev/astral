import { catalogEntries } from '@/data/catalog/entries';
import { skyPositions } from '@/data/catalog/sky';
import type { CatalogEntry } from '@/data/catalog/types';
import { equatorialToGalactic, galacticUnitVector } from './skyMath';

/**
 * Scene placement for the galaxy and universe views.
 *
 * What is real: each object's direction on the sky (J2000 RA/Dec turned into
 * galactic coordinates) and, in the galaxy view, its distance (1 scene unit =
 * 500 light-years, so the Milky Way's ~50,000 ly radius is 100 units and the Sun
 * sits 52 units from the centre). What is artistic: the spiral-arm pattern, the
 * galaxy sizes and tilts, and the compressed distances in the universe view.
 */
export const LY_PER_GALAXY_UNIT = 500;
export const MILKY_WAY_RADIUS = 100;
export const SUN_GALAXY_POSITION: readonly [number, number, number] = [52, 0, 0];

/**
 * Drawn radius of a star marker in the galaxy view. Nearby stars are only 0.01-0.1
 * units apart (4-50 ly at 500 ly per unit), so a marker bigger than that would
 * swallow its neighbours. Far away, a constant-size halo keeps them findable.
 */
export const GALAXY_STAR_RADIUS = 0.003;

export type MarkerKind = 'sun' | 'star' | 'black_hole' | 'galaxy';

export type SceneMarker = {
  id: string;
  name: string;
  kind: MarkerKind;
  position: [number, number, number];
  /** Drawn radius, scene units. Artistic. */
  radius: number;
  color: string;
  /** Catalogue record, when there is one. */
  entry?: CatalogEntry;
};

/** Galactic (X to centre, Y toward l = 90, Z north) to scene axes, with the Sun at +x so the centre lies at the origin. */
function toScene(unit: readonly [number, number, number], distance: number): [number, number, number] {
  return [-unit[0] * distance, unit[2] * distance, unit[1] * distance];
}

export function starColor(temperatureK: number | undefined): string {
  if (temperatureK === undefined) return '#f4f6ff';
  if (temperatureK < 3700) return '#ff9a5c';
  if (temperatureK < 5200) return '#ffc48a';
  if (temperatureK < 6000) return '#fff0cc';
  if (temperatureK < 7500) return '#f8f7ff';
  if (temperatureK < 10000) return '#cad7ff';
  return '#9db4ff';
}

function direction(entry: CatalogEntry): [number, number, number] | null {
  const sky = skyPositions[entry.id];
  if (!sky) return null;
  const { lDeg, bDeg } = equatorialToGalactic(sky.raDeg, sky.decDeg);
  return galacticUnitVector(lDeg, bDeg) as [number, number, number];
}

/** The Sun plus the catalogue's stars and black holes that sit inside the Milky Way. */
export function galaxyMarkers(entries: readonly CatalogEntry[] = catalogEntries): SceneMarker[] {
  const markers: SceneMarker[] = [
    { id: 'sun', name: 'Sun', kind: 'sun', position: [...SUN_GALAXY_POSITION], radius: GALAXY_STAR_RADIUS, color: '#ffd166' },
  ];
  for (const entry of entries) {
    if (entry.type !== 'star' && entry.type !== 'black_hole') continue;
    if (entry.id === 'sun') continue;
    const distanceLy = entry.distanceLy?.value;
    const unit = direction(entry);
    if (distanceLy === undefined || !unit || distanceLy > 60_000) continue; // beyond the Milky Way: universe view
    const offset = toScene(unit, distanceLy / LY_PER_GALAXY_UNIT);
    markers.push({
      id: entry.id,
      name: entry.name,
      kind: entry.type === 'black_hole' ? 'black_hole' : 'star',
      position: [SUN_GALAXY_POSITION[0] + offset[0], SUN_GALAXY_POSITION[1] + offset[1], SUN_GALAXY_POSITION[2] + offset[2]],
      radius: entry.type === 'black_hole' ? 0.9 : GALAXY_STAR_RADIUS,
      color: entry.type === 'black_hole' ? '#8b6cff' : starColor(entry.temperatureK?.value),
      entry,
    });
  }
  // Alpha Centauri A and Proxima are 0.2 ly apart, 0.0004 units: shrink each star
  // marker below its nearest neighbour's gap so close pairs never merge.
  for (const marker of markers) {
    if (marker.kind === 'black_hole') continue;
    let nearest = Infinity;
    for (const other of markers) {
      if (other === marker || other.kind === 'black_hole') continue;
      nearest = Math.min(nearest, Math.hypot(marker.position[0] - other.position[0], marker.position[1] - other.position[1], marker.position[2] - other.position[2]));
    }
    marker.radius = Math.min(marker.radius, nearest * 0.4);
  }
  return markers;
}

/** Compressed distance for the universe view: keeps order and rough ratios while fitting the screen. */
export function universeDistance(distanceMly: number): number {
  return 22 * Math.pow(Math.max(distanceMly, 0), 0.45);
}

const GALAXY_RADII: Record<string, number> = { 'milky-way': 11, andromeda: 16, triangulum: 7, lmc: 3.5, whirlpool: 9, sombrero: 8, 'm87-star': 12 };

/** The Milky Way at the centre, then every catalogue galaxy (and M87*) in its real direction. */
export function universeMarkers(entries: readonly CatalogEntry[] = catalogEntries): SceneMarker[] {
  const markers: SceneMarker[] = [];
  for (const entry of entries) {
    const isGalaxy = entry.type === 'galaxy';
    if (!isGalaxy && entry.id !== 'm87-star') continue;
    const radius = GALAXY_RADII[entry.id] ?? 3;
    if (entry.id === 'milky-way') {
      markers.push({ id: entry.id, name: entry.name, kind: 'galaxy', position: [0, 0, 0], radius, color: '#d9e2ff', entry });
      continue;
    }
    const unit = direction(entry);
    const distanceLy = entry.distanceLy?.value;
    if (!unit || distanceLy === undefined) continue;
    markers.push({
      id: entry.id,
      name: entry.name,
      kind: isGalaxy ? 'galaxy' : 'black_hole',
      position: toScene(unit, universeDistance(distanceLy / 1e6)),
      radius,
      color: isGalaxy ? '#d9e2ff' : '#8b6cff',
      entry,
    });
  }
  return markers;
}

/** Catalogue ids shown in each view, for the sidebar list. */
export function markerIdsFor(scale: 'galaxy' | 'universe'): string[] {
  return (scale === 'galaxy' ? galaxyMarkers() : universeMarkers()).map((marker) => marker.id);
}
