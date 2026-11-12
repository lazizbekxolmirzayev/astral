import { describe, expect, it } from 'vitest';
import { DESTINATION_IDS } from '@/mission';
import { missionStore } from '@/stores/missionStore';
import { simStore } from '@/stores/simStore';
import { buildSimPlan, STAGE_IDS } from '@/mission/sim';
import { CINEMATIC_SECONDS, cinematicRate, MAX_CINEMATIC_RATE, stageSeconds } from './cinematic';
import { createGameStore } from './gameStore';
import { MAP_ANCHORS, MAP_RINGS, ringPoint, ringPoints } from './mapLayout';

describe('map layout', () => {
  it('has an anchor and camera pose for every destination', () => {
    for (const id of DESTINATION_IDS) {
      const anchor = MAP_ANCHORS[id];
      expect(anchor.id).toBe(id);
      expect(anchor.position.every(Number.isFinite)).toBe(true);
      expect(anchor.camera.position.every(Number.isFinite)).toBe(true);
    }
  });
  it('places ring points at the ring radius from the centre', () => {
    for (const ring of Object.values(MAP_RINGS)) {
      for (const point of ringPoints(ring.radius, ring.tilt, [0, 0, 0], 32)) expect(Math.hypot(...point)).toBeCloseTo(ring.radius, 9);
    }
    expect(ringPoint(2, 0, 0, [1, 2, 3])).toEqual([3, 2, 3]);
  });
});

describe('cinematic pacing', () => {
  it('makes each stage take about its target time to watch', () => {
    const id = missionStore.getState().createFromTemplate('moon', 'Test');
    const plan = buildSimPlan(missionStore.getState().missions[id]!);
    for (const stage of plan.stageIds) {
      const length = stageSeconds(plan, stage);
      const rate = cinematicRate(plan, stage);
      expect(rate).toBeGreaterThanOrEqual(1);
      expect(rate).toBeLessThanOrEqual(MAX_CINEMATIC_RATE);
      if (length > 0 && rate < MAX_CINEMATIC_RATE && rate > 1) expect(length / rate).toBeCloseTo(CINEMATIC_SECONDS[stage], 6);
    }
    expect(Object.keys(CINEMATIC_SECONDS).sort()).toEqual([...STAGE_IDS].sort());
  });
});

describe('game flow', () => {
  it('goes map → hangar → flight → result and back, with one mission document', () => {
    const game = createGameStore();
    expect(game.getState().phase).toBe('map');
    expect(game.getState().confirmDestination('x')).toBeNull(); // nothing focused yet
    game.getState().focusDestination('leo');
    const id = game.getState().confirmDestination('My first mission');
    expect(id).not.toBeNull();
    expect(game.getState().phase).toBe('hangar');
    expect(missionStore.getState().missions[id!]?.objective.destinationId).toBe('leo');

    // The shared simulation store is the one the game drives.
    const gameLike = createGameStore();
    gameLike.getState().focusDestination('leo');
    gameLike.getState().confirmDestination('Flight test');
    expect(gameLike.getState().launch()).toBe(true);
    expect(gameLike.getState().phase).toBe('flight');
    expect(simStore.getState().status).toBe('running');
    for (let index = 0; index < 4000 && simStore.getState().status === 'running'; index += 1) simStore.getState().tick(0.25);
    expect(simStore.getState().status).toBe('finished');
    expect(simStore.getState().sim?.outcome).not.toBeNull();
    gameLike.getState().showResult();
    expect(gameLike.getState().phase).toBe('result');
    gameLike.getState().redesign();
    expect(gameLike.getState().phase).toBe('hangar');
    expect(simStore.getState().status).toBe('idle');
    gameLike.getState().newMission();
    expect(gameLike.getState().phase).toBe('map');
    expect(gameLike.getState().missionId).toBeNull();
  });

  it('removes an unflown draft when the player leaves the hangar', () => {
    const game = createGameStore();
    game.getState().focusDestination('moon');
    const id = game.getState().confirmDestination('Draft')!;
    game.getState().cancelHangar();
    expect(game.getState().phase).toBe('map');
    expect(missionStore.getState().missions[id]).toBeUndefined();
  });

  it('ignores a launch outside the hangar', () => {
    const game = createGameStore();
    expect(game.getState().launch()).toBe(false);
    expect(game.getState().phase).toBe('map');
  });
});

