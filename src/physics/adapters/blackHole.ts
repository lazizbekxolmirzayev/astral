import type { CatalogAdapterResult, CatalogObject } from '@/types/catalog';
import { assessNewtonianValidity, schwarzschildRadiusM } from '@/physics/blackHole';
import { toLengthMeters, toMassKg } from './utils';

export type CatalogBlackHole = {
  massKg: number;
  radiusM: number;
  distanceM: number;
  schwarzschildRadiusM: number;
  validity: ReturnType<typeof assessNewtonianValidity>;
};

export function catalogToBlackHole(record: CatalogObject): CatalogAdapterResult<CatalogBlackHole> {
  const missing: string[] = [];

  const massKg = record.mass ? toMassKg(record.mass) : undefined;
  const radiusM = record.radius ? toLengthMeters(record.radius) : undefined;
  const distanceM = record.distance ? toLengthMeters(record.distance) : undefined;

  if (massKg === undefined) missing.push('mass');
  if (radiusM === undefined) missing.push('radius');
  if (distanceM === undefined) missing.push('distance');

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] };
  }

  const schwarzschild = schwarzschildRadiusM(massKg!);

  return {
    ok: true,
    value: {
      massKg: massKg!,
      radiusM: radiusM!,
      distanceM: distanceM!,
      schwarzschildRadiusM: schwarzschild,
      validity: assessNewtonianValidity(massKg!, distanceM!),
    },
  };
}
