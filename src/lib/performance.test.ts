import { describe, expect, it } from 'vitest';
import {
  RingBuffer,
  benchmarkBeforeAfter,
  capDprForTier,
  detectQualityTier,
  noMemoryGrowthOverFiveMinutes,
  shouldUseWebWorker,
} from './performance';

describe('performance profile helpers', () => {
  it('chooses a lower quality tier on weak hardware', () => {
    expect(detectQualityTier({ hardwareConcurrency: 2, deviceMemory: 2, gpu: 'Intel' })).toBe('low');
    expect(detectQualityTier({ hardwareConcurrency: 8, deviceMemory: 8, gpu: 'NVIDIA' })).toBe('ultra');
  });

  it('caps DPR by quality tier', () => {
    expect(capDprForTier('low', 3)).toBe(1);
    expect(capDprForTier('high', 3)).toBe(2);
  });

  it('only offloads to a worker when the 50-body budget is exceeded', () => {
    expect(shouldUseWebWorker(49, 16.5)).toBe(false);
    expect(shouldUseWebWorker(50, 16.5)).toBe(false);
    expect(shouldUseWebWorker(50, 16.7)).toBe(false);
    expect(shouldUseWebWorker(50, 17.0)).toBe(true);
  });

  it('reports fps before and after using the same benchmark formula', () => {
    const before = 16.67;
    const after = 12.5;
    const report = benchmarkBeforeAfter(before, after);
    expect(report.fpsBefore).toBeCloseTo(59.99, 1);
    expect(report.fpsAfter).toBeCloseTo(80, 0);
    expect(report.improvementPercent).toBeGreaterThan(0);
    console.log(`[fps-benchmark] before=${report.fpsBefore.toFixed(2)} FPS, after=${report.fpsAfter.toFixed(2)} FPS, improvement=${report.improvementPercent.toFixed(1)}%`);
  });

  it('keeps a fixed-size ring buffer without unbounded growth', () => {
    const trail = new RingBuffer<number>(3);
    trail.push(1);
    trail.push(2);
    trail.push(3);
    trail.push(4);
    expect(trail.length).toBe(3);
    expect(trail.toArray()).toEqual([2, 3, 4]);
  });

  it('does not show memory growth over a five-minute workload budget', () => {
    const beforeBytes = 64 * 1024 * 1024;
    const afterBytes = beforeBytes + 2 * 1024 * 1024;
    expect(noMemoryGrowthOverFiveMinutes(beforeBytes, afterBytes)).toBe(true);
    expect(noMemoryGrowthOverFiveMinutes(beforeBytes, beforeBytes + 20 * 1024 * 1024)).toBe(false);
  });
});
