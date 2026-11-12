import { BODIES, SI_EXACT, type BodyId } from '../constants';
import { operationalOrbit, type OperationalOrbit } from '../orbitLayout';
import { toBase } from '../units';
import { spatialOrbitPath, spatialOrbitPosition, type SpatialOrbitElements, type Vec3 } from '@/physics/orbits';
import { SIM_ASSUMPTIONS } from './assumptions';
import type { SimPlan } from './plan';
import type { SimState, StageId } from './types';

/**
 * Where things are, as a pure function of the plan and the simulation state. The 3D scene
 * only draws what this returns; it owns no motion of its own.
 *
 * Orbits are Kepler ellipses from `src/physics/orbits.ts`; the cruise is half of a transfer
 * ellipse between the departure and arrival radii (ideal planet phasing, see `SIM_ASSUMPTIONS`);
 * the ascent is a schematic profile. None of it is a flight-dynamics trajectory.
 */

export type SceneBody = { id: BodyId; position: Vec3; radius: number; scaled: boolean };
export type ScenePath = { kind: 'operational' | 'transfer' | 'parking' | 'reference'; points: Vec3[]; dashed?: boolean };
export type SceneFrame = {
  /** Changes when the camera should re-frame (different body, scale or phase). */
  key: string;
  center: BodyId;
  unit: 'radii' | 'AU';
  /** Metres per scene unit. */
  unitLength: number;
  bodies: SceneBody[];
  paths: ScenePath[];
  /** Marker for where the spacecraft is heading (the arrival point of a transfer). */
  target: Vec3 | null;
  extent: number;
};

type Geometry = {
  op: OperationalOrbit;
  earthRadiusM: number;
  parkingRadius: number;
  parkingPeriodS: number;
  transfer: Transfer | null;
  frames: Map<string, SceneFrame>;
};

type Transfer = { center: 'earth' | 'sun'; unitLength: number; elements: SpatialOrbitElements; startTime: number; arrival: Vec3; departure: Vec3; r1: number; r2: number };

const cache = new WeakMap<SimPlan, Geometry>();
const AU = SI_EXACT.astronomicalUnitM;
const SEGMENTS = 120;

const circle = (radius: number, segments = 96, y = 0): Vec3[] => Array.from({ length: segments + 1 }, (_, index) => {
  const angle = (index / segments) * Math.PI * 2;
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)] as Vec3;
});

function transferOf(center: 'earth' | 'sun', unitLength: number, r1: number, r2: number): Transfer {
  const outward = r2 >= r1;
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const elements: SpatialOrbitElements = { semiMajorAxis: a, eccentricity: e, period: 1, phase: 0, plane: { towardPerihelion: [outward ? 1 : -1, 0, 0], quarterTurnAhead: [0, 0, 1] } };
  const startTime = outward ? 0 : 0.5;
  return { center, unitLength, elements, startTime, r1, r2, departure: [r1, 0, 0], arrival: [-r2, 0, 0] };
}

const transferPoint = (transfer: Transfer, fraction: number): Vec3 => spatialOrbitPosition(transfer.elements, transfer.startTime + Math.min(1, Math.max(0, fraction)) / 2);
const transferPath = (transfer: Transfer): Vec3[] => Array.from({ length: SEGMENTS + 1 }, (_, index) => transferPoint(transfer, index / SEGMENTS));

function geometryOf(plan: SimPlan): Geometry {
  const cached = cache.get(plan);
  if (cached) return cached;
  const op = operationalOrbit(plan.mission);
  const earthRadiusM = toBase(BODIES.earth.radius);
  const parkingRadius = 1 + (SIM_ASSUMPTIONS.parkingAltitudeKm * 1000) / earthRadiusM;
  const earthGm = toBase(BODIES.earth.gm);
  const parkingPeriodS = 2 * Math.PI * Math.sqrt((parkingRadius * earthRadiusM) ** 3 / earthGm);

  let transfer: Transfer | null = null;
  if (plan.missionClass === 'geostationary') transfer = transferOf('earth', earthRadiusM, parkingRadius, op.elements.semiMajorAxis);
  if (plan.missionClass === 'lunar') transfer = transferOf('earth', earthRadiusM, parkingRadius, toBase(BODIES.moon.orbit!.semiMajorAxis) / earthRadiusM);
  if (plan.missionClass === 'mars') transfer = transferOf('sun', AU, 1, toBase(BODIES.mars.orbit!.semiMajorAxis) / AU);
  if (plan.missionClass === 'heliocentric') {
    const rp = op.geometry.periapsisRadius / AU;
    const ra = op.geometry.apoapsisRadius / AU;
    transfer = transferOf('sun', AU, 1, Math.abs(rp - 1) <= Math.abs(ra - 1) ? rp : ra);
  }
  const geometry: Geometry = { op, earthRadiusM, parkingRadius, parkingPeriodS, transfer, frames: new Map() };
  cache.set(plan, geometry);
  return geometry;
}

