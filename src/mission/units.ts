/**
 * Units and conversions for the mission domain — pure TypeScript, no React.
 *
 * The existing physics core works in AU, days and `gm` in AU³/day² (G = 1). Mission
 * design works in kg, W, m/s, USD and bits. This module is the single boundary
 * between the two worlds: every mission quantity carries an explicit unit symbol,
 * and conversions go through the SI base unit of its dimension. A conversion
 * between different dimensions throws instead of returning a wrong number.
 *
 * Conventions:
 * - Data sizes use decimal prefixes (1 GB = 10⁹ bytes, 1 Gbit = 10⁹ bits).
 * - `yr` is the Julian year (365.25 d).
 * - `USD` is an educational, constant-value dollar: no inflation, no exchange rates.
 * - `dB`/`dBi` are logarithmic power ratios; use `dbToRatio`/`ratioToDb` to leave
 *   the log domain. They convert to each other 1:1 and to nothing else.
 */

export type Dimension =
  | 'mass'
  | 'length'
  | 'time'
  | 'velocity'
  | 'acceleration'
  | 'power'
  | 'energy'
  | 'area'
  | 'data'
  | 'dataRate'
  | 'currency'
  | 'angle'
  | 'frequency'
  | 'ratio'
  | 'gain'
  | 'gravParam'
  | 'specificEnergy'
  | 'irradiance'
  | 'temperature'
  | 'score';

type UnitDef = { readonly dimension: Dimension; /** Multiplier to the SI base unit of the dimension. */ readonly factor: number };

const UNITS = {
  kg: { dimension: 'mass', factor: 1 },
  g: { dimension: 'mass', factor: 1e-3 },
  t: { dimension: 'mass', factor: 1e3 },

  m: { dimension: 'length', factor: 1 },
  km: { dimension: 'length', factor: 1e3 },
  AU: { dimension: 'length', factor: 149_597_870_700 },

  s: { dimension: 'time', factor: 1 },
  min: { dimension: 'time', factor: 60 },
  h: { dimension: 'time', factor: 3600 },
  d: { dimension: 'time', factor: 86_400 },
  yr: { dimension: 'time', factor: 31_557_600 },

  'm/s': { dimension: 'velocity', factor: 1 },
  'km/s': { dimension: 'velocity', factor: 1e3 },

  'm/s^2': { dimension: 'acceleration', factor: 1 },

  W: { dimension: 'power', factor: 1 },
  kW: { dimension: 'power', factor: 1e3 },

  J: { dimension: 'energy', factor: 1 },
  Wh: { dimension: 'energy', factor: 3600 },
  kWh: { dimension: 'energy', factor: 3.6e6 },

  'm^2': { dimension: 'area', factor: 1 },

  bit: { dimension: 'data', factor: 1 },
  byte: { dimension: 'data', factor: 8 },
  Mbit: { dimension: 'data', factor: 1e6 },
  Gbit: { dimension: 'data', factor: 1e9 },
  MB: { dimension: 'data', factor: 8e6 },
  GB: { dimension: 'data', factor: 8e9 },

  'bit/s': { dimension: 'dataRate', factor: 1 },
  'kbit/s': { dimension: 'dataRate', factor: 1e3 },
  'Mbit/s': { dimension: 'dataRate', factor: 1e6 },
  'Gbit/s': { dimension: 'dataRate', factor: 1e9 },

  USD: { dimension: 'currency', factor: 1 },
  kUSD: { dimension: 'currency', factor: 1e3 },
  MUSD: { dimension: 'currency', factor: 1e6 },

  rad: { dimension: 'angle', factor: 1 },
  deg: { dimension: 'angle', factor: Math.PI / 180 },

  Hz: { dimension: 'frequency', factor: 1 },
  MHz: { dimension: 'frequency', factor: 1e6 },
  GHz: { dimension: 'frequency', factor: 1e9 },

  '1': { dimension: 'ratio', factor: 1 },
  '%': { dimension: 'ratio', factor: 0.01 },

  dBi: { dimension: 'gain', factor: 1 },
  dB: { dimension: 'gain', factor: 1 },

  'm^3/s^2': { dimension: 'gravParam', factor: 1 },
  'km^3/s^2': { dimension: 'gravParam', factor: 1e9 },

  'm^2/s^2': { dimension: 'specificEnergy', factor: 1 },
  'km^2/s^2': { dimension: 'specificEnergy', factor: 1e6 },

  'W/m^2': { dimension: 'irradiance', factor: 1 },

  K: { dimension: 'temperature', factor: 1 },

  /** Game-defined science points. Not a physical unit. */
  pt: { dimension: 'score', factor: 1 },
} as const satisfies Record<string, UnitDef>;

export type UnitSymbol = keyof typeof UNITS;

export const UNIT_SYMBOLS = Object.keys(UNITS) as UnitSymbol[];

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}

export function isUnit(symbol: string): symbol is UnitSymbol {
  return Object.prototype.hasOwnProperty.call(UNITS, symbol);
}

function definition(symbol: string): UnitDef {
  if (!isUnit(symbol)) throw new UnitError(`unknown unit "${symbol}"`);
  return UNITS[symbol];
}

export function dimensionOf(symbol: string): Dimension {
  return definition(symbol).dimension;
}

/** Converts `value` between two units of the same dimension. */
export function convert(value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new UnitError(`value must be finite, got ${String(value)}`);
  const source = definition(from);
  const target = definition(to);
  if (source.dimension !== target.dimension) {
    throw new UnitError(`cannot convert ${from} (${source.dimension}) to ${to} (${target.dimension})`);
  }
  return (value * source.factor) / target.factor;
}

/** The value in the SI base unit of its dimension (kg, m, s, m/s, W, J, bit, …). */
export function toBase(quantity: { value: number; unit: string }): number {
  if (!Number.isFinite(quantity.value)) throw new UnitError(`value must be finite, got ${String(quantity.value)}`);
  return quantity.value * definition(quantity.unit).factor;
}

/** The value of `quantity` expressed in `unit`. Throws on a dimension mismatch. */
export function valueIn(quantity: { value: number; unit: string }, unit: UnitSymbol): number {
  return convert(quantity.value, quantity.unit, unit);
}

/** Power ratio from decibels: 10^(dB/10). */
export function dbToRatio(decibels: number): number {
  if (!Number.isFinite(decibels)) throw new UnitError(`decibels must be finite, got ${String(decibels)}`);
  return 10 ** (decibels / 10);
}

/** Decibels from a positive power ratio: 10·log10(ratio). */
export function ratioToDb(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) throw new UnitError(`ratio must be a positive number, got ${String(ratio)}`);
  return 10 * Math.log10(ratio);
}
