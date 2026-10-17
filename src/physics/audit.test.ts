import { describe, expect, it } from 'vitest';
import { initialConditions, SUN_GM_AU3_PER_DAY2 } from '@/data/initialConditions';
import { solarSystem } from '@/data/solarSystem';
import { createState, accelerations, distanceBetween } from '@/physics/gravity';
import { stepVelocityVerlet, integrate, DEFAULT_SOFTENING_AU } from '@/physics/integrator';
import { totalEnergy, angularMomentum, driftPercent, kinematicsRelativeTo, escapeSpeed } from '@/physics/diagnostics';
import { osculatingElements, keplerPeriod } from '@/physics/orbits';

describe('Physics and Data Audit', () => {
  it('measures energy and angular momentum drift over 1, 10, and 100 years', () => {
    const dt = 0.05;
    const state = createState(initialConditions);
    const E0 = totalEnergy(state, DEFAULT_SOFTENING_AU).total;
    const L0 = angularMomentum(state).magnitude;

    const years = [1, 10, 100];
    for (const yr of years) {
      const stateClone = createState(initialConditions);
      const days = yr * 365.25;
      const steps = Math.round(days / dt);
      integrate(stateClone, dt, steps, DEFAULT_SOFTENING_AU);
      const E = totalEnergy(stateClone, DEFAULT_SOFTENING_AU).total;
      const L = angularMomentum(stateClone).magnitude;
      const dE = driftPercent(E, E0);
      const dL = driftPercent(L, L0);
      console.log(`[Drift] Year ${yr} (${days} d, ${steps} steps): dE = ${dE.toExponential(4)} %, dL = ${dL.toExponential(4)} %`);
      expect(Math.abs(dE), `energy drift after ${yr} years`).toBeLessThan(1e-6);
      expect(Math.abs(dL), `angular-momentum drift after ${yr} years`).toBeLessThan(1e-9);
    }
  });

  it('measures softening effects on real planets (epsilon = 1e-4 AU vs 0)', () => {
    const state0 = createState(initialConditions);
    const stateSoft = createState(initialConditions);
    const a0 = accelerations(state0, 0);
    const aSoft = accelerations(stateSoft, DEFAULT_SOFTENING_AU);

    console.log('[Softening effect on initial accelerations]');
    for (let i = 0; i < initialConditions.length; i++) {
      const id = initialConditions[i]!.id;
      const diffX = aSoft[i * 3]! - a0[i * 3]!;
      const diffY = aSoft[i * 3 + 1]! - a0[i * 3 + 1]!;
      const diffZ = aSoft[i * 3 + 2]! - a0[i * 3 + 2]!;
      const mag0 = Math.hypot(a0[i * 3]!, a0[i * 3 + 1]!, a0[i * 3 + 2]!);
      const magDiff = Math.hypot(diffX, diffY, diffZ);
      const relDiff = mag0 > 0 ? (magDiff / mag0) : 0;
      console.log(`  ${id.padEnd(8)}: rel acc diff = ${relDiff.toExponential(4)}`);
    }
  });

  it('checks Kepler period consistency of solarSystem.ts data', () => {
    console.log('[Kepler Period Consistency in solarSystem.ts]');
    for (const body of solarSystem) {
      if (body.type === 'planet') {
        if (!body.semiMajorAxis || !body.orbitalPeriod) continue;
        const aKm = body.semiMajorAxis.value;
        const aAu = aKm / 149597870.7;
        const T_stated_days = body.orbitalPeriod.value;
        const T_kepler_days = keplerPeriod(SUN_GM_AU3_PER_DAY2, aAu);
        const diffPercent = ((T_kepler_days - T_stated_days) / T_stated_days) * 100;
        console.log(`  ${body.id.padEnd(8)}: a=${aAu.toFixed(3)} AU, T_stated=${T_stated_days} d, T_kepler=${T_kepler_days.toFixed(2)} d, diff=${diffPercent.toFixed(2)}%`);
      }
    }
  });

  it('checks barycenter velocity and momentum of initialConditions', () => {
    const state = createState(initialConditions);
    let totalMass = 0;
    const P = [0, 0, 0];
    for (let i = 0; i < state.gm.length; i++) {
      totalMass += state.gm[i];
      P[0] += state.gm[i] * state.velocities[i * 3]!;
      P[1] += state.gm[i] * state.velocities[i * 3 + 1]!;
      P[2] += state.gm[i] * state.velocities[i * 3 + 2]!;
    }
    const Vcm = P.map(p => p / totalMass);
    const Vcm_kms = Math.hypot(...Vcm) * 149597870.7 / 86400;
    console.log(`[Barycenter Velocity] V_cm = ${Math.hypot(...Vcm).toExponential(4)} AU/day (${Vcm_kms.toFixed(4)} m/s)`);
    // System barycenter drifts at ~12.4 mm/s due to heliocentric Sun at [0,0,0]
    expect(Vcm_kms).toBeLessThan(0.02);
  });
});
