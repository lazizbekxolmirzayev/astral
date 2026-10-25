import { describe, expect, it } from 'vitest';
import type { QualityTier } from '@/lib/performance';
import { bloomSettingsFor, gradeSettingsFor, msaaSamplesFor } from './cinematicGrade';

const TIERS: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra'];

describe('cinematic grade presets', () => {
  it('stays in a sane range on every tier', () => {
    for (const tier of TIERS) {
      const grade = gradeSettingsFor(tier);
      expect(grade.saturation).toBeGreaterThan(1);
      expect(grade.saturation).toBeLessThan(1.3);
      expect(grade.crush).toBeGreaterThanOrEqual(0);
      expect(grade.crush).toBeLessThan(0.05);
      expect(grade.vignette).toBeGreaterThan(0);
      expect(grade.vignette).toBeLessThanOrEqual(1);
      expect(grade.exposure).toBeGreaterThan(0.8);
      expect(bloomSettingsFor(tier).strength).toBeGreaterThan(0);
      expect(bloomSettingsFor(tier).threshold).toBeGreaterThan(0.5);
      for (const channel of [...grade.shadowTint, ...grade.highlightTint]) {
        expect(channel).toBeGreaterThan(0.7);
        expect(channel).toBeLessThan(1.3);
      }
    }
  });

  it('pushes the cinematic look further on stronger hardware', () => {
    expect(gradeSettingsFor('ultra').grain).toBeGreaterThan(gradeSettingsFor('low').grain);
    expect(gradeSettingsFor('ultra').aberration).toBeGreaterThan(gradeSettingsFor('low').aberration);
    expect(bloomSettingsFor('ultra').strength).toBeGreaterThan(bloomSettingsFor('low').strength);
  });

  it('only asks for SMAA when MSAA is off', () => {
    expect(msaaSamplesFor('low')).toBe(0);
    expect(msaaSamplesFor('high')).toBeGreaterThan(0);
    for (const tier of TIERS) {
      const samples = msaaSamplesFor(tier);
      expect(samples).toBeGreaterThanOrEqual(0);
      expect(samples).toBeLessThanOrEqual(4);
    }
  });
});
