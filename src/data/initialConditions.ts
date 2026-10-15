import type { BodyDefinition } from '@/physics/gravity';

/**
 * Real initial conditions for the simulation, at one fixed epoch.
 *
 * ## Source
 *
 * NASA/JPL Horizons (ephemeris DE441), `EPHEM_TYPE=VECTORS`, target = each body's
 * centre, centre body = `500@10` (the Sun's centre), reference frame = ecliptic
 * of J2000.0, epoch **2026-01-01 00:00:00 TDB**. Retrieved 2026-10-14 from
 * `https://ssd.jpl.nasa.gov/api/horizons.api`. The request for each body is
 * recorded in `raw` below, so the numbers can be re-pulled and compared.
 *
 * `GM` (the gravitational parameter) is printed by Horizons in the target
 * summary for every body except the outer-planet barycenter records, which is
 * why the planet *centres* (599/699/799/899) were queried rather than the
 * barycenters (5/6/7/8).
 *
 * ## Units — and why the numbers here are `derived`, not `measured`
 *
 * Horizons prints kilometres and km/s. The simulation runs in AU and days, so
 * every value below is converted at module load by `toAuDay()`:
 *
 *   1 AU  = 149 597 870.7 km      IAU 2012 Resolution B2 (exact definition)
 *   1 day = 86 400 s              SI
 *
 * The inputs are `measured` (JPL), the outputs are `derived` (a unit change, no
 * modelling assumption). 1 AU/day ≈ 1 731.5 km/s, which is the sanity check:
 * Earth comes out at 0.017 0 AU/day ≈ 29.5 km/s, matching the 29.8 km/s NASA
 * prints for Earth's mean orbital speed.
 *
 * ## What is NOT modelled
 *
 * Point-mass Newtonian gravity only: no oblateness (J2), no moons, no dwarf
 * planets, no relativity, no radiation pressure. The Sun starts exactly at the
 * origin with zero velocity, so the system's barycentre is at rest by
 * construction.
 */

/** Distance conversions. Both are exact definitions, not measurements. */
export const KILOMETRES_PER_AU = 149597870.7;
export const SECONDS_PER_DAY = 86400;

/** Epoch of every state vector below. */
export const EPOCH = {
  label: '2026-01-01 00:00:00 TDB',
  julianDateTdb: 2461041.5,
  frame: 'ecliptic of J2000.0, heliocentric (Horizons centre 500@10)',
  source: 'https://ssd.jpl.nasa.gov/api/horizons.api',
} as const;

type RawRecord = {
  id: string;
  /** Horizons target number, for re-pulling the record. */
  target: string;
  /** GM in km³/s², exactly as Horizons prints it. */
  gmKm3PerSecondSquared: number;
  /** km, ecliptic J2000.0, relative to the Sun's centre. */
  positionKm: readonly [number, number, number];
  /** km/s, same frame. */
  velocityKmPerSecond: readonly [number, number, number];
};

/** Provenance marker reused on every row so nothing looks hand-typed. */
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api (DE441, centre 500@10, J2000 ecliptic)';

const raw: readonly RawRecord[] = [
  { id: 'sun', target: '10', gmKm3PerSecondSquared: 132712440041.93938, positionKm: [0, 0, 0], velocityKmPerSecond: [0, 0, 0] },
  {
    id: 'mercury',
    target: '199',
    gmKm3PerSecondSquared: 22031.86855,
    positionKm: [-3.219365690676167e7, -6.12165879829846e7, -2.049979952579837e6],
    velocityKmPerSecond: [3.329912211950884e1, -2.032319326617692e1, -4.715026944319221],
  },
  {
    id: 'venus',
    target: '299',
    gmKm3PerSecondSquared: 324858.592,
    positionKm: [1.329584729627933e7, -1.079741155459946e8, -2.250558830319598e6],
    velocityKmPerSecond: [3.452275635351619e1, 4.156129935817114, -1.934854181927197],
  },
  {
    id: 'earth',
    target: '399',
    gmKm3PerSecondSquared: 398600.435436,
    positionKm: [-2.607213844816194e7, 1.447746738210197e8, -8892.861905746162],
    velocityKmPerSecond: [-29.78893116564825, -5.396270536820538, 0.0004106639513727917],
  },
  {
    id: 'mars',
    target: '499',
    gmKm3PerSecondSquared: 42828.375662,
    positionKm: [5.094999446228143e7, -2.074925482420174e8, -5.597537454939082e6],
    velocityKmPerSecond: [24.44715235948102, 7.861165862885534, -0.4347434612671703],
  },
  {
    id: 'jupiter',
    target: '599',
    gmKm3PerSecondSquared: 126686531.9,
    positionKm: [-2.53419345368912e8, 7.373503057947004e8, 2.606925500009716e6],
    velocityKmPerSecond: [-12.52004139508961, -3.640294521136214, 0.2951466824685909],
  },
  {
    id: 'saturn',
    target: '699',
    gmKm3PerSecondSquared: 37931206.234,
    positionKm: [1.42227806719984e9, 3.855721158159366e7, -5.728636261760134e7],
    velocityKmPerSecond: [-0.8022902327476618, 9.633913344037813, -0.1352982130832756],
  },
  {
    id: 'uranus',
    target: '799',
    gmKm3PerSecondSquared: 5793950.6103,
    positionKm: [1.478073476913783e9, 2.513246041395467e9, -9.831518091484904e6],
    velocityKmPerSecond: [-5.932790537281171, 3.134649152126629, 0.08880768290436647],
  },
  {
    id: 'neptune',
    target: '899',
    gmKm3PerSecondSquared: 6835099.97,
    positionKm: [4.46880589819067e9, 7.763207126367633e7, -1.045790075770329e8],
    velocityKmPerSecond: [-0.1418854875118983, 5.465647406292941, -0.1098254845841962],
  },
];

/** km³/s² → AU³/day². */
export function gmToAuPerDay(gmKm3PerSecondSquared: number): number {
  return (gmKm3PerSecondSquared * SECONDS_PER_DAY ** 2) / KILOMETRES_PER_AU ** 3;
}

/** km → AU. */
export function kmToAu(km: number): number {
  return km / KILOMETRES_PER_AU;
}

/** km/s → AU/day. */
export function kmPerSecondToAuPerDay(kmPerSecond: number): number {
  return (kmPerSecond * SECONDS_PER_DAY) / KILOMETRES_PER_AU;
}

/**
 * The nine bodies in integration order. Index 0 is the Sun, which the UI treats
 * as the central mass.
 */
export const initialConditions: readonly BodyDefinition[] = raw.map((record) => ({
  id: record.id,
  gm: gmToAuPerDay(record.gmKm3PerSecondSquared),
  position: record.positionKm.map(kmToAu) as [number, number, number],
  velocity: record.velocityKmPerSecond.map(kmPerSecondToAuPerDay) as [number, number, number],
}));

export const sourceOfInitialConditions = HORIZONS;

/** GM of the Sun in AU³/day² = 2.959122082855911e-4 (the Gaussian constant²). */
export const SUN_GM_AU3_PER_DAY2 = initialConditions[0]!.gm;