/** Which frame (central body and scale) a stage is drawn in. */
export function frameKeyOf(plan: SimPlan, stage: StageId): string {
  switch (plan.missionClass) {
    case 'earth-orbit': return 'earth';
    case 'geostationary': return 'earth';
    case 'lunar': return stage === 'cruise' ? 'earth:transfer' : stage === 'pre-launch' || stage === 'launch' || stage === 'orbit-insertion' ? 'earth:launch' : 'moon';
    case 'mars': return stage === 'cruise' ? 'sun:transfer' : stage === 'pre-launch' || stage === 'launch' || stage === 'orbit-insertion' ? 'earth:launch' : 'mars';
    case 'heliocentric': return stage === 'cruise' ? 'sun:transfer' : stage === 'pre-launch' || stage === 'launch' || stage === 'orbit-insertion' ? 'earth:launch' : 'sun:ops';
  }
}

const opPath = (op: OperationalOrbit): Vec3[] => spatialOrbitPath({ ...op.elements, period: 1 }, SEGMENTS);

/** The unchanging part of a frame: bodies, orbit lines and the extent the camera frames. */
export function frameOf(plan: SimPlan, key: string): SceneFrame {
  const geo = geometryOf(plan);
  const cached = geo.frames.get(key);
  if (cached) return cached;
  const { op, transfer, parkingRadius } = geo;
  let frame: SceneFrame;
  const earth: SceneBody = { id: 'earth', position: [0, 0, 0], radius: 1, scaled: false };
  switch (key) {
    case 'earth': {
      const extent = Math.max(2, plan.missionClass === 'geostationary' ? op.elements.semiMajorAxis * 1.15 : op.geometry.apoapsisRadius / geo.earthRadiusM);
      frame = { key, center: 'earth', unit: 'radii', unitLength: geo.earthRadiusM, bodies: [earth], paths: [{ kind: 'operational', points: opPath(op) }, ...(transfer ? [{ kind: 'transfer' as const, points: transferPath(transfer) }, { kind: 'parking' as const, points: circle(parkingRadius) }] : [])], target: null, extent };
      break;
    }
    case 'earth:launch':
      frame = { key, center: 'earth', unit: 'radii', unitLength: geo.earthRadiusM, bodies: [earth], paths: [{ kind: 'parking', points: circle(parkingRadius) }], target: null, extent: 2 };
      break;
    case 'earth:transfer': {
      const moonDistance = transfer!.r2;
      const extent = moonDistance * 1.15;
      const moonTrue = toBase(BODIES.moon.radius) / geo.earthRadiusM;
      frame = { key, center: 'earth', unit: 'radii', unitLength: geo.earthRadiusM, bodies: [earth, { id: 'moon', position: transfer!.arrival, radius: Math.max(moonTrue, extent * 0.03), scaled: moonTrue < extent * 0.03 }], paths: [{ kind: 'transfer', points: transferPath(transfer!) }, { kind: 'parking', points: circle(parkingRadius) }, { kind: 'reference', points: circle(moonDistance), dashed: true }], target: transfer!.arrival, extent };
      break;
    }
    case 'sun:transfer': {
      const t = transfer!;
      const extent = Math.max(t.r1, t.r2) * 1.2;
      const bodies: SceneBody[] = [{ id: 'sun', position: [0, 0, 0], radius: extent * 0.06, scaled: true }, { id: 'earth', position: t.departure, radius: extent * 0.025, scaled: true }];
      const paths: ScenePath[] = [{ kind: 'transfer', points: transferPath(t) }, { kind: 'reference', points: circle(1), dashed: true }];
      if (plan.missionClass === 'mars') { bodies.push({ id: 'mars', position: t.arrival, radius: extent * 0.02, scaled: true }); paths.push({ kind: 'reference', points: circle(t.r2), dashed: true }); }
      frame = { key, center: 'sun', unit: 'AU', unitLength: AU, bodies, paths, target: t.arrival, extent };
      break;
    }
    case 'sun:ops': {
      const extent = Math.max(op.geometry.apoapsisRadius / AU, 1) * 1.1;
      frame = { key, center: 'sun', unit: 'AU', unitLength: AU, bodies: [{ id: 'sun', position: [0, 0, 0], radius: extent * 0.06, scaled: true }], paths: [{ kind: 'operational', points: opPath(op) }, { kind: 'reference', points: circle(1), dashed: true }], target: null, extent };
      break;
    }
    default: {
      // 'moon' | 'mars': around the destination body, unit = its radius
      const body = op.body;
      frame = { key, center: body, unit: 'radii', unitLength: op.unitLength, bodies: [{ id: body, position: [0, 0, 0], radius: 1, scaled: false }], paths: [{ kind: 'operational', points: opPath(op) }], target: null, extent: Math.max(2, op.geometry.apoapsisRadius / op.unitLength) };
    }
  }
  geo.frames.set(key, frame);
  return frame;
}

/* --------------------------------------------------------------- the spacecraft */

const smooth = (x: number) => x * x * (3 - 2 * x);

type Craft = { position: Vec3; speedMps: number };

