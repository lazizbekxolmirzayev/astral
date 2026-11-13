import { DEFAULT_CATALOG, type CatalogLookup } from '../catalog';
import { BODIES } from '../constants';
import { evaluateMission, type Evaluation } from '../engine';
import { createAssumptionReader } from '../engine/assumptions';
import { describeOrbit } from '../engine/orbit';
import type { EngineIssueCode } from '../engine/issues';
import { L, type Localized } from '../i18n';
import type { DestinationId } from '../models/catalog';
import type { Mission } from '../models/mission';
import { toBase, valueIn } from '../units';
import { SIM_ASSUMPTIONS } from './assumptions';
import { generateEvents } from './events';
import { streamRng } from './rng';
import type { MissionClass, ScheduledEvent, StageId } from './types';

const DAY = 86_400;

export const MISSION_CLASS: Record<DestinationId, MissionClass> = { leo: 'earth-orbit', sso: 'earth-orbit', geo: 'geostationary', moon: 'lunar', mars: 'mars', helio: 'heliocentric' };

/** Stage list per class: an Earth-orbit mission has no cruise or arrival, every other class does. */
export const STAGES_OF_CLASS: Record<MissionClass, readonly StageId[]> = {
  'earth-orbit': ['pre-launch', 'launch', 'orbit-insertion', 'science-operations', 'data-transmission', 'mission-completion'],
  geostationary: ['pre-launch', 'launch', 'orbit-insertion', 'cruise', 'destination-arrival', 'science-operations', 'data-transmission', 'mission-completion'],
  lunar: ['pre-launch', 'launch', 'orbit-insertion', 'cruise', 'destination-arrival', 'science-operations', 'data-transmission', 'mission-completion'],
  mars: ['pre-launch', 'launch', 'orbit-insertion', 'cruise', 'destination-arrival', 'science-operations', 'data-transmission', 'mission-completion'],
  heliocentric: ['pre-launch', 'launch', 'orbit-insertion', 'cruise', 'destination-arrival', 'science-operations', 'data-transmission', 'mission-completion'],
};

/** Engine issues that stop the launch on the pad. Every other problem is flown and its consequence simulated. */
export const LAUNCH_BLOCKING_ISSUES: readonly EngineIssueCode[] = ['mass-over-launcher-capacity', 'launcher-not-at-site'];

export type PlanInstrument = {
  instrumentId: string;
  name: Localized;
  quantity: number;
  /** Power while observing, W. */
  powerW: number;
  dutyCycle: number;
  /** Data added to the onboard queue while observing, bit/s; 0 for relay instruments. */
  dataRateBps: number;
  relay: boolean;
  scienceValue: number;
  pointingOk: boolean;
};

export type SimPlan = {
  mission: Mission;
  missionId: string;
  title: string;
  seed: number;
  destinationId: DestinationId;
  missionClass: MissionClass;
  evaluation: Evaluation;
  launcherName: Localized;
  siteName: Localized;
  /** Latitude of the launch site, radians (the ascent starts there). */
  siteLatitudeRad: number;
  /** Set when the design cannot be resolved at all: the simulation cannot start. */
  unresolvable: Localized[] | null;
  stageIds: readonly StageId[];
  stagePlannedS: Partial<Record<StageId, number>>;
  /** Pre-launch hold reasons; empty when the vehicle may be launched. */
  blockers: Localized[];
  /** `pilot` is set when a person flew the ascent by hand: the flight, not the seeded draw, decides the launch. */
  launch: { reliability: number; draw: number; success: boolean; pilot?: { failure: 'ground' | 'stress' | 'fuel' | null; grade: 'perfect' | 'good' | 'rough' | null } };
  /** Departure energy C3 in km²/s² (the engine works in m²/s²). */
  departure: { requiredC3: number; providedC3: number } | null;
  dv: { available: number; insertion: number; corrections: number; stationkeeping: number; impulsiveImpossible: boolean };
  power: {
    bolW: number;
    eolW: number;
    degradationYearsS: number;
    baseLoadW: number;
    commsFullW: number;
    commsStandby: number;
    propulsionPeakW: number;
    batteryCapacityJ: number;
    chargeEfficiency: number;
    periodS: number;
    eclipseS: number;
  };
  link: { contactS: number; rateBps: number };
  storageBits: number;
  instruments: PlanInstrument[];
  ops: { plannedS: number; effectiveS: number; limit: 'planned' | 'design-life' | 'propellant'; startS: number; effectiveEndS: number };
  events: ScheduledEvent[];
  geometry: { periodS: number; operationalOrbitSpeedMps: number };
};

