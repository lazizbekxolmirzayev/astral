import {
  adcsById,
  batteryById,
  busById,
  commsById,
  computerById,
  instrumentById,
  launcherById,
  objectiveById,
  orbitById,
  powerById,
  propulsionById,
  TARGETS,
} from './data';
import {
  eclipseFraction,
  hohmannTransferDays,
  linkRateMbps,
  orbitalPeriodMinutes,
  propellantForDeltaV,
  solarArrayPowerW,
  synodicPeriodDays,
  TANK_FRACTION,
} from './physics';
import type { Analysis, Capability, Instrument, Issue, MissionDesign, Orbit, Target } from './types';

const DAYS_PER_MONTH = 30;
const INTEGRATION_FACTOR = 1.25;
/** Li-ion cells last far longer when only partly discharged each orbit. */
const BATTERY_DEPTH_OF_DISCHARGE = 0.4;
const BATTERY_REQUIRED_MARGIN = 1;
const WINDOW_WAIT_COST_PER_MONTH_M = 1;
const THIN_MARGIN_PCT = 10;
/** Share of an instrument's cost in schedule terms beyond the longest one. */
const EXTRA_INSTRUMENT_SCHEDULE = 0.25;
const BASE_INTEGRATION_MONTHS = 6;
const LOCAL_TRANSFER_DAYS: Partial<Record<Target['id'], number>> = { earth: 1, moon: 5 };
const MISSING_CAPABILITY_PENALTY = 0.4;
const SANDBOX_BUDGET_FACTOR = 100;
const SANDBOX_EXTRA_MONTHS = 600;

const percentOver = (available: number, used: number) => (used > 0 ? ((available - used) / used) * 100 : 100);

export function instrumentScience(instrument: Instrument, orbit: Orbit, priorities: Partial<Record<Capability, number>>): number {
  const weight = priorities[instrument.capability] ?? 0.3;
  const detail = instrument.capability === 'imaging' || instrument.capability === 'topography' ? orbit.detail : 1;
  return instrument.science * weight * detail * orbit.coverage;
}

export function transferDays(target: Target): number {
  return LOCAL_TRANSFER_DAYS[target.id] ?? hohmannTransferDays(1, target.sunDistanceAu);
}

