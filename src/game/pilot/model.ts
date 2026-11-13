/**
 * Flying the launch by hand: a planar, two-stage ascent over a round Earth, pure and deterministic.
 *
 * What is modelled (and what is not): gravity (inverse square), a thin exponential atmosphere with drag, engine thrust
 * with an Isp that improves with altitude, two stages that burn and separate, the pitch of the vehicle (limited turn
 * rate), the aerodynamic stress q times the angle of attack (too much breaks the vehicle up) and the rotation of
 * the Earth. Not modelled: weather, winds, a third dimension (no plane changes), engine gimbal dynamics, heating.
 * The vehicle is a class-typical two-stage kerolox rocket (numbers follow a Falcon 9 class vehicle), scaled so that
 * the launcher's catalog capacity is its payload to orbit. A lighter spacecraft than the capacity leaves fuel to spare.
 */

export const MU = 3.986004418e14;
export const EARTH_R = 6_378_137;
export const G0 = 9.80665;
/** Earth's sidereal rotation, rad/s. */
const OMEGA = 7.2921159e-5;
const SCALE_HEIGHT = 7_200;
const RHO0 = 1.225;
/** The parking orbit the launch aims for (the drawn orbit of the game). */
export const TARGET_ALTITUDE_M = 300_000;
/** A perigee above this is a stable orbit: the vehicle no longer touches the air. */
export const STABLE_PERIGEE_M = 150_000;
/** Stress limit: dynamic pressure (Pa) times angle of attack (rad). Above it the vehicle breaks up. */
export const Q_ALPHA_LIMIT = 4_500;
/** Seconds of vehicle time it takes the engine of the second stage to light after separation. */
export const IGNITION_DELAY_S = 1.2;
/** Highest rate the vehicle can turn, degrees per second. */
export const TURN_RATE_DEG = 4;

export type Vehicle = {
  /** Lift-off mass including the payload, kg. */
  liftoffMass: number;
  payloadMass: number;
  stage1: { dry: number; propellant: number; thrustVac: number; ispVac: number; ispSl: number; minThrottle: number };
  stage2: { dry: number; propellant: number; thrustVac: number; ispVac: number; ispSl: number; minThrottle: number };
  /** Frontal area, m². */
  area: number;
  /** True when the vehicle carries side boosters (they are dropped early in the first-stage burn). */
  boosters: boolean;
};

/**
 * Builds the vehicle for a launcher: `capacityKg` is the catalog mass it can deliver, `payloadKg` the mass of the player's
 * spacecraft. The vehicle is sized from the capacity (24 times it at lift-off, a Falcon 9 class ratio).
 */
export function createVehicle(capacityKg: number, payloadKg: number, boosters = false): Vehicle {
  const m0 = Math.max(2_000, capacityKg * 24);
  const stage1Prop = 0.72 * m0;
  const stage1Dry = 0.045 * m0;
  const stage2Prop = 0.2 * m0;
  const stage2Dry = 0.0085 * m0;
  return {
    liftoffMass: stage1Prop + stage1Dry + stage2Prop + stage2Dry + Math.max(0, payloadKg),
    payloadMass: Math.max(0, payloadKg),
    stage1: { dry: stage1Dry, propellant: stage1Prop, thrustVac: 1.42 * m0 * G0, ispVac: 311, ispSl: 282, minThrottle: 0.4 },
    stage2: { dry: stage2Dry, propellant: stage2Prop, thrustVac: 0.98 * (stage2Dry + stage2Prop + Math.max(0, payloadKg)) * G0 * 1.25, ispVac: 348, ispSl: 250, minThrottle: 0.4 },
    area: 10.75 * Math.pow(m0 / 549_000, 2 / 3),
    boosters,
  };
}

export type FlightStatus = 'flying' | 'orbit' | 'crashed' | 'broke-up' | 'suborbital';

export type Flight = {
  vehicle: Vehicle;
  /** Mission time since the throttle was first opened, s. */
  t: number;
  /** Distance from the centre of the Earth, m. */
  r: number;
  /** Angle travelled along the ground track, rad. */
  theta: number;
  /** Radial and tangential (inertial) speed, m/s. */
  vr: number;
  vt: number;
  /** Which stage is attached: 1 or 2. */
  stage: 1 | 2;
  prop1: number;
  prop2: number;
  /** Real attitude: angle from the local vertical toward downrange, rad. */
  pitch: number;
  /** Where the player (or the autopilot) points it, rad. */
  pitchCommand: number;
  /** The engine is lit at this fraction of full thrust (0 when off, dead or igniting). */
  thrust: number;
  /** Seconds left before the second-stage engine can light after separation. */
  ignitionIn: number;
  liftedOff: boolean;
  fairingGone: boolean;
  boostersGone: boolean;
  /** Largest dynamic pressure and stress met so far. */
  maxQ: number;
  maxQAlpha: number;
  /** Latitude of the pad, rad. */
  latitude: number;
  status: FlightStatus;
  /** Why it ended, when it did. */
  reason: 'orbit' | 'ground' | 'stress' | 'fuel' | null;
  /** The current stress as a fraction of the limit (1 breaks the vehicle). */
  stressRatio: number;
  /** Seconds since stage separation (for the scene), -1 before. */
  sinceSeparation: number;
};

