/**
 * Impact and entry-risk utilities.
 *
 * This module intentionally avoids crater-scaling estimates unless the user first
 * provides a published formula set (e.g. Collins, Melosh & Marcus 2005). We do
 * not guess coefficients or make casualty/global-consequence claims.
 */

import { PhysicsInputError } from './gravity';

export const GRAVITATIONAL_CONSTANT = 6.67430e-11;
export const MEGATON_TNT_JOULES = 4.184e15;

export type ImpactModelCard = {
  title: string;
  scope: string;
  inputUnits: string;
  assumptions: readonly string[];
  limitations: readonly string[];
};

/** Describes which outputs are estimates and which physical effects are omitted. */
export const IMPACT_MODEL_CARD: ImpactModelCard = {
  title: 'Impact and entry-risk model card',
  scope: 'Impactor mass, kinetic energy, TNT energy equivalent, Newtonian target escape speed, categorical surface type, and a rule-based airburst risk flag.',
  inputUnits: 'SI inputs: metres, kilograms, kilograms per cubic metre, metres per second, and joules.',
  assumptions: [
    'Impactor mass assumes a sphere with uniform density.',
    'Escape speed uses a Newtonian point-mass target.',
    'Airburst assessment is a coarse heuristic: radius at most 100 m, atmosphere present, and speed threshold relative to target escape speed.',
    'TNT megaton conversion uses 4.184e15 joules per megaton.',
  ],
  limitations: [
    'No atmospheric trajectory, fragmentation, material strength, blast propagation, casualties, or global effects are modelled.',
    'Crater diameter is deliberately unsupported until a published scaling formula is supplied.',
    'The airburst flag is not a probability or a prediction of an actual event.',
  ],
};

export type ImpactTargetType = 'rocky' | 'gas-giant' | 'star' | 'asteroid' | 'unknown';
export type SurfaceKind = 'solid' | 'no solid surface' | 'unknown';

export type AirburstAssessment = {
  risk: boolean;
  surface: SurfaceKind;
  reason: string;
};

function requireFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new PhysicsInputError(`${label} must be a finite number, got ${String(value)}`);
  }
}

function requirePositive(label: string, value: number, maxValue = 1e300): void {
  requireFinite(label, value);
  if (value <= 0) {
    throw new PhysicsInputError(`${label} must be > 0, got ${String(value)}`);
  }
  if (value > maxValue) {
    throw new PhysicsInputError(`${label} is ${String(value)}, above the supported maximum of ${String(maxValue)}`);
  }
}

export function classifySurface(targetType: ImpactTargetType): SurfaceKind {
  switch (targetType) {
    case 'gas-giant':
    case 'star':
      return 'no solid surface';
    case 'rocky':
    case 'asteroid':
      return 'solid';
    default:
      return 'unknown';
  }
}

export function impactorMassFromRadiusAndDensity(radiusM: number, densityKgM3: number): number {
  requirePositive('impactor radius (m)', radiusM, 1e100);
  requirePositive('impactor density (kg/m³)', densityKgM3, 1e30);

  const mass = (4 / 3) * Math.PI * radiusM ** 3 * densityKgM3;
  if (!Number.isFinite(mass) || mass <= 0) {
    throw new PhysicsInputError(`impactor mass overflow: radius ${String(radiusM)} m and density ${String(densityKgM3)} kg/m³`);
  }
  return mass;
}

export function kineticEnergyJoules(massKg: number, velocityMs: number): number {
  requirePositive('impactor mass (kg)', massKg, 1e200);
  requirePositive('impact velocity (m/s)', velocityMs, 1e12);

  const energy = 0.5 * massKg * velocityMs ** 2;
  if (!Number.isFinite(energy) || energy <= 0) {
    throw new PhysicsInputError(`kinetic energy overflow: mass ${String(massKg)} kg, velocity ${String(velocityMs)} m/s`);
  }
  return energy;
}

export function tntEquivalentMegatons(energyJoules: number): number {
  requirePositive('energy (J)', energyJoules, 1e300);
  return energyJoules / MEGATON_TNT_JOULES;
}

export function minimumImpactVelocity(targetMassKg: number, targetRadiusM: number): number {
  requirePositive('target mass (kg)', targetMassKg, 1e200);
  requirePositive('target radius (m)', targetRadiusM, 1e100);

  const velocity = Math.sqrt((2 * GRAVITATIONAL_CONSTANT * targetMassKg) / targetRadiusM);
  if (!Number.isFinite(velocity) || velocity <= 0) {
    throw new PhysicsInputError(`target escape velocity overflow: mass ${String(targetMassKg)} kg, radius ${String(targetRadiusM)} m`);
  }
  return velocity;
}

export function airburstRiskForTarget(params: {
  targetHasAtmosphere: boolean;
  targetType: ImpactTargetType;
  impactorRadiusM: number;
  impactorDensityKgM3: number;
  impactVelocityMs: number;
  targetRadiusM: number;
  targetMassKg: number;
}): AirburstAssessment {
  const {
    targetHasAtmosphere,
    targetType,
    impactorRadiusM,
    impactorDensityKgM3,
    impactVelocityMs,
    targetRadiusM,
    targetMassKg,
  } = params;

  const surface = classifySurface(targetType);
  if (surface === 'no solid surface') {
    return {
      risk: false,
      surface,
      reason: 'Gas giants and stars are treated as having no solid surface in this model; this routine does not estimate an impact on a solid terrain.',
    };
  }

  requirePositive('impactor radius (m)', impactorRadiusM, 1e100);
  requirePositive('impactor density (kg/m³)', impactorDensityKgM3, 1e30);
  requirePositive('impact velocity (m/s)', impactVelocityMs, 1e12);
  requirePositive('target radius (m)', targetRadiusM, 1e100);
  requirePositive('target mass (kg)', targetMassKg, 1e200);

  if (!targetHasAtmosphere) {
    return {
      risk: false,
      surface,
      reason: 'No atmosphere on the target, so this rule-based airburst heuristic is not triggered.',
    };
  }

  // Approximate rule only: small solid impactors can fragment and airburst when a
  // dense atmosphere is present and the impact speed is high enough relative to the
  // escape speed of the target. This does not predict casualties or global effects.
  const targetEscapeVelocityMs = minimumImpactVelocity(targetMassKg, targetRadiusM);
  const smallImpactor = impactorRadiusM <= 100;
  const highRelativeSpeed = impactVelocityMs >= Math.max(5000, 0.5 * targetEscapeVelocityMs);

  if (smallImpactor && highRelativeSpeed) {
    return {
      risk: true,
      surface,
      reason:
        'Approximate heuristic: small solid impactor in an atmosphere, high relative speed, and a local atmospheric entry regime consistent with an airburst; this is an approximate risk flag only, not a casualty or global-consequence forecast.',
    };
  }

  return {
    risk: false,
    surface,
    reason: 'Atmosphere present, but the small-body/high-speed rule is not met; this is only a rough heuristic.',
  };
}

export function estimateCraterDiameter(): never {
  throw new PhysicsInputError(
    'Crater estimation is intentionally disabled until the published scaling formula set is provided (for example Collins, Melosh & Marcus 2005). Do not guess coefficients.',
  );
}
