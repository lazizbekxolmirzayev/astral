import { BODIES, SI_EXACT } from './constants';
import { DEFAULT_CATALOG, type CatalogLookup } from './catalog';
import type { Mission } from './models/mission';
import type { OrbitSpec } from './models/catalog';
import { valueIn } from './units';

/**
 * Orbit editor fields in the units a person thinks in. Earth, Moon and Mars orbits are
 * edited as altitudes in km; heliocentric orbits as distances from the Sun in AU (the
 * document keeps altitudes above the Sun's surface in km for every body, so the engine
 * has one representation). Conversion only: no orbital mechanics happens here.
 */

export type OrbitField = 'periapsis' | 'apoapsis' | 'inclination';
export type FieldRange = { value: number; min: number; max: number; step: number; unit: 'km' | 'AU' | 'deg'; locked: boolean };
export type OrbitInputs = {
  heliocentric: boolean;
  periapsis: FieldRange;
  apoapsis: FieldRange;
  inclination: FieldRange;
};

const AU_KM = SI_EXACT.astronomicalUnitM / 1000;
const sunRadiusKm = () => valueIn(BODIES.sun.radius, 'km');

const toAu = (altitudeKm: number) => (altitudeKm + sunRadiusKm()) / AU_KM;
const fromAu = (au: number) => Math.round(au * AU_KM - sunRadiusKm());
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

export function orbitInputs(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): OrbitInputs {
  const destination = catalog.getDestination(mission.objective.destinationId);
  if (!destination) throw new Error(`catalog has no destination "${mission.objective.destinationId}"`);
  const { altitudeKm, inclinationDeg } = destination.orbitLimits;
  const helio = destination.centralBody === 'sun';
  const altitude = (value: number): FieldRange => ({
    value: helio ? round(toAu(value), 3) : value,
    min: helio ? round(toAu(altitudeKm.min), 3) : altitudeKm.min,
    max: helio ? round(toAu(altitudeKm.max), 3) : altitudeKm.max,
    step: helio ? 0.01 : 10,
    unit: helio ? 'AU' : 'km',
    locked: altitudeKm.min === altitudeKm.max,
  });
  return {
    heliocentric: helio,
    periapsis: altitude(mission.orbit.periapsisAltKm),
    apoapsis: altitude(mission.orbit.apoapsisAltKm),
    inclination: { value: mission.orbit.inclinationDeg, min: inclinationDeg.min, max: inclinationDeg.max, step: 0.1, unit: 'deg', locked: inclinationDeg.min === inclinationDeg.max },
  };
}

/**
 * The orbit change for typing `value` into `field`. Keeps the apsides in order: raising
 * the periapsis above the apoapsis lifts the apoapsis with it, and lowering the apoapsis
 * below the periapsis lowers the periapsis (so a typed number never becomes a refused edit).
 */
export function orbitChange(mission: Mission, field: OrbitField, value: number): Partial<OrbitSpec> {
  const helio = mission.objective.destinationId === 'helio';
  const altitude = helio ? fromAu(value) : value;
  if (field === 'inclination') return { inclinationDeg: value };
  if (field === 'periapsis') return { periapsisAltKm: altitude, apoapsisAltKm: Math.max(altitude, mission.orbit.apoapsisAltKm) };
  return { apoapsisAltKm: altitude, periapsisAltKm: Math.min(altitude, mission.orbit.periapsisAltKm) };
}

/** Seconds as the most readable of minutes, hours or days. */
export function durationParts(seconds: number): { value: number; unit: 'min' | 'h' | 'd' } {
  if (seconds < 2 * 3600) return { value: seconds / 60, unit: 'min' };
  if (seconds < 2 * 86_400) return { value: seconds / 3600, unit: 'h' };
  return { value: seconds / 86_400, unit: 'd' };
}
