import type { Evaluation } from './engine';
import { ASSUMPTIONS } from './engine/assumptions';
import type { Part } from './models/catalog';
import { convert, type UnitSymbol } from './units';
import { instrumentDailyData } from './engine/data';

/**
 * View models: turn an `Evaluation` or a catalog item into plain rows for the UI.
 * They only select and convert units; every number is computed by the engine.
 */

export type Tone = 'normal' | 'warning' | 'critical';

const TIGHT = ASSUMPTIONS.find((assumption) => assumption.id === 'tight-margin')?.quantity.value ?? 0.1;

/** Same thresholds as the engine's resource status: below zero is critical, below the tight margin a warning. */
export function toneOfMargin(margin: number | null): Tone {
  if (margin === null) return 'normal';
  if (margin < 0) return 'critical';
  return margin < TIGHT ? 'warning' : 'normal';
}

export const INDICATOR_IDS = ['mass', 'power', 'battery', 'deltaV', 'data', 'cost', 'readiness'] as const;
export type IndicatorId = (typeof INDICATOR_IDS)[number];

export type Indicator = {
  id: IndicatorId;
  tone: Tone;
  /** What the design uses or needs, in `unit`. Null when the mission cannot be evaluated. */
  used: number | null;
  /** What is available, in `unit`. Null when nothing limits it (no cost requirement) or it cannot be evaluated. */
  limit: number | null;
  unit: UnitSymbol;
  /** used / limit, for a bar; null when there is no limit. */
  fraction: number | null;
  errors?: number;
  warnings?: number;
};

const fraction = (used: number, limit: number | null): number | null => (limit === null ? null : limit > 0 ? used / limit : used > 0 ? Number.POSITIVE_INFINITY : 0);

/**
 * The seven always-visible indicators. Pairs read "used / available": mass against
 * what the launcher carries, average consumption against array output, the eclipse
 * energy against usable battery, Δv required against available, data per day against
 * the link, cost against the budget requirement.
 */
export function buildIndicators(evaluation: Evaluation): Indicator[] {
  const { resources, details } = evaluation;
  const errors = evaluation.referenceIssues.length + evaluation.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = evaluation.issues.filter((issue) => issue.severity === 'warning').length;
  const readinessTone: Tone = evaluation.status === 'feasible' ? 'normal' : evaluation.status === 'marginal' ? 'warning' : 'critical';
  const readiness: Indicator = { id: 'readiness', tone: readinessTone, used: null, limit: null, unit: '1', fraction: null, errors, warnings };

  if (!resources || !details) {
    const unavailable = (id: IndicatorId, unit: UnitSymbol): Indicator => ({ id, tone: 'normal', used: null, limit: null, unit, fraction: null });
    return [unavailable('mass', 'kg'), unavailable('power', 'W'), unavailable('battery', 'Wh'), unavailable('deltaV', 'm/s'), unavailable('data', 'GB'), unavailable('cost', 'MUSD'), readiness];
  }

  const mass = resources.mass;
  const power = details.power;
  const deltaV = details.deltaV;
  const data = resources.data;
  const budget = resources.budget;
  const wh = (joules: number) => convert(joules, 'J', 'Wh');
  const gb = (bits: number) => convert(bits, 'bit', 'GB');
  const musd = (usd: number) => convert(usd, 'USD', 'MUSD');
  const limitOrNull = (value: number | null, to: (x: number) => number) => (value === null ? null : to(value));

  return [
    { id: 'mass', tone: toneOfMargin(mass.margin), used: mass.used, limit: mass.limit, unit: 'kg', fraction: fraction(mass.used, mass.limit) },
    { id: 'power', tone: toneOfMargin(resources.power.margin), used: power.averageLoad.value, limit: power.generationEol.value, unit: 'W', fraction: fraction(power.averageLoad.value, power.generationEol.value) },
    { id: 'battery', tone: toneOfMargin(power.batteryMargin), used: wh(power.eclipseEnergy.value), limit: wh(power.batteryUsable.value), unit: 'Wh', fraction: fraction(power.eclipseEnergy.value, power.batteryUsable.value) },
    { id: 'deltaV', tone: toneOfMargin(deltaV.margin), used: deltaV.required.value, limit: deltaV.available.value, unit: 'm/s', fraction: fraction(deltaV.required.value, deltaV.available.value) },
    { id: 'data', tone: toneOfMargin(data.margin), used: gb(data.used), limit: limitOrNull(data.limit, gb), unit: 'GB', fraction: fraction(data.used, data.limit) },
    { id: 'cost', tone: toneOfMargin(budget.margin), used: musd(budget.used), limit: limitOrNull(budget.limit, musd), unit: 'MUSD', fraction: fraction(budget.used, budget.limit) },
    readiness,
  ];
}

