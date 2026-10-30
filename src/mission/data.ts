import type {
  Adcs,
  Battery,
  Bus,
  Comms,
  Computer,
  Instrument,
  Launcher,
  MissionDesign,
  Objective,
  Orbit,
  PowerSource,
  Propulsion,
  Target,
  TargetId,
} from './types';

/**
 * Game values, simplified from public mission and launcher figures. Body
 * constants and launcher capacities are approximate real numbers; part masses,
 * costs and science scores are balanced for play and are not real quotes.
 */
export const TARGETS: Record<TargetId, Target> = {
  earth: { id: 'earth', radiusKm: 6371, muKm3S2: 398_600, sunDistanceAu: 1, groundDishM: 11, systemNoiseK: 150, contactHoursPerDay: 0.8, opsCostPerMonthM: 0.4, color: '#3f8fd6' },
  moon: { id: 'moon', radiusKm: 1737, muKm3S2: 4_903, sunDistanceAu: 1, groundDishM: 18, systemNoiseK: 80, contactHoursPerDay: 10, opsCostPerMonthM: 0.6, color: '#a9a39a' },
  mars: { id: 'mars', radiusKm: 3390, muKm3S2: 42_828, sunDistanceAu: 1.524, groundDishM: 34, systemNoiseK: 30, contactHoursPerDay: 8, opsCostPerMonthM: 1.4, color: '#c8623a' },
  jupiter: { id: 'jupiter', radiusKm: 69_911, muKm3S2: 126_687_000, sunDistanceAu: 5.203, groundDishM: 34, systemNoiseK: 30, contactHoursPerDay: 6, opsCostPerMonthM: 2, color: '#c9a77c' },
};

export const OBJECTIVES: readonly Objective[] = [
  { id: 'earth-climate', target: 'earth', difficulty: 1, budgetM: 300, minLifetimeMonths: 24, launchDeadlineMonths: 48, requiredScience: 30, required: ['imaging'], priorities: { imaging: 1.2, thermal: 1.2, spectroscopy: 1, radar: 0.8, topography: 0.6 } },
  { id: 'moon-ice', target: 'moon', difficulty: 2, budgetM: 480, minLifetimeMonths: 12, launchDeadlineMonths: 48, requiredScience: 42, required: ['spectroscopy'], priorities: { spectroscopy: 1.4, radar: 1.2, topography: 1.2, thermal: 1, imaging: 0.8 } },
  { id: 'mars-water', target: 'mars', difficulty: 3, budgetM: 800, minLifetimeMonths: 24, launchDeadlineMonths: 66, requiredScience: 50, required: ['radar'], priorities: { radar: 1.5, spectroscopy: 1.2, imaging: 1, thermal: 0.8, topography: 0.8 } },
  { id: 'jupiter-magnetosphere', target: 'jupiter', difficulty: 4, budgetM: 1100, minLifetimeMonths: 18, launchDeadlineMonths: 84, requiredScience: 30, required: ['fields', 'particles'], priorities: { fields: 1.6, particles: 1.6, thermal: 0.8, imaging: 0.7, spectroscopy: 0.7 } },
];

export const ORBITS: readonly Orbit[] = [
  { id: 'leo-sso', target: 'earth', periapsisKm: 700, apoapsisKm: 700, launchClass: 'sso', insertionDeltaVMs: 30, stationKeepingMsPerYear: 15, commsRangeKm: 1_500, coverage: 1, detail: 1, radiation: 0.2 },
  { id: 'leo-low', target: 'earth', periapsisKm: 450, apoapsisKm: 450, launchClass: 'leo', insertionDeltaVMs: 20, stationKeepingMsPerYear: 60, commsRangeKm: 1_200, coverage: 0.6, detail: 1.3, radiation: 0.15 },
  { id: 'geo', target: 'earth', periapsisKm: 35_786, apoapsisKm: 35_786, launchClass: 'gto', insertionDeltaVMs: 1_800, stationKeepingMsPerYear: 50, commsRangeKm: 37_000, coverage: 0.45, detail: 0.4, radiation: 0.4 },
  { id: 'llo-polar', target: 'moon', periapsisKm: 100, apoapsisKm: 100, launchClass: 'tli', insertionDeltaVMs: 850, stationKeepingMsPerYear: 60, commsRangeKm: 384_400, coverage: 1, detail: 1.1, radiation: 0.3 },
  { id: 'lunar-elliptic', target: 'moon', periapsisKm: 100, apoapsisKm: 8_000, launchClass: 'tli', insertionDeltaVMs: 600, stationKeepingMsPerYear: 20, commsRangeKm: 384_400, coverage: 0.65, detail: 0.8, radiation: 0.3 },
  { id: 'mars-low-polar', target: 'mars', periapsisKm: 400, apoapsisKm: 400, launchClass: 'tmi', insertionDeltaVMs: 2_000, stationKeepingMsPerYear: 25, commsRangeKm: 225_000_000, coverage: 1, detail: 1, radiation: 0.35 },
  { id: 'mars-elliptic', target: 'mars', periapsisKm: 300, apoapsisKm: 33_000, launchClass: 'tmi', insertionDeltaVMs: 1_000, stationKeepingMsPerYear: 10, commsRangeKm: 225_000_000, coverage: 0.55, detail: 0.7, radiation: 0.35 },
  { id: 'jupiter-polar', target: 'jupiter', periapsisKm: 4_200, apoapsisKm: 8_100_000, launchClass: 'tjo', insertionDeltaVMs: 1_400, stationKeepingMsPerYear: 5, commsRangeKm: 778_000_000, coverage: 1, detail: 1, radiation: 0.9, noEclipse: true },
  { id: 'jupiter-distant', target: 'jupiter', periapsisKm: 900_000, apoapsisKm: 19_000_000, launchClass: 'tjo', insertionDeltaVMs: 1_100, stationKeepingMsPerYear: 3, commsRangeKm: 778_000_000, coverage: 0.6, detail: 0.5, radiation: 0.55, noEclipse: true },
];

