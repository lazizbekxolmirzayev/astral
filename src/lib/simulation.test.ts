/**
 * Engine-level checks: the real solar system must survive a simulated century,
 * and reset must be bit-exact.
 *
 * The distance bounds asserted after the century run are derived from the
 * measured semi-major axes and eccentricities in `data/solarSystem.ts`
 * (perihelion a(1−e), aphelion a(1+e)) with a 0.05 AU slack, so the test fails
 * if a planet is ejected, collides, or drifts out of its own orbit.
 */

import { describe, expect, it } from 'vitest';
import { EPOCH, SUN_GM_AU3_PER_DAY2, initialConditions } from '@/data/initialConditions';
import { solarSystem } from '@/data/solarSystem';
import { FIXED_TIMESTEP_DAYS, simulation } from '@/lib/simulation';
import { evaluateStability } from '@/lib/stability';
import { DEFAULT_SOFTENING_AU, integrate } from '@/physics/integrator';
import {
  angularMomentum,
  driftPercent,
  kinematicsRelativeTo,
  toKilometresPerSecond,
  totalEnergy,
} from '@/physics/diagnostics';
import { osculatingElements } from '@/physics/orbits';

/** 100 Julian years. */
const CENTURY_DAYS = 36525;

/** AU of slack on the perihelion/aphelion bounds, for real n-body perturbation. */
const BOUND_SLACK_AU = 0.05;

function auOfSemiMajorAxis(id: string): number {
  const quantity = solarSystem.find((body) => body.id === id)?.semiMajorAxis;
  if (!quantity) throw new Error(`no semi-major axis on record for "${id}"`);
  return quantity.value / 149597870.7; // km → AU, IAU definition
}

function eccentricityOf(id: string): number {
  const quantity = solarSystem.find((body) => body.id === id)?.eccentricity;
  if (!quantity) throw new Error(`no eccentricity on record for "${id}"`);
  return quantity.value;
}

