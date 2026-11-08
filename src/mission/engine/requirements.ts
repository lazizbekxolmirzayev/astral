import { convert, toBase } from '../units';
import { REQUIREMENT_KINDS, type Requirement, type RequirementKind } from '../models/mission';
import type { Provenance, Quantity } from '../models/quantity';
import { derive, weakestProvenance, type Derived } from './derived';
import type { DataResult } from './data';
import type { ResolvedDesign } from './resolve';

export type ScienceResult = {
  /** Provisional science points: Σ instrument value × share of its data that reaches Earth × pointing ok (0 or 1). */
  total: Derived;
  perInstrument: { instrumentId: string; points: number; pointingOk: boolean }[];
  /** Best (smallest) pointing error the attitude systems give, radians; Infinity without one. */
  pointingAccuracyRad: number;
};

export type RequirementResult = {
  id: string;
  kind: RequirementKind;
  limit: number;
  actual: number;
  unit: string;
  met: boolean;
  /** Relative distance to the limit; negative when not met. */
  margin: number;
  provenance: Provenance;
};

const TOLERANCE = 1e-9;

export function computeScience(design: ResolvedDesign, data: DataResult): ScienceResult {
  let accuracy = Number.POSITIVE_INFINITY;
  for (const { part } of design.attitude) accuracy = Math.min(accuracy, toBase(part.pointingAccuracy));

  const perInstrument: ScienceResult['perInstrument'] = [];
  const inputs: Quantity[] = [];
  let total = 0;
  for (const { part } of design.instruments) {
    const pointingOk = accuracy <= toBase(part.requiredPointing) + TOLERANCE;
    const share = part.dataHandling === 'relay' ? 1 : data.returnFraction;
    const points = pointingOk ? toBase(part.scienceValue) * share : 0;
    perInstrument.push({ instrumentId: part.id, points, pointingOk });
    total += points;
    inputs.push(part.scienceValue, part.requiredPointing);
  }
  return {
    total: derive(total, 'pt', 'communications-data', 'Σ science value · share of data returned · pointing ok (provisional, game scoring comes later)', inputs),
    perInstrument,
    pointingAccuracyRad: accuracy,
  };
}

export type RequirementFacts = {
  cost: Derived;
  launchMass: Derived;
  science: Derived;
  returnedData: Derived;
  launchReliability: Quantity;
  operationsDays: number;
};

export function evaluateRequirements(requirements: readonly Requirement[], facts: RequirementFacts): RequirementResult[] {
  return requirements.map((requirement) => {
    const { direction, unit } = REQUIREMENT_KINDS[requirement.kind];
    let actual: number;
    let source: Quantity[];
    switch (requirement.kind) {
      case 'max-cost': actual = convert(facts.cost.value, facts.cost.unit, unit); source = [facts.cost]; break;
      case 'max-launch-mass': actual = convert(facts.launchMass.value, facts.launchMass.unit, unit); source = [facts.launchMass]; break;
      case 'min-operations': actual = facts.operationsDays; source = []; break;
      case 'min-science': actual = convert(facts.science.value, facts.science.unit, unit); source = [facts.science]; break;
      case 'min-data-return': actual = convert(facts.returnedData.value, facts.returnedData.unit, unit); source = [facts.returnedData]; break;
      case 'min-launch-success': actual = toBase(facts.launchReliability); source = [facts.launchReliability]; break;
    }
    const met = direction === 'max' ? actual <= requirement.limit * (1 + TOLERANCE) : actual >= requirement.limit * (1 - TOLERANCE);
    const margin = direction === 'max' ? (requirement.limit - actual) / requirement.limit : (actual - requirement.limit) / requirement.limit;
    return { id: requirement.id, kind: requirement.kind, limit: requirement.limit, actual, unit, met, margin, provenance: weakestProvenance(source) };
  });
}
