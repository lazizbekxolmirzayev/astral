import type { CatalogObject, Quantity } from '@/types/catalog';

export const AU_METRES = 149_597_870_700;
export const SECONDS_PER_DAY = 86_400;
export const GRAVITATIONAL_CONSTANT = 6.67430e-11;

export function coerceQuantity(quantity: Quantity | number, kind: 'mass' | 'length' | 'velocity' | 'density'): number {
  if (typeof quantity === 'number') return quantity;

  const value = Number(quantity.value);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${kind} quantity: ${String(quantity)}`);

  const unit = quantity.unit.trim().toLowerCase();
  switch (kind) {
    case 'mass':
      if (unit === 'kg') return value;
      if (unit === 'g') return value / 1000;
      if (unit === 't' || unit === 'tonne' || unit === 'metricton') return value * 1000;
      return value;
    case 'length':
      if (unit === 'm') return value;
      if (unit === 'km') return value * 1000;
      if (unit === 'au' || unit === 'astronomicalunit') return value * AU_METRES;
      return value;
    case 'velocity':
      if (unit === 'm/s') return value;
      if (unit === 'km/s') return value * 1000;
      if (unit === 'au/day') return value * AU_METRES / SECONDS_PER_DAY;
      return value;
    case 'density':
      if (unit === 'kg/m^3' || unit === 'kg/m3') return value;
      if (unit === 'g/cm^3' || unit === 'g/cm3') return value * 1000;
      return value;
    default:
      return value;
  }
}

export function toMassKg(quantity?: Quantity): number | undefined {
  if (!quantity) return undefined;
  return coerceQuantity(quantity, 'mass');
}

export function toLengthMeters(quantity?: Quantity): number | undefined {
  if (!quantity) return undefined;
  return coerceQuantity(quantity, 'length');
}

export function toVelocityMs(quantity?: Quantity): number | undefined {
  if (!quantity) return undefined;
  return coerceQuantity(quantity, 'velocity');
}

export function toDensityKgM3(quantity?: Quantity): number | undefined {
  if (!quantity) return undefined;
  return coerceQuantity(quantity, 'density');
}

export function toVector3(vector: readonly number[] | { x: number; y: number; z: number } | [number, number, number], kind: 'length' | 'velocity'): [number, number, number] | undefined {
  if (Array.isArray(vector)) {
    if (vector.length !== 3) return undefined;
    return [
      kind === 'length' ? Number(vector[0]) : Number(vector[0]),
      kind === 'length' ? Number(vector[1]) : Number(vector[1]),
      kind === 'length' ? Number(vector[2]) : Number(vector[2]),
    ];
  }

  if ('x' in vector && 'y' in vector && 'z' in vector) {
    return [Number(vector.x), Number(vector.y), Number(vector.z)];
  }

  return undefined;
}

export function toVelocityAuPerDay(value: number): number {
  return (value * SECONDS_PER_DAY) / AU_METRES;
}

export function computeVectorMagnitude(values: readonly number[]): number {
  return Math.sqrt(values.reduce((total, value) => total + value * value, 0));
}

export function getScalarFromCatalog(record: CatalogObject, key: 'velocity' | 'position' | 'radius' | 'distance' | 'speed' | 'mass' | 'gm'): number | undefined {
  if (key === 'velocity' && record.velocity) {
    const values = Array.isArray(record.velocity)
      ? record.velocity
      : [record.velocity.x, record.velocity.y, record.velocity.z];
    return computeVectorMagnitude(values.map((value) => Number(value)));
  }

  if (key === 'position' && record.position) {
    const values = Array.isArray(record.position)
      ? record.position
      : [record.position.x, record.position.y, record.position.z];
    return computeVectorMagnitude(values.map((value) => Number(value)));
  }

  if (key === 'radius' && record.radius) return toLengthMeters(record.radius);
  if (key === 'distance' && record.distance) return toLengthMeters(record.distance);
  if (key === 'mass' && record.mass) return toMassKg(record.mass);
  if (key === 'gm' && record.gm) return coerceQuantity(record.gm, 'mass');
  if (key === 'speed' && record.velocity) {
    const values = Array.isArray(record.velocity)
      ? record.velocity
      : [record.velocity.x, record.velocity.y, record.velocity.z];
    return computeVectorMagnitude(values.map((value) => Number(value)));
  }

  return undefined;
}
