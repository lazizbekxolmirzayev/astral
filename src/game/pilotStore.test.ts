import { describe, expect, it } from 'vitest';
import { DESTINATION_IDS } from '@/mission';
import { buildSimPlan, advanceSim, createSim } from '@/mission/sim';
import { missionStore } from '@/stores/missionStore';
import { orbitOf, TARGET_ALTITUDE_M } from './pilot/model';
import { createPilotStore, vehicleOf } from './pilotStore';

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
});
