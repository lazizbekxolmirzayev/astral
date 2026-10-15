/**
 * Two-body validation of the integrator against the analytic Kepler solution.
 *
 * Reference gravity parameter: the Sun's real GM = 1.3271244004193938e11 km³/s²
 * (NASA/JPL Horizons, target 10, retrieved 2026-10-14), converted to AU³/day²
 * with the IAU astronomical unit (149 597 870.7 km) and the SI day:
 *   GM = 2.959122082855911e-4 AU³/day²
 * That is the square of the Gaussian gravitational constant, so a test orbit at
 * a = 1 AU comes out with a 365.256-day period — Earth-like by construction.
 *
 * Stated tolerances:
 *   - circular radius error:        < 1e-6 AU   at dt = 0.01 d
 *   - position vs analytic Kepler:  < 1e-4 AU   over one eccentric orbit
 *   - period error:                 < 0.1 %
 *   - energy drift:                 < 1e-6 %    over 100 orbits
 *   - angular momentum drift:       < 1e-9 %    over 100 orbits
 * The measured drift is printed by the last test.
 */

import { describe, expect, it } from 'vitest';
import { type NBodyState, createState } from './gravity';
import { DEFAULT_SOFTENING_AU, integrate, stepVelocityVerlet } from './integrator';
import { angularMomentum, driftPercent, totalEnergy } from './diagnostics';
import { orbitElementsFromGm, orbitPosition } from './orbits';

/** GM of the Sun in AU³/day² — see the file header for the conversion. */
const GM_SUN = 2.959122082855911e-4;

/** A central body plus one near-massless test planet. */
function twoBody(semiMajorAxis: number, eccentricity: number) {
  const perihelion = semiMajorAxis * (1 - eccentricity);
  // Perihelion speed from vis-viva: v² = GM (2/r − 1/a) at r = a(1−e).
  const vPerihelion = Math.sqrt(GM_SUN * (2 / perihelion - 1 / semiMajorAxis));
  const elements = orbitElementsFromGm(semiMajorAxis, eccentricity, GM_SUN);
  const state = createState([
    { id: 'sun', gm: GM_SUN, position: [0, 0, 0], velocity: [0, 0, 0] },
    // Launched in the XZ plane so it lines up with `orbitPosition`, which also
    // puts perihelion on +x at t = 0 and moves toward +z.
    { id: 'test', gm: 1e-12, position: [perihelion, 0, 0], velocity: [0, 0, vPerihelion] },
  ]);
  return { state, elements };
}

/** Separation vector, which is independent of how the frame drifts. */
function relative(state: NBodyState, index = 1): [number, number, number] {
  return [
    (state.positions[index * 3] as number) - (state.positions[0] as number),
    (state.positions[index * 3 + 1] as number) - (state.positions[0] as number),
    (state.positions[index * 3 + 2] as number) - (state.positions[0] as number),
  ];
}

describe('velocity Verlet against the analytic Kepler solution', () => {
  it('keeps a circular orbit on its radius', () => {
    const { state } = twoBody(1, 0);
    const dt = 0.01;
    let worstRadiusError = 0;
    for (let step = 0; step < Math.ceil(365.256 / dt); step += 1) {
      stepVelocityVerlet(state, dt, DEFAULT_SOFTENING_AU);
      const [x, y, z] = relative(state);
      worstRadiusError = Math.max(worstRadiusError, Math.abs(Math.hypot(x, y, z) - 1));
    }
    expect(worstRadiusError).toBeLessThan(1e-6);
  });

  it('matches the analytic position of an eccentric orbit (e = 0.2)', () => {
    const { state, elements } = twoBody(1, 0.2);
    const dt = 0.01;
    const samples = 200;
    let worstError = 0;
    let elapsed = 0;
    for (let sample = 1; sample <= samples; sample += 1) {
      const targetTime = (elements.period * sample) / samples;
      const steps = Math.round((targetTime - elapsed) / dt);
      integrate(state, dt, steps, DEFAULT_SOFTENING_AU);
      elapsed += steps * dt;
      const analytic = orbitPosition(elements, elapsed);
      const [x, , z] = relative(state);
      worstError = Math.max(worstError, Math.hypot(x - analytic.x, z - analytic.z));
    }
    expect(worstError).toBeLessThan(1e-4);
  });

  it("reproduces Kepler's third law within 0.1 % for four different orbits", () => {
    for (const [semiMajorAxis, eccentricity] of [
      [1, 0],
      [1, 0.2],
      [0.4, 0.1],
      [3, 0.5],
    ] as const) {
      const { state, elements } = twoBody(semiMajorAxis, eccentricity);
      const dt = 0.02;
      // z is zero at perihelion and aphelion, so the second zero crossing of
      // the out-of-plane coordinate marks one full revolution.
      let elapsed = 0;
      let previousZ = relative(state)[2];
      let crossings = 0;
      let measuredPeriod = 0;
      while (crossings < 2 && elapsed < elements.period * 1.2) {
        stepVelocityVerlet(state, dt, DEFAULT_SOFTENING_AU);
        elapsed += dt;
        const z = relative(state)[2];
        if (previousZ !== 0 && Math.sign(z) !== Math.sign(previousZ)) {
          crossings += 1;
          // Linear interpolation of the crossing time within this step.
          if (crossings === 2) measuredPeriod = elapsed - (dt * z) / (z - previousZ);
        }
        previousZ = z;
      }
      expect(crossings).toBe(2);
      const periodError = Math.abs(measuredPeriod - elements.period) / elements.period;
      expect(periodError).toBeLessThan(0.001);
    }
  });
});

describe('conservation over 100 orbits', () => {
  it('holds energy and angular momentum drift inside the stated bounds', () => {
    const dt = 0.02;
    const orbits = 100;
    const { state, elements } = twoBody(1, 0.2);
    const energy0 = totalEnergy(state, DEFAULT_SOFTENING_AU).total;
    const momentum0 = angularMomentum(state).magnitude;

    integrate(state, dt, Math.ceil((elements.period * orbits) / dt), DEFAULT_SOFTENING_AU);

    const energyDrift = Math.abs(driftPercent(totalEnergy(state, DEFAULT_SOFTENING_AU).total, energy0));
    const momentumDrift = Math.abs(driftPercent(angularMomentum(state).magnitude, momentum0));
    const [x, y, z] = relative(state);

    console.info(
      `[two-body] ${String(orbits)} orbits (e=0.2, dt=${String(dt)} d): energy drift ${energyDrift.toExponential(3)} %, ` +
        `angular momentum drift ${momentumDrift.toExponential(3)} %, final radius ${Math.hypot(x, y, z).toFixed(9)} AU`,
    );

    expect(energyDrift).toBeLessThan(1e-6);
    expect(momentumDrift).toBeLessThan(1e-9);
  });
});
