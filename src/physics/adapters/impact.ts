import type { CatalogAdapterResult, CatalogObject } from '@/types/catalog';
import { computeVectorMagnitude, getScalarFromCatalog, GRAVITATIONAL_CONSTANT, toDensityKgM3, toLengthMeters, toMassKg, toVelocityMs } from './utils';

export type CatalogImpactor = {
  radiusM: number;
  densityKgM3: number;
  massKg: number;
  impactVelocityMs: number;
  targetType?: 'rocky' | 'gas-giant' | 'star' | 'asteroid' | 'unknown';
  targetHasAtmosphere?: boolean;
  targetRadiusM?: number;
  targetMassKg?: number;
};

export function catalogToImpactor(record: CatalogObject): CatalogAdapterResult<CatalogImpactor> {
  const missing: string[] = [];

  const radiusM = record.radius ? toLengthMeters(record.radius) : undefined;
  const densityKgM3 = record.density ? toDensityKgM3(record.density) : undefined;
  const impactVelocityMs = getScalarFromCatalog(record, 'speed');
  const catalogMassKg = record.mass ? toMassKg(record.mass) : undefined;

  if (radiusM === undefined) missing.push('radius');
  if (densityKgM3 === undefined) missing.push('density');
  if (impactVelocityMs === undefined) missing.push('velocity');

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] };
  }

  const computedMassKg = radiusM !== undefined && densityKgM3 !== undefined
    ? (4 / 3) * Math.PI * radiusM ** 3 * densityKgM3
    : undefined;
  const massKg = catalogMassKg ?? computedMassKg ?? 0;
  const targetType = record.targetType ?? 'unknown';
  const targetHasAtmosphere = record.targetHasAtmosphere ?? false;
  const targetRadiusM = record.distance ? toLengthMeters(record.distance) : undefined;
  const targetMassKg = record.mass && record.radius ? toMassKg(record.mass) : undefined;

  return {
    ok: true,
    value: {
      radiusM: radiusM!,
      densityKgM3: densityKgM3!,
      massKg,
      impactVelocityMs: impactVelocityMs!,
      targetType,
      targetHasAtmosphere,
      targetRadiusM,
      targetMassKg,
    },
  };
}
