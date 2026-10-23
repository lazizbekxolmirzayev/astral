import { initialConditions } from '@/data/initialConditions';
import { solarSystem } from '@/data/solarSystem';
import {
  angularMomentum,
  driftPercent,
  kinematicsRelativeTo,
  totalEnergy,
} from '@/physics/diagnostics';
import {
  assessNewtonianValidity,
  NEWTONIAN_GRAVITATIONAL_CONSTANT,
  schwarzschildRadiusM,
} from '@/physics/blackHole';
import {
  airburstRiskForTarget,
  impactorMassFromRadiusAndDensity,
  kineticEnergyJoules,
  tntEquivalentMegatons,
} from '@/physics/impact';
import {
  cloneState,
  createState,
  type BodyDefinition,
  type NBodyState,
} from '@/physics/gravity';
import { DEFAULT_SOFTENING_AU, MAX_TIMESTEP_DAYS, MIN_TIMESTEP_DAYS, createTimestepAccumulator, stepVelocityVerlet } from '@/physics/integrator';
import { catalogEntries } from '@/data/catalog/entries';
import type { CatalogEntry } from '@/data/catalog/types';
import { replaceStarMass } from '@/physics/starReplacement';
import { evaluateStability, type StabilityWarning } from './stability';

export const SANDBOX_SPEEDS = [1, 10, 100, 1000] as const;
export type SandboxSpeed = (typeof SANDBOX_SPEEDS)[number];
export type SandboxPreset =
  | 'stable-system'
  | 'two-body'
  | 'asteroid-impact'
  | 'star-replacement'
  | 'black-hole'
  | 'empty-space';

export const SANDBOX_PRESETS: readonly SandboxPreset[] = [
  'stable-system', 'two-body', 'asteroid-impact', 'star-replacement', 'black-hole', 'empty-space',
];

export const SANDBOX_TIMESTEP_DAYS = 0.01;
export const DEFAULT_DAYS_PER_SECOND = 2;
const MAX_STEPS_PER_FRAME = 2000;
const AU_METRES = 149_597_870_700;
const SECONDS_PER_DAY = 86_400;
const SUN_ID = 'sun';
function findSolarGM(): number {
  const gm = initialConditions.find((body) => body.id === SUN_ID)?.gm;
  if (gm === undefined) throw new Error('Solar initial conditions need the Sun');
  return gm;
}
const SOLAR_GM = findSolarGM();
const GM_SI_PER_AU3_DAY2 = AU_METRES ** 3 / SECONDS_PER_DAY ** 2;

export type SandboxPresetInfo = {
  bodies: BodyDefinition[];
  centerId?: string;
  softeningAu: number;
  timestepDays: number;
  /** Simulated days per real second at 1x speed; presets with very short time scales override it. */
  daysPerSecond?: number;
  /** Stop the run and report an impact when these two bodies come within `distanceAu` of each other. */
  collision?: { bodyA: string; bodyB: string; distanceAu: number };
  /** Where an override scenario came from. Absent for the built-in presets. */
  kind?: 'catalog' | 'custom';
  /** Set for scenarios built from a catalogue record. */
  title?: string;
  /** Defaults used because the record did not provide the value. */
  assumptions?: string[];
  impact?: { energyJoules: number; tntMegatons: number; airburstRisk: boolean };
  blackHole?: { massKg: number; radiusM: number; validity: ReturnType<typeof assessNewtonianValidity> };
  note: 'stable' | 'twoBody' | 'impact' | 'starReplacement' | 'blackHole' | 'empty';
};

function copyBody(body: BodyDefinition): BodyDefinition {
  return { ...body, position: [...body.position], velocity: [...body.velocity] };
}

function getBodies(ids: readonly string[]) {
  return ids.map((id) => {
    const body = initialConditions.find((candidate) => candidate.id === id);
    if (!body) throw new Error(`Missing initial conditions for ${id}`);
    return copyBody(body);
  });
}

