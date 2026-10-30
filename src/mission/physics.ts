/**
 * Real engineering formulas behind the game — pure, no React and no Three.js.
 * The game's part values are simplified, but these relations are the actual
 * ones mission designers use, so a choice fails for the right physical reason.
 */

const G0_M_S2 = 9.80665;
const SOLAR_CONSTANT_W_M2 = 1361;
const SOLAR_CELL_EFFICIENCY = 0.29;
/** Packing, wiring and sun-angle losses. */
const SOLAR_ARRAY_LOSSES = 0.85;
const BOLTZMANN_J_K = 1.380649e-23;
const X_BAND_WAVELENGTH_M = 0.036;
const APERTURE_EFFICIENCY = 0.55;
/** Required energy per bit over noise density, about 4.8 dB. */
const EB_N0 = 3;
/** Pointing, atmosphere and hardware losses, about 6 dB. */
const LINK_LOSS = 0.25;
const EARTH_YEAR_DAYS = 365.25;

/** Tank and plumbing mass per kilogram of propellant. */
export const TANK_FRACTION = 0.1;

/**
 * Propellant for a manoeuvre from the Tsiolkovsky rocket equation,
 * Δv = Isp·g₀·ln(m₀/m₁), including the tanks that carry it. Returns Infinity
 * when the tanks alone would need more propellant than they could ever hold.
 */
export function propellantForDeltaV(dryMassKg: number, deltaVMs: number, ispS: number): number {
  const ratio = Math.exp(deltaVMs / (ispS * G0_M_S2)) - 1;
  const closure = 1 - TANK_FRACTION * ratio;
  return closure <= 0 ? Infinity : (dryMassKg * ratio) / closure;
}

/** Kepler's third law: T = 2π√(a³/μ), in minutes. */
export function orbitalPeriodMinutes(semiMajorAxisKm: number, muKm3S2: number): number {
  return (2 * Math.PI * Math.sqrt(semiMajorAxisKm ** 3 / muKm3S2)) / 60;
}

/** Worst-case share of an orbit spent in the planet's shadow (Sun in the orbit plane). */
export function eclipseFraction(semiMajorAxisKm: number, bodyRadiusKm: number): number {
  return Math.asin(Math.min(1, bodyRadiusKm / semiMajorAxisKm)) / Math.PI;
}

/** Sunlight falls with the square of the distance: 1361 W/m² at 1 AU. */
export function solarArrayPowerW(areaM2: number, distanceAu: number): number {
  return (areaM2 * SOLAR_CONSTANT_W_M2 * SOLAR_CELL_EFFICIENCY * SOLAR_ARRAY_LOSSES) / distanceAu ** 2;
}

/**
 * Friis link budget for the highest data rate a radio link can close, in
 * megabits per second. Rate grows with dish area and transmit power and falls
 * with the square of the distance.
 */
export function linkRateMbps(
  transmitW: number,
  dishDiameterM: number,
  rangeKm: number,
  groundDishM: number,
  systemNoiseK: number,
): number {
  const gain = APERTURE_EFFICIENCY * ((Math.PI * dishDiameterM) / X_BAND_WAVELENGTH_M) ** 2;
  const rangeM = rangeKm * 1000;
  const fluxW_M2 = (transmitW * gain) / (4 * Math.PI * rangeM ** 2);
  const apertureM2 = APERTURE_EFFICIENCY * Math.PI * (groundDishM / 2) ** 2;
  const receivedW = fluxW_M2 * apertureM2 * LINK_LOSS;
  return receivedW / (BOLTZMANN_J_K * systemNoiseK * EB_N0) / 1e6;
}

/** Half the period of the transfer ellipse between two circular solar orbits. */
export function hohmannTransferDays(fromAu: number, toAu: number): number {
  const semiMajorAxisAu = (fromAu + toAu) / 2;
  return (semiMajorAxisAu ** 1.5 * EARTH_YEAR_DAYS) / 2;
}

/** Days between launch windows to a planet: 1/S = |1/T₁ − 1/T₂|, with T = a^1.5 years. */
export function synodicPeriodDays(fromAu: number, toAu: number): number {
  const rate = Math.abs(1 / fromAu ** 1.5 - 1 / toAu ** 1.5);
  return EARTH_YEAR_DAYS / rate;
}
