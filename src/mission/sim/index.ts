/** Phase 5: the interactive mission simulation (pure TypeScript; no React, no Three.js). */
export { SIM_ASSUMPTIONS, SIM_ASSUMPTION_LIST } from './assumptions';
export { advanceSim, contactOverlap, createSim, durationText, runToEnd, scienceEarned, skipToNextStage, stageLength, stageTitle } from './engine';
export { generateEvents } from './events';
export { buildSimPlan, LAUNCH_BLOCKING_ISSUES, MISSION_CLASS, STAGES_OF_CLASS } from './plan';
export type { PlanInstrument, SimPlan } from './plan';
export { createRng, hashString, streamRng } from './rng';
export { craftState, craftTrail, frameKeyOf, frameOf, operationalCraft, operationalTrail } from './scene';
export type { SceneBody, SceneFrame, ScenePath } from './scene';
export { readTelemetry } from './telemetry';
export type { Telemetry } from './telemetry';
export * from './types';
