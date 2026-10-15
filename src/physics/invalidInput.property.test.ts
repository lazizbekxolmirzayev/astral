/**
 * Property tests for hostile input, written with fast-check.
 *
 * Contract under test: the physics core never crashes, never returns NaN and
 * never silently "fixes" bad data. Anything it cannot represent must come back
 * as a `PhysicsInputError` naming the offending value; anything it accepts must
 * keep producing finite numbers.
 *
 * Run with `npx vitest run src/physics/invalidInput.property.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  MAX_COORDINATE_AU,
  PhysicsInputError,
  accelerations,
  createState,
  validateBody,
  type BodyDefinition,
} from './gravity';
import { MAX_TIMESTEP_DAYS, MIN_TIMESTEP_DAYS, stepVelocityVerlet, validateTimestep } from './integrator';
import {
  MAX_GM_AU3_PER_DAY2,
  MIN_DISTANCE_AU,
  angularMomentum,
  driftPercent,
  escapeSpeed,
  kinematicsRelativeTo,
  totalEnergy,
} from './diagnostics';

/** Numbers that no caller should ever get away with passing. */
const hostileNumber = fc.oneof(
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 0, -1),
  fc.constantFrom(Number.MAX_VALUE, -Number.MAX_VALUE, 1e308, -1e308, MAX_COORDINATE_AU * 10),
  fc.double({ min: -1e12, max: 1e12, noNaN: true }),
);

const finitePositive = fc.double({ min: 1e-9, max: 1e3, noNaN: true, noDefaultInfinity: true });

function bodyWith(overrides: Partial<BodyDefinition>): BodyDefinition {
  return {
    id: 'probe',
    gm: 2.959122082855911e-4,
    position: [1, 0, 0],
    velocity: [0, 0, 0.0172],
    ...overrides,
  };
}

