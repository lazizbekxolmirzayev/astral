import type { Vec3 } from '@/physics/orbits';
import type { Localized } from '../i18n';
import { scienceEarned } from './engine';
import type { SimPlan } from './plan';
import { craftState, frameOf, sceneDistance } from './scene';
import type { InstrumentStatus, PowerMode, StageId, SimState } from './types';

export type Telemetry = {
  elapsedS: number;
  stage: StageId;
  /** 0..1 within the stage's planned length. */
  stageProgress: number;
  frameKey: string;
  /** Position in the frame's scene units, and what those are. */
  position: Vec3;
  unit: 'radii' | 'AU';
  /** Distance from the centre of the frame's body, metres. */
  distanceM: number;
  /** Height above the surface for frames around a planet or moon; null around the Sun. */
  altitudeM: number | null;
  speedMps: number;
  powerGenerationW: number;
  powerLoadW: number;
  batteryJ: number;
  batteryCapacityJ: number;
  batteryFraction: number;
  powerMode: PowerMode;
  sunlit: boolean;
  instruments: Array<{ instrumentId: string; name: Localized; status: InstrumentStatus }>;
  generatedBits: number;
  deliveredBits: number;
  lostBits: number;
  backlogBits: number;
  inContact: boolean;
  health: number;
  dvRemaining: number;
  sciencePoints: number;
};

/** Every live number the panel shows, read from the simulation state and the plan; nothing here is scripted. */
export function readTelemetry(plan: SimPlan, state: SimState, clockT: number = state.t): Telemetry {
  const stage = plan.stageIds[state.stageIndex]!;
  const length = stage === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[stage] ?? 0);
  const craft = craftState(plan, state, clockT);
  const frame = frameOf(plan, craft.frameKey);
  const distanceM = sceneDistance(craft.position, [0, 0, 0]) * frame.unitLength;
  const bodyRadius = frame.center === 'sun' ? null : frame.unitLength;
  return {
    elapsedS: Math.max(state.t, state.ended ? state.t : clockT),
    stage,
    stageProgress: length > 0 ? Math.min(1, state.stageElapsedS / length) : state.ended ? 1 : 0,
    frameKey: craft.frameKey,
    position: craft.position,
    unit: frame.unit,
    distanceM,
    altitudeM: bodyRadius === null ? null : Math.max(0, distanceM - bodyRadius),
    speedMps: craft.speedMps,
    powerGenerationW: state.generationW,
    powerLoadW: state.loadW,
    batteryJ: state.batteryJ,
    batteryCapacityJ: plan.power.batteryCapacityJ,
    batteryFraction: plan.power.batteryCapacityJ > 0 ? state.batteryJ / plan.power.batteryCapacityJ : 0,
    powerMode: state.powerMode,
    sunlit: state.sunlit,
    instruments: plan.instruments.map((instrument, index) => ({ instrumentId: instrument.instrumentId, name: instrument.name, status: state.instruments[index]?.status ?? 'off' })),
    generatedBits: state.generatedBits,
    deliveredBits: state.deliveredBits,
    lostBits: state.lostBits,
    backlogBits: state.backlogBits,
    inContact: state.inContact,
    health: state.health,
    dvRemaining: Math.max(0, plan.dv.available - state.dvUsed),
    sciencePoints: scienceEarned(plan, state),
  };
}
