import { DEFAULT_CATALOG, type CatalogLookup } from '../catalog';
import { L } from '../i18n';
import type { Mission } from '../models/mission';
import type { ResourceBudget, ResourceLine, ResourceStatus } from '../models/resources';
import type { ModelCardId } from '../modelCards';
import type { Provenance, Quantity } from '../models/quantity';
import { toBase } from '../units';
import type { MissionIssue } from '../validation';
import { createAssumptionReader, type Assumption } from './assumptions';
import { computeCost, type CostResult } from './cost';
import { computeData, type DataResult } from './data';
import { computeDeltaV, type DeltaVResult } from './deltaV';
import { marginOf, weakestProvenance } from './derived';
import type { EngineIssue } from './issues';
import { computeLink, type LinkResult } from './link';
import { computeOrbitReport, type OrbitReport } from './orbitReport';
import { buildReadiness, type ReadinessReport } from './readiness';
import { computeMass, type MassResult } from './mass';
import { computePower, type PowerResult } from './power';
import { evaluateRequirements, computeScience, type RequirementResult, type ScienceResult } from './requirements';
import { resolveDesign } from './resolve';

/**
 * `unresolvable`  a catalog id is unknown or in the wrong slot; nothing can be computed.
 * `infeasible`    at least one error: the design cannot work as chosen.
 * `marginal`      no errors, but warnings (thin margins, reduced data return).
 * `feasible`      no errors and no warnings.
 */
export type EvaluationStatus = 'unresolvable' | 'infeasible' | 'marginal' | 'feasible';

export type Evaluation = {
  status: EvaluationStatus;
  /** True when there are no errors (warnings allowed). */
  feasible: boolean;
  /** Catalog and compatibility problems from `validateMissionReferences`; each one is an error. */
  referenceIssues: MissionIssue[];
  issues: EngineIssue[];
  /** Null only when the status is `unresolvable`. */
  resources: ResourceBudget | null;
  details: {
    mass: MassResult;
    power: PowerResult;
    cost: CostResult;
    deltaV: DeltaVResult;
    link: LinkResult;
    data: DataResult;
    science: ScienceResult;
    orbit: OrbitReport;
  } | null;
  /** Every check, grouped, with PASS / WARNING / FAIL, a reason and a way to fix it. Nothing is filtered out. */
  readiness: ReadinessReport;
  requirements: RequirementResult[];
  /** Every engine assumption this evaluation used, so the UI can list them. */
  assumptionsUsed: Assumption[];
};

const SECONDS_PER_DAY = 86_400;

/**
 * Evaluates a mission document: the only entry point of the resource engine. Pure:
 * the same mission and catalog always give the same result, and nothing is mutated.
 */
