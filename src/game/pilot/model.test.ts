import { describe, expect, it } from 'vitest';
import { altitudeOf, autopilot, createFlight, createVehicle, orbitOf, rateFlight, runFlight, stepFlight, TARGET_ALTITUDE_M, type PilotInput } from './model';

const LAT = 0.5;
const fly = (capacity: number, payload: number, policy: (f: ReturnType<typeof createFlight>) => PilotInput = autopilot) => runFlight(createFlight(createVehicle(capacity, payload), LAT), policy);

describe('the manual ascent model', () => {
  it('lets the reference pilot reach the parking orbit with the catalog payload', () => {
    for (const [capacity, payload] of [[800, 500], [5000, 2000], [5000, 5000], [15000, 8000], [50000, 40000]] as const) {
      const flight = fly(capacity, payload);
      expect(flight.status).toBe('orbit');
      const orbit = orbitOf(flight);
      expect(orbit.periapsis).toBeGreaterThan(TARGET_ALTITUDE_M * 0.9);
      expect(Math.abs(orbit.apoapsis - TARGET_ALTITUDE_M)).toBeLessThan(60_000);
      expect(rateFlight(flight).grade).toBe('perfect');
      // the ascent takes about ten minutes of flight, like a real one
      expect(flight.t).toBeGreaterThan(420);
      expect(flight.t).toBeLessThan(900);
    }
  });

  it('is limited by the spacecraft: a payload above the capacity does not reach orbit', () => {
    const flight = fly(5000, 6500);
    expect(flight.status).not.toBe('orbit');
  });

  it('leaves more propellant for a lighter spacecraft', () => {
    const light = rateFlight(fly(5000, 1000)).fuelLeftPct;
    const heavy = rateFlight(fly(5000, 5000)).fuelLeftPct;
    expect(light).toBeGreaterThan(heavy + 5);
  });

  it('is deterministic', () => {
    const a = fly(5000, 3000);
    const b = fly(5000, 3000);
    expect([a.t, a.r, a.vr, a.vt, a.prop2]).toEqual([b.t, b.r, b.vr, b.vt, b.prop2]);
  });

  it('crashes or fails when flown straight up (no turn): the vehicle falls back', () => {
    const flight = fly(5000, 3000, (f) => ({ throttle: 1, pitchCommand: 0, hold: false, separate: f.stage === 1 && f.prop1 <= 0 }));
    expect(flight.status === 'crashed' || flight.status === 'suborbital').toBe(true);
    expect(flight.status).not.toBe('orbit');
  });

  it('breaks the vehicle up when it is turned hard through the thick air', () => {
    const flight = fly(5000, 3000, (f) => ({ throttle: 1, pitchCommand: f.t < 20 ? 0 : Math.PI / 2, hold: false, separate: false }));
    expect(flight.status).toBe('broke-up');
    expect(flight.reason).toBe('stress');
  });

  it('stays on the pad until the engine is lit, and cannot separate there', () => {
    const flight = createFlight(createVehicle(5000, 3000), LAT);
    for (let i = 0; i < 200; i += 1) stepFlight(flight, { throttle: 0, pitchCommand: 0, hold: false, separate: true }, 0.05);
    expect(flight.status).toBe('flying');
    expect(flight.stage).toBe(1);
    expect(altitudeOf(flight)).toBe(0);
    for (let i = 0; i < 200; i += 1) stepFlight(flight, { throttle: 1, pitchCommand: 0, hold: false, separate: false }, 0.05);
    expect(altitudeOf(flight)).toBeGreaterThan(100);
  });

  it('uses propellant when the engine runs, and none when it is off', () => {
    const flight = createFlight(createVehicle(5000, 3000), LAT);
    const full = flight.prop1;
    for (let i = 0; i < 100; i += 1) stepFlight(flight, { throttle: 1, pitchCommand: 0, hold: true, separate: false }, 0.05);
    expect(flight.prop1).toBeLessThan(full);
    const burned = flight.prop1;
    for (let i = 0; i < 100; i += 1) stepFlight(flight, { throttle: 0, pitchCommand: 0, hold: true, separate: false }, 0.05);
    expect(flight.prop1).toBe(burned);
  });

  it('lights the second stage only after the separation delay', () => {
    const flight = createFlight(createVehicle(5000, 3000), LAT);
    for (let i = 0; i < 400; i += 1) stepFlight(flight, { throttle: 1, pitchCommand: 0, hold: true, separate: false }, 0.05);
    stepFlight(flight, { throttle: 1, pitchCommand: 0, hold: true, separate: true }, 0.05);
    expect(flight.stage).toBe(2);
    expect(flight.thrust).toBe(0);
    for (let i = 0; i < 40; i += 1) stepFlight(flight, { throttle: 1, pitchCommand: 0, hold: true, separate: false }, 0.05);
    expect(flight.thrust).toBeGreaterThan(0);
  });
});
