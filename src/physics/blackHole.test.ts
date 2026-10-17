import { describe, expect, it } from 'vitest';
import { PhysicsInputError } from './gravity';
import {
  approximateTidalRadiusM,
  assessNewtonianValidity,
  iscoRadiusM,
  newtonianTestParticleAccelerationMPerS2,
  photonSphereRadiusM,
  schwarzschildRadiusM,
  stepNewtonianTestParticle,
} from './blackHole';

const SOLAR_MASS_KG = 1.98847e30;

describe('black-hole reference radii', () => {
  it('computes a Schwarzschild radius of about 2.95 km for one solar mass', () => {
    expect(schwarzschildRadiusM(SOLAR_MASS_KG) / 1000).toBeCloseTo(2.95, 1);
  });

  it('uses the requested photon-sphere and ISCO multiples', () => {
    const radius = schwarzschildRadiusM(SOLAR_MASS_KG);
    expect(photonSphereRadiusM(SOLAR_MASS_KG)).toBeCloseTo(1.5 * radius, 12);
    expect(iscoRadiusM(SOLAR_MASS_KG)).toBeCloseTo(3 * radius, 12);
  });
});

describe('Newtonian validity gauge', () => {
  it('triggers its invalid status at the photon sphere', () => {
    const photonSphere = photonSphereRadiusM(SOLAR_MASS_KG);
    const gauge = assessNewtonianValidity(SOLAR_MASS_KG, photonSphere);
    expect(gauge.status).toBe('invalid');
    expect(gauge.distanceInSchwarzschildRadii).toBeCloseTo(1.5, 12);
  });

  it('marks only distances of at least ten Schwarzschild radii as valid', () => {
    const radius = schwarzschildRadiusM(SOLAR_MASS_KG);
    expect(assessNewtonianValidity(SOLAR_MASS_KG, 5 * radius).status).toBe('caution');
    expect(assessNewtonianValidity(SOLAR_MASS_KG, 10 * radius).status).toBe('valid');
  });
});

describe('Newtonian test-particle approximation', () => {
  it('computes inward acceleration and advances a particle', () => {
    const acceleration = newtonianTestParticleAccelerationMPerS2(SOLAR_MASS_KG, [1e9, 0, 0]);
    expect(acceleration[0]).toBeLessThan(0);
    expect(acceleration[1]).toBeCloseTo(0, 12);
    const next = stepNewtonianTestParticle(
      SOLAR_MASS_KG,
      { positionM: [1e9, 0, 0], velocityMPerS: [0, 1, 0] },
      1,
    );
    expect(next.positionM[1]).toBeGreaterThan(0);
    expect(next.velocityMPerS[0]).toBeLessThan(0);
  });

  it('estimates the tidal scale from body size and mass', () => {
    expect(approximateTidalRadiusM(8, 1, 2)).toBeCloseTo(4, 12);
  });

  it('rejects invalid masses and a zero particle position', () => {
    expect(() => schwarzschildRadiusM(0)).toThrow(PhysicsInputError);
    expect(() => newtonianTestParticleAccelerationMPerS2(SOLAR_MASS_KG, [0, 0, 0])).toThrow(PhysicsInputError);
  });
});
