import { mulberry32 } from '@/lib/random';
import { analyzeDesign } from './analysis';
import { adcsById, computerById, instrumentById, launcherById, orbitById } from './data';
import type { EndCause, FlightEvent, FlightEventId, FlightFrame, FlightPhase, FlightResult, Instrument, MissionDesign, Outcome } from './types';

const DAYS_PER_MONTH = 30;
const CRUISE_FRAMES = 30;
const OPERATIONS_FRAMES = 210;
const INSERTION_RELIABILITY = 0.985;
const SOLAR_ARRAY_DECAY_PER_DAY = 0.00006;
const FLARE_RATE = 1 / 180;
const FLARE_OUTAGE_DAYS = 12;
const MICROMETEOROID_RATE = 1 / 900;
const MICROMETEOROID_ARRAY_LOSS = 0.93;
const WHEEL_RATE = 1 / 1100;
/** Attitude control degraded: fine-pointing instruments work this share of the time. */
const WHEEL_FAILURE_DUTY = 0.6;
const GROUND_OUTAGE_RATE = 1 / 200;
const GROUND_OUTAGE_DAYS = 5;
const INSTRUMENT_FAULT_RATE = 1 / 1500;
const TRANSMITTER_FADE_RATE = 1 / 1200;
/** Share of the downlink left after the transmitter amplifier ages. */
const TRANSMITTER_FADE_LEFT = 0.7;
const RADIATION_KILL_RATE = 0.002;
const POWER_COLLAPSE_SHARE = 0.6;
const POWER_COLLAPSE_DAYS = 30;
const PARTIAL_SUCCESS_SHARE = 0.6;
const MAX_DATA_RETURN_CREDIT = 1.5;