export function evaluateMission(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): Evaluation {
  const resolution = resolveDesign(mission, catalog);
  if (!resolution.design) {
    return {
      status: 'unresolvable',
      feasible: false,
      referenceIssues: resolution.referenceIssues,
      issues: [],
      resources: null,
      details: null,
      requirements: [],
      assumptionsUsed: [],
      readiness: buildReadiness({ design: null, referenceIssues: resolution.referenceIssues, issues: [], resources: null, details: null, requirements: [] }),
    };
  }
  const { design, referenceIssues } = resolution;
  const assume = createAssumptionReader();
  const { destination, launcher } = design;
  const tight = assume.value('tight-margin');
  const issues: EngineIssue[] = [];
  const add = (issue: EngineIssue) => issues.push(issue);

  const mass = computeMass(design);
  const link = computeLink(design, assume);
  const power = computePower(design, assume, link.contactTime.value);
  const cost = computeCost(design);
  const deltaV = computeDeltaV(design, assume, mass.launch.value);
  const data = computeData(design, link);
  const science = computeScience(design, data);
  const orbit = computeOrbitReport(design);

  const statusOf = (margin: number | null): ResourceStatus => (margin === null || margin >= tight ? 'ok' : margin < 0 ? 'over' : 'tight');
  const line = (used: number, limit: number | null, unit: string, model: ModelCardId, basis: string, inputs: readonly Quantity[]): ResourceLine => {
    const margin = limit === null ? null : marginOf(limit, used);
    return { used, limit, margin, unit, status: statusOf(margin), provenance: weakestProvenance(inputs) satisfies Provenance, model, basis };
  };

  /* ------------------------------ resource lines ------------------------------ */
  const maxCost = mission.objective.requirements.find((requirement) => requirement.kind === 'max-cost');
  const totalSeconds = toBase(destination.cruiseDuration) + mission.plannedOperationsDays * SECONDS_PER_DAY;
  const neededRate = data.dailyGenerated.value / link.contactTime.value;

  const resources: ResourceBudget = {
    mass: line(mass.launch.value, mass.launcherCapacity?.value ?? 0, 'kg', 'launch-fit', 'launch mass (dry + propellant) against what the launcher can deliver to its target', [mass.launch, ...(mass.launcherCapacity ? [mass.launcherCapacity] : [])]),
    power: line(power.requiredGeneration.value, power.generationEol.value, 'W', 'power-budget', 'array output needed to run the loads and recharge the batteries, against end-of-life array output', [power.requiredGeneration, power.generationEol]),
    budget: line(cost.total.value, maxCost?.limit ?? null, 'USD', 'cost', 'total mission cost against the max-cost requirement (no limit when there is none)', [cost.total]),
    data: line(data.dailyGenerated.value, data.dailyCapacity.value, 'bit', 'communications-data', 'data produced per day against what the link can send per day', [data.dailyGenerated, data.dailyCapacity]),
    comms: line(neededRate, link.budgetRate.value, 'bit/s', 'communications-data', 'rate needed to send one day of data during the daily contact, against the rate the link budget supports', [data.dailyGenerated, link.budgetRate]),
    time: line(totalSeconds, toBase(design.bus.designLife), 's', 'mass-budget', 'cruise plus planned operations against the bus design life', [design.bus.designLife, destination.cruiseDuration]),
  };

  /* --------------------------------- issues --------------------------------- */
  const pct = (margin: number) => Math.round(margin * 1000) / 10;

  if (resources.mass.status === 'over') {
    add({ code: 'mass-over-launcher-capacity', severity: 'error', subject: 'mass', values: { launchMassKg: mass.launch.value, capacityKg: mass.launcherCapacity?.value ?? 0 },
      message: L(`Launch mass ${mass.launch.value.toFixed(0)} kg exceeds what ${launcher.id} can deliver (${(mass.launcherCapacity?.value ?? 0).toFixed(0)} kg).`, `Uchirish massasi ${mass.launch.value.toFixed(0)} kg ${launcher.id} yetkaza oladigan massadan (${(mass.launcherCapacity?.value ?? 0).toFixed(0)} kg) oshib ketdi.`) });
  } else if (resources.mass.status === 'tight') {
    add({ code: 'mass-margin-tight', severity: 'warning', subject: 'mass', values: { marginPercent: pct(resources.mass.margin ?? 0) },
      message: L(`Only ${pct(resources.mass.margin ?? 0)}% launch mass margin is left.`, `Uchirish massasi zaxirasi atigi ${pct(resources.mass.margin ?? 0)}% qoldi.`) });
  }
  if (mass.payloadMargin < 0) {
    add({ code: 'payload-over-bus-limit', severity: 'error', subject: 'mass', values: { payloadKg: mass.payload.value, limitKg: mass.payloadLimit.value },
      message: L(`Instruments weigh ${mass.payload.value.toFixed(1)} kg but the bus carries at most ${mass.payloadLimit.value.toFixed(1)} kg.`, `Asboblar ${mass.payload.value.toFixed(1)} kg, lekin bus ko'pi bilan ${mass.payloadLimit.value.toFixed(1)} kg ko'taradi.`) });
  }

  if (design.solarArrays.length === 0) {
    add({ code: 'no-power-source', severity: 'error', subject: 'power', values: {}, message: L('The spacecraft has no solar array, so it has no power.', "Apparatda quyosh paneli yo'q, shuning uchun quvvat manbai yo'q.") });
  } else if (resources.power.status === 'over') {
    add({ code: 'power-deficit', severity: 'error', subject: 'power', values: { requiredW: power.requiredGeneration.value, generatedW: power.generationEol.value },
      message: L(`The arrays give ${power.generationEol.value.toFixed(1)} W at end of life but ${power.requiredGeneration.value.toFixed(1)} W are needed.`, `Panellar xizmat oxirida ${power.generationEol.value.toFixed(1)} W beradi, lekin ${power.requiredGeneration.value.toFixed(1)} W kerak.`) });
  } else if (resources.power.status === 'tight') {
    add({ code: 'power-margin-tight', severity: 'warning', subject: 'power', values: { marginPercent: pct(resources.power.margin ?? 0) },
      message: L(`Only ${pct(resources.power.margin ?? 0)}% power margin is left at end of life.`, `Xizmat oxirida quvvat zaxirasi atigi ${pct(resources.power.margin ?? 0)}% qoldi.`) });
  }
  if (power.batteryMargin < 0) {
    add({ code: 'battery-too-small', severity: 'error', subject: 'power', values: { neededJ: power.eclipseEnergy.value, usableJ: power.batteryUsable.value },
      message: L(`The batteries hold ${(power.batteryUsable.value / 3600).toFixed(1)} Wh usable but the longest eclipse needs ${(power.eclipseEnergy.value / 3600).toFixed(1)} Wh.`, `Batareyalar ${(power.batteryUsable.value / 3600).toFixed(1)} Wh ishlatish mumkin, eng uzun soya esa ${(power.eclipseEnergy.value / 3600).toFixed(1)} Wh talab qiladi.`) });
  } else if (power.batteryMargin < tight) {
    add({ code: 'battery-margin-tight', severity: 'warning', subject: 'power', values: { marginPercent: pct(power.batteryMargin) },
      message: L(`Only ${pct(power.batteryMargin)}% battery margin for the longest eclipse.`, `Eng uzun soya uchun batareya zaxirasi atigi ${pct(power.batteryMargin)}%.`) });
  }

  if (design.computers.length === 0) add({ code: 'no-flight-computer', severity: 'error', subject: 'data', values: {}, message: L('No flight computer: there is nowhere to store instrument data.', "Bort kompyuteri yo'q: asbob ma'lumotlarini saqlash uchun joy yo'q.") });
  if (design.attitude.length === 0) add({ code: 'no-attitude-control', severity: 'error', subject: 'design', values: {}, message: L('No attitude control: the spacecraft cannot point its antenna or instruments.', "Orientatsiya tizimi yo'q: apparat antenna va asboblarni yo'naltira olmaydi.") });
  if (design.instruments.length === 0) add({ code: 'no-instruments', severity: 'warning', subject: 'design', values: {}, message: L('No instruments: the mission returns no science.', "Asboblar yo'q: missiya ilmiy natija bermaydi.") });

  if (link.radioId === null) {
    add({ code: 'no-radio', severity: 'error', subject: 'comms', values: {}, message: L('No radio: the spacecraft cannot send anything to Earth.', "Radio yo'q: apparat Yerga hech narsa yubora olmaydi.") });
  } else if (link.usableRate.value <= 0) {
    add({ code: 'link-cannot-close', severity: 'error', subject: 'comms', values: {}, message: L('The link carries no data at this distance.', "Aloqa bu masofada ma'lumot o'tkazmaydi.") });
  } else if (link.marginDb < 0) {
    add({ code: 'link-below-hardware-rate', severity: 'warning', subject: 'comms', values: { marginDb: link.marginDb, budgetRate: link.budgetRate.value, hardwareRate: link.hardwareRate.value },
      message: L(`At the worst-case distance the link supports ${(link.budgetRate.value / 1e3).toFixed(1)} kbit/s, below the radio's ${(link.hardwareRate.value / 1e3).toFixed(1)} kbit/s.`, `Eng yomon masofada aloqa ${(link.budgetRate.value / 1e3).toFixed(1)} kbit/s ni ta'minlaydi, bu radioning ${(link.hardwareRate.value / 1e3).toFixed(1)} kbit/s qiymatidan past.`) });
  }

  if (data.firstOverflowDay !== null) {
    add({ code: 'data-storage-overflow', severity: 'error', subject: 'data', values: { day: data.firstOverflowDay, lostBits: data.lost.value },
      message: L(`Storage overflows on day ${data.firstOverflowDay}: ${(data.lost.value / 1e9).toFixed(2)} Gbit of data is lost.`, `Xotira ${data.firstOverflowDay}-kuni to'lib ketadi: ${(data.lost.value / 1e9).toFixed(2)} Gbit ma'lumot yo'qoladi.`) });
  } else if (data.endBacklog.value > 0) {
    add({ code: 'data-backlog-at-end', severity: 'warning', subject: 'data', values: { backlogBits: data.endBacklog.value },
      message: L(`${(data.endBacklog.value / 1e9).toFixed(2)} Gbit are still onboard when operations end.`, `Operatsiyalar tugaganda bortda hali ${(data.endBacklog.value / 1e9).toFixed(2)} Gbit qoladi.`) });
  }

  for (const entry of science.perInstrument) {
    if (!entry.pointingOk) {
      add({ code: 'pointing-insufficient', severity: 'error', subject: 'design', values: { instrumentId: entry.instrumentId, pointingErrorDeg: (science.pointingAccuracyRad * 180) / Math.PI },
        message: L(`The attitude control cannot point well enough for ${entry.instrumentId}; it returns no science.`, `Orientatsiya tizimi ${entry.instrumentId} uchun yetarlicha aniq emas; u ilmiy natija bermaydi.`) });
    }
  }

  if (deltaV.impulsiveBurnsImpossible) {
    add({ code: 'low-thrust-cannot-insert', severity: 'error', subject: 'delta-v', values: {}, message: L('Electric propulsion cannot make the impulsive burns this trajectory needs.', "Elektr dvigatel bu traektoriya talab qiladigan impulsiv yoqishlarni bajara olmaydi.") });
  }
  if (deltaV.departureC3 && deltaV.departureC3.provided.value < deltaV.departureC3.required.value) {
    add({ code: 'departure-energy-insufficient', severity: 'error', subject: 'delta-v', values: { requiredM2S2: deltaV.departureC3.required.value, providedM2S2: deltaV.departureC3.provided.value },
      message: L('The launch target gives less departure energy than the transfer needs.', "Uchirish nuqtasi o'tish uchun kerak bo'lgan ketish energiyasidan kam beradi.") });
  }
  if (deltaV.margin < 0) {
    add({ code: 'delta-v-insufficient', severity: 'error', subject: 'delta-v', values: { requiredMS: deltaV.required.value, availableMS: deltaV.available.value },
      message: L(`The spacecraft can change velocity by ${deltaV.available.value.toFixed(0)} m/s but ${deltaV.required.value.toFixed(0)} m/s are required.`, `Apparat tezligini ${deltaV.available.value.toFixed(0)} m/s ga o'zgartira oladi, lekin ${deltaV.required.value.toFixed(0)} m/s talab qilinadi.`) });
  } else if (deltaV.margin < tight) {
    add({ code: 'delta-v-margin-tight', severity: 'warning', subject: 'delta-v', values: { marginPercent: pct(deltaV.margin) },
      message: L(`Only ${pct(deltaV.margin)}% Δv margin is left.`, `Δv zaxirasi atigi ${pct(deltaV.margin)}% qoldi.`) });
  }

  if (resources.time.status === 'over') {
    add({ code: 'exceeds-design-life', severity: 'error', subject: 'time', values: { missionDays: totalSeconds / SECONDS_PER_DAY, designLifeDays: toBase(design.bus.designLife) / SECONDS_PER_DAY },
      message: L(`The mission lasts ${(totalSeconds / SECONDS_PER_DAY).toFixed(0)} days but the bus is designed for ${(toBase(design.bus.designLife) / SECONDS_PER_DAY).toFixed(0)} days.`, `Missiya ${(totalSeconds / SECONDS_PER_DAY).toFixed(0)} kun davom etadi, bus esa ${(toBase(design.bus.designLife) / SECONDS_PER_DAY).toFixed(0)} kunga mo'ljallangan.`) });
  } else if (resources.time.status === 'tight') {
    add({ code: 'time-margin-tight', severity: 'warning', subject: 'time', values: { marginPercent: pct(resources.time.margin ?? 0) },
      message: L(`Only ${pct(resources.time.margin ?? 0)}% design-life margin is left.`, `Xizmat muddati zaxirasi atigi ${pct(resources.time.margin ?? 0)}% qoldi.`) });
  }

  /* ----------------------- launch site and orbit purpose ---------------------- */
  if (!design.site.launcherIds.includes(launcher.id)) {
    add({ code: 'launcher-not-at-site', severity: 'error', subject: 'design', values: { launcherId: launcher.id, siteId: design.site.id },
      message: L(`${launcher.name.en} does not launch from ${design.site.name.en}.`, `${launcher.name.uz} ${design.site.name.uz} dan uchmaydi.`) });
  }
  const planeChangeLimit = assume.value('site-plane-change-limit');
  const siteFacts = deltaV.site;
  // Geostationary missions always change plane at the transfer-orbit apogee (already in the Δv); only direct-to-orbit launches can be unreachable.
  if (siteFacts && destination.id !== 'geo' && siteFacts.shortfallDeg > 1e-9) {
    const limitDeg = (planeChangeLimit * 180) / Math.PI;
    const shortfall = Math.round(siteFacts.shortfallDeg * 10) / 10;
    const extra = Math.round(siteFacts.extra.value);
    if (siteFacts.shortfallDeg > limitDeg) {
      add({ code: 'site-cannot-reach-inclination', severity: 'error', subject: 'design', values: { shortfallDeg: siteFacts.shortfallDeg, limitDeg, extraDeltaVMS: siteFacts.extra.value },
        message: L(`${design.site.name.en} cannot fly directly within ${shortfall}° of ${mission.orbit.inclinationDeg}° inclination; the plane change would need ${extra} m/s.`, `${design.site.name.uz} ${mission.orbit.inclinationDeg}° og'ishga ${shortfall}° dan yaqin to'g'ridan-to'g'ri chiqa olmaydi; tekislikni o'zgartirish ${extra} m/s talab qiladi.`) });
    } else {
      add({ code: 'site-inclination-penalty', severity: 'warning', subject: 'delta-v', values: { shortfallDeg: siteFacts.shortfallDeg, extraDeltaVMS: siteFacts.extra.value },
        message: L(`${design.site.name.en} cannot reach ${mission.orbit.inclinationDeg}° directly; a ${shortfall}° plane change costs about ${extra} m/s of Δv.`, `${design.site.name.uz} ${mission.orbit.inclinationDeg}° ga to'g'ridan-to'g'ri chiqa olmaydi; ${shortfall}° tekislik o'zgartirish taxminan ${extra} m/s Δv sarflaydi.`) });
    }
  }
  const sunSync = orbit.sunSynchronous;
  if (destination.inclinationRule === 'sun-synchronous' && sunSync) {
    const tolerance = assume.value('sso-inclination-tolerance') * (180 / Math.PI);
    const limit = assume.value('sso-inclination-limit') * (180 / Math.PI);
    const drift = Math.round(sunSync.localTimeDriftMinPerDay * 100) / 100;
    if (sunSync.inclinationErrorDeg === null) {
      add({ code: 'orbit-not-sun-synchronous', severity: 'error', subject: 'design', values: { altitudeKm: mission.orbit.apoapsisAltKm },
        message: L('No inclination makes an orbit this high sun-synchronous.', "Bunday balandlikdagi orbitani Quyosh-sinxron qiladigan og'ish mavjud emas.") });
    } else if (Math.abs(sunSync.inclinationErrorDeg) > limit) {
      add({ code: 'orbit-not-sun-synchronous', severity: 'error', subject: 'design', values: { errorDeg: sunSync.inclinationErrorDeg, requiredDeg: sunSync.requiredInclinationDeg ?? 0, driftMinPerDay: drift },
        message: L(`Inclination ${mission.orbit.inclinationDeg}° is ${Math.abs(sunSync.inclinationErrorDeg).toFixed(2)}° from the sun-synchronous ${(sunSync.requiredInclinationDeg ?? 0).toFixed(2)}°: the crossing time drifts ${drift} min per day.`, `${mission.orbit.inclinationDeg}° og'ish Quyosh-sinxron ${(sunSync.requiredInclinationDeg ?? 0).toFixed(2)}° dan ${Math.abs(sunSync.inclinationErrorDeg).toFixed(2)}° farq qiladi: kesib o'tish vaqti kuniga ${drift} daqiqaga siljiydi.`) });
    } else if (Math.abs(sunSync.inclinationErrorDeg) > tolerance) {
      add({ code: 'orbit-sun-sync-drift', severity: 'warning', subject: 'design', values: { errorDeg: sunSync.inclinationErrorDeg, requiredDeg: sunSync.requiredInclinationDeg ?? 0, driftMinPerDay: drift },
        message: L(`Inclination is ${Math.abs(sunSync.inclinationErrorDeg).toFixed(2)}° off the sun-synchronous value: the crossing time drifts ${drift} min per day.`, `Og'ish Quyosh-sinxron qiymatdan ${Math.abs(sunSync.inclinationErrorDeg).toFixed(2)}° farq qiladi: kesib o'tish vaqti kuniga ${drift} daqiqaga siljiydi.`) });
    }
  }

  const requirements = evaluateRequirements(mission.objective.requirements, {
    cost: cost.total,
    launchMass: mass.launch,
    science: science.total,
    returnedData: data.returnedTotal,
    launchReliability: launcher.reliability,
    operationsDays: mission.plannedOperationsDays,
  });
  for (const requirement of requirements) {
    if (!requirement.met) {
      add({ code: 'requirement-not-met', severity: 'error', subject: 'requirements', values: { requirementId: requirement.id, kind: requirement.kind, limit: requirement.limit, actual: requirement.actual, unit: requirement.unit },
        message: L(`Requirement "${requirement.id}" (${requirement.kind}) is not met: ${requirement.actual.toPrecision(4)} ${requirement.unit} against ${requirement.limit} ${requirement.unit}.`, `«${requirement.id}» (${requirement.kind}) talabi bajarilmadi: ${requirement.actual.toPrecision(4)} ${requirement.unit}, kerak ${requirement.limit} ${requirement.unit}.`) });
    }
  }

  const hasError = referenceIssues.length > 0 || issues.some((issue) => issue.severity === 'error');
  const status: EvaluationStatus = hasError ? 'infeasible' : issues.length > 0 ? 'marginal' : 'feasible';
  const details = { mass, power, cost, deltaV, link, data, science, orbit };
  return {
    status,
    feasible: !hasError,
    referenceIssues,
    issues,
    resources,
    details,
    requirements,
    assumptionsUsed: assume.used(),
    readiness: buildReadiness({ design, referenceIssues, issues, resources, details, requirements }),
  };
}
