import { describe, expect, it } from 'vitest';
import { pulseTimes } from './pulsarAudio';

describe('pulseTimes', () => {
  it('places pulses exactly one period apart', () => {
    const t = pulseTimes(1, 1.5, 0.1);
    expect(t.length).toBe(5);
    expect(t[1]! - t[0]!).toBeCloseTo(0.1, 12);
  });
  it('returns nothing for invalid periods', () => {
    expect(pulseTimes(0, 1, 0)).toEqual([]);
    expect(pulseTimes(0, 1, Number.NaN)).toEqual([]);
  });
  it('is empty when the next pulse is beyond the horizon', () => {
    expect(pulseTimes(2, 1, 0.1)).toEqual([]);
  });
});