function impactInfo(radiusM: number, densityKgM3: number, impactVelocityMs: number): SandboxPresetInfo {
  const [sun, earth] = getBodies([SUN_ID, 'earth']);
  const earthFacts = solarSystem.find((body) => body.id === 'earth');
  if (!sun || !earth || !earthFacts?.radius) throw new Error('Earth radius is required for the impact scenario');
  const massKg = impactorMassFromRadiusAndDensity(radiusM, densityKgM3);
  const asteroid: BodyDefinition = {
    id: 'asteroid',
    gm: NEWTONIAN_GRAVITATIONAL_CONSTANT * massKg / GM_SI_PER_AU3_DAY2,
    position: [earth.position[0] + 0.0002, earth.position[1], earth.position[2]],
    velocity: [earth.velocity[0] - impactVelocityMs * SECONDS_PER_DAY / AU_METRES, earth.velocity[1], earth.velocity[2]],
  };
  const energyJoules = kineticEnergyJoules(massKg, impactVelocityMs);
  const airburst = airburstRiskForTarget({
    targetHasAtmosphere: true,
    targetType: 'rocky',
    impactorRadiusM: radiusM,
    impactorDensityKgM3: densityKgM3,
    impactVelocityMs,
    targetRadiusM: earthFacts.radius.value * 1000,
    // Convert JPL's Earth GM into mass using the SI gravitational constant.
    targetMassKg: earth.gm * GM_SI_PER_AU3_DAY2 / NEWTONIAN_GRAVITATIONAL_CONSTANT,
  });
  // Approach starts 0.0002 AU away; the default 2 days/s would cross it in microseconds.
  return {
    collision: { bodyA: 'asteroid', bodyB: 'earth', distanceAu: (earthFacts.radius.value * 1000) / AU_METRES },
    bodies: [sun, earth, asteroid], centerId: SUN_ID, softeningAu: 1e-8, timestepDays: 1e-4, daysPerSecond: 0.002, note: 'impact',
    impact: { energyJoules, tntMegatons: tntEquivalentMegatons(energyJoules), airburstRisk: airburst.risk },
  };
}

function blackHoleInfo(massSolar: number): SandboxPresetInfo {
  const massKg = (SOLAR_GM * GM_SI_PER_AU3_DAY2 / NEWTONIAN_GRAVITATIONAL_CONSTANT) * massSolar;
  const radiusM = schwarzschildRadiusM(massKg) * 12;
  const radiusAu = radiusM / AU_METRES;
  const gm = SOLAR_GM * massSolar;
  const planet: BodyDefinition = {
    id: 'test-particle',
    gm: SOLAR_GM * 1e-20,
    position: [radiusAu, 0, 0],
    velocity: [0, Math.sqrt(gm / radiusAu), 0],
  };
  // One orbit at 12 r_s is far shorter than the global 2 days/s and 0.01 d step, so size both from the period.
  const periodDays = 2 * Math.PI * Math.sqrt(radiusAu ** 3 / gm);
  return {
    bodies: [{ id: 'black-hole', gm, position: [0, 0, 0], velocity: [0, 0, 0] }, planet],
    centerId: 'black-hole',
    softeningAu: radiusAu * 1e-8,
    timestepDays: clampStep(periodDays / 400),
    daysPerSecond: periodDays / 6,
    note: 'blackHole',
    blackHole: { massKg, radiusM, validity: assessNewtonianValidity(massKg, radiusM) },
  };
}

function clampStep(dt: number): number {
  return Math.min(MAX_TIMESTEP_DAYS, Math.max(MIN_TIMESTEP_DAYS, dt));
}

function twoBodyInfo(starMassSolar: number, planetMassEarth: number | undefined, semiMajorAxisAu: number): SandboxPresetInfo {
  const gm = SOLAR_GM * starMassSolar;
  const planetGm = SOLAR_GM * (planetMassEarth ?? 0) * 3.0034893e-6;
  const periodDays = 2 * Math.PI * Math.sqrt(semiMajorAxisAu ** 3 / gm);
  return {
    bodies: [
      { id: 'star', gm, position: [0, 0, 0], velocity: [0, 0, 0] },
      { id: 'planet', gm: Math.max(planetGm, SOLAR_GM * 1e-12), position: [semiMajorAxisAu, 0, 0], velocity: [0, Math.sqrt(gm / semiMajorAxisAu), 0] },
    ],
    centerId: 'star',
    softeningAu: semiMajorAxisAu * 1e-6,
    timestepDays: clampStep(periodDays / 400),
    daysPerSecond: periodDays / 8,
    note: 'twoBody',
  };
}

/**
 * Builds a runnable scenario from a catalogue record, or null when the record
 * is not simulatable (galaxies). Every default that is not in the record is
 * listed in `assumptions` so the UI can show it.
 */