/** Runs the whole flight day by day. The same design and seed always fly the same way. */
export function simulateMission(design: MissionDesign, seed: number): FlightResult {
  const analysis = analyzeDesign(design);
  const random = mulberry32(seed);
  const launcher = launcherById(design.launcherId);
  const orbit = orbitById(design.orbitId);
  const computer = computerById(design.computerId);
  const adcs = adcsById(design.adcsId);
  const plannedDays = design.lifetimeMonths * DAYS_PER_MONTH;
  const cruiseDays = Math.round(analysis.time.transferDays);

  const events: FlightEvent[] = [{ day: 0, id: 'liftoff', params: {} }];
  const frames: FlightFrame[] = [];
  const addEvent = (day: number, id: FlightEventId, params: FlightEvent['params'] = {}) => events.push({ day, id, params });
  const frame = (day: number, phase: FlightPhase, fields: Partial<FlightFrame> = {}) => {
    frames.push({ day, phase, powerAvailableW: analysis.power.averageW, loadW: analysis.power.platformW, duty: 0, bufferGb: 0, returnedGb: 0, healthPct: 100, ...fields });
  };
  const finish = (endCause: EndCause, operationsDays: number, totals: { generatedGb: number; returnedGb: number; lostGb: number; dutySum: number }): FlightResult => {
    const minDays = analysis.time.minLifetimeMonths * DAYS_PER_MONTH;
    const nominalGb = analysis.data.generatedGbPerDay * minDays;
    const returnShare = nominalGb > 0 ? Math.min(MAX_DATA_RETURN_CREDIT, totals.returnedGb / nominalGb) : 0;
    // Onboard software sends the most valuable data first, so value grows slower than volume.
    const scienceValue = analysis.science.potential * Math.sqrt(returnShare);
    const lastedLongEnough = operationsDays >= minDays;
    const outcome: Outcome = scienceValue >= analysis.science.required && lastedLongEnough
      ? 'full'
      : scienceValue >= analysis.science.required * PARTIAL_SUCCESS_SHARE
        ? 'partial'
        : 'failed';
    const meanDuty = operationsDays > 0 ? totals.dutySum / operationsDays : 0;
    return { seed, outcome, endCause, frames, events, operationsDays, plannedDays, generatedGb: totals.generatedGb, returnedGb: totals.returnedGb, lostGb: totals.lostGb, meanDuty, scienceValue };
  };
  const noTotals = { generatedGb: 0, returnedGb: 0, lostGb: 0, dutySum: 0 };

  frame(0, 'launch');
  if (random() > launcher.reliability) {
    addEvent(0, 'launchFailure');
    frame(0, 'ended', { healthPct: 0 });
    return finish('launchFailure', 0, noTotals);
  }
  addEvent(0, 'separation');
  const cruiseStep = Math.max(1, Math.ceil(cruiseDays / CRUISE_FRAMES));
  for (let day = cruiseStep; day < cruiseDays; day += cruiseStep) frame(day, 'cruise');

  if (random() > INSERTION_RELIABILITY) {
    addEvent(cruiseDays, 'insertionFailure');
    frame(cruiseDays, 'ended', { healthPct: 0 });
    return finish('insertionFailure', 0, noTotals);
  }
  addEvent(cruiseDays, 'insertion', { deltaV: Math.round(orbit.insertionDeltaVMs) });

  const instruments: Instrument[] = design.instrumentIds.map(instrumentById);
  let arrayFactor = 1;
  let wheelsDamaged = false;
  let safeUntil = -1;
  let groundDownUntil = -1;
  let transmitterFactor = 1;
  let starvedDays = 0;
  let bufferGb = 0;
  const totals = { generatedGb: 0, returnedGb: 0, lostGb: 0, dutySum: 0 };
  const opsStep = Math.max(1, Math.ceil(plannedDays / OPERATIONS_FRAMES));

  for (let opsDay = 1; opsDay <= plannedDays; opsDay += 1) {
    const day = cruiseDays + opsDay;

    if (random() < FLARE_RATE * (0.5 + orbit.radiation)) {
      const outage = Math.round(FLARE_OUTAGE_DAYS * (1 - computer.radiationTolerance));
      safeUntil = Math.max(safeUntil, opsDay + outage);
      addEvent(day, 'solarFlare', { days: outage });
    }
    if (random() < MICROMETEOROID_RATE) {
      arrayFactor *= MICROMETEOROID_ARRAY_LOSS;
      addEvent(day, 'micrometeoroid', { loss: Math.round((1 - MICROMETEOROID_ARRAY_LOSS) * 100) });
    }
    if (!wheelsDamaged && random() < WHEEL_RATE) {
      if (adcs.redundant) addEvent(day, 'wheelFailover');
      else {
        wheelsDamaged = true;
        addEvent(day, 'wheelFailure', { duty: Math.round(WHEEL_FAILURE_DUTY * 100) });
      }
    }
    if (random() < GROUND_OUTAGE_RATE) {
      groundDownUntil = opsDay + GROUND_OUTAGE_DAYS;
      addEvent(day, 'groundOutage', { days: GROUND_OUTAGE_DAYS });
    }
    if (transmitterFactor === 1 && random() < TRANSMITTER_FADE_RATE) {
      transmitterFactor = TRANSMITTER_FADE_LEFT;
      addEvent(day, 'transmitterFade', { left: Math.round(TRANSMITTER_FADE_LEFT * 100) });
    }
    if (instruments.length > 1 && random() < INSTRUMENT_FAULT_RATE) {
      const [lost] = instruments.splice(Math.floor(random() * instruments.length), 1);
      addEvent(day, 'instrumentFault', { instrument: lost!.id });
    }
    if (computer.radiationTolerance < orbit.radiation && random() < (orbit.radiation - computer.radiationTolerance) * RADIATION_KILL_RATE) {
      addEvent(day, 'radiationKill');
      frame(day, 'ended', { healthPct: 0, bufferGb, returnedGb: totals.returnedGb });
      return finish('radiationKill', opsDay, totals);
    }

    const decay = analysis.power.generatedW > 0 && analysis.power.sunlitFraction < 1 ? 1 - SOLAR_ARRAY_DECAY_PER_DAY * opsDay : 1;
    const powerAvailableW = analysis.power.averageW * arrayFactor * decay;
    const { platformW, batteryFactor, sunlitFraction } = analysis.power;
    const instrumentW = instruments.reduce((sum, item) => sum + item.powerW, 0);

    if (powerAvailableW < platformW * POWER_COLLAPSE_SHARE) starvedDays += 1;
    else starvedDays = 0;
    if (starvedDays >= POWER_COLLAPSE_DAYS) {
      addEvent(day, 'powerCollapse', { available: Math.round(powerAvailableW), needed: Math.round(platformW) });
      frame(day, 'ended', { healthPct: 0, powerAvailableW, bufferGb, returnedGb: totals.returnedGb });
      return finish('powerCollapse', opsDay, totals);
    }

    const powerDuty = instrumentW > 0 ? Math.max(0, Math.min(1, (powerAvailableW - platformW) / instrumentW)) : 0;
    // Without battery reserve, instruments can only run through part of each eclipse.
    const eclipseDuty = sunlitFraction + (1 - sunlitFraction) * batteryFactor;
    const safeMode = opsDay <= safeUntil;
    const instrumentDuty = safeMode ? 0 : powerDuty * eclipseDuty;

    let generatedToday = 0;
    for (const item of instruments) {
      const pointingDuty = wheelsDamaged && item.needsFinePointing ? WHEEL_FAILURE_DUTY : 1;
      generatedToday += item.dataGbPerDay * instrumentDuty * pointingDuty;
    }
    totals.generatedGb += generatedToday;
    totals.dutySum += instrumentDuty;

    bufferGb += generatedToday;
    if (opsDay > groundDownUntil && !safeMode) {
      const sent = Math.min(bufferGb, analysis.data.downlinkGbPerDay * transmitterFactor);
      bufferGb -= sent;
      totals.returnedGb += sent;
    }
    if (bufferGb > analysis.data.storageGb) {
      totals.lostGb += bufferGb - analysis.data.storageGb;
      bufferGb = analysis.data.storageGb;
    }

    if (opsDay % opsStep === 0 || opsDay === plannedDays) {
      frame(day, 'operations', {
        powerAvailableW,
        loadW: platformW + instrumentW * instrumentDuty,
        duty: instrumentDuty,
        bufferGb,
        returnedGb: totals.returnedGb,
        healthPct: Math.round(arrayFactor * decay * (wheelsDamaged ? 80 : 100) * (instruments.length / design.instrumentIds.length)),
      });
    }
  }

  totals.lostGb += bufferGb;
  addEvent(cruiseDays + plannedDays, 'missionComplete');
  frame(cruiseDays + plannedDays, 'ended', { returnedGb: totals.returnedGb });
  return finish('completed', plannedDays, totals);
}
