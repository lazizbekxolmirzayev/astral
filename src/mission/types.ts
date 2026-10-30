export type TargetId = 'earth' | 'moon' | 'mars' | 'jupiter';

export type Capability = 'imaging' | 'spectroscopy' | 'radar' | 'fields' | 'particles' | 'thermal' | 'topography';

/** How much a launcher can send to each kind of destination. */
export type LaunchClass = 'leo' | 'sso' | 'gto' | 'tli' | 'tmi' | 'tjo';

export type Target = {
  id: TargetId;
  radiusKm: number;
  muKm3S2: number;
  /** Mean distance from the Sun. */
  sunDistanceAu: number;
  groundDishM: number;
  systemNoiseK: number;
  contactHoursPerDay: number;
  opsCostPerMonthM: number;
  color: string;
};

export type Objective = {
  id: string;
  target: TargetId;
  difficulty: 1 | 2 | 3 | 4;
  budgetM: number;
  minLifetimeMonths: number;
  launchDeadlineMonths: number;
  requiredScience: number;
  required: readonly Capability[];
  priorities: Partial<Record<Capability, number>>;
};

export type Orbit = {
  id: string;
  target: TargetId;
  periapsisKm: number;
  apoapsisKm: number;
  launchClass: LaunchClass;
  /** Performed by the spacecraft after the launcher separates. */
  insertionDeltaVMs: number;
  stationKeepingMsPerYear: number;
  /** Earth–spacecraft distance used by the link budget. */
  commsRangeKm: number;
  /** Share of the target this orbit can observe, 0–1. */
  coverage: number;
  /** Scales imaging and topography: closer orbits see finer detail. */
  detail: number;
  /** Electronics stress, 0–1. */
  radiation: number;
  /** Long polar orbits are planned to stay out of the planet's shadow. */
  noEclipse?: boolean;
};

export type Launcher = {
  id: string;
  costM: number;
  reliability: number;
  capacityKg: Partial<Record<LaunchClass, number>>;
};

type Part = {
  id: string;
  massKg: number;
  powerW: number;
  costM: number;
};

export type Bus = Part & { payloadCapacityKg: number; tankCapacityKg: number; devMonths: number };
export type PowerSource = Part & { arrayAreaM2?: number; rtgW?: number };
export type Battery = Part & { capacityWh: number };
export type Comms = Part & { transmitW: number; dishDiameterM: number; maxRateMbps: number };
export type Computer = Part & { radiationTolerance: number; storageGb: number };
export type Adcs = Part & { finePointing: boolean; redundant: boolean; earthOnly: boolean };
export type Propulsion = Part & { ispS: number };
export type Instrument = Part & {
  capability: Capability;
  dataGbPerDay: number;
  science: number;
  devMonths: number;
  needsFinePointing: boolean;
};

export type MissionDesign = {
  objectiveId: string;
  busId: string;
  powerId: string;
  batteryId: string;
  commsId: string;
  computerId: string;
  adcsId: string;
  propulsionId: string;
  instrumentIds: readonly string[];
  orbitId: string;
  launcherId: string;
  lifetimeMonths: number;
  /** Free experiment: no budget or schedule limit, and no ranking. */
  sandbox?: boolean;
};

export type ResourceId = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'time' | 'science';

export type Issue = {
  id: string;
  severity: 'blocker' | 'warning';
  resource: ResourceId;
  params: Record<string, number | string>;
};

export type Analysis = {
  mass: {
    payloadKg: number;
    busPayloadCapacityKg: number;
    dryKg: number;
    propellantKg: number;
    tankCapacityKg: number;
    wetKg: number;
    launcherCapacityKg: number;
    marginPct: number;
    deltaVMs: number;
  };
  power: {
    generatedW: number;
    averageW: number;
    platformW: number;
    instrumentW: number;
    loadW: number;
    marginPct: number;
    batteryNeededWh: number;
    batteryUsableWh: number;
    batteryFactor: number;
    eclipseMinutes: number;
    orbitMinutes: number;
    sunlitFraction: number;
  };
  budget: {
    developmentM: number;
    launchM: number;
    operationsM: number;
    waitM: number;
    totalM: number;
    capM: number;
    marginPct: number;
  };
  data: {
    generatedGbPerDay: number;
    downlinkGbPerDay: number;
    rateMbps: number;
    contactHoursPerDay: number;
    storageGb: number;
  };
  time: {
    developmentMonths: number;
    launchMonth: number;
    windowWaitMonths: number;
    transferDays: number;
    lifetimeMonths: number;
    minLifetimeMonths: number;
    deadlineMonths: number;
  };
  science: {
    potential: number;
    required: number;
    missingCapabilities: readonly Capability[];
  };
  issues: readonly Issue[];
};

export type FlightPhase = 'launch' | 'cruise' | 'operations' | 'ended';

export type FlightEventId =
  | 'liftoff'
  | 'launchFailure'
  | 'separation'
  | 'insertion'
  | 'insertionFailure'
  | 'solarFlare'
  | 'micrometeoroid'
  | 'wheelFailure'
  | 'wheelFailover'
  | 'groundOutage'
  | 'transmitterFade'
  | 'instrumentFault'
  | 'radiationKill'
  | 'powerCollapse'
  | 'missionComplete';

export type FlightEvent = {
  day: number;
  id: FlightEventId;
  params: Record<string, number | string>;
};

export type FlightFrame = {
  day: number;
  phase: FlightPhase;
  powerAvailableW: number;
  loadW: number;
  duty: number;
  bufferGb: number;
  returnedGb: number;
  healthPct: number;
};

export type Outcome = 'full' | 'partial' | 'failed';

export type EndCause = 'completed' | 'launchFailure' | 'insertionFailure' | 'radiationKill' | 'powerCollapse';

export type FlightResult = {
  seed: number;
  outcome: Outcome;
  endCause: EndCause;
  frames: readonly FlightFrame[];
  events: readonly FlightEvent[];
  operationsDays: number;
  plannedDays: number;
  generatedGb: number;
  returnedGb: number;
  lostGb: number;
  meanDuty: number;
  scienceValue: number;
};

export type Insight = {
  id: string;
  tone: 'good' | 'bad' | 'info';
  params: Record<string, number | string>;
};

export type RoleId = 'director' | 'engineer' | 'scientist' | 'operator';

export type RoleGoal = {
  role: RoleId;
  met: boolean;
  params: Record<string, number | string>;
};

export type Score = {
  total: number;
  success: number;
  science: number;
  budget: number;
  robustness: number;
  teamBonus: number;
  goals: readonly RoleGoal[];
  insights: readonly Insight[];
};
