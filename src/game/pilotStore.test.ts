import { describe, expect, it } from 'vitest';
import { DESTINATION_IDS } from '@/mission';
import { buildSimPlan, advanceSim, createSim } from '@/mission/sim';
import { missionStore } from '@/stores/missionStore';
import { orbitOf, TARGET_ALTITUDE_M } from './pilot/model';
import { createPilotStore, vehicleOf } from './pilotStore';
import { DIFFICULTIES, DIFFICULTY_RULES } from './difficulty';
import { computeScore } from './score';

const planOf = (destination: (typeof DESTINATION_IDS)[number]) => {
  const id = missionStore.getState().createFromTemplate(destination, 'Pilot test');
  return buildSimPlan(missionStore.getState().missions[id]!);
};
const fly = (store: ReturnType<typeof createPilotStore>, seconds = 1_500) => {
  for (let i = 0; i < seconds * 20 && store.getState().flight?.status === 'flying'; i += 1) store.getState().update(0.05);
};

describe('the pilot store', () => {
  it('builds a vehicle from the mission: the payload is the design\'s launch mass, within the launcher capacity', () => {
    for (const destination of DESTINATION_IDS) {
      const plan = planOf(destination);
      const vehicle = vehicleOf(plan);
      expect(vehicle.payloadMass).toBeGreaterThan(0);
      expect(vehicle.payloadMass).toBeLessThanOrEqual(vehicle.liftoffMass / 20);
    }
  });

  it('does not start when the film is chosen', () => {
    const store = createPilotStore();
    store.getState().setMode('off');
    expect(store.getState().begin(planOf('leo'))).toBe(false);
    expect(store.getState().flight).toBeNull();
  });

  it('flies a default mission to orbit with the autopilot and rates it', () => {
    for (const destination of DESTINATION_IDS) {
      const store = createPilotStore();
      store.getState().setMode('auto');
      store.getState().setWarp(8);
      expect(store.getState().begin(planOf(destination))).toBe(true);
      fly(store);
      const flight = store.getState().flight!;
      expect(flight.status).toBe('orbit');
      expect(orbitOf(flight).periapsis).toBeGreaterThan(TARGET_ALTITUDE_M * 0.9);
      expect(store.getState().rating?.grade).toBe('perfect');
    }
  });

  it('fails a flight that is not steered after the first stage (assisted mode, no input)', () => {
    const store = createPilotStore();
    store.getState().setMode('assist');
    store.getState().setWarp(8);
    store.getState().setCrewCount(4); // every station has a person, so nobody flies the engines for them
    store.getState().begin(planOf('leo'));
    fly(store);
    expect(store.getState().flight?.status).not.toBe('orbit');
    expect(store.getState().flight?.status).not.toBe('flying');
  });

  it('records the keys: pitch is limited and the throttle stays within 0..1', () => {
    const store = createPilotStore();
    store.getState().setThrottle(5);
    expect(store.getState().throttle).toBe(1);
    store.getState().setThrottle(-2);
    expect(store.getState().throttle).toBe(0);
    store.getState().nudgePitch(500);
    expect(store.getState().pitchCommand).toBeCloseTo((110 * Math.PI) / 180, 6);
    store.getState().nudgePitch(-900);
    expect(store.getState().pitchCommand).toBeCloseTo(-(20 * Math.PI) / 180, 6);
  });

  it('lets the mission simulation take the flown result: a failure ends the mission at launch, a success goes on', () => {
    const plan = planOf('leo');
    const toLaunchEnd = (override: NonNullable<typeof plan.launch.pilot>, success: boolean) => {
      const flown = { ...plan, launch: { ...plan.launch, success, pilot: override } };
      let sim = createSim(flown);
      sim = advanceSim(flown, sim, 1e7);
      return sim;
    };
    const lost = toLaunchEnd({ failure: 'stress', grade: null }, false);
    expect(lost.outcome?.kind).toBe('failure');
    expect(lost.outcome?.endedIn).toBe('launch');
    const ok = toLaunchEnd({ failure: null, grade: 'perfect' }, true);
    expect(ok.stages.find((stage) => stage.id === 'launch')?.result).toBe('ok');
  });

  it('a lone player gets the AI engineer: the throttle is set by the AI once the person lets go, and a touch hands it back', () => {
    const store = createPilotStore();
    store.getState().setCrewCount(1);
    store.getState().begin(planOf('leo'));
    store.getState().setThrottle(0.3);
    store.getState().update(0.05);
    expect(store.getState().throttle).toBeCloseTo(0.3, 5);
    expect(store.getState().aiAction).toBeNull();
    for (let i = 0; i < 80; i += 1) store.getState().update(0.05); // four idle seconds
    expect(store.getState().aiAction).toBe('throttle');
    expect(store.getState().throttle).toBeGreaterThan(0.9);
    store.getState().setThrottle(0.2);
    store.getState().update(0.05);
    expect(store.getState().throttle).toBeCloseTo(0.2, 5);
  });

  it('with two players the engineer is a person: the throttle is never taken away', () => {
    const store = createPilotStore();
    store.getState().setCrewCount(2);
    store.getState().begin(planOf('leo'));
    store.getState().setThrottle(0.4);
    for (let i = 0; i < 120; i += 1) store.getState().update(0.05);
    expect(store.getState().aiAction).toBeNull();
    expect(store.getState().throttle).toBeCloseTo(0.4, 5);
  });

  it('the AI power tech eases a dangerous turn, so a hard turn no longer breaks the vehicle up', () => {
    const run = (count: number) => {
      const store = createPilotStore();
      store.getState().setMode('manual');
      store.getState().setCrewCount(count);
      store.getState().begin(planOf('leo'));
      store.getState().setThrottle(1);
      store.getState().setWarp(4);
      for (let i = 0; i < 600 && store.getState().flight?.status === 'flying'; i += 1) {
        store.getState().update(0.05);
        if (i > 100) store.getState().nudgePitch(20);
      }
      return store.getState().flight!.status;
    };
    expect(run(4)).toBe('broke-up');
    expect(run(1)).not.toBe('broke-up');
  });

  it('a human power tech can switch the load limiter on: the same hard turn no longer breaks the vehicle up', () => {
    const run = (limiter: boolean) => {
      const store = createPilotStore();
      store.getState().setMode('manual');
      store.getState().setCrewCount(4);
      store.getState().setLimiter(limiter);
      store.getState().setWarp(4);
      store.getState().begin(planOf('leo'));
      for (let i = 0; i < 600 && store.getState().flight?.status === 'flying'; i += 1) {
        store.getState().update(0.05);
        if (i > 100) store.getState().nudgePitch(20);
      }
      return store.getState().flight!.status;
    };
    expect(run(false)).toBe('broke-up');
    expect(run(true)).not.toBe('broke-up');
  });

  it('each difficulty level sets the starting mode: cadet and engineer are assisted, director flies by hand', () => {
    const store = createPilotStore();
    for (const level of DIFFICULTIES) {
      store.getState().setDifficulty(level);
      expect(store.getState().mode).toBe(DIFFICULTY_RULES[level].mode);
    }
    expect(DIFFICULTY_RULES.cadet.mode).toBe('assist');
    expect(DIFFICULTY_RULES.director.mode).toBe('manual');
  });

  it('on cadet the load limiter is always on, even with every station crewed', () => {
    const run = (difficulty: 'cadet' | 'engineer') => {
      const store = createPilotStore();
      store.getState().setDifficulty(difficulty);
      store.getState().setMode('manual');
      store.getState().setCrewCount(4);
      store.getState().setWarp(4);
      store.getState().begin(planOf('leo'));
      for (let i = 0; i < 600 && store.getState().flight?.status === 'flying'; i += 1) {
        store.getState().update(0.05);
        if (i > 100) store.getState().nudgePitch(20);
      }
      return store.getState().flight!.status;
    };
    expect(run('engineer')).toBe('broke-up');
    expect(run('cadet')).not.toBe('broke-up');
  });

  it('the director level adds a bonus line to the score; the other levels do not', () => {
    const outcome = { kind: 'success', requirements: [], scienceNominal: 0, sciencePoints: 0, generatedBits: 0, deliveredBits: 0 } as never;
    const base = { outcome, health: 1, log: [], playerCount: 1 };
    expect(computeScore({ ...base, difficulty: 'engineer' }).lines.some((line) => line.id === 'difficulty')).toBe(false);
    const director = computeScore({ ...base, difficulty: 'director' });
    expect(director.lines.find((line) => line.id === 'difficulty')).toEqual({ id: 'difficulty', points: 100, max: 100 });
    expect(computeScore({ ...base, outcome: { ...(outcome as object), kind: 'failure' } as never, difficulty: 'director' }).lines.find((line) => line.id === 'difficulty')?.points).toBe(0);
  });

  it('with ignition required the vehicle waits on the pad until it is lit; an AI engineer lights it after three seconds', () => {
    const store = createPilotStore();
    store.getState().setRequireIgnition(true);
    store.getState().setCrewCount(4);
    store.getState().begin(planOf('leo'));
    for (let i = 0; i < 100; i += 1) store.getState().update(0.1);
    expect(store.getState().ignited).toBe(false);
    expect(store.getState().flight!.t).toBe(0);
    store.getState().ignite();
    for (let i = 0; i < 20; i += 1) store.getState().update(0.1);
    expect(store.getState().flight!.t).toBeGreaterThan(0);

    const lone = createPilotStore();
    lone.getState().setRequireIgnition(true);
    lone.getState().setCrewCount(1);
    lone.getState().begin(planOf('leo'));
    for (let i = 0; i < 20; i += 1) lone.getState().update(0.1);
    expect(lone.getState().ignited).toBe(false);
    for (let i = 0; i < 20; i += 1) lone.getState().update(0.1);
    expect(lone.getState().ignited).toBe(true);
  });

  it('the gravity-turn switch makes a hand-flown first stage follow its own path, so it does not break up', () => {
    const run = (pathHold: boolean) => {
      const store = createPilotStore();
      store.getState().setMode('manual');
      store.getState().setCrewCount(4);
      store.getState().setPathHold(pathHold);
      store.getState().setWarp(4);
      store.getState().begin(planOf('leo'));
      for (let i = 0; i < 600 && store.getState().flight?.status === 'flying' && store.getState().flight!.stage === 1; i += 1) {
        store.getState().update(0.05);
        if (i > 100) store.getState().nudgePitch(20);
      }
      return store.getState().flight!.status;
    };
    expect(run(false)).toBe('broke-up');
    expect(run(true)).not.toBe('broke-up');
  });
});