export function catalogScenario(entry: CatalogEntry, catalog: readonly CatalogEntry[] = catalogEntries): SandboxPresetInfo | null {
  const assumptions: string[] = [];
  let info: SandboxPresetInfo | null = null;
  switch (entry.type) {
    case 'star': {
      const mass = entry.massSolar?.value;
      if (!mass) return null;
      info = { bodies: replaceStarMass(initialConditions, SUN_ID, mass), centerId: SUN_ID, softeningAu: DEFAULT_SOFTENING_AU, timestepDays: SANDBOX_TIMESTEP_DAYS, note: 'starReplacement' };
      break;
    }
    case 'black_hole': {
      const mass = entry.massSolar?.value;
      if (!mass) return null;
      info = blackHoleInfo(mass);
      break;
    }
    case 'asteroid':
    case 'comet':
    case 'meteorite_event': {
      const radiusM = entry.diameterM ? entry.diameterM.value / 2 : entry.radiusKm ? entry.radiusKm.value * 1000 : null;
      if (!radiusM) return null;
      const density = entry.densityKgM3?.value ?? (entry.type === 'comet' ? 600 : 3000);
      if (!entry.densityKgM3) assumptions.push(`density ${density} kg/m³`);
      const velocityKmS = entry.impactVelocityKmS?.value ?? 20;
      if (!entry.impactVelocityKmS) assumptions.push(`impact speed ${velocityKmS} km/s`);
      info = impactInfo(radiusM, density, velocityKmS * 1000);
      break;
    }
    case 'exoplanet': {
      const a = entry.semiMajorAxisAu?.value;
      if (!a) return null;
      const host = entry.hostId ? catalog.find((candidate) => candidate.id === entry.hostId) : undefined;
      const hostMass = host?.massSolar?.value ?? 1;
      if (!host?.massSolar) assumptions.push('host star mass 1 M☉');
      info = twoBodyInfo(hostMass, entry.massEarth?.value, a);
      assumptions.push('circular orbit (eccentricity ignored)');
      break;
    }
    default:
      return null;
  }
  return { ...info, kind: 'catalog', title: entry.name, assumptions };
}

function presetInfo(preset: SandboxPreset): SandboxPresetInfo {
  switch (preset) {
    case 'stable-system':
      return { bodies: initialConditions.map(copyBody), centerId: SUN_ID, softeningAu: DEFAULT_SOFTENING_AU, timestepDays: SANDBOX_TIMESTEP_DAYS, note: 'stable' };
    case 'two-body':
      return { bodies: getBodies([SUN_ID, 'earth']), centerId: SUN_ID, softeningAu: DEFAULT_SOFTENING_AU, timestepDays: SANDBOX_TIMESTEP_DAYS, note: 'twoBody' };
    case 'asteroid-impact':
      return impactInfo(500, 3000, 25_000);
    case 'star-replacement':
      return {
        bodies: replaceStarMass(initialConditions, SUN_ID, 0.5),
        centerId: SUN_ID,
        softeningAu: DEFAULT_SOFTENING_AU,
        timestepDays: SANDBOX_TIMESTEP_DAYS,
        note: 'starReplacement',
      };
    case 'black-hole':
      return blackHoleInfo(1000);
    case 'empty-space':
      return { bodies: [], softeningAu: DEFAULT_SOFTENING_AU, timestepDays: SANDBOX_TIMESTEP_DAYS, note: 'empty' };
  }
}

function emptyState(): NBodyState {
  return { ids: [], gm: new Float64Array(), positions: new Float64Array(), velocities: new Float64Array() };
}

export type SandboxSnapshot = {
  elapsedDays: number;
  energyDriftPercent: number;
  angularMomentumDriftPercent: number;
  warnings: StabilityWarning[];
  energyAvailable: boolean;
  /** Set once the two watched bodies touched; the run is frozen from then on. */
  collision?: { elapsedDays: number; speedKmS: number };
};

const KM_S_PER_AU_DAY = AU_METRES / SECONDS_PER_DAY / 1000;

