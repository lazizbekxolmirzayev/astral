/**
 * UI-facing snapshot of the simulation, published at a throttled rate.
 *
 * The engine (`lib/simulation.ts`) runs every frame; this store does not. A
 * frame driver calls `publishDiagnostics()` each frame and the store drops
 * everything but one update per `DIAGNOSTICS_INTERVAL_MS`, so the panel reads
 * ~4 numbers a second instead of 60. That keeps rule 4 (no per-frame React
 * state) intact while still being live.
 */

import { create } from 'zustand';
import { toKilometresPerSecond } from '@/physics/diagnostics';
import { simulation } from '@/lib/simulation';
import { type StabilityWarning, evaluateStability } from '@/lib/stability';

/** Minimum gap between two publishes, in real milliseconds. */
export const DIAGNOSTICS_INTERVAL_MS = 250;

export type BodyRow = {
  id: string;
  distanceAu: number;
  speedKmPerSecond: number;
  escapeKmPerSecond: number;
  /** speed ÷ escape speed; ≥ 1 means the body is unbound from the Sun. */
  boundRatio: number;
};

export type DiagnosticsState = {
  elapsedDays: number;
  energyDriftPercent: number;
  momentumDriftPercent: number;
  stepsPerSecond: number;
  bodies: BodyRow[];
  warnings: StabilityWarning[];
  /** False until the first publish, so the panel never shows a made-up zero. */
  ready: boolean;
};

const empty: DiagnosticsState = {
  elapsedDays: 0,
  energyDriftPercent: 0,
  momentumDriftPercent: 0,
  stepsPerSecond: 0,
  bodies: [],
  warnings: [],
  ready: false,
};

export const useDiagnosticsStore = create<DiagnosticsState>()(() => empty);

let lastPublishMs = 0;

/** Reads the engine and pushes a new snapshot, at most every 250 ms. */
export function publishDiagnostics(nowMs: number): void {
  if (nowMs - lastPublishMs < DIAGNOSTICS_INTERVAL_MS) return;
  lastPublishMs = nowMs;

  const snapshot = simulation.snapshot();
  const kinematics = simulation.kinematics();
  useDiagnosticsStore.setState({
    elapsedDays: snapshot.elapsedDays,
    energyDriftPercent: snapshot.energyDriftPercent,
    momentumDriftPercent: snapshot.momentumDriftPercent,
    stepsPerSecond: snapshot.stepsPerSecond,
    bodies: kinematics.map((row) => ({
      id: row.id,
      distanceAu: row.distanceAu,
      speedKmPerSecond: toKilometresPerSecond(row.speedAuPerDay),
      escapeKmPerSecond: toKilometresPerSecond(row.escapeSpeedAuPerDay),
      boundRatio: row.boundRatio,
    })),
    warnings: evaluateStability(kinematics),
    ready: true,
  });
}

/** Force the next publish through, so a pause or reset shows up immediately. */
export function invalidateDiagnostics(): void {
  lastPublishMs = 0;
}