describe('orbit pacing', () => {
  it('draws the operational orbit at a fixed pace and keeps the craft on it', async () => {
    const { operationalCraft, createSim, advanceSim } = await import('@/mission/sim');
    const { usesVisualOrbit, visualOrbitSeconds, VISUAL_ORBIT_SECONDS } = await import('./orbitPacing');
    for (const destination of ['leo', 'geo', 'moon', 'mars'] as const) {
      const id = missionStore.getState().createFromTemplate(destination, 'Pacing');
      const plan = buildSimPlan(missionStore.getState().missions[id]!);
      let state = createSim(plan);
      state = advanceSim(plan, state, 1e9); // to the end: positions only depend on the plan's orbit
      expect(usesVisualOrbit(plan, 'science-operations')).toBe(true);
      expect(usesVisualOrbit(plan, 'launch')).toBe(false);
      expect(visualOrbitSeconds(plan, VISUAL_ORBIT_SECONDS)).toBeCloseTo(plan.geometry.periodS, 6);
      const a = operationalCraft(plan, { ...state, stageIndex: plan.stageIds.indexOf('science-operations') }, 1000);
      const b = operationalCraft(plan, { ...state, stageIndex: plan.stageIds.indexOf('science-operations') }, 1000 + plan.geometry.periodS);
      expect(a.position.every(Number.isFinite)).toBe(true);
      for (let axis = 0; axis < 3; axis += 1) expect(b.position[axis]).toBeCloseTo(a.position[axis]!, 5);
    }
  });
});

describe('launch cameras and separation', () => {
  it('separation happens in order, inside the climb, and the schedule shows each from a camera that can see it', async () => {
    const { SEPARATION, autoCameraAt } = await import('../components/game/launchPath');
    expect(SEPARATION.boosters).toBeLessThan(SEPARATION.stage1);
    expect(SEPARATION.stage1).toBeLessThan(SEPARATION.fairing);
    expect(SEPARATION.fairing).toBeLessThan(1);
    // an outside camera is on while each piece falls away
    expect(['chase', 'rear', 'track']).toContain(autoCameraAt(SEPARATION.boosters + 0.02));
    expect(['chase', 'rear', 'track']).toContain(autoCameraAt(SEPARATION.stage1 + 0.02));
    expect(['chase', 'rear', 'track']).toContain(autoCameraAt(SEPARATION.fairing + 0.02));
    expect(autoCameraAt(0)).toBe('side');
    // the auto schedule never uses the removed/unknown cameras
    for (let tau = 0; tau <= 1; tau += 0.01) expect(['side', 'track', 'chase', 'rear', 'onboard', 'crew']).toContain(autoCameraAt(tau));
  });

  it('shakes hardest at lift-off and max-Q and jolts after a separation, then settles', async () => {
    const { shakeAmount } = await import('../components/game/launchPath');
    expect(shakeAmount(0.05, -1)).toBeGreaterThan(shakeAmount(0.6, -1));
    expect(shakeAmount(0.2, -1)).toBeGreaterThan(shakeAmount(0.5, -1));
    expect(shakeAmount(0.5, 0)).toBeGreaterThan(shakeAmount(0.5, -1));
    expect(shakeAmount(0.5, 3)).toBeCloseTo(shakeAmount(0.5, -1), 3);
    for (let tau = 0; tau <= 1; tau += 0.05) expect(shakeAmount(tau, 0)).toBeLessThanOrEqual(1.2);
  });

  it('the drawn vehicle has consistent proportions for every class', async () => {
    const { rocketDims } = await import('../components/game/RocketModel');
    for (const rocket of ['small', 'medium', 'heavy', 'super-heavy'] as const) {
      const d = rocketDims(rocket);
      expect(d.engineBase + d.firstStage + d.interstage + d.secondStage + d.noseHeight).toBeCloseTo(d.engineBase + d.body + d.noseHeight, 6);
      expect(d.engineBase + d.body + d.noseHeight).toBeCloseTo(d.height + d.engineBase, 6);
    }
    expect(rocketDims('heavy').boosters).toBeGreaterThan(0);
    expect(rocketDims('small').boosters).toBe(0);
  });

  it('the launch camera choice lives in the game store', async () => {
    const { gameStore, LAUNCH_CAMERAS } = await import('./gameStore');
    expect(LAUNCH_CAMERAS[0]).toBe('auto');
    gameStore.getState().setLaunchCamera('crew');
    expect(gameStore.getState().launchCamera).toBe('crew');
    gameStore.getState().setLaunchCamera('auto');
  });
});

describe('instrument dials', () => {
  it('log dials are 0 at zero, 1 at the top of the scale, and rise with the value', async () => {
    const { logFraction } = await import('../components/game/Instruments');
    expect(logFraction(0, 1000, 10)).toBe(0);
    expect(logFraction(1000, 1000, 10)).toBeCloseTo(1, 6);
    expect(logFraction(5000, 1000, 10)).toBe(1);
    let previous = -1;
    for (const value of [1, 10, 100, 500, 1000]) { const f = logFraction(value, 1000, 10); expect(f).toBeGreaterThan(previous); previous = f; }
  });
});
