import { L, type Localized } from '../i18n';
import type { RequirementKind } from '../models/mission';
import type { ResourceBudget } from '../models/resources';
import { valueIn } from '../units';
import type { MissionIssue, MissionIssueCode } from '../validation';
import type { CostResult } from './cost';
import type { DataResult } from './data';
import type { DeltaVResult } from './deltaV';
import type { EngineIssue, EngineIssueCode } from './issues';
import type { LinkResult } from './link';
import type { MassResult } from './mass';
import type { OrbitReport } from './orbitReport';
import type { PowerResult } from './power';
import type { RequirementResult, ScienceResult } from './requirements';
import type { ResolvedDesign } from './resolve';

/**
 * The mission readiness report: one list of checks, each PASS, WARNING or FAIL with a
 * reason and, when it is not a PASS, a way to fix it. It is a *view* over the engine's
 * results: every engine issue, catalog issue and mission requirement is assigned to
 * exactly one check by the exhaustive tables below, so nothing can be left out, and the
 * mission is `launchReady` exactly when no check fails (warnings are allowed and shown).
 */

export type CheckStatus = 'pass' | 'warning' | 'fail';

export const CHECK_GROUPS = ['spacecraft', 'payload', 'resources', 'orbit', 'launch-vehicle', 'launch-site', 'budget'] as const;
export type CheckGroup = (typeof CHECK_GROUPS)[number];

