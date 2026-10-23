import { describe, expect, it } from 'vitest';
import { fbm3, valueNoise3 } from './noise';

describe('noise', () => {
  it('is deterministic and bounded', () => {
    for (let i = 0; i < 500; i++) {
      const v = fbm3(i * 0.37, i * 0.11, i * 0.73, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fbm3(i * 0.37, i * 0.11, i * 0.73, 5)).toBe(v);
    }
  });
  it('is continuous (no jumps between nearby samples)', () => {
    for (let i = 0; i < 200; i++) {
      const a = valueNoise3(i * 0.31, 1.7, 2.9, 1);
      const b = valueNoise3(i * 0.31 + 1e-4, 1.7, 2.9, 1);
      expect(Math.abs(a - b)).toBeLessThan(0.01);
    }
  });
  it('differs between seeds', () => {
    expect(valueNoise3(3.3, 4.4, 5.5, 1)).not.toBe(valueNoise3(3.3, 4.4, 5.5, 2));
  });
});