export function createFlight(vehicle: Vehicle, latitudeRad: number): Flight {
  return {
    vehicle, t: 0, r: EARTH_R, theta: 0, vr: 0, vt: OMEGA * EARTH_R * Math.cos(latitudeRad), stage: 1,
    prop1: vehicle.stage1.propellant, prop2: vehicle.stage2.propellant, pitch: 0, pitchCommand: 0, thrust: 0, ignitionIn: 0,
    liftedOff: false, fairingGone: false, boostersGone: false, maxQ: 0, maxQAlpha: 0, latitude: latitudeRad,
    status: 'flying', reason: null, stressRatio: 0, sinceSeparation: -1,
  };
}

export type PilotInput = {
  /** 0..1. A value between 0 and the engine's minimum is raised to the minimum; 0 shuts the engine down. */
  throttle: number;
  /** Where to point the vehicle: angle from vertical, radians (used unless `hold` follows the flight path). */
  pitchCommand: number;
  /** Hold the vehicle on the flight path (a gravity turn), after a small kick. */
  hold: boolean;
  /** Request stage separation (second stage lights after a short delay). */
  separate: boolean;
};

const deg = (value: number) => (value * Math.PI) / 180;

export const altitudeOf = (flight: Flight) => flight.r - EARTH_R;
export const speedOf = (flight: Flight) => Math.hypot(flight.vr, flight.vt);
export const downrangeOf = (flight: Flight) => flight.theta * EARTH_R;
const density = (altitude: number) => (altitude > 140_000 ? 0 : RHO0 * Math.exp(-Math.max(0, altitude) / SCALE_HEIGHT));

export function massOf(flight: Flight): number {
  const { vehicle } = flight;
  let mass = vehicle.payloadMass + flight.prop2 + vehicle.stage2.dry;
  if (flight.stage === 1) mass += flight.prop1 + vehicle.stage1.dry;
  return mass;
}

export type OrbitElements = { periapsis: number; apoapsis: number; bound: boolean; eccentricity: number };

/** Orbit that the vehicle would follow with the engines off (altitudes above the surface, m). */
export function orbitOf(flight: Flight): OrbitElements {
  const energy = (flight.vr * flight.vr + flight.vt * flight.vt) / 2 - MU / flight.r;
  const h = flight.r * flight.vt;
  if (energy >= 0) return { periapsis: flight.r - EARTH_R, apoapsis: Infinity, bound: false, eccentricity: 1 };
  const a = -MU / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (MU * MU)));
  return { periapsis: a * (1 - e) - EARTH_R, apoapsis: a * (1 + e) - EARTH_R, bound: true, eccentricity: e };
}

/** Remaining propellant of the attached stage, 0..1. */
export function fuelFraction(flight: Flight, stage: 1 | 2): number {
  if (stage === 1) return flight.stage === 1 ? flight.prop1 / flight.vehicle.stage1.propellant : 0;
  return flight.prop2 / flight.vehicle.stage2.propellant;
}

/** Angle of the flight path from the local vertical (the direction "hold" follows), radians. */
function pathAngle(flight: Flight): number {
  const vtRel = flight.vt - OMEGA * Math.cos(flight.latitude) * flight.r;
  return Math.atan2(vtRel, flight.vr);
}

