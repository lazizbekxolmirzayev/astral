import { describe, expect, it } from 'vitest';
import { UNIT_SYMBOLS, UnitError, convert, dbToRatio, dimensionOf, isUnit, ratioToDb, toBase, valueIn } from './units';

describe('mission units', () => {
  it('converts within a dimension through the SI base unit', () => {
    expect(convert(1, 'AU', 'km')).toBeCloseTo(149_597_870.7, 6);
    expect(convert(1, 'Wh', 'J')).toBe(3600);
    expect(convert(1, 'GB', 'Gbit')).toBe(8);
    expect(convert(1, 'byte', 'bit')).toBe(8);
    expect(convert(2.5, 'km/s', 'm/s')).toBe(2500);
    expect(convert(180, 'deg', 'rad')).toBeCloseTo(Math.PI, 12);
    expect(convert(1, 'yr', 'd')).toBe(365.25);
    expect(convert(1.5, 'MUSD', 'USD')).toBe(1_500_000);
    expect(convert(1, 'km^2/s^2', 'm^2/s^2')).toBe(1e6);
    expect(convert(398_600.4418, 'km^3/s^2', 'm^3/s^2')).toBeCloseTo(3.986004418e14, 0);
  });

  it('round-trips through every unit of its dimension', () => {
    for (const from of UNIT_SYMBOLS) {
      for (const to of UNIT_SYMBOLS) {
        if (dimensionOf(from) !== dimensionOf(to)) continue;
        expect(convert(convert(123.456, from, to), to, from)).toBeCloseTo(123.456, 9);
      }
    }
  });

  it('refuses to convert between dimensions instead of returning a wrong number', () => {
    expect(() => convert(1, 'kg', 'W')).toThrow(UnitError);
    expect(() => convert(1, 'm', 'm/s')).toThrow(/length.*velocity/);
    expect(() => valueIn({ value: 5, unit: 'W' }, 'kg')).toThrow(UnitError);
  });

  it('rejects unknown units and non-finite values', () => {
    expect(isUnit('kg')).toBe(true);
    expect(isUnit('furlong')).toBe(false);
    expect(isUnit('toString')).toBe(false);
    expect(() => dimensionOf('furlong')).toThrow(UnitError);
    expect(() => convert(1, 'kg', 'stone')).toThrow(UnitError);
    expect(() => convert(Number.NaN, 'kg', 'g')).toThrow(UnitError);
    expect(() => toBase({ value: Number.POSITIVE_INFINITY, unit: 'kg' })).toThrow(UnitError);
  });

  it('gives the SI base value of a quantity', () => {
    expect(toBase({ value: 2, unit: 't' })).toBe(2000);
    expect(valueIn({ value: 3600, unit: 's' }, 'h')).toBe(1);
  });

  it('converts decibels as power ratios', () => {
    expect(dbToRatio(0)).toBe(1);
    expect(dbToRatio(10)).toBeCloseTo(10, 12);
    expect(dbToRatio(3)).toBeCloseTo(1.9953, 4);
    expect(ratioToDb(100)).toBeCloseTo(20, 12);
    expect(ratioToDb(dbToRatio(43))).toBeCloseTo(43, 12);
    expect(() => ratioToDb(0)).toThrow(UnitError);
    expect(() => ratioToDb(-1)).toThrow(UnitError);
    expect(() => dbToRatio(Number.NaN)).toThrow(UnitError);
  });

  it('keeps decibels out of every other dimension', () => {
    expect(() => convert(10, 'dB', '1')).toThrow(UnitError);
    expect(convert(10, 'dB', 'dBi')).toBe(10);
  });
});