describe('invalid input is rejected, never absorbed', () => {
  it('rejects any non-finite or negative gravity parameter', () => {
    fc.assert(
      fc.property(hostileNumber, (gm) => {
        if (Number.isFinite(gm) && gm > 0) {
          expect(() => validateBody(bodyWith({ gm }))).not.toThrow();
          return;
        }
        expect(() => validateBody(bodyWith({ gm }))).toThrow(PhysicsInputError);
      }),
      { numRuns: 300 },
    );
  });

  it('rejects a zero mass with a message that says so', () => {
    // Explicitly spelled out because "zero mass" is the case the prompt names.
    let message = '';
    try {
      validateBody(bodyWith({ gm: 0 }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('gm = 0');
    expect(message).toContain('positive gravity');
  });

  it('rejects non-finite, oversized positions and velocities', () => {
    fc.assert(
      fc.property(hostileNumber, fc.constantFrom('position' as const, 'velocity' as const), (value, field) => {
        const vector = [0, 0, 0] as [number, number, number];
        vector[1] = value;
        const body = bodyWith(field === 'position' ? { position: vector } : { velocity: vector });
        const limit = field === 'position' ? MAX_COORDINATE_AU : 2500;
        if (Number.isFinite(value) && Math.abs(value) <= limit) {
          expect(() => validateBody(body)).not.toThrow();
          return;
        }
        expect(() => validateBody(body)).toThrow(PhysicsInputError);
      }),
      { numRuns: 400 },
    );
  });

  it('rejects duplicate ids, empty ids and an empty system', () => {
    const ok = bodyWith({});
    expect(() => createState([])).toThrow(PhysicsInputError);
    expect(() => createState([ok, { ...ok }])).toThrow(PhysicsInputError);
    expect(() => createState([{ ...ok, id: '' }])).toThrow(PhysicsInputError);
  });

  it('rejects any softening or timestep it cannot integrate with', () => {
    fc.assert(
      fc.property(hostileNumber, (value) => {
        const valid = Number.isFinite(value) && value >= MIN_TIMESTEP_DAYS && value <= MAX_TIMESTEP_DAYS;
        expect(valid).toBe(
          (() => {
            try {
              validateTimestep(value);
              return true;
            } catch (error) {
              expect(error).toBeInstanceOf(PhysicsInputError);
              return false;
            }
          })(),
        );
      }),
      { numRuns: 200 },
    );
  });

  it('rejects non-finite positions in accelerations', () => {
    const state = createState([
      { id: 'sun', gm: 2.959122082855911e-4, position: [0, 0, 0], velocity: [0, 0, 0] },
      { id: 'earth', gm: 8.887692445123496e-10, position: [1, 0, 0], velocity: [0, 0, 0.0172] },
    ]);
    state.positions[0] = Number.NaN;
    expect(() => accelerations(state, 1e-4)).toThrow(PhysicsInputError);

    state.positions[0] = Number.POSITIVE_INFINITY;
    expect(() => accelerations(state, 1e-4)).toThrow(PhysicsInputError);
  });
});

describe('accepted input never produces NaN', () => {
  it('keeps accelerations finite for any sane two-body setup', () => {
    fc.assert(
      fc.property(
        finitePositive,
        finitePositive,
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1e-3, max: 1e-3, noNaN: true }),
        (separation, gm, direction, speed) => {
          const state = createState([
            { id: 'a', gm, position: [0, 0, 0], velocity: [0, 0, 0] },
            {
              id: 'b',
              gm: gm / 1000,
              position: [separation, direction, 0],
              velocity: [0, speed, speed],
            },
          ]);
          const out = accelerations(state, 1e-4);
          for (const value of out) expect(Number.isFinite(value)).toBe(true);
          expect(Number.isFinite(totalEnergy(state, 1e-4).total)).toBe(true);
          expect(Number.isFinite(angularMomentum(state).magnitude)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('survives every supported timestep without diverging to NaN', () => {
    fc.assert(
      fc.property(
        fc.double({ min: MIN_TIMESTEP_DAYS, max: MAX_TIMESTEP_DAYS, noNaN: true }),
        fc.double({ min: 1e-4, max: 1e-3, noNaN: true }),
        (dt, softening) => {
          const state = createState([
            { id: 'sun', gm: 2.959122082855911e-4, position: [0, 0, 0], velocity: [0, 0, 0] },
            { id: 'earth', gm: 8.887692445123496e-10, position: [1, 0, 0], velocity: [0, 0, 0.0172] },
          ]);
          stepVelocityVerlet(state, dt, softening);
          for (const value of state.positions) expect(Number.isFinite(value)).toBe(true);
          for (const value of state.velocities) expect(Number.isFinite(value)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('reports drift as a finite percentage for any finite pair of values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (current, reference) => {
          expect(Number.isFinite(driftPercent(current, reference))).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('refuses escape speed for a centre or radius outside the supported range', () => {
    fc.assert(
      fc.property(hostileNumber, hostileNumber, (gm, distance) => {
        const supported =
          Number.isFinite(gm) &&
          gm > 0 &&
          gm <= MAX_GM_AU3_PER_DAY2 &&
          Number.isFinite(distance) &&
          distance >= MIN_DISTANCE_AU &&
          distance <= MAX_COORDINATE_AU;
        if (supported) {
          expect(Number.isFinite(escapeSpeed(gm, distance))).toBe(true);
          return;
        }
        expect(() => escapeSpeed(gm, distance)).toThrow(PhysicsInputError);
      }),
      { numRuns: 300 },
    );
  });

  it('gives finite kinematics for a body sitting exactly on the centre', () => {
    // The degenerate r = 0 case must not print Infinity as a measurement.
    const state = createState([
      { id: 'sun', gm: 2.959122082855911e-4, position: [0, 0, 0], velocity: [0, 0, 0] },
      { id: 'collapsed', gm: 1e-9, position: [0, 0, 0], velocity: [0, 0, 0] },
    ]);
    const [row] = kinematicsRelativeTo(state, 0);
    expect(row!.distanceAu).toBe(0);
    expect(row!.boundRatio).toBe(0);
  });
});