export const CHECK_IDS = [
  'catalog-compatibility',
  'subsystems',
  'payload-mass-limit',
  'design-life',
  'instruments-fit-destination',
  'instruments-present',
  'pointing',
  'science-return',
  'power',
  'battery',
  'data-storage',
  'link',
  'orbit-limits',
  'orbit-purpose',
  'delta-v',
  'launcher-reaches-target',
  'launch-mass',
  'departure-energy',
  'launch-reliability',
  'site-hosts-launcher',
  'site-inclination',
  'budget',
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/** The checks that decide whether the chosen orbit, vehicle, site and budget fit together. */
export const COMPATIBILITY_CHECK_IDS: readonly CheckId[] = ['launch-mass', 'launcher-reaches-target', 'departure-energy', 'orbit-purpose', 'orbit-limits', 'delta-v', 'budget', 'site-inclination', 'site-hosts-launcher'];

export type ReadinessCheck = {
  id: CheckId;
  group: CheckGroup;
  status: CheckStatus;
  /** Why the check has this status, with the numbers behind it. */
  reason: Localized;
  /** What to change to fix a WARNING or FAIL; null for a PASS. */
  fix: Localized | null;
};

export type ReadinessGroup = { group: CheckGroup; status: CheckStatus; checks: ReadinessCheck[] };

export type ReadinessReport = {
  groups: ReadinessGroup[];
  /** The worst status of any check. */
  overall: CheckStatus;
  /** True exactly when no check fails. Warnings do not block a launch, but they are listed. */
  launchReady: boolean;
  counts: { pass: number; warning: number; fail: number };
  /** True when a catalog problem stopped the engine, so only the problems that were found are listed. */
  unresolvable: boolean;
};

export type ReadinessInput = {
  design: ResolvedDesign | null;
  referenceIssues: readonly MissionIssue[];
  issues: readonly EngineIssue[];
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
  requirements: readonly RequirementResult[];
};

/* ------------------------- which check owns which issue ------------------------- */

export const CHECK_OF_ENGINE_ISSUE: Record<EngineIssueCode, CheckId> = {
  'mass-over-launcher-capacity': 'launch-mass',
  'mass-margin-tight': 'launch-mass',
  'payload-over-bus-limit': 'payload-mass-limit',
  'power-deficit': 'power',
  'power-margin-tight': 'power',
  'no-power-source': 'power',
  'battery-too-small': 'battery',
  'battery-margin-tight': 'battery',
  'no-flight-computer': 'subsystems',
  'no-attitude-control': 'subsystems',
  'no-radio': 'link',
  'link-cannot-close': 'link',
  'link-below-hardware-rate': 'link',
  'data-storage-overflow': 'data-storage',
  'data-backlog-at-end': 'data-storage',
  'pointing-insufficient': 'pointing',
  'delta-v-insufficient': 'delta-v',
  'delta-v-margin-tight': 'delta-v',
  'low-thrust-cannot-insert': 'delta-v',
  'departure-energy-insufficient': 'departure-energy',
  'exceeds-design-life': 'design-life',
  'time-margin-tight': 'design-life',
  'requirement-not-met': 'budget', // refined per requirement kind below
  'no-instruments': 'instruments-present',
  'launcher-not-at-site': 'site-hosts-launcher',
  'site-cannot-reach-inclination': 'site-inclination',
  'site-inclination-penalty': 'site-inclination',
  'orbit-not-sun-synchronous': 'orbit-purpose',
  'orbit-sun-sync-drift': 'orbit-purpose',
};

export const CHECK_OF_REFERENCE_ISSUE: Record<MissionIssueCode, CheckId> = {
  'unknown-bus': 'catalog-compatibility',
  'unknown-propulsion': 'catalog-compatibility',
  'unknown-part': 'catalog-compatibility',
  'unknown-launcher': 'launcher-reaches-target',
  'unknown-launch-site': 'site-hosts-launcher',
  'wrong-category': 'catalog-compatibility',
  'duplicate-part': 'catalog-compatibility',
  'bus-not-for-destination': 'catalog-compatibility',
  'instrument-not-for-destination': 'instruments-fit-destination',
  'propellant-without-propulsion': 'catalog-compatibility',
  'propellant-exceeds-capacity': 'catalog-compatibility',
  'launcher-cannot-reach-target': 'launcher-reaches-target',
  'orbit-out-of-limits': 'orbit-limits',
};

export const CHECK_OF_REQUIREMENT: Record<RequirementKind, CheckId> = {
  'max-cost': 'budget',
  'max-launch-mass': 'launch-mass',
  'min-operations': 'design-life',
  'min-science': 'science-return',
  'min-data-return': 'science-return',
  'min-launch-success': 'launch-reliability',
};

const GROUP_OF_CHECK: Record<CheckId, CheckGroup> = {
  'catalog-compatibility': 'spacecraft',
  subsystems: 'spacecraft',
  'payload-mass-limit': 'spacecraft',
  'design-life': 'spacecraft',
  'instruments-fit-destination': 'payload',
  'instruments-present': 'payload',
  pointing: 'payload',
  'science-return': 'payload',
  power: 'resources',
  battery: 'resources',
  'data-storage': 'resources',
  link: 'resources',
  'orbit-limits': 'orbit',
  'orbit-purpose': 'orbit',
  'delta-v': 'orbit',
  'launcher-reaches-target': 'launch-vehicle',
  'launch-mass': 'launch-vehicle',
  'departure-energy': 'launch-vehicle',
  'launch-reliability': 'launch-vehicle',
  'site-hosts-launcher': 'launch-site',
  'site-inclination': 'launch-site',
  budget: 'budget',
};

/* ------------------------------- catalog issue text ------------------------------ */

const REFERENCE_TEXT: Record<MissionIssueCode, Localized> = {
  'unknown-bus': L('The chosen bus is not in the catalog.', "Tanlangan platforma katalogda yo'q."),
  'unknown-propulsion': L('The chosen propulsion system is not in the catalog.', "Tanlangan dvigatel katalogda yo'q."),
  'unknown-part': L('A selected part is not in the catalog.', "Tanlangan qismlardan biri katalogda yo'q."),
  'unknown-launcher': L('The chosen launch vehicle is not in the catalog.', "Tanlangan raketa katalogda yo'q."),
  'unknown-launch-site': L('The chosen launch site is not in the catalog.', "Tanlangan uchirish joyi katalogda yo'q."),
  'wrong-category': L('A part sits in the wrong slot.', "Qism noto'g'ri joyga qo'yilgan."),
  'duplicate-part': L('A part is listed twice.', 'Bir qism ikki marta kiritilgan.'),
  'bus-not-for-destination': L('The bus cannot fly to this destination.', "Bu platforma tanlangan manzilga yeta olmaydi."),
  'instrument-not-for-destination': L('An instrument is not available at this destination.', "Asboblardan biri bu manzilda mavjud emas."),
  'propellant-without-propulsion': L('Propellant is loaded but no propulsion system is chosen.', "Yoqilg'i yuklangan, lekin dvigatel tanlanmagan."),
  'propellant-exceeds-capacity': L('The propellant exceeds what the tanks hold.', "Yoqilg'i baklar sig'imidan oshib ketdi."),
  'launcher-cannot-reach-target': L('The launch vehicle cannot deliver to the target this destination needs.', "Raketa bu manzil talab qiladigan nuqtaga yetkaza olmaydi."),
  'orbit-out-of-limits': L('The orbit is outside the range allowed at this destination.', "Orbita bu manzil uchun ruxsat etilgan oraliqdan tashqarida."),
};

/* ----------------------------------- fix hints ---------------------------------- */

const FIX: Record<CheckId, Localized> = {
  'catalog-compatibility': L('Open the Spacecraft tab and choose a bus, propulsion and propellant mass that fit this destination.', "Kosmik kema bo'limida bu manzilga mos platforma, dvigatel va yoqilg'i massasini tanlang."),
  subsystems: L('Add a flight computer and an attitude-control unit in the Spacecraft tab.', "Kosmik kema bo'limida bort kompyuteri va orientatsiya tizimini qo'shing."),
  'payload-mass-limit': L('Remove an instrument or choose a larger bus.', "Asbobni olib tashlang yoki kattaroq platforma tanlang."),
  'design-life': L('Shorten the planned operations or choose a bus with a longer design life.', "Rejalashtirilgan ishlash muddatini qisqartiring yoki xizmat muddati uzunroq platformani tanlang."),
  'instruments-fit-destination': L('Remove the instrument that does not operate here or change the destination.', "Bu yerda ishlamaydigan asbobni olib tashlang yoki manzilni o'zgartiring."),
  'instruments-present': L('Add at least one instrument in the Payload tab; without one the mission returns no science.', "Yuklama bo'limida kamida bitta asbob qo'shing; usiz missiya ilmiy natija bermaydi."),
  pointing: L('Choose an attitude-control unit with a finer pointing accuracy, or an instrument that tolerates more error.', "Aniqroq orientatsiya tizimini yoki xatoga chidamliroq asbobni tanlang."),
  'science-return': L('Add instruments, raise the data the link can return, or lower the science requirement.', "Asboblar qo'shing, aloqa qaytara oladigan ma'lumotni oshiring yoki ilmiy talabni pasaytiring."),
  power: L('Add solar-array area, remove loads, or choose more efficient arrays.', "Quyosh paneli maydonini oshiring, iste'molchilarni kamaytiring yoki samaraliroq panel tanlang."),
  battery: L('Add battery capacity or reduce the load during eclipse.', "Batareya sig'imini oshiring yoki soya vaqtidagi yukni kamaytiring."),
  'data-storage': L('Choose a computer with more storage, a faster radio, or instruments that produce less data.', "Xotirasi katta kompyuter, tezroq radio yoki kam ma'lumot beradigan asbob tanlang."),
  link: L('Add a radio (or a stronger one with a higher-gain antenna) in the Spacecraft tab.', "Kosmik kema bo'limida radio qo'shing (yoki yuqori yutuqli antennali kuchliroq radio)."),
  'orbit-limits': L('Open the Orbit tab and bring the altitude and inclination back inside the allowed range.', "Orbita bo'limida balandlik va og'ishni ruxsat etilgan oraliqqa qaytaring."),
  'orbit-purpose': L('In the Orbit tab use the "sun-synchronous inclination" button to set the exact inclination for this altitude.', "Orbita bo'limida shu balandlik uchun aniq og'ishni o'rnatish uchun «Quyosh-sinxron og'ish» tugmasidan foydalaning."),
  'delta-v': L('Load more propellant, choose a higher-Isp propulsion system, reduce dry mass, or lower the orbit demands.', "Ko'proq yoqilg'i yuklang, solishtirma impulsi yuqori dvigatel tanlang, quruq massani kamaytiring yoki orbita talablarini pasaytiring."),
  'launcher-reaches-target': L('Open the Launch tab and choose a vehicle that can deliver to this destination\'s target.', "Uchirish bo'limida bu manzil nuqtasiga yetkaza oladigan raketani tanlang."),
  'launch-mass': L('Reduce the spacecraft mass (propellant, parts) or choose a more capable launch vehicle.', "Kosmik kema massasini kamaytiring (yoqilg'i, qismlar) yoki quvvatliroq raketa tanlang."),
  'departure-energy': L('Choose the launch target or vehicle that gives enough departure energy, or move the orbit closer to Earth\'s distance from the Sun.', "Yetarli ketish energiyasi beradigan raketani tanlang yoki orbitani Quyoshdan Yer masofasiga yaqinlashtiring."),
  'launch-reliability': L('Choose a vehicle with a higher launch success probability, or lower the requirement.', "Uchirish muvaffaqiyati ehtimoli yuqori raketani tanlang yoki talabni pasaytiring."),
  'site-hosts-launcher': L('Open the Launch tab and choose a site that hosts this vehicle, or choose a vehicle that flies from this site.', "Uchirish bo'limida bu raketani qabul qiladigan joyni yoki shu joydan uchadigan raketani tanlang."),
  'site-inclination': L('Choose a site whose inclination range includes the orbit (for example Vandenberg for polar and sun-synchronous orbits, Kourou for equatorial ones), or change the orbit inclination.', "Og'ish oralig'i orbitani qamrab oladigan joyni tanlang (masalan, qutbiy va Quyosh-sinxron uchun Vandenberg, ekvatorial uchun Kuru) yoki orbita og'ishini o'zgartiring."),
  budget: L('Remove costly parts, choose a cheaper launch vehicle, shorten operations, or raise the budget limit.', "Qimmat qismlarni olib tashlang, arzonroq raketa tanlang, ishlash muddatini qisqartiring yoki byudjet chegarasini oshiring."),
};

/* --------------------------------- passing reasons -------------------------------- */

const n = (value: number, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const pct = (margin: number | null) => (margin === null ? '' : `${n(margin * 100)}%`);
const both = (en: string, uz: string) => L(en, uz);

function passReason(id: CheckId, input: ReadinessInput): Localized {
  const { design, details, resources } = input;
  if (!design || !details || !resources) return both('Not checked: a catalog problem stopped the engine.', "Tekshirilmadi: katalog muammosi hisoblashni to'xtatdi.");
  const { mission, destination, launcher, site } = design;
  switch (id) {
    case 'catalog-compatibility':
      return both(`The bus, propulsion and every part are compatible with ${destination.name.en}.`, `Platforma, dvigatel va barcha qismlar ${destination.name.uz} uchun mos.`);
    case 'subsystems':
      return both('A flight computer and attitude control are installed.', "Bort kompyuteri va orientatsiya tizimi o'rnatilgan.");
    case 'payload-mass-limit':
      return both(`Instruments weigh ${n(details.mass.payload.value, 1)} kg; the bus carries up to ${n(details.mass.payloadLimit.value, 1)} kg.`, `Asboblar ${n(details.mass.payload.value, 1)} kg; platforma ${n(details.mass.payloadLimit.value, 1)} kg gacha ko'taradi.`);
    case 'design-life':
      return both(`Cruise plus operations is ${n(resources.time.used / 86_400)} days against a bus design life of ${n((resources.time.limit ?? 0) / 86_400)} days (${pct(resources.time.margin)} margin).`, `Parvoz va ishlash ${n(resources.time.used / 86_400)} kun, platformaning xizmat muddati ${n((resources.time.limit ?? 0) / 86_400)} kun (zaxira ${pct(resources.time.margin)}).`);
    case 'instruments-fit-destination':
      return both(`Every instrument can operate at ${destination.name.en}.`, `Barcha asboblar ${destination.name.uz} da ishlay oladi.`);
    case 'instruments-present':
      return both(`${design.instruments.reduce((sum, entry) => sum + entry.quantity, 0)} instrument(s) installed.`, `${design.instruments.reduce((sum, entry) => sum + entry.quantity, 0)} ta asbob o'rnatilgan.`);
    case 'pointing':
      return both('The attitude control points well enough for every instrument.', "Orientatsiya tizimi barcha asboblar uchun yetarlicha aniq.");
    case 'science-return':
      return both(`Expected science return is ${n(details.science.total.value, 1)} points.`, `Kutilayotgan ilmiy natija ${n(details.science.total.value, 1)} ball.`);
    case 'power':
      return both(`The arrays give ${n(details.power.generationEol.value, 1)} W at end of life; ${n(details.power.requiredGeneration.value, 1)} W are needed (${pct(resources.power.margin)} margin).`, `Panellar xizmat oxirida ${n(details.power.generationEol.value, 1)} W beradi; ${n(details.power.requiredGeneration.value, 1)} W kerak (zaxira ${pct(resources.power.margin)}).`);
    case 'battery':
      return details.power.eclipseEnergy.value === 0
        ? both('There is no eclipse on this orbit, so no battery energy is needed.', "Bu orbitada soya yo'q, shuning uchun batareya energiyasi kerak emas.")
        : both(`The batteries hold ${n(details.power.batteryUsable.value / 3600, 1)} Wh usable; the longest eclipse needs ${n(details.power.eclipseEnergy.value / 3600, 1)} Wh.`, `Batareyalar ${n(details.power.batteryUsable.value / 3600, 1)} Wh ishlatish mumkin; eng uzun soya ${n(details.power.eclipseEnergy.value / 3600, 1)} Wh talab qiladi.`);
    case 'data-storage':
      return both('All the data fits in storage and is returned; none is lost.', "Barcha ma'lumot xotiraga sig'adi va qaytariladi; hech narsa yo'qolmaydi.");
    case 'link':
      return both(`The link supports ${n(details.link.usableRate.value / 1e3, 1)} kbit/s at the worst distance.`, `Aloqa eng yomon masofada ${n(details.link.usableRate.value / 1e3, 1)} kbit/s ni ta'minlaydi.`);
    case 'orbit-limits': {
      const { altitudeKm, inclinationDeg } = destination.orbitLimits;
      return destination.centralBody === 'sun'
        ? both(`The orbit stays inside the range allowed for ${destination.name.en}.`, `Orbita ${destination.name.uz} uchun ruxsat etilgan oraliqda.`)
        : both(`Altitude ${n(mission.orbit.periapsisAltKm)}–${n(mission.orbit.apoapsisAltKm)} km and inclination ${mission.orbit.inclinationDeg}° are inside the allowed ${n(altitudeKm.min)}–${n(altitudeKm.max)} km and ${inclinationDeg.min}–${inclinationDeg.max}°.`, `Balandlik ${n(mission.orbit.periapsisAltKm)}–${n(mission.orbit.apoapsisAltKm)} km va og'ish ${mission.orbit.inclinationDeg}° ruxsat etilgan ${n(altitudeKm.min)}–${n(altitudeKm.max)} km va ${inclinationDeg.min}–${inclinationDeg.max}° ichida.`);
    }
    case 'orbit-purpose': {
      const sun = details.orbit.sunSynchronous;
      if (destination.inclinationRule === 'sun-synchronous' && sun && sun.requiredInclinationDeg !== null) {
        return both(`Inclination ${mission.orbit.inclinationDeg}° matches the sun-synchronous value ${n(sun.requiredInclinationDeg, 2)}° (drift ${n(sun.localTimeDriftMinPerDay, 2)} min/day).`, `${mission.orbit.inclinationDeg}° og'ish Quyosh-sinxron ${n(sun.requiredInclinationDeg, 2)}° ga mos (siljish ${n(sun.localTimeDriftMinPerDay, 2)} daq/kun).`);
      }
      return both(`The orbit suits a ${destination.name.en} mission.`, `Orbita ${destination.name.uz} missiyasiga mos.`);
    }
    case 'delta-v':
      return both(`${n(details.deltaV.available.value)} m/s available against ${n(details.deltaV.required.value)} m/s required (${pct(details.deltaV.margin)} margin).`, `${n(details.deltaV.available.value)} m/s mavjud, ${n(details.deltaV.required.value)} m/s kerak (zaxira ${pct(details.deltaV.margin)}).`);
    case 'launcher-reaches-target':
      return both(`${launcher.name.en} can deliver to the target for ${destination.name.en}.`, `${launcher.name.uz} ${destination.name.uz} uchun kerakli nuqtaga yetkaza oladi.`);
    case 'launch-mass':
      return both(`Launch mass ${n(details.mass.launch.value)} kg against a capacity of ${n(details.mass.launcherCapacity?.value ?? 0)} kg (${pct(details.mass.launcherMargin)} margin).`, `Uchirish massasi ${n(details.mass.launch.value)} kg, sig'im ${n(details.mass.launcherCapacity?.value ?? 0)} kg (zaxira ${pct(details.mass.launcherMargin)}).`);
    case 'departure-energy': {
      const c3 = details.deltaV.departureC3;
      const km2 = (value: { value: number } | undefined) => (value ? value.value / 1e6 : 0); // Derived values are in m²/s²
      return both(
        `The launch target gives C3 = ${n(km2(c3?.provided), 1)} km²/s²; the transfer needs ${n(km2(c3?.required), 1)} km²/s².`,
        `Uchirish nuqtasi C3 = ${n(km2(c3?.provided), 1)} km²/s² beradi; o'tish ${n(km2(c3?.required), 1)} km²/s² talab qiladi.`,
      );
    }
    case 'launch-reliability':
      return both(`${launcher.name.en} succeeds with a probability of ${n(valueIn(launcher.reliability, '1') * 100, 1)}%.`, `${launcher.name.uz} ${n(valueIn(launcher.reliability, '1') * 100, 1)}% ehtimol bilan muvaffaqiyatli uchadi.`);
    case 'site-hosts-launcher':
      return both(`${launcher.name.en} launches from ${site.name.en}.`, `${launcher.name.uz} ${site.name.uz} dan uchadi.`);
    case 'site-inclination': {
      const min = valueIn(site.inclinationRange.min, 'deg');
      const max = valueIn(site.inclinationRange.max, 'deg');
      if (details.deltaV.site && destination.id === 'geo') {
        return both(`A transfer orbit from ${site.name.en} starts at ${n(details.deltaV.site.deliveryInclinationDeg, 1)}°; the apogee burn removes it (already counted in the Δv).`, `${site.name.uz} dan o'tish orbitasi ${n(details.deltaV.site.deliveryInclinationDeg, 1)}° dan boshlanadi; apogey yoqishi uni yo'qotadi (Δv da hisobga olingan).`);
      }
      return details.deltaV.site
        ? both(`${site.name.en} flies ${n(min, 1)}–${n(max, 1)}° directly; the orbit needs ${mission.orbit.inclinationDeg}°.`, `${site.name.uz} ${n(min, 1)}–${n(max, 1)}° ga to'g'ridan-to'g'ri uchadi; orbita ${mission.orbit.inclinationDeg}° talab qiladi.`)
        : both('The site\'s inclination range does not enter the model for escape trajectories; the launch target fixes the departure energy.', "Qochish traektoriyalari uchun joyning og'ish oralig'i modelga kirmaydi; ketish energiyasini uchirish nuqtasi belgilaydi.");
    }
    case 'budget': {
      const total = details.cost.total.value / 1e6;
      const limit = resources.budget.limit;
      return limit === null
        ? both(`Total mission cost is ${n(total, 1)} MUSD; no budget limit is set.`, `Missiyaning umumiy narxi ${n(total, 1)} MUSD; byudjet chegarasi o'rnatilmagan.`)
        : both(`Total mission cost is ${n(total, 1)} MUSD against a limit of ${n(limit / 1e6, 1)} MUSD (${pct(resources.budget.margin)} margin).`, `Missiyaning umumiy narxi ${n(total, 1)} MUSD, chegara ${n(limit / 1e6, 1)} MUSD (zaxira ${pct(resources.budget.margin)}).`);
    }
  }
}

/** Checks that only exist when they apply to the design. */
function applies(id: CheckId, input: ReadinessInput): boolean {
  if (id === 'departure-energy') return input.details?.deltaV.departureC3 != null;
  return true;
}

/* ------------------------------------- builder ------------------------------------ */

const worst = (a: CheckStatus, b: CheckStatus): CheckStatus => (a === 'fail' || b === 'fail' ? 'fail' : a === 'warning' || b === 'warning' ? 'warning' : 'pass');

export function buildReadiness(input: ReadinessInput): ReadinessReport {
  type Finding = { severity: 'error' | 'warning'; message: Localized };
  const findings = new Map<CheckId, Finding[]>();
  const claim = (id: CheckId, finding: Finding) => findings.set(id, [...(findings.get(id) ?? []), finding]);

  for (const issue of input.referenceIssues) claim(CHECK_OF_REFERENCE_ISSUE[issue.code], { severity: 'error', message: REFERENCE_TEXT[issue.code] });
  for (const issue of input.issues) {
    const id = issue.code === 'requirement-not-met' ? CHECK_OF_REQUIREMENT[String(issue.values.kind) as RequirementKind] ?? CHECK_OF_ENGINE_ISSUE[issue.code] : CHECK_OF_ENGINE_ISSUE[issue.code];
    claim(id, { severity: issue.severity, message: issue.message });
  }

  const unresolvable = input.design === null;
  const checks: ReadinessCheck[] = [];
  for (const id of CHECK_IDS) {
    const found = findings.get(id) ?? [];
    if (unresolvable && found.length === 0) continue; // nothing can be said about a check the engine could not run
    if (found.length === 0 && !applies(id, input)) continue;
    const status: CheckStatus = found.some((finding) => finding.severity === 'error') ? 'fail' : found.length > 0 ? 'warning' : 'pass';
    const reason: Localized = found.length === 0
      ? passReason(id, input)
      : { en: found.map((finding) => finding.message.en).join(' '), uz: found.map((finding) => finding.message.uz).join(' ') };
    checks.push({ id, group: GROUP_OF_CHECK[id], status, reason, fix: status === 'pass' ? null : FIX[id] });
  }

  const groups: ReadinessGroup[] = CHECK_GROUPS.map((group) => {
    const members = checks.filter((check) => check.group === group);
    return { group, status: members.reduce<CheckStatus>((status, check) => worst(status, check.status), 'pass'), checks: members };
  }).filter((group) => group.checks.length > 0);

  const counts = { pass: 0, warning: 0, fail: 0 };
  for (const check of checks) counts[check.status] += 1;
  const overall: CheckStatus = counts.fail > 0 ? 'fail' : counts.warning > 0 ? 'warning' : 'pass';
  return { groups, overall, launchReady: counts.fail === 0, counts, unresolvable };
}