export const LAUNCHERS: readonly Launcher[] = [
  { id: 'electron', costM: 8, reliability: 0.92, capacityKg: { leo: 300, sso: 200 } },
  { id: 'alpha', costM: 15, reliability: 0.88, capacityKg: { leo: 1_030, sso: 630 } },
  { id: 'falcon-9', costM: 70, reliability: 0.99, capacityKg: { leo: 17_500, sso: 8_000, gto: 5_500, tli: 3_000, tmi: 1_500 } },
  { id: 'atlas-v', costM: 160, reliability: 0.99, capacityKg: { leo: 18_800, sso: 15_000, gto: 8_900, tli: 6_000, tmi: 3_800, tjo: 3_600 } },
  { id: 'falcon-heavy', costM: 178, reliability: 0.98, capacityKg: { leo: 63_800, sso: 40_000, gto: 26_700, tli: 18_000, tmi: 16_800, tjo: 6_000 } },
];

export const BUSES: readonly Bus[] = [
  { id: 'bus-small', massKg: 80, powerW: 30, costM: 25, payloadCapacityKg: 70, tankCapacityKg: 60, devMonths: 10 },
  { id: 'bus-medium', massKg: 350, powerW: 90, costM: 90, payloadCapacityKg: 260, tankCapacityKg: 1_000, devMonths: 16 },
  { id: 'bus-large', massKg: 900, powerW: 180, costM: 220, payloadCapacityKg: 700, tankCapacityKg: 2_600, devMonths: 24 },
];

export const POWER_SOURCES: readonly PowerSource[] = [
  { id: 'solar-2', massKg: 12, powerW: 0, costM: 6, arrayAreaM2: 2 },
  { id: 'solar-6', massKg: 36, powerW: 0, costM: 16, arrayAreaM2: 6 },
  { id: 'solar-16', massKg: 96, powerW: 0, costM: 40, arrayAreaM2: 16 },
  { id: 'solar-60', massKg: 340, powerW: 0, costM: 110, arrayAreaM2: 60 },
  { id: 'rtg', massKg: 45, powerW: 0, costM: 130, rtgW: 110 },
];

export const BATTERIES: readonly Battery[] = [
  { id: 'battery-small', massKg: 4, powerW: 0, costM: 1, capacityWh: 500 },
  { id: 'battery-medium', massKg: 14, powerW: 0, costM: 3, capacityWh: 2_000 },
  { id: 'battery-large', massKg: 42, powerW: 0, costM: 8, capacityWh: 6_000 },
];

export const COMMS_SYSTEMS: readonly Comms[] = [
  { id: 'comms-small', massKg: 5, powerW: 25, costM: 4, transmitW: 5, dishDiameterM: 0.3, maxRateMbps: 200 },
  { id: 'comms-medium', massKg: 22, powerW: 90, costM: 14, transmitW: 20, dishDiameterM: 1, maxRateMbps: 600 },
  { id: 'comms-large', massKg: 60, powerW: 200, costM: 45, transmitW: 60, dishDiameterM: 2.5, maxRateMbps: 1_000 },
  { id: 'comms-deep', massKg: 110, powerW: 300, costM: 70, transmitW: 100, dishDiameterM: 3, maxRateMbps: 1_000 },
];