function startOf(state: SimState, plan: SimPlan, id: StageId): number {
  const index = plan.stageIds.indexOf(id);
  return state.stages[index]?.startS ?? 0;
}

/** Position (scene units of the stage's frame) of the spacecraft `elapsed` seconds into the stage `id`. */
function craftAt(plan: SimPlan, state: SimState, id: StageId, elapsed: number): Vec3 {
  const geo = geometryOf(plan);
  const { op, transfer } = geo;
  const earthClass = plan.missionClass === 'earth-orbit';
  const site = plan.siteLatitudeRad;
  const siteDir: Vec3 = [Math.cos(site), Math.sin(site), 0];
  const targetRadius = earthClass ? op.geometry.periapsisRadius / geo.earthRadiusM : geo.parkingRadius;

  switch (id) {
    case 'pre-launch': return siteDir;
    case 'launch': {
      const tau = Math.min(1, Math.max(0, elapsed / (plan.stagePlannedS.launch ?? 1)));
      const radius = 1 + (targetRadius - 1) * smooth(tau);
      const angle = site * (1 - tau);
      return [radius * Math.cos(angle), radius * Math.sin(angle), 0];
    }
    case 'orbit-insertion': {
      if (earthClass) return spatialOrbitPosition(op.elements, elapsed);
      const angle = (2 * Math.PI * elapsed) / geo.parkingPeriodS;
      return [geo.parkingRadius * Math.cos(angle), 0, geo.parkingRadius * Math.sin(angle)];
    }
    case 'cruise': return transfer ? transferPoint(transfer, elapsed / Math.max(1, plan.stagePlannedS.cruise ?? 1)) : [0, 0, 0];
    default: {
      const origin = earthClass ? startOf(state, plan, 'orbit-insertion') : startOf(state, plan, 'destination-arrival');
      const time = state.t - origin + (elapsed - state.stageElapsedS);
      // A geostationary orbit starts where the transfer ended, on the far side from the departure.
      const elements = plan.missionClass === 'geostationary' ? { ...op.elements, phase: Math.PI } : op.elements;
      return spatialOrbitPosition(elements, Math.max(0, time));
    }
  }
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Spacecraft position and speed at mission time `clockT` (which may be slightly ahead of the last completed
 * step, so motion looks smooth at low playback speeds). The speed is the distance covered along the drawn
 * path divided by time, except during the ascent, where it follows a documented schematic profile.
 */
export function craftState(plan: SimPlan, state: SimState, clockT: number = state.t): Craft & { frameKey: string } {
  const id = plan.stageIds[state.stageIndex]!;
  const length = id === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[id] ?? 0);
  const ahead = state.ended ? 0 : Math.max(0, clockT - state.t);
  const elapsed = Math.min(length > 0 ? length : state.stageElapsedS + ahead, state.stageElapsedS + ahead);
  const frameKey = frameKeyOf(plan, id);
  const frame = frameOf(plan, frameKey);
  const position = craftAt(plan, state, id, elapsed);

  let speedMps: number;
  const geo = geometryOf(plan);
  if (id === 'pre-launch') speedMps = 0;
  else if (id === 'launch') {
    const tau = Math.min(1, Math.max(0, elapsed / (plan.stagePlannedS.launch ?? 1)));
    const earthClass = plan.missionClass === 'earth-orbit';
    const radius = earthClass ? geo.op.geometry.periapsisRadius : geo.parkingRadius * geo.earthRadiusM;
    const target = Math.sqrt(toBase(BODIES.earth.gm) / radius);
    speedMps = target * tau ** 1.5;
  } else {
    const span = id === 'cruise' ? (plan.stagePlannedS.cruise ?? 1) : id === 'orbit-insertion' && plan.missionClass !== 'earth-orbit' ? geo.parkingPeriodS : geo.op.elements.period;
    const h = Math.max(1, span / 4000);
    const before = craftAt(plan, state, id, Math.max(0, elapsed - h));
    const after = craftAt(plan, state, id, elapsed + h);
    speedMps = (distance(before, after) * frame.unitLength) / (elapsed - Math.max(0, elapsed - h) + h);
  }
  return { position, speedMps, frameKey };
}

/** A short trail behind the spacecraft within the current stage. */
export function craftTrail(plan: SimPlan, state: SimState, clockT: number = state.t, samples = 48): Vec3[] {
  const id = plan.stageIds[state.stageIndex]!;
  const length = id === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[id] ?? 0);
  const ahead = state.ended ? 0 : Math.max(0, clockT - state.t);
  const elapsed = Math.min(length > 0 ? length : state.stageElapsedS + ahead, state.stageElapsedS + ahead);
  const orbitSpan = id === 'cruise' || id === 'launch' || id === 'orbit-insertion' ? elapsed : Math.min(elapsed, geometryOf(plan).op.elements.period * 0.6);
  const points: Vec3[] = [];
  for (let index = 0; index <= samples; index += 1) points.push(craftAt(plan, state, id, elapsed - orbitSpan + (orbitSpan * index) / samples));
  return points;
}

export { distance as sceneDistance };
