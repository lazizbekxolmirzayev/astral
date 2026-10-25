import type { BodyDefinition } from '@/physics/gravity';
import type { CatalogAdapterResult, CatalogObject } from '@/types/catalog';
import { coerceQuantity, computeVectorMagnitude, toLengthMeters, toMassKg, toVector3, toVelocityAuPerDay } from './utils';

export function catalogToBody(record: CatalogObject): CatalogAdapterResult<BodyDefinition> {
  const missing: string[] = [];

  const bodyId = record.id?.trim();
  if (!bodyId) missing.push('id');

  const gmValue = record.gm ? coerceQuantity(record.gm, 'mass') : undefined;
  const massValue = record.mass ? toMassKg(record.mass) : undefined;
  const position = record.position ? toVector3(record.position, 'length') : undefined;
  const velocity = record.velocity ? toVector3(record.velocity, 'velocity') : undefined;

  if (gmValue === undefined && massValue === undefined) missing.push('gm or mass');
  if (!position) missing.push('position');
  if (!velocity) missing.push('velocity');

  if (missing.length > 0) {
    return { ok: false, missing: [...new Set(missing)] };
  }

  const gm = gmValue ?? (massValue === undefined ? 0 : (6.67430e-11 * massValue) / (149_597_870_700 ** 3 / 86_400 ** 2));
  const bodyPosition = position ?? [0, 0, 0];
  const bodyVelocity = velocity ?? [0, 0, 0];

  return {
    ok: true,
    value: {
      id: bodyId,
      gm,
      position: [bodyPosition[0], bodyPosition[1], bodyPosition[2]],
      velocity: [bodyVelocity[0], bodyVelocity[1], bodyVelocity[2]],
    },
  };
}

export function catalogToBodyMass(record: CatalogObject): CatalogAdapterResult<BodyDefinition> {
  return catalogToBody(record);
}

export function catalogToBodyFromCatalog(record: CatalogObject): CatalogAdapterResult<BodyDefinition> {
  return catalogToBody(record);
}

export function catalogToBodyFromMass(record: CatalogObject): CatalogAdapterResult<BodyDefinition> {
  return catalogToBody(record);
}

export function catalogToBodyFromVector(record: CatalogObject): CatalogAdapterResult<BodyDefinition> {
  return catalogToBody(record);
}