/** One step of the flight. Mutates and returns `flight`. */
export function stepFlight(flight: Flight, input: PilotInput, dt: number): Flight {
  if (flight.status !== 'flying') return flight;
  const { vehicle } = flight;
  const altitude = altitudeOf(flight);
  const engine = flight.stage === 1 ? vehicle.stage1 : vehicle.stage2;
  const fuel = flight.stage === 1 ? flight.prop1 : flight.prop2;

  // separation
  if (flight.sinceSeparation >= 0) flight.sinceSeparation += dt;
  if (input.separate && flight.stage === 1 && flight.liftedOff) {
    flight.stage = 2;
    flight.prop1 = 0;
    flight.ignitionIn = IGNITION_DELAY_S;
    flight.sinceSeparation = 0;
  }
  if (flight.ignitionIn > 0) flight.ignitionIn = Math.max(0, flight.ignitionIn - dt);

  // attitude: the player's pitch, or the flight path after a small kick
  let command = input.pitchCommand;
  if (input.hold) {
    const speed = Math.hypot(flight.vr, flight.vt - OMEGA * Math.cos(flight.latitude) * flight.r);
    command = flight.t < 8 || speed < 40 ? 0 : Math.max(pathAngle(flight), flight.pitch < deg(1.5) ? deg(2.2) : 0);
  }
  flight.pitchCommand = Math.min(deg(110), Math.max(-deg(20), command));
  const maxTurn = deg(TURN_RATE_DEG) * dt;
  flight.pitch += Math.max(-maxTurn, Math.min(maxTurn, flight.pitchCommand - flight.pitch));

  // engine
  const wanted = input.throttle <= 0 ? 0 : Math.max(engine.minThrottle, Math.min(1, input.throttle));
  const lit = wanted > 0 && fuel > 0 && flight.ignitionIn <= 0;
  const throttle = lit ? wanted : 0;
  flight.thrust = throttle;
  const ispNow = engine.ispVac - (engine.ispVac - engine.ispSl) * Math.exp(-Math.max(0, altitude) / SCALE_HEIGHT);
  const massFlow = lit ? (throttle * engine.thrustVac) / (engine.ispVac * G0) : 0;
  const burned = Math.min(fuel, massFlow * dt);
  const force = lit && massFlow > 0 ? (burned / dt) * ispNow * G0 : 0;
  if (flight.stage === 1) flight.prop1 -= burned; else flight.prop2 -= burned;
  if (burned > 0) flight.t += dt; else if (flight.liftedOff) flight.t += dt;

  // the pad holds the vehicle until it can lift
  const mass = massOf(flight);
  const ux = Math.cos(flight.pitch); // radial part of the thrust direction
  const uy = Math.sin(flight.pitch); // tangential part

  // air
  const airT = OMEGA * Math.cos(flight.latitude) * flight.r;
  const vrRel = flight.vr;
  const vtRel = flight.vt - airT;
  const speed = Math.hypot(vrRel, vtRel);
  const rho = density(altitude);
  const q = 0.5 * rho * speed * speed;
  let alpha = 0;
  if (speed > 20) {
    const dot = (ux * vrRel + uy * vtRel) / speed;
    alpha = Math.acos(Math.min(1, Math.max(-1, dot)));
  }
  const cd = 0.35 + 3 * alpha * alpha;
  const drag = q * vehicle.area * cd;
  const dragR = speed > 0 ? (drag * vrRel) / speed : 0;
  const dragT = speed > 0 ? (drag * vtRel) / speed : 0;
  const stress = q * alpha;
  flight.stressRatio = stress / Q_ALPHA_LIMIT;
  flight.maxQ = Math.max(flight.maxQ, q);
  flight.maxQAlpha = Math.max(flight.maxQAlpha, stress);

  const g = MU / (flight.r * flight.r);
  let ar = (flight.vt * flight.vt) / flight.r - g + (force * ux - dragR) / mass;
  const at = -(flight.vr * flight.vt) / flight.r + (force * uy - dragT) / mass;
  if (!flight.liftedOff && flight.vr <= 0 && ar <= 0) { ar = 0; flight.vr = 0; } // standing on the pad
  flight.vr += ar * dt;
  flight.vt += at * dt;
  flight.r += flight.vr * dt;
  flight.theta += (flight.vt / flight.r) * dt;
  if (!flight.liftedOff && flight.r - EARTH_R > 2) flight.liftedOff = true;

  if (!flight.fairingGone && altitude > 110_000) flight.fairingGone = true;
  if (!flight.boostersGone && vehicle.boosters && flight.stage === 1 && flight.prop1 < vehicle.stage1.propellant * 0.62) flight.boostersGone = true;

  // the ends
  if (flight.liftedOff && flight.r <= EARTH_R && flight.vr < 0) { flight.status = 'crashed'; flight.reason = 'ground'; flight.r = EARTH_R; return flight; }
  if (stress > Q_ALPHA_LIMIT) { flight.status = 'broke-up'; flight.reason = 'stress'; return flight; }
  const orbit = orbitOf(flight);
  const empty = (flight.stage === 2 && flight.prop2 <= 0) || (flight.stage === 1 && flight.prop1 <= 0 && false);
  if (orbit.bound && orbit.periapsis >= STABLE_PERIGEE_M && altitudeOf(flight) > 100_000 && (throttle === 0 || orbit.periapsis >= TARGET_ALTITUDE_M * 0.95 || empty)) {
    flight.status = 'orbit';
    flight.reason = 'orbit';
    return flight;
  }
  if (empty && !(orbit.bound && orbit.periapsis >= STABLE_PERIGEE_M)) {
    // out of propellant and not in a stable orbit: the vehicle falls back
    flight.status = 'suborbital';
    flight.reason = 'fuel';
  }
  return flight;
}

