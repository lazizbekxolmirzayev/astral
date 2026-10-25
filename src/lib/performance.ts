export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export type QualityPreset = {
  maxDpr: number;
  antialias: boolean;
  shadows: boolean;
  maximumBodies: number;
  targetFps: number;
};

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: { maxDpr: 1, antialias: false, shadows: false, maximumBodies: 32, targetFps: 30 },
  medium: { maxDpr: 1.25, antialias: true, shadows: false, maximumBodies: 64, targetFps: 45 },
  high: { maxDpr: 1.5, antialias: true, shadows: true, maximumBodies: 128, targetFps: 60 },
  ultra: { maxDpr: 1.75, antialias: true, shadows: true, maximumBodies: 512, targetFps: 60 },
};

export function detectQualityTier(input?: {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  gpu?: string;
}): QualityTier {
  const hardwareConcurrency = input?.hardwareConcurrency ?? globalThis.navigator?.hardwareConcurrency ?? 4;
  const deviceMemory = input?.deviceMemory ?? (globalThis.navigator as Navigator & { deviceMemory?: number } | undefined)?.deviceMemory ?? 4;
  const gpu = input?.gpu ?? (globalThis.navigator as Navigator & { gpu?: { vendor?: string; } } | undefined)?.gpu?.vendor ?? '';

  const highEndGpu = /m1|m2|m3|apple|nvidia|geforce|radeon|amd/.test(gpu.toLowerCase());
  if (highEndGpu && hardwareConcurrency >= 8 && deviceMemory >= 8) {
    return 'ultra';
  }
  if (highEndGpu && hardwareConcurrency >= 6 && deviceMemory >= 6) return 'high';
  if (hardwareConcurrency >= 4 && deviceMemory >= 4) return 'medium';
  return 'low';
}

export function capDprForTier(tier: QualityTier, devicePixelRatio = globalThis.devicePixelRatio ?? 1): number {
  return Math.min(devicePixelRatio, QUALITY_PRESETS[tier].maxDpr);
}

export function shouldUseWebWorker(bodyCount: number, mainThreadFrameMs: number, frameBudgetMs = 16.67): boolean {
  const overBudgetMarginMs = 0.25;
  return bodyCount >= 50 && mainThreadFrameMs > frameBudgetMs + overBudgetMarginMs;
}

export function estimateFps(frameMs: number): number {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return 0;
  return 1000 / frameMs;
}

export function benchmarkBeforeAfter(beforeMs: number, afterMs: number): {
  fpsBefore: number;
  fpsAfter: number;
  improvementPercent: number;
} {
  const fpsBefore = estimateFps(beforeMs);
  const fpsAfter = estimateFps(afterMs);
  const improvementPercent = fpsBefore === 0 ? 0 : ((fpsAfter - fpsBefore) / fpsBefore) * 100;
  return { fpsBefore, fpsAfter, improvementPercent };
}

export class RingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private size = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('RingBuffer capacity must be a positive integer');
    }
    this.buffer = new Array<T | undefined>(capacity);
  }

  push(value: T): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size += 1;
  }

  toArray(): T[] {
    const items: T[] = [];
    if (this.size === 0) return items;
    for (let index = 0; index < this.size; index += 1) {
      const slot = (this.head + this.capacity - this.size + index) % this.capacity;
      const value = this.buffer[slot];
      if (value !== undefined) items.push(value);
    }
    return items;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }
}

export function noMemoryGrowthOverFiveMinutes(beforeBytes: number, afterBytes: number, growthLimitBytes = 10 * 1024 * 1024): boolean {
  return Number.isFinite(beforeBytes) && Number.isFinite(afterBytes) && afterBytes - beforeBytes <= growthLimitBytes;
}
