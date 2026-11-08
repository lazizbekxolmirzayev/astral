import { L, type Localized } from './i18n';
import { q, type Quantity } from './models/quantity';

/**
 * Exact by SI definition (or by IAU convention for the astronomical unit), so they
 * carry no uncertainty and are plain numbers rather than `Quantity` values.
 */
export const SI_EXACT = {
  speedOfLightMS: 299_792_458,
  boltzmannJPerK: 1.380649e-23,
  standardGravityMS2: 9.80665,
  astronomicalUnitM: 149_597_870_700,
} as const;

export const BODY_IDS = ['sun', 'earth', 'moon', 'mars'] as const;
export type BodyId = (typeof BODY_IDS)[number];

export type Body = {
  id: BodyId;
  name: Localized;
  /** Gravitational parameter μ = GM. */
  gm: Quantity;
  /** Radius used to turn altitudes into orbit radii (mean or equatorial, see source). */
  radius: Quantity;
  /** Mean distance from the parent body, where it matters for the mission models. */
  orbit?: { parent: BodyId; semiMajorAxis: Quantity };
};

const JPL_GM = 'JPL/NAIF planetary constants kernel (pck00010)';
const IAU_RADII = 'IAU WGCCRE 2015 (Archinal et al. 2018)';
const FACTSHEET = 'NASA NSSDC Planetary Fact Sheet';

/** Measured reference data for the bodies missions can orbit. Sources are mandatory. */
export const BODIES: Record<BodyId, Body> = {
  sun: {
    id: 'sun',
    name: L('Sun', 'Quyosh'),
    gm: q(1.32712440018e11, 'km^3/s^2', 'measured', JPL_GM),
    radius: q(695_700, 'km', 'measured', 'IAU 2015 Resolution B3 (nominal solar radius)'),
  },
  earth: {
    id: 'earth',
    name: L('Earth', 'Yer'),
    gm: q(3.986004418e5, 'km^3/s^2', 'measured', JPL_GM),
    radius: q(6378.137, 'km', 'measured', 'WGS 84 equatorial radius'),
    orbit: { parent: 'sun', semiMajorAxis: q(149.598e6, 'km', 'measured', FACTSHEET) },
  },
  moon: {
    id: 'moon',
    name: L('Moon', 'Oy'),
    gm: q(4.9028e3, 'km^3/s^2', 'measured', JPL_GM),
    radius: q(1737.4, 'km', 'measured', IAU_RADII),
    orbit: { parent: 'earth', semiMajorAxis: q(384.4e3, 'km', 'measured', `${FACTSHEET} (Moon)`) },
  },
  mars: {
    id: 'mars',
    name: L('Mars', 'Mars'),
    gm: q(4.282837e4, 'km^3/s^2', 'measured', JPL_GM),
    radius: q(3389.5, 'km', 'measured', `${IAU_RADII} (mean radius)`),
    orbit: { parent: 'sun', semiMajorAxis: q(227.956e6, 'km', 'measured', `${FACTSHEET} (Mars)`) },
  },
};

/** Total solar irradiance at 1 AU. The 1/r² scaling to other distances is Phase 2. */
export const SOLAR_CONSTANT = q(1360.8, 'W/m^2', 'measured', 'Kopp & Lean 2011, Geophys. Res. Lett. 38, L01706', 0.5);

/** Earth's J2 zonal harmonic (drives sun-synchronous nodal precession). */
export const EARTH_J2 = q(1.08263e-3, '1', 'measured', 'WGS 84 / EGM96');

/** One rotation relative to the stars; the period of a geostationary orbit. */
export const EARTH_SIDEREAL_DAY = q(86_164.0905, 's', 'measured', 'IERS');

/** Earth's orbit around the Sun relative to the equinox; a sun-synchronous node precesses once per this. */
export const TROPICAL_YEAR = q(365.2422, 'd', 'measured', 'IERS / standard astronomical value');
