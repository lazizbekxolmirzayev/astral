import { describe, expect, it } from 'vitest';
import { formatBits, formatBitRate, formatDistance, formatMissionTime, formatMoney, formatNumber, formatSpeed } from './format';

describe('game formatting', () => {
  it('formats distances in sensible units', () => {
    expect(formatDistance(500, 'en')).toBe('500 m');
    expect(formatDistance(500_000, 'en')).toBe('500 km');
    expect(formatDistance(384_400_000, 'en')).toContain('km');
    expect(formatDistance(1.5e11, 'en')).toBe('150 M km');
    expect(formatDistance(Number.NaN, 'en')).toBe('—');
  });
  it('formats speed, data, money and rates', () => {
    expect(formatSpeed(120, 'en')).toBe('120 m/s');
    expect(formatSpeed(7_800, 'en')).toBe('7.8 km/s');
    expect(formatBits(8e9, 'en')).toBe('1 GB');
    expect(formatBits(8e3, 'en')).toBe('1 kB');
    expect(formatMoney(42e6, 'en')).toBe('$42M');
    expect(formatMoney(250e3, 'en')).toBe('$250k');
    expect(formatBitRate(2.5e6, 'en')).toBe('2.5 Mbit/s');
    expect(formatNumber(Infinity, 'en')).toBe('—');
  });
  it('formats the mission clock', () => {
    expect(formatMissionTime(0)).toBe('T+ 00:00:00');
    expect(formatMissionTime(3_725)).toBe('T+ 01:02:05');
    expect(formatMissionTime(86_400 * 3 + 61)).toBe('T+ 3d 00:01:01');
    expect(formatMissionTime(-5)).toBe('T+ 00:00:00');
  });
});
