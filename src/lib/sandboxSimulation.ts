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
import { DEFAULT_SOFTENING_AU, createTimestepAccumulator, stepVelocityVerlet } from '@/physics/integrator';
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
const SIMULATION_DAYS_PER_SECOND = 2;
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

function presetInfo(preset: SandboxPreset): SandboxPresetInfo {
  switch (preset) {
    case 'stable-system':
      return { bodies: initialConditions.map(copyBody), centerId: SUN_ID, softeningAu: DEFAULT_SOFTENING_AU, timestepDays: SANDBOX_TIMESTEP_DAYS, note: 'stable' };
    case 'two-body':
      return { bodies: getBodies([SUN_ID, 'earth']), centerId: SUN_ID, softeningAu: DEFAULT_SOFTENING_AU, timestepDays: SANDBOX_TIMESTEP_DAYS, note: 'twoBody' };
    case 'asteroid-impact': {
      const [sun, earth] = getBodies([SUN_ID, 'earth']);
      const earthFacts = solarSystem.find((body) => body.id === 'earth');
      if (!earthFacts?.radius) throw new Error('Earth radius is required for the impact preset');
      const radiusM = 500;
      const densityKgM3 = 3000;
      const impactVelocityMs = 25_000;
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
      return {
        bodies: [sun, earth, asteroid], centerId: SUN_ID, softeningAu: 1e-8, timestepDays: 1e-4, note: 'impact',
        impact: { energyJoules, tntMegatons: tntEquivalentMegatons(energyJoules), airburstRisk: airburst.risk },
      };
    }
    case 'star-replacement':
      return {
        bodies: replaceStarMass(initialConditions, SUN_ID, 0.5),
        centerId: SUN_ID,
        softeningAu: DEFAULT_SOFTENING_AU,
        timestepDays: SANDBOX_TIMESTEP_DAYS,
        note: 'starReplacement',
      };
    case 'black-hole': {
      // 1,000 solar masses keeps the displayed toy system within the N-body
      // engine's documented GM/speed limits while still being a massive BH.
      const massKg = (SOLAR_GM * GM_SI_PER_AU3_DAY2 / NEWTONIAN_GRAVITATIONAL_CONSTANT) * 1_000;
      const radiusM = schwarzschildRadiusM(massKg) * 12;
      const radiusAu = radiusM / AU_METRES;
      const gm = SOLAR_GM * 1_000;
      const planet: BodyDefinition = {
        id: 'test-particle',
        gm: SOLAR_GM * 1e-20,
        position: [radiusAu, 0, 0],
        velocity: [0, Math.sqrt(gm / radiusAu), 0],
      };
      return {
        bodies: [{ id: 'black-hole', gm, position: [0, 0, 0], velocity: [0, 0, 0] }, planet],
        centerId: 'black-hole',
        softeningAu: 1e-12,
        timestepDays: 1e-4,
        note: 'blackHole',
        blackHole: { massKg, radiusM, validity: assessNewtonianValidity(massKg, radiusM) },
      };
    }
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
};

/** One independent, resettable sandbox world backed by the shared Verlet engine. */
export function createSandboxSimulation(preset: SandboxPreset) {
  const info = presetInfo(preset);
  const state = info.bodies.length > 0 ? createState(info.bodies) : emptyState();
  const initial = cloneState(state);
  const centerIndex = info.centerId ? state.ids.indexOf(info.centerId) : -1;
  const accumulator = createTimestepAccumulator(info.timestepDays);
  const baselineEnergy = state.ids.length ? totalEnergy(initial, info.softeningAu).total : 0;
  const baselineMomentum = state.ids.length ? angularMomentum(initial).magnitude : 0;
  let elapsedDays = 0;

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
    };
  }

  return {
    state,
    initial,
    info,
    advance(deltaSeconds: number, speed: SandboxSpeed): number {
      return accumulator.advance(deltaSeconds * SIMULATION_DAYS_PER_SECOND * speed, MAX_STEPS_PER_FRAME, () => {
        if (state.ids.length > 0) stepVelocityVerlet(state, info.timestepDays, info.softeningAu);
        elapsedDays += info.timestepDays;
      });
    },
    reset(): void {
      if (state.ids.length > 0) {
        state.gm.set(initial.gm);
        state.positions.set(initial.positions);
        state.velocities.set(initial.velocities);
      }
      elapsedDays = 0;
      accumulator.reset();
    },
    snapshot,
  };
}