/* ----------------------------- part parameters ----------------------------- */

export type ParamRow = {
  /** Key under `mission.param` in the message catalogs. */
  key: string;
  number?: number;
  unit?: UnitSymbol;
  /** An enumerated value shown through `mission.enum.<group>.<id>`. */
  enumValue?: { group: string; id: string };
};

const n = (key: string, quantity: { value: number; unit: string }, unit: UnitSymbol): ParamRow => ({ key, number: convert(quantity.value, quantity.unit, unit), unit });
const e = (key: string, group: string, id: string): ParamRow => ({ key, enumValue: { group, id } });

/** The technical parameters of a catalog part, in display units. Mass and cost come first for every category. */
export function describePart(part: Part): ParamRow[] {
  const common = [n('mass', part.mass, 'kg'), n('cost', part.cost, 'MUSD')];
  switch (part.category) {
    case 'bus':
      return [...common, n('basePower', part.basePowerDraw, 'W'), n('payloadLimit', part.payloadMassLimit, 'kg'), n('designLife', part.designLife, 'yr')];
    case 'propulsion':
      return [...common, e('technology', 'technology', part.technology), n('isp', part.isp, 's'), n('propellantCapacity', part.propellantCapacity, 'kg'), n('power', part.powerDraw, 'W'), e('thrustClass', 'thrustClass', part.thrustClass)];
    case 'solar-array':
      return [...common, n('area', part.area, 'm^2'), n('efficiency', part.efficiency, '%'), n('degradation', part.degradationPerYear, '%'), e('mounting', 'mounting', part.mounting)];
    case 'battery':
      return [...common, n('capacity', part.capacity, 'Wh'), n('depthOfDischarge', part.depthOfDischarge, '%')];
    case 'comms':
      return [...common, e('band', 'band', part.band), n('frequency', part.frequency, 'GHz'), n('txPower', part.txPower, 'W'), n('gain', part.antennaGain, 'dBi'), n('power', part.powerDraw, 'W'), n('maxRate', part.maxDataRate, 'Mbit/s')];
    case 'obc':
      return [...common, n('storage', part.storage, 'GB'), n('power', part.powerDraw, 'W')];
    case 'adcs':
      return [...common, n('pointing', part.pointingAccuracy, 'deg'), n('power', part.powerDraw, 'W')];
    case 'instrument':
      return [
        ...common,
        e('kind', 'instrumentKind', part.kind),
        n('power', part.powerDraw, 'W'),
        n('dutyCycle', part.dutyCycle, '%'),
        { key: 'dailyData', number: convert(instrumentDailyData(part), 'bit', 'GB'), unit: 'GB' },
        n('science', part.scienceValue, 'pt'),
        n('requiredPointing', part.requiredPointing, 'deg'),
        e('dataHandling', 'dataHandling', part.dataHandling),
      ];
  }
}

export const PART_CATEGORY_ORDER = ['bus', 'propulsion', 'solar-array', 'battery', 'comms', 'obc', 'adcs', 'instrument'] as const;

