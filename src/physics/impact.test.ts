import { describe, expect, it } from 'vitest';
import { PhysicsInputError } from './gravity';
import {
  airburstRiskForTarget,
  classifySurface,
  estimateCraterDiameter,
  impactorMassFromRadiusAndDensity,
  kineticEnergyJoules,
  minimumImpactVelocity,
  tntEquivalentMegatons,
} from './impact';

describe('impact calculations', () => {
  it('computes mass from radius and density', () => {
    const mass = impactorMassFromRadiusAndDensity(1, 3000);
    expect(mass).toBeCloseTo((4 / 3) * Math.PI * 3000, 12);
  });

  it('rejects zero, negative and non-finite values', () => {
    expect(() => impactorMassFromRadiusAndDensity(0, 3000)).toThrow(PhysicsInputError);
    expect(() => impactorMassFromRadiusAndDensity(-1, 3000)).toThrow(PhysicsInputError);
    expect(() => impactorMassFromRadiusAndDensity(1, -3000)).toThrow(PhysicsInputError);
    expect(() => impactorMassFromRadiusAndDensity(Number.NaN, 3000)).toThrow(PhysicsInputError);
  });

  it('rejects huge input before overflow', () => {
    expect(() => impactorMassFromRadiusAndDensity(1e308, 1e308)).toThrow(PhysicsInputError);
  });

  it('computes kinetic energy and TNT equivalent', () => {
    const mass = 1000;
    const velocity = 2000;
    const energy = kineticEnergyJoules(mass, velocity);
    expect(energy).toBeCloseTo(0.5 * mass * velocity * velocity, 12);

    const mt = tntEquivalentMegatons(energy);
    expect(mt).toBeCloseTo(energy / 4.184e15, 12);
  });

  it('rejects invalid kinetic-energy input', () => {
    expect(() => kineticEnergyJoules(-1, 1000)).toThrow(PhysicsInputError);
    expect(() => kineticEnergyJoules(1, -1000)).toThrow(PhysicsInputError);
    expect(() => kineticEnergyJoules(1, Number.NaN)).toThrow(PhysicsInputError);
  });

  it('matches the expected Earth escape speed order of magnitude', () => {
    const v = minimumImpactVelocity(5.972e24, 6.371e6);
    expect(v).toBeGreaterThan(10000);
    expect(v).toBeLessThan(15000);
  });

  it('flags an airburst risk only for small bodies against an atmosphere', () => {
    const rocky = airburstRiskForTarget({
      targetHasAtmosphere: true,
      targetType: 'rocky',
      impactorRadiusM: 3,
      impactorDensityKgM3: 3000,
      impactVelocityMs: 12000,
      targetRadiusM: 6.371e6,
      targetMassKg: 5.972e24,
    });
    expect(rocky.risk).toBe(true);

    const noAtmosphere = airburstRiskForTarget({
      targetHasAtmosphere: false,
      targetType: 'rocky',
      impactorRadiusM: 3,
      impactorDensityKgM3: 3000,
      impactVelocityMs: 12000,
      targetRadiusM: 6.371e6,
      targetMassKg: 5.972e24,
    });
    expect(noAtmosphere.risk).toBe(false);
  });

  it('marks gas giants and stars as no solid surface', () => {
    expect(classifySurface('gas-giant')).toBe('no solid surface');
    expect(classifySurface('star')).toBe('no solid surface');
    expect(classifySurface('rocky')).toBe('solid');
  });

  it('requires a published crater formula before estimating a crater diameter', () => {
    expect(() => estimateCraterDiameter()).toThrow(/published scaling formula/i);
  });
});