export const COMPUTERS: readonly Computer[] = [
  { id: 'computer-basic', massKg: 2, powerW: 10, costM: 1, radiationTolerance: 0.3, storageGb: 64 },
  { id: 'computer-standard', massKg: 8, powerW: 25, costM: 6, radiationTolerance: 0.7, storageGb: 512 },
  { id: 'computer-hardened', massKg: 15, powerW: 35, costM: 18, radiationTolerance: 0.95, storageGb: 2_048 },
];

export const ADCS_SYSTEMS: readonly Adcs[] = [
  { id: 'adcs-magnetic', massKg: 3, powerW: 5, costM: 1, finePointing: false, redundant: false, earthOnly: true },
  { id: 'adcs-wheels', massKg: 25, powerW: 30, costM: 10, finePointing: true, redundant: false, earthOnly: false },
  { id: 'adcs-redundant', massKg: 45, powerW: 45, costM: 22, finePointing: true, redundant: true, earthOnly: false },
];

export const PROPULSION_SYSTEMS: readonly Propulsion[] = [
  { id: 'prop-cold', massKg: 8, powerW: 5, costM: 3, ispS: 70 },
  { id: 'prop-mono', massKg: 25, powerW: 10, costM: 8, ispS: 220 },
  { id: 'prop-biprop', massKg: 70, powerW: 15, costM: 25, ispS: 320 },
];

export const INSTRUMENTS: readonly Instrument[] = [
  { id: 'camera-wide', massKg: 18, powerW: 25, costM: 20, capability: 'imaging', dataGbPerDay: 4, science: 12, devMonths: 6, needsFinePointing: false },
  { id: 'camera-hires', massKg: 65, powerW: 60, costM: 60, capability: 'imaging', dataGbPerDay: 30, science: 30, devMonths: 14, needsFinePointing: true },
  { id: 'spectrometer', massKg: 30, powerW: 35, costM: 35, capability: 'spectroscopy', dataGbPerDay: 6, science: 20, devMonths: 10, needsFinePointing: true },
  { id: 'radar', massKg: 120, powerW: 110, costM: 70, capability: 'radar', dataGbPerDay: 12, science: 28, devMonths: 16, needsFinePointing: false },
  { id: 'radiometer', massKg: 15, powerW: 15, costM: 15, capability: 'thermal', dataGbPerDay: 1, science: 12, devMonths: 6, needsFinePointing: false },
  { id: 'laser-altimeter', massKg: 30, powerW: 40, costM: 28, capability: 'topography', dataGbPerDay: 2, science: 16, devMonths: 10, needsFinePointing: true },
  { id: 'magnetometer', massKg: 6, powerW: 5, costM: 6, capability: 'fields', dataGbPerDay: 0.2, science: 8, devMonths: 4, needsFinePointing: false },
  { id: 'particle-detector', massKg: 12, powerW: 12, costM: 12, capability: 'particles', dataGbPerDay: 0.5, science: 10, devMonths: 6, needsFinePointing: false },
];

const byId = <T extends { id: string }>(items: readonly T[], id: string): T => {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown mission part: ${id}`);
  return item;
};

export const objectiveById = (id: string) => byId(OBJECTIVES, id);
export const orbitById = (id: string) => byId(ORBITS, id);
export const launcherById = (id: string) => byId(LAUNCHERS, id);
export const busById = (id: string) => byId(BUSES, id);
export const powerById = (id: string) => byId(POWER_SOURCES, id);
export const batteryById = (id: string) => byId(BATTERIES, id);
export const commsById = (id: string) => byId(COMMS_SYSTEMS, id);
export const computerById = (id: string) => byId(COMPUTERS, id);
export const adcsById = (id: string) => byId(ADCS_SYSTEMS, id);
export const propulsionById = (id: string) => byId(PROPULSION_SYSTEMS, id);
export const instrumentById = (id: string) => byId(INSTRUMENTS, id);

export const orbitsFor = (target: TargetId) => ORBITS.filter((orbit) => orbit.target === target);

/** A cheap, deliberately under-built start: the player must work out what to improve. */
export function startingDesign(objectiveId: string): MissionDesign {
  const objective = objectiveById(objectiveId);
  return {
    objectiveId,
    busId: 'bus-small',
    powerId: 'solar-2',
    batteryId: 'battery-small',
    commsId: 'comms-small',
    computerId: 'computer-basic',
    adcsId: 'adcs-wheels',
    propulsionId: 'prop-mono',
    instrumentIds: [],
    orbitId: orbitsFor(objective.target)[0]!.id,
    launcherId: 'falcon-9',
    lifetimeMonths: objective.minLifetimeMonths,
  };
}