/** Every number the dashboard shows, and every rule the design breaks. Pure. */
export function analyzeDesign(design: MissionDesign): Analysis {
  const baseObjective = objectiveById(design.objectiveId);
  const objective = design.sandbox
    ? { ...baseObjective, budgetM: baseObjective.budgetM * SANDBOX_BUDGET_FACTOR, launchDeadlineMonths: baseObjective.launchDeadlineMonths + SANDBOX_EXTRA_MONTHS }
    : baseObjective;
  const target = TARGETS[objective.target];
  const orbit = orbitById(design.orbitId);
  const launcher = launcherById(design.launcherId);
  const bus = busById(design.busId);
  const source = powerById(design.powerId);
  const battery = batteryById(design.batteryId);
  const comms = commsById(design.commsId);
  const computer = computerById(design.computerId);
  const adcs = adcsById(design.adcsId);
  const propulsion = propulsionById(design.propulsionId);
  const instruments = design.instrumentIds.map(instrumentById);
  const issues: Issue[] = [];

  // Mass. The launcher lifts everything; the spacecraft's own engine brakes it into orbit.
  const payloadKg = instruments.reduce((sum, item) => sum + item.massKg, 0);
  const baseDryKg = bus.massKg + source.massKg + battery.massKg + comms.massKg + computer.massKg + adcs.massKg + propulsion.massKg + payloadKg;
  const deltaVMs = orbit.insertionDeltaVMs + (orbit.stationKeepingMsPerYear * design.lifetimeMonths) / 12;
  const propellantKg = propellantForDeltaV(baseDryKg, deltaVMs, propulsion.ispS);
  const propellantFits = Number.isFinite(propellantKg);
  const dryKg = baseDryKg + (propellantFits ? propellantKg * TANK_FRACTION : 0);
  const wetKg = dryKg + (propellantFits ? propellantKg : 0);
  const launcherCapacityKg = launcher.capacityKg[orbit.launchClass] ?? 0;

  // Power. Sunlight must cover the load in daylight and recharge what the eclipse used.
  const semiMajorKm = target.radiusKm + (orbit.periapsisKm + orbit.apoapsisKm) / 2;
  const orbitMinutes = orbitalPeriodMinutes(semiMajorKm, target.muKm3S2);
  const shadow = orbit.noEclipse ? 0 : eclipseFraction(semiMajorKm, target.radiusKm);
  const generatedW = source.rtgW ?? solarArrayPowerW(source.arrayAreaM2 ?? 0, target.sunDistanceAu);
  const sunlitFraction = source.rtgW ? 1 : 1 - shadow;
  const averageW = generatedW * sunlitFraction;
  const contactShare = target.contactHoursPerDay / 24;
  const platformW = bus.powerW + computer.powerW + adcs.powerW + propulsion.powerW + comms.powerW * Math.max(0.1, contactShare);
  const instrumentW = instruments.reduce((sum, item) => sum + item.powerW, 0);
  const loadW = platformW + instrumentW;
  const eclipseMinutes = orbitMinutes * shadow;
  const batteryNeededWh = source.rtgW ? 0 : (loadW * eclipseMinutes * BATTERY_REQUIRED_MARGIN) / 60;
  const batteryUsableWh = battery.capacityWh * BATTERY_DEPTH_OF_DISCHARGE;
  const batteryFactor = batteryNeededWh > 0 ? Math.min(1, batteryUsableWh / batteryNeededWh) : 1;

  // Data. What the instruments make must fit through the radio link.
  const generatedGbPerDay = instruments.reduce((sum, item) => sum + item.dataGbPerDay, 0);
  const rateMbps = Math.min(comms.maxRateMbps, linkRateMbps(comms.transmitW, comms.dishDiameterM, orbit.commsRangeKm, target.groundDishM, target.systemNoiseK));
  const downlinkGbPerDay = (rateMbps * 3600 * target.contactHoursPerDay) / 1000;

  // Time. Planets only line up for departure once per synodic period.
  const longestInstrument = Math.max(0, ...instruments.map((item) => item.devMonths));
  const otherInstruments = instruments.reduce((sum, item) => sum + item.devMonths, 0) - longestInstrument;
  const developmentMonths = Math.ceil(BASE_INTEGRATION_MONTHS + bus.devMonths + longestInstrument + otherInstruments * EXTRA_INSTRUMENT_SCHEDULE);
  const hasWindows = target.sunDistanceAu !== 1;
  const windowMonths = hasWindows ? synodicPeriodDays(1, target.sunDistanceAu) / DAYS_PER_MONTH : 0;
  const launchMonth = hasWindows ? Math.ceil(developmentMonths / windowMonths) * windowMonths : developmentMonths;
  const windowWaitMonths = launchMonth - developmentMonths;

  // Budget.
  const partsCostM = bus.costM + source.costM + battery.costM + comms.costM + computer.costM + adcs.costM + propulsion.costM + instruments.reduce((sum, item) => sum + item.costM, 0);
  const developmentM = partsCostM * INTEGRATION_FACTOR;
  const operationsM = target.opsCostPerMonthM * (design.lifetimeMonths + transferDays(target) / DAYS_PER_MONTH);
  const waitM = windowWaitMonths * WINDOW_WAIT_COST_PER_MONTH_M;
  const totalM = developmentM + launcher.costM + operationsM + waitM;

  // Science.
  const potentialRaw = instruments.reduce((sum, item) => sum + instrumentScience(item, orbit, objective.priorities), 0);
  const capabilities = new Set(instruments.map((item) => item.capability));
  const missingCapabilities = objective.required.filter((capability) => !capabilities.has(capability));
  const potential = potentialRaw * (missingCapabilities.length > 0 ? MISSING_CAPABILITY_PENALTY : 1);

  const massMarginPct = percentOver(launcherCapacityKg, wetKg);
  const powerMarginPct = percentOver(averageW, loadW);
  const budgetMarginPct = ((objective.budgetM - totalM) / objective.budgetM) * 100;

  const add = (id: string, severity: Issue['severity'], resource: Issue['resource'], params: Issue['params'] = {}) => issues.push({ id, severity, resource, params });

  if (instruments.length === 0) add('noInstruments', 'blocker', 'science');
  if (payloadKg > bus.payloadCapacityKg) add('busPayload', 'blocker', 'mass', { used: Math.round(payloadKg), limit: bus.payloadCapacityKg });
  if (!propellantFits) add('propellantImpossible', 'blocker', 'mass', { deltaV: Math.round(deltaVMs), isp: propulsion.ispS });
  else if (propellantKg > bus.tankCapacityKg) add('tankOverflow', 'blocker', 'mass', { used: Math.round(propellantKg), limit: bus.tankCapacityKg });
  if (launcherCapacityKg === 0) add('launcherCannotReach', 'blocker', 'mass');
  else if (propellantFits && wetKg > launcherCapacityKg) add('launcherOverweight', 'blocker', 'mass', { used: Math.round(wetKg), limit: launcherCapacityKg });
  if (totalM > objective.budgetM) add('overBudget', 'blocker', 'budget', { used: Math.round(totalM), limit: objective.budgetM });
  if (launchMonth > objective.launchDeadlineMonths) add('lateLaunch', 'blocker', 'time', { used: Math.round(launchMonth), limit: objective.launchDeadlineMonths });
  if (adcs.earthOnly && target.id !== 'earth') add('magneticAwayFromEarth', 'blocker', 'power');
  if (!adcs.finePointing && instruments.some((item) => item.needsFinePointing)) add('needsFinePointing', 'blocker', 'science');
  if (design.lifetimeMonths < objective.minLifetimeMonths) add('shortLifetime', 'blocker', 'time', { used: design.lifetimeMonths, limit: objective.minLifetimeMonths });

  if (missingCapabilities.length > 0) add('missingCapability', 'warning', 'science', { missing: missingCapabilities.join(', ') });
  if (averageW < loadW) add('powerDeficit', 'warning', 'power', { used: Math.round(loadW), limit: Math.round(averageW) });
  else if (powerMarginPct < THIN_MARGIN_PCT) add('thinPower', 'warning', 'power', { margin: Math.round(powerMarginPct) });
  if (batteryFactor < 1) add('batteryShort', 'warning', 'power', { used: Math.round(batteryNeededWh), limit: Math.round(batteryUsableWh) });
  if (generatedGbPerDay > downlinkGbPerDay) add('downlinkShort', 'warning', 'data', { used: Number(generatedGbPerDay.toFixed(1)), limit: Number(downlinkGbPerDay.toFixed(2)) });
  if (computer.radiationTolerance < orbit.radiation) add('radiationExposure', 'warning', 'time', { tolerance: Math.round(computer.radiationTolerance * 100), radiation: Math.round(orbit.radiation * 100) });
  if (potential < objective.requiredScience) add('lowScience', 'warning', 'science', { used: Math.round(potential), limit: objective.requiredScience });

  return {
    mass: { payloadKg, busPayloadCapacityKg: bus.payloadCapacityKg, dryKg, propellantKg, tankCapacityKg: bus.tankCapacityKg, wetKg, launcherCapacityKg, marginPct: massMarginPct, deltaVMs },
    power: { generatedW, averageW, platformW, instrumentW, loadW, marginPct: powerMarginPct, batteryNeededWh, batteryUsableWh, batteryFactor, eclipseMinutes, orbitMinutes, sunlitFraction },
    budget: { developmentM, launchM: launcher.costM, operationsM, waitM, totalM, capM: objective.budgetM, marginPct: budgetMarginPct },
    data: { generatedGbPerDay, downlinkGbPerDay, rateMbps, contactHoursPerDay: target.contactHoursPerDay, storageGb: computer.storageGb },
    time: { developmentMonths, launchMonth, windowWaitMonths, transferDays: transferDays(target), lifetimeMonths: design.lifetimeMonths, minLifetimeMonths: objective.minLifetimeMonths, deadlineMonths: objective.launchDeadlineMonths },
    science: { potential, required: objective.requiredScience, missingCapabilities },
    issues,
  };
}

export const hasBlockers = (analysis: Analysis) => analysis.issues.some((issue) => issue.severity === 'blocker');