/** One independent, resettable sandbox world backed by the shared Verlet engine. */
export function createSandboxSimulation(preset: SandboxPreset, override?: SandboxPresetInfo) {
  const info = override ?? presetInfo(preset);
  const state = info.bodies.length > 0 ? createState(info.bodies) : emptyState();
  const initial = cloneState(state);
  const centerIndex = info.centerId ? state.ids.indexOf(info.centerId) : -1;
  const accumulator = createTimestepAccumulator(info.timestepDays);
  const baselineEnergy = state.ids.length ? totalEnergy(initial, info.softeningAu).total : 0;
  const baselineMomentum = state.ids.length ? angularMomentum(initial).magnitude : 0;
  let elapsedDays = 0;
  let collision: SandboxSnapshot['collision'];
  const watch = info.collision
    ? { a: state.ids.indexOf(info.collision.bodyA), b: state.ids.indexOf(info.collision.bodyB), limit: info.collision.distanceAu }
    : null;
  const watching = watch !== null && watch.a >= 0 && watch.b >= 0;

  function checkCollision(): void {
    if (!watching || collision) return;
    const { a, b, limit } = watch;
    const dx = (state.positions[a * 3] as number) - (state.positions[b * 3] as number);
    const dy = (state.positions[a * 3 + 1] as number) - (state.positions[b * 3 + 1] as number);
    const dz = (state.positions[a * 3 + 2] as number) - (state.positions[b * 3 + 2] as number);
    if (Math.hypot(dx, dy, dz) > limit) return;
    const vx = (state.velocities[a * 3] as number) - (state.velocities[b * 3] as number);
    const vy = (state.velocities[a * 3 + 1] as number) - (state.velocities[b * 3 + 1] as number);
    const vz = (state.velocities[a * 3 + 2] as number) - (state.velocities[b * 3 + 2] as number);
    collision = { elapsedDays, speedKmS: Math.hypot(vx, vy, vz) * KM_S_PER_AU_DAY };
  }

  function snapshot(): SandboxSnapshot {
    const energyAvailable = state.ids.length > 1;
    const energyNow = state.ids.length ? totalEnergy(state, info.softeningAu).total : 0;
    const momentumNow = state.ids.length ? angularMomentum(state).magnitude : 0;
    const kinematics = centerIndex >= 0 ? kinematicsRelativeTo(state, centerIndex) : [];
    return {
      elapsedDays,
      energyDriftPercent: energyAvailable ? driftPercent(energyNow, baselineEnergy) : 0,
      angularMomentumDriftPercent: energyAvailable ? driftPercent(momentumNow, baselineMomentum) : 0,
      warnings: evaluateStability(kinematics),
      energyAvailable,
      ...(collision ? { collision } : {}),
    };
  }

  return {
    state,
    initial,
    info,
    advance(deltaSeconds: number, speed: SandboxSpeed): number {
      return accumulator.advance(deltaSeconds * (info.daysPerSecond ?? DEFAULT_DAYS_PER_SECOND) * speed, MAX_STEPS_PER_FRAME, () => {
        if (collision) return;
        if (state.ids.length > 0) stepVelocityVerlet(state, info.timestepDays, info.softeningAu);
        elapsedDays += info.timestepDays;
        checkCollision();
      });
    },
    reset(): void {
      if (state.ids.length > 0) {
        state.gm.set(initial.gm);
        state.positions.set(initial.positions);
        state.velocities.set(initial.velocities);
      }
      elapsedDays = 0;
      collision = undefined;
      accumulator.reset();
    },
    snapshot,
  };
}

export type CustomBodySpec = {
  name: string;
  massSolar: number;
  xAu: number;
  yAu: number;
  /** Velocity in km/s. */
  vxKmS: number;
  vyKmS: number;
};

/** Speed of a circular orbit at `distanceAu` around `centralMassSolar`, in km/s. */
export function circularSpeedKmS(centralMassSolar: number, distanceAu: number): number {
  if (!(centralMassSolar > 0) || !(distanceAu > 0)) return 0;
  return Math.sqrt(SOLAR_GM * centralMassSolar / distanceAu) * KM_S_PER_AU_DAY;
}

/**
 * Scenario from user-placed bodies. The time step and playback speed follow the
 * shortest orbital time among the bodies, so a tight pair and a wide pair both
 * play at a visible pace. Throws PhysicsInputError (from createState) on bad input.
 */
export function customScenario(specs: readonly CustomBodySpec[]): SandboxPresetInfo {
  const bodies: BodyDefinition[] = specs.map((spec) => ({
    id: spec.name,
    gm: SOLAR_GM * spec.massSolar,
    position: [spec.xAu, spec.yAu, 0],
    velocity: [spec.vxKmS / KM_S_PER_AU_DAY, spec.vyKmS / KM_S_PER_AU_DAY, 0],
  }));
  createState(bodies); // validates ranges, names and uniqueness
  const totalGm = bodies.reduce((sum, body) => sum + body.gm, 0);
  const first = bodies[0];
  let shortest = Infinity;
  let minDistance = Infinity;
  for (const body of bodies) {
    if (!first || body === first) continue;
    const r = Math.hypot(body.position[0] - first.position[0], body.position[1] - first.position[1]);
    if (r > 0) {
      shortest = Math.min(shortest, 2 * Math.PI * Math.sqrt(r ** 3 / totalGm));
      minDistance = Math.min(minDistance, r);
    }
  }
  if (!Number.isFinite(shortest)) shortest = 1;
  return {
    bodies,
    centerId: first?.id,
    softeningAu: Number.isFinite(minDistance) ? minDistance * 1e-6 : DEFAULT_SOFTENING_AU,
    timestepDays: clampStep(shortest / 400),
    daysPerSecond: shortest / 5,
    note: 'empty',
    kind: 'custom',
  };
}
