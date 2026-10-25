import type { BodyDefinition } from '@/physics/gravity';
import type { CatalogAdapterResult, CatalogObject } from '@/types/catalog';
import { getScalarFromCatalog, toMassKg, toVector3 } from './utils';

export function catalogToStar(record: CatalogObject): CatalogAdapterResult<BodyDefinition> {
  const missing: string[] = [];

  if (!record.id?.trim()) missing.push('id');
  if (!record.mass && !record.gm) missing.push('mass or gm');
  if (!record.position) missing.push('position');
  if (!record.velocity) missing.push('velocity');

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] };
  }

  const position = toVector3(record.position!, 'length');
  const velocity = toVector3(record.velocity!, 'velocity');
  const massKg = record.mass ? toMassKg(record.mass) : undefined;
  const gm = record.gm ? Number(record.gm.value) : undefined;

  const convertedGm = gm ?? (massKg === undefined ? 0 : (6.67430e-11 * massKg) / (149_597_870_700 ** 3 / 86_400 ** 2));

  return {
    ok: true,
    value: {
      id: record.id,
      gm: convertedGm,
      position: [position![0], position![1], position![2]],
      velocity: [velocity![0], velocity![1], velocity![2]],
    },
  };
}
