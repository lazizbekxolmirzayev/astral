/**
 * A flight recorder for the ascent instruments: it keeps the flown altitude and speed (for the strip chart) and
 * the acceleration worked out from how fast the speed changes per mission second. Pure and framework-free; the
 * panel feeds it from the simulation's telemetry.
 */
export type ChartSample = { t: number; altitudeKm: number; speedKms: number };
export type RecorderSnapshot = { samples: readonly ChartSample[]; g: number };
export type RecorderInput = { clockT: number; stage: string; launchElapsedS: number; altitudeKm: number; speedMps: number };

/** Seconds of the climb between two chart samples. */
export const SAMPLE_EVERY_S = 2;

export function createFlightRecorder() {
  let samples: ChartSample[] = [];
  let g = 0;
  let last: { t: number; speed: number } | null = null;
  let snapshot: RecorderSnapshot = { samples, g };
  return {
    snapshot: () => snapshot,
    /** Feeds one reading; returns the new snapshot (the same object when nothing changed). */
    push(input: RecorderInput): RecorderSnapshot {
      const { clockT, stage, launchElapsedS, altitudeKm, speedMps } = input;
      let changed = false;
      const lastSample = samples[samples.length - 1];
      // a restart, or the pad: forget the old flight
      if (stage === 'pre-launch' || (lastSample && launchElapsedS < lastSample.t - 1)) {
        if (samples.length > 0 || g !== 0) { samples = []; g = 0; changed = true; }
        last = null;
      }
      if (stage === 'launch') {
        if (last && clockT > last.t + 1e-6) {
          const raw = (speedMps - last.speed) / (clockT - last.t) / 9.80665;
          g = g * 0.9 + Math.min(8, Math.max(0, raw)) * 0.1;
          changed = true;
        }
        const tail = samples[samples.length - 1];
        if (!tail || launchElapsedS - tail.t >= SAMPLE_EVERY_S) {
          samples = [...samples, { t: launchElapsedS, altitudeKm, speedKms: speedMps / 1000 }];
          changed = true;
        }
        last = { t: clockT, speed: speedMps };
      } else if (stage !== 'pre-launch') {
        if (g !== 0) { g = 0; changed = true; }
        last = null;
      }
      if (changed) snapshot = { samples, g };
      return snapshot;
    },
  };
}