function missionPlan(evaluation: Evaluation, mission: Mission, catalog: CatalogLookup): SimPlan | null {
  const details = evaluation.details;
  if (!details) return null;
  const destination = catalog.getDestination(mission.objective.destinationId)!;
  const launcher = catalog.getLauncher(mission.launch.vehicleId)!;
  const assume = createAssumptionReader();
  const missionClass = MISSION_CLASS[destination.id];
  const stageIds = STAGES_OF_CLASS[missionClass];
  const hasCruise = stageIds.includes('cruise');
  const cruiseS = hasCruise ? toBase(destination.cruiseDuration) : 0;

  const insertionS = missionClass === 'earth-orbit' ? SIM_ASSUMPTIONS.earthInsertionS : SIM_ASSUMPTIONS.departureInjectionS;
  const plannedOpsS = mission.plannedOperationsDays * DAY;

  // --- resolved parts, for per-instrument behaviour (names, power, data rate) ---
  const instrumentRows = mission.spacecraft.parts;
  const instruments: PlanInstrument[] = [];
  for (const selection of instrumentRows) {
    const part = catalog.getPart(selection.itemId);
    if (part?.category !== 'instrument') continue;
    const science = details.science.perInstrument.find((row) => row.instrumentId === part.id);
    const relay = part.dataHandling === 'relay';
    instruments.push({
      instrumentId: part.id,
      name: part.name,
      quantity: selection.quantity,
      powerW: toBase(part.powerDraw) * selection.quantity,
      dutyCycle: toBase(part.dutyCycle),
      dataRateBps: relay ? 0 : toBase(part.dataRate) * selection.quantity,
      relay,
      scienceValue: toBase(part.scienceValue) * selection.quantity,
      pointingOk: science?.pointingOk ?? false,
    });
  }

  // --- Δv ---
  const step = (id: 'orbit-insertion' | 'trajectory-corrections' | 'stationkeeping') => details.deltaV.steps.find((row) => row.id === id)?.value.value ?? 0;
  const dv = { available: details.deltaV.available.value, insertion: step('orbit-insertion'), corrections: step('trajectory-corrections'), stationkeeping: step('stationkeeping'), impulsiveImpossible: details.deltaV.impulsiveBurnsImpossible };
  const dvAfterArrival = dv.available - dv.insertion - dv.corrections;
  const dvLimit = dv.stationkeeping <= 0 ? 1 : Math.max(0, Math.min(1, dvAfterArrival / dv.stationkeeping));

  // --- operations length: planned, shortened by design life or by the propellant left for stationkeeping ---
  const designLifeS = toBase(design(catalog, mission).designLife);
  const designLimitS = Math.max(0, designLifeS - cruiseS);
  const propellantLimitS = plannedOpsS * dvLimit;
  let effectiveS = plannedOpsS;
  let limit: 'planned' | 'design-life' | 'propellant' = 'planned';
  if (designLimitS < effectiveS) { effectiveS = designLimitS; limit = 'design-life'; }
  if (propellantLimitS < effectiveS) { effectiveS = propellantLimitS; limit = 'propellant'; }

  const stagePlannedS: Partial<Record<StageId, number>> = {
    'pre-launch': SIM_ASSUMPTIONS.countdownS,
    launch: SIM_ASSUMPTIONS.ascentS,
    'orbit-insertion': insertionS,
    ...(hasCruise ? { cruise: cruiseS, 'destination-arrival': SIM_ASSUMPTIONS.captureS } : {}),
    'science-operations': plannedOpsS,
    'data-transmission': SIM_ASSUMPTIONS.finalDownlinkMaxDays * DAY,
    'mission-completion': 0,
  };
  let startS = 0;
  for (const id of stageIds) {
    if (id === 'science-operations') break;
    startS += stagePlannedS[id] ?? 0;
  }

  // --- blockers ---
  const blockers: Localized[] = evaluation.issues.filter((issue) => LAUNCH_BLOCKING_ISSUES.includes(issue.code)).map((issue) => issue.message);

  // --- power ---
  const standby = assume.value('comms-standby-fraction');
  const loads = details.power.loads;
  const sum = (kind: (typeof loads)[number]['kind']) => loads.filter((load) => load.kind === kind).reduce((total, load) => total + load.peakW, 0);
  const baseLoadW = sum('bus') + sum('obc') + sum('adcs');
  const years = details.power.degradationYears;
  const bol = details.power.generationBol.value;
  const eol = details.power.generationEol.value;

  const geometry = describeOrbit(destination.centralBody, mission.orbit);
  const body = BODIES[destination.centralBody];
  const gm = toBase(body.gm);
  const operationalOrbitSpeedMps = Math.sqrt(gm / geometry.semiMajorAxis);

  const draw = streamRng(mission.seed, 'launch')();
  const reliability = toBase(launcher.reliability);

  const departure = details.deltaV.departureC3 ? { requiredC3: details.deltaV.departureC3.required.value / 1e6, providedC3: details.deltaV.departureC3.provided.value / 1e6 } : null;

  const events = generateEvents({ seed: mission.seed, opsStartS: startS, opsEndS: startS + effectiveS, instrumentCount: instruments.length, hasArrays: bol > 0 });

  return {
    mission,
    missionId: mission.id,
    title: mission.title,
    seed: mission.seed,
    destinationId: destination.id,
    missionClass,
    evaluation,
    launcherName: launcher.name,
    siteName: catalog.getLaunchSite(mission.launch.siteId)!.name,
    siteLatitudeRad: (valueIn(catalog.getLaunchSite(mission.launch.siteId)!.latitude, 'deg') * Math.PI) / 180,
    unresolvable: null,
    stageIds,
    stagePlannedS,
    blockers,
    launch: { reliability, draw, success: draw < reliability },
    departure,
    dv,
    power: {
      bolW: bol,
      eolW: eol,
      degradationYearsS: Math.max(1, years) * valueIn({ value: 1, unit: 'yr' }, 's'),
      baseLoadW,
      commsFullW: sum('comms'),
      commsStandby: standby,
      propulsionPeakW: sum('propulsion'),
      batteryCapacityJ: details.power.batteryUsable.value,
      chargeEfficiency: assume.value('battery-round-trip-efficiency'),
      periodS: details.power.orbitPeriod.value,
      eclipseS: details.power.eclipseDuration.value,
    },
    link: { contactS: details.link.contactTime.value, rateBps: details.link.usableRate.value },
    storageBits: details.data.storage.value,
    instruments,
    ops: { plannedS: plannedOpsS, effectiveS, limit, startS, effectiveEndS: startS + effectiveS },
    events,
    geometry: { periodS: geometry.period, operationalOrbitSpeedMps },
  };
}

