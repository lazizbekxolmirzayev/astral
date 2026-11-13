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
      if (stage !== 'launch' && stage !== 'pre-launch' && length > 0 && rate < MAX_CINEMATIC_RATE && rate > 1) expect(length / rate).toBeCloseTo(CINEMATIC_SECONDS[stage], 6);
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

describe('real-time launch pacing', () => {
  it('plays the climb in real time and only the last minute of the countdown, at the chosen speed', () => {
    const mission = missionStore.getState().createFromTemplate('geo', 'x');
    const plan = buildSimPlan(missionStore.getState().missions[mission]!);
    expect(cinematicRate(plan, 'launch')).toBe(1);
    expect(cinematicRate(plan, 'launch', { speed: 4 })).toBe(4);
    const hold = stageSeconds(plan, 'pre-launch');
    expect(cinematicRate(plan, 'pre-launch', { stageElapsedS: 0 })).toBeGreaterThan(50);
    expect(cinematicRate(plan, 'pre-launch', { stageElapsedS: hold - 30 })).toBe(1);
    expect(cinematicRate(plan, 'pre-launch', { stageElapsedS: hold - 30, speed: 2 })).toBe(2);
    // a launch lasts about as long as a real ascent (nine minutes)
    expect(stageSeconds(plan, 'launch') / cinematicRate(plan, 'launch')).toBeGreaterThan(400);
  });
});

describe('voice announcer', () => {
  const base = { stage: 'pre-launch' as const, stageElapsedS: 0, stageLengthS: 3600, altitudeKm: 0, speedKms: 0, parkingKm: 300, hasBoosters: true, separation: { boosters: 0.38, stage1: 0.62, fairing: 0.8 }, lost: false };
  it('counts down once each, in order, and calls liftoff', async () => {
    const { createAnnouncer } = await import('./voice');
    const announcer = createAnnouncer();
    const said: string[] = [];
    for (let remaining = 3600; remaining >= 0; remaining -= 1) {
      for (const line of announcer.update({ ...base, stageElapsedS: 3600 - remaining })) said.push(line.id);
    }
    expect(said.slice(0, 2)).toEqual(['cd60', 'cd30']);
    expect(said.filter((id) => id.startsWith('count-'))).toEqual(Array.from({ length: 10 }, (_, i) => `count-${10 - i}`));
    expect(new Set(said).size).toBe(said.length);
    const launch = announcer.update({ ...base, stage: 'launch', stageElapsedS: 1, stageLengthS: 540 });
    expect(launch.map((line) => line.id)).toContain('liftoff');
  });
  it('says what is left to orbit and skips booster calls for a vehicle without boosters', async () => {
    const { createAnnouncer } = await import('./voice');
    const announcer = createAnnouncer();
    const lines = announcer.update({ ...base, stage: 'launch', stageElapsedS: 400, stageLengthS: 540, altitudeKm: 150, speedKms: 5, hasBoosters: false });
    expect(lines.map((line) => line.id)).not.toContain('boosters');
    expect(lines.map((line) => line.id)).toContain('stage1');
    expect(lines.find((line) => line.id === 'orbit-1')?.params).toEqual({ distance: 150 });
  });
  it('announces a lost vehicle and nothing else', async () => {
    const { createAnnouncer } = await import('./voice');
    const lines = createAnnouncer().update({ ...base, stage: 'launch', stageElapsedS: 100, stageLengthS: 540, lost: true });
    expect(lines.map((line) => line.id)).toEqual(['lost']);
  });
  it('has a message for every line key in every language', async () => {
    const { createAnnouncer } = await import('./voice');
    const keys = new Set<string>();
    const announcer = createAnnouncer();
    for (const stage of ['pre-launch', 'launch', 'orbit-insertion', 'cruise', 'destination-arrival', 'science-operations', 'data-transmission', 'mission-completion'] as const) {
      for (let elapsed = 0; elapsed <= 3600; elapsed += 5) for (const line of announcer.update({ ...base, stage, stageElapsedS: stage === 'launch' ? elapsed % 541 : elapsed, stageLengthS: stage === 'launch' ? 540 : 3600 })) keys.add(line.key);
    }
    const en = (await import('../messages/en.json')).default.game.voice as Record<string, unknown>;
    const uz = (await import('../messages/uz.json')).default.game.voice as Record<string, unknown>;
    for (const key of keys) { expect(en[key], `en ${key}`).toBeTypeOf('string'); expect(uz[key], `uz ${key}`).toBeTypeOf('string'); }
  });
});

describe('flight recorder', () => {
  it('works out acceleration in g from the change of speed and keeps a chart history', async () => {
    const { createFlightRecorder } = await import('./recorder');
    const recorder = createFlightRecorder();
    let snapshot = recorder.snapshot();
    for (let t = 0; t <= 100; t += 1) snapshot = recorder.push({ clockT: 3600 + t, stage: 'launch', launchElapsedS: t, altitudeKm: t, speedMps: 98.0665 * t });
    expect(snapshot.g).toBeGreaterThan(0.9); // 98.07 m/s per second = 10 g, smoothed toward it
    expect(snapshot.samples.length).toBeGreaterThan(40);
    const before = snapshot.samples.length;
    expect(recorder.push({ clockT: 3700, stage: 'orbit-insertion', launchElapsedS: 540, altitudeKm: 300, speedMps: 7700 }).g).toBe(0);
    expect(recorder.snapshot().samples.length).toBe(before);
    expect(recorder.push({ clockT: 0, stage: 'pre-launch', launchElapsedS: 0, altitudeKm: 0, speedMps: 0 }).samples.length).toBe(0);
  });
});