describe('the real solar system', () => {
  it('loads nine bodies at the JPL epoch with no NaN', () => {
    expect(initialConditions).toHaveLength(9);
    expect(initialConditions[0]!.id).toBe('sun');
    expect(EPOCH.label).toBe('2026-01-01 00:00:00 TDB');
    for (const body of initialConditions) {
      for (const value of [...body.position, ...body.velocity, body.gm]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    // The Sun's GM in these units is the square of the Gaussian gravitational
    // constant; if the unit conversion is wrong this number moves.
    expect(SUN_GM_AU3_PER_DAY2).toBeCloseTo(2.959122082855911e-4, 20);
  });

  it('reproduces the published mean orbital speeds after conversion', () => {
    // Earth's mean orbital speed is 29.78 km/s per its NASA facts page; the
    // epoch value is within a few percent of that for a nearly circular orbit.
    const rows = kinematicsRelativeTo(simulation.state, 0);
    const earth = rows.find((row) => row.id === 'earth')!;
    expect(toKilometresPerSecond(earth.speedAuPerDay)).toBeGreaterThan(29);
    expect(toKilometresPerSecond(earth.speedAuPerDay)).toBeLessThan(31);
  });

  it('starts every planet on the ellipse its measured elements describe', () => {
    // Cross-validates the JPL state vectors against the NASA fact-sheet a and e:
    // the osculating ellipse of each state vector must agree with them.
    for (const body of initialConditions.slice(1)) {
      const elements = osculatingElements(body.position, body.velocity, SUN_GM_AU3_PER_DAY2);
      expect(elements, `${body.id} should be bound to the Sun`).not.toBeNull();
      const measuredA = auOfSemiMajorAxis(body.id);
      const measuredE = eccentricityOf(body.id);
      // Fact-sheet axes are rounded to 2 significant digits, hence the 3 % slack.
      expect(Math.abs(elements!.semiMajorAxis - measuredA) / measuredA).toBeLessThan(0.03);
      expect(Math.abs(elements!.eccentricity - measuredE)).toBeLessThan(0.01);
    }
  });

  it('orbits a simulated century without exploding, then resets exactly', () => {
    const energy0 = totalEnergy(simulation.state, DEFAULT_SOFTENING_AU).total;
    const momentum0 = angularMomentum(simulation.state).magnitude;
    const startedAt = performance.now();

    integrate(simulation.state, FIXED_TIMESTEP_DAYS, Math.ceil(CENTURY_DAYS / FIXED_TIMESTEP_DAYS), DEFAULT_SOFTENING_AU);

    const elapsed = performance.now() - startedAt;
    const rows = kinematicsRelativeTo(simulation.state, 0);
    for (const row of rows) {
      const a = auOfSemiMajorAxis(row.id);
      const e = eccentricityOf(row.id);
      expect(Number.isFinite(row.distanceAu)).toBe(true);
      expect(row.distanceAu).toBeGreaterThan(a * (1 - e) - BOUND_SLACK_AU);
      expect(row.distanceAu).toBeLessThan(a * (1 + e) + BOUND_SLACK_AU);
    }

    const energyDrift = Math.abs(driftPercent(totalEnergy(simulation.state, DEFAULT_SOFTENING_AU).total, energy0));
    const momentumDrift = Math.abs(driftPercent(angularMomentum(simulation.state).magnitude, momentum0));
    console.info(
      `[century] ${CENTURY_DAYS} d (${(CENTURY_DAYS / 365.25).toFixed(0)} yr, dt=${FIXED_TIMESTEP_DAYS} d, ` +
        `${Math.ceil(CENTURY_DAYS / FIXED_TIMESTEP_DAYS).toLocaleString('en-US')} steps in ${elapsed.toFixed(0)} ms): ` +
        `energy drift ${energyDrift.toExponential(3)} %, angular momentum drift ${momentumDrift.toExponential(3)} %, ` +
        `Neptune at ${rows[rows.length - 1]!.distanceAu.toFixed(4)} AU`,
    );

    expect(energyDrift).toBeLessThan(1e-6);
    expect(momentumDrift).toBeLessThan(1e-9);

    // Reset must be bit-exact, not "close to".
    simulation.reset();
    expect(Array.from(simulation.state.positions)).toEqual(Array.from(simulation.initial.positions));
    expect(Array.from(simulation.state.velocities)).toEqual(Array.from(simulation.initial.velocities));
    expect(Array.from(simulation.state.gm)).toEqual(Array.from(simulation.initial.gm));
    expect(simulation.elapsedDays).toBe(0);
  });
});

describe('stability rules', () => {
  it('reports nothing as unstable at the real epoch', () => {
    simulation.reset();
    expect(evaluateStability(simulation.kinematics())).toEqual([]);
  });

  it('flags a planet that is given escape velocity', () => {
    simulation.reset();
    const [earth] = kinematicsRelativeTo(simulation.state, 0).filter((row) => row.id === 'earth');
    // Give it 1.5× the speed it needs to leave: Δv = 1.5·v_esc − v_now.
    const delta = 1.5 * earth!.escapeSpeedAuPerDay - earth!.speedAuPerDay;
    simulation.nudgeVelocity('earth', [0, 0, delta]);

    const warnings = evaluateStability(simulation.kinematics());
    expect(warnings.map((warning) => warning.id)).toContain('earth');
    expect(warnings.find((warning) => warning.id === 'earth')!.kind).toBe('unbound');

    simulation.reset();
    expect(evaluateStability(simulation.kinematics())).toEqual([]);
  });

  it('flags a body thrown far outside the modelled system', () => {
    simulation.reset();
    const index = simulation.indexFor('mercury');
    // Move it past the distance threshold and stop it, so only the distance rule
    // can fire: a stationary body at 60 AU is bound, just far away.
    simulation.state.positions[index * 3] = 60;
    simulation.state.positions[index * 3 + 1] = 0;
    simulation.state.positions[index * 3 + 2] = 0;
    simulation.state.velocities.set([0, 0, 0], index * 3);

    const warnings = evaluateStability(simulation.kinematics());
    expect(warnings.find((warning) => warning.id === 'mercury')!.kind).toBe('distance');
    simulation.reset();
  });

  it('refuses to nudge a body that does not exist', () => {
    expect(() => simulation.nudgeVelocity('pluto', [0, 0, 1])).toThrow(/no body named/);
    expect(() => simulation.nudgeVelocity('earth', [Number.NaN, 0, 0])).toThrow(/finite/);
  });

  // Covers the panel's development kick button, which scales rather than adds.
  it('multiplies one body\'s speed around the Sun and trips the warning', () => {
    simulation.reset();
    const before = simulation.kinematics().find((row) => row.id === 'earth')!;

    simulation.speedUp('earth', 1.5);
    const after = simulation.kinematics().find((row) => row.id === 'earth')!;

    expect(after.speedAuPerDay).toBeCloseTo(1.5 * before.speedAuPerDay, 9);
    // A pure velocity change cannot move the body.
    expect(after.distanceAu).toBeCloseTo(before.distanceAu, 9);
    // 1.5× a near-circular orbit (escape ÷ √2) lands just past parabolic.
    expect(after.boundRatio).toBeGreaterThanOrEqual(1);
    expect(evaluateStability(simulation.kinematics()).map((warning) => warning.id)).toEqual([
      'earth',
    ]);

    simulation.reset();
  });

  it('refuses a speed factor that is not a positive number', () => {
    for (const factor of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1.5]) {
      expect(() => simulation.speedUp('earth', factor)).toThrow(/finite and positive/);
    }
  });
});