function design(catalog: CatalogLookup, mission: Mission) {
  const bus = catalog.getPart(mission.spacecraft.busId);
  if (bus?.category !== 'bus') throw new Error('bus expected');
  return bus;
}

/**
 * Turns a mission document into a simulation plan: the resource engine's evaluation
 * plus the stage list, the seeded launch draw and event schedule. Pure. A design the
 * engine cannot resolve returns a plan with `unresolvable` set, which cannot be started.
 */
export function buildSimPlan(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): SimPlan {
  const evaluation = evaluateMission(mission, catalog);
  const plan = missionPlan(evaluation, mission, catalog);
  if (plan) return plan;
  const reasons = evaluation.referenceIssues.map((issue) => L(`Catalog problem: ${issue.message}`, `Katalog muammosi: ${issue.message}`));
  return {
    mission,
    missionId: mission.id,
    title: mission.title,
    seed: mission.seed,
    destinationId: mission.objective.destinationId,
    missionClass: MISSION_CLASS[mission.objective.destinationId],
    evaluation,
    launcherName: L('(unknown launcher)', "(noma'lum raketa)"),
    siteName: L('(unknown site)', "(noma'lum joy)"),
    siteLatitudeRad: 0,
    unresolvable: reasons.length > 0 ? reasons : [L('The design cannot be resolved.', "Dizaynni aniqlab bo'lmadi.")],
    stageIds: STAGES_OF_CLASS[MISSION_CLASS[mission.objective.destinationId]],
    stagePlannedS: {},
    blockers: [],
    launch: { reliability: 0, draw: 0, success: false },
    departure: null,
    dv: { available: 0, insertion: 0, corrections: 0, stationkeeping: 0, impulsiveImpossible: false },
    power: { bolW: 0, eolW: 0, degradationYearsS: 1, baseLoadW: 0, commsFullW: 0, commsStandby: 0, propulsionPeakW: 0, batteryCapacityJ: 0, chargeEfficiency: 1, periodS: 1, eclipseS: 0 },
    link: { contactS: 0, rateBps: 0 },
    storageBits: 0,
    instruments: [],
    ops: { plannedS: 0, effectiveS: 0, limit: 'planned', startS: 0, effectiveEndS: 0 },
    events: [],
    geometry: { periodS: 1, operationalOrbitSpeedMps: 0 },
  };
}