export type FlightRating = { grade: 'perfect' | 'good' | 'rough'; periapsisKm: number; apoapsisKm: number; fuelLeftPct: number; errorKm: number };

/** How well an orbit was reached (only meaningful when `status` is `orbit`). */
export function rateFlight(flight: Flight): FlightRating {
  const orbit = orbitOf(flight);
  const target = TARGET_ALTITUDE_M;
  const errorKm = Math.max(Math.abs(orbit.periapsis - target), Math.abs(orbit.apoapsis - target)) / 1000;
  const total = flight.vehicle.stage2.propellant;
  const fuelLeftPct = Math.max(0, (flight.prop2 / total) * 100);
  const grade = errorKm < 40 ? 'perfect' : errorKm < 200 ? 'good' : 'rough';
  return { grade, periapsisKm: orbit.periapsis / 1000, apoapsisKm: Number.isFinite(orbit.apoapsis) ? orbit.apoapsis / 1000 : Infinity, fuelLeftPct, errorKm };
}

/**
 * The reference pilot: a gravity turn on the first stage, separation when it runs dry, then a closed-loop climb to the
 * parking orbit. Used by the "auto" mode, by the tests (proving the ascent is possible with the vehicle) and as the
 * level against which a human flight is judged.
 */
export function autopilot(flight: Flight): PilotInput {
  const altitude = altitudeOf(flight);
  if (flight.stage === 1) {
    const empty = flight.prop1 <= 0;
    return { throttle: 1, pitchCommand: 0, hold: true, separate: empty };
  }
  const orbit = orbitOf(flight);
  const target = TARGET_ALTITUDE_M;
  const circular = orbit.bound && orbit.periapsis >= target * 0.97;
  if (circular) return { throttle: 0, pitchCommand: Math.PI / 2, hold: false, separate: false };
  // phase 1: climb on the first-stage direction until the high point of the orbit reaches the target
  const apogeeReached = orbit.bound && orbit.apoapsis >= target * 0.985;
  if (!apogeeReached) {
    const elevation = Math.min(deg(55), Math.max(-deg(5), 2.2e-6 * (target - altitude) - 1.2e-4 * flight.vr));
    return { throttle: 1, pitchCommand: Math.PI / 2 - elevation, hold: false, separate: false };
  }
  // phase 2: coast up to the high point, then burn sideways to lift the low point
  const nearApogee = flight.vr < 12;
  if (!nearApogee) return { throttle: 0, pitchCommand: Math.PI / 2 - deg(Math.max(0, Math.min(40, flight.vr / 60))), hold: false, separate: false };
  const elevation = Math.min(deg(25), Math.max(-deg(25), -4e-3 * flight.vr + 1.5e-6 * (target - altitude)));
  return { throttle: 1, pitchCommand: Math.PI / 2 - elevation, hold: false, separate: false };
}

/** Flies with a policy to its end (a test helper and the "auto" mode's fast path). */
export function runFlight(flight: Flight, policy: (flight: Flight) => PilotInput, dt = 0.05, maxSeconds = 1_500): Flight {
  for (let step = 0; step < maxSeconds / dt && flight.status === 'flying'; step += 1) stepFlight(flight, policy(flight), dt);
  return flight;
}

export type HintKey = 'liftoff' | 'climb' | 'turn' | 'stage' | 'stress' | 'second' | 'coast' | 'circularize' | 'orbit' | 'cut' | 'fuelLow';

/** The advice shown to the pilot at this moment (a key into the translations). */
export function hintOf(flight: Flight): HintKey {
  const altitude = altitudeOf(flight);
  const orbit = orbitOf(flight);
  if (flight.status === 'orbit') return 'orbit';
  if (flight.stressRatio > 0.7) return 'stress';
  if (!flight.liftedOff) return 'liftoff';
  if (flight.stage === 1) {
    if (flight.prop1 <= flight.vehicle.stage1.propellant * 0.04) return 'stage';
    if (altitude < 1_500) return 'climb';
    return 'turn';
  }
  if (flight.ignitionIn > 0) return 'second';
  const target = TARGET_ALTITUDE_M;
  if (orbit.bound && orbit.periapsis >= STABLE_PERIGEE_M) return 'cut';
  if (orbit.bound && orbit.apoapsis >= target * 0.985) return flight.vr > 12 ? 'coast' : 'circularize';
  if (flight.prop2 < flight.vehicle.stage2.propellant * 0.08) return 'fuelLow';
  return 'second';
}
