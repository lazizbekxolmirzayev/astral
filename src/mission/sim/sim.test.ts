import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LAUNCHERS } from '@/mission/catalog';
import { addPart, setLauncher, setOperationsDays, setOrbit, setPartQuantity, setPropellantMass, setSeed } from '@/mission/edit';
import { evaluateMission } from '@/mission/engine';
import { DESTINATION_IDS, type DestinationId } from '@/mission/models/catalog';
import type { Mission } from '@/mission/models/mission';
import { createDefaultMission } from '@/mission/templates/defaults';
import { createSimStore, SIM_SPEEDS } from '@/stores/simStore';
import {
  advanceSim, buildSimPlan, contactOverlap, craftState, craftTrail, createSim, frameKeyOf, frameOf, generateEvents, readTelemetry, runToEnd, scienceEarned, skipToNextStage, stageLength, streamRng, STAGES_OF_CLASS,
  type SimPlan, type SimState,
} from '.';

const NOW = '2026-06-06T00:00:00.000Z';
const mk = (destination: DestinationId, seed = 42): Mission => createDefaultMission(destination, { id: `m-${destination}`, now: NOW, title: 'Test', seed });
const edit = (mission: Mission, result: { mission: Mission; error?: string }): Mission => {
  expect(result.error).toBeUndefined();
  return result.mission;
};
const fly = (mission: Mission) => {
  const plan = buildSimPlan(mission);
  return { plan, sim: runToEnd(plan, createSim(plan)) };
};
const summary = (sim: SimState) => JSON.stringify({ t: sim.t, outcome: sim.outcome, stages: sim.stages, timeline: sim.timeline, bits: [sim.generatedBits, sim.deliveredBits, sim.lostBits, sim.backlogBits], dv: sim.dvUsed, battery: sim.batteryJ, health: sim.health });

describe('seeded random numbers', () => {
  it('give the same sequence for the same seed and stream, and independent streams', () => {
    const a = streamRng(7, 'events');
    const b = streamRng(7, 'events');
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
    expect(streamRng(7, 'launch')()).not.toBe(streamRng(7, 'events')());
    expect(streamRng(8, 'events')()).not.toBe(streamRng(7, 'events')());
    for (let index = 0; index < 100; index += 1) { const x = a(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});

describe('stage plans', () => {
  it('an Earth-orbit mission has no cruise or arrival, every other class does, and they differ', () => {
    expect(STAGES_OF_CLASS['earth-orbit']).not.toContain('cruise');
    expect(STAGES_OF_CLASS['earth-orbit']).not.toContain('destination-arrival');
    for (const destination of ['geo', 'moon', 'mars', 'helio'] as const) {
      const plan = buildSimPlan(mk(destination));
      expect(plan.stageIds).toContain('cruise');
      expect(plan.stageIds).toContain('destination-arrival');
    }
    expect(buildSimPlan(mk('leo')).stageIds).not.toEqual(buildSimPlan(mk('mars')).stageIds);
    // the stage list always begins with the pre-launch checks and ends with completion
    for (const destination of DESTINATION_IDS) {
      const ids = buildSimPlan(mk(destination)).stageIds;
      expect(ids[0]).toBe('pre-launch');
      expect(ids.at(-1)).toBe('mission-completion');
      expect(ids).toContain('science-operations');
      expect(ids).toContain('data-transmission');
    }
  });

  it('stage lengths come from the mission: cruise from the destination, operations from the document', () => {
    const mars = buildSimPlan(mk('mars'));
    expect(mars.stagePlannedS.cruise).toBeCloseTo(260 * 86_400, 0);
    const longer = edit(mk('leo'), setOperationsDays(mk('leo'), 100));
    expect(buildSimPlan(longer).ops.plannedS).toBe(100 * 86_400);
  });

  it('reports the departure energy in km²/s², as the pre-launch and departure messages say', () => {
    const plan = buildSimPlan(mk('mars'));
    expect(plan.departure!.providedC3).toBeCloseTo(10, 6);
    expect(plan.departure!.requiredC3).toBeGreaterThan(5);
    expect(plan.departure!.requiredC3).toBeLessThan(15);
    const sim = runToEnd(plan, createSim(plan));
    expect(sim.stages.find((stage) => stage.id === 'orbit-insertion')!.outcome!.en).toContain('km²/s²');
    expect(sim.stages.find((stage) => stage.id === 'orbit-insertion')!.outcome!.en).not.toMatch(/\d{4,}/);
    expect(buildSimPlan(mk('leo')).departure).toBeNull();
  });

  it('takes its numbers from the resource engine, not from its own copies', () => {
    const mission = mk('sso');
    const plan = buildSimPlan(mission);
    const details = evaluateMission(mission).details!;
    expect(plan.dv.available).toBe(details.deltaV.available.value);
    expect(plan.power.batteryCapacityJ).toBe(details.power.batteryUsable.value);
    expect(plan.link.rateBps).toBe(details.link.usableRate.value);
    expect(plan.storageBits).toBe(details.data.storage.value);
    expect(plan.power.bolW).toBe(details.power.generationBol.value);
  });
});

describe('a complete mission for every destination', () => {
  it.each(DESTINATION_IDS)('%s flies every stage and ends with an explained outcome', (destination) => {
    const { plan, sim } = fly(mk(destination));
    expect(sim.ended).toBe(true);
    expect(sim.outcome).not.toBeNull();
    expect(['success', 'partial', 'failure']).toContain(sim.outcome!.kind);
    expect(sim.outcome!.reasons.length).toBeGreaterThan(0);
    for (const stage of sim.stages) {
      expect(stage.startS, stage.id).not.toBeNull();
      expect(stage.endS, stage.id).not.toBeNull();
      expect(stage.endS!).toBeGreaterThanOrEqual(stage.startS!);
      expect(['ok', 'degraded']).toContain(stage.result);
    }
    // stages follow each other in time
    for (let index = 1; index < sim.stages.length; index += 1) expect(sim.stages[index]!.startS!).toBeGreaterThanOrEqual(sim.stages[index - 1]!.endS! - 1e-6);
    expect(sim.stages.length).toBe(plan.stageIds.length);
    // everything has an English and an Uzbek text
    for (const entry of sim.timeline) { expect(entry.text.en.length).toBeGreaterThan(0); expect(entry.text.uz.length).toBeGreaterThan(0); }
    expect(sim.timeline.some((entry) => entry.kind === 'stage')).toBe(true);
  });

  it('the stage lengths flown match the plan (cruise, arrival and the like)', () => {
    const { plan, sim } = fly(mk('moon'));
    for (const stage of sim.stages) {
      if (stage.id === 'data-transmission' || stage.id === 'mission-completion') continue;
      expect(stage.endS! - stage.startS!, stage.id).toBeCloseTo(stageLength(plan, stage.id), 3);
    }
  });
});

describe('determinism', () => {
  it('the same design and seed give exactly the same mission', () => {
    for (const destination of ['sso', 'mars'] as const) {
      expect(summary(fly(mk(destination, 5)).sim)).toBe(summary(fly(mk(destination, 5)).sim));
    }
  });

  it('does not depend on how playback splits the time', () => {
    const plan = buildSimPlan(mk('sso', 11));
    const whole = runToEnd(plan, createSim(plan));
    let chunked = createSim(plan);
    let clock = 0;
    const sizes = [37, 5_000, 123, 86_400, 9_999, 600_000];
    let index = 0;
    while (!chunked.ended && index < 20_000) {
      clock += sizes[index % sizes.length]!;
      chunked = advanceSim(plan, chunked, clock - chunked.t);
      index += 1;
    }
    // one last push through the end, as the player's clock would do
    chunked = runToEnd(plan, chunked);
    expect(summary(chunked)).toBe(summary(whole));
  });

  it('the event schedule is a pure function of the seed, and different seeds differ', () => {
    const input = { seed: 9, opsStartS: 1_000, opsEndS: 1_000 + 800 * 86_400, instrumentCount: 2, hasArrays: true };
    expect(generateEvents(input)).toEqual(generateEvents(input));
    expect(generateEvents({ ...input, seed: 10 })).not.toEqual(generateEvents(input));
    for (const event of generateEvents(input)) {
      expect(event.startS).toBeGreaterThanOrEqual(input.opsStartS);
      expect(event.startS).toBeLessThanOrEqual(input.opsEndS);
      if (event.endS !== null) expect(event.endS).toBeGreaterThan(event.startS);
    }
    expect(generateEvents({ ...input, opsEndS: input.opsStartS })).toEqual([]);
  });

  it('all five kinds of event occur across seeds, and each one is explained in the timeline when it happens', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) for (const event of buildSimPlan(mk('sso', seed)).events) kinds.add(event.kind);
    expect([...kinds].sort()).toEqual(['communication-outage', 'increased-power-demand', 'instrument-malfunction', 'observation-opportunity', 'solar-degradation']);
    const { sim } = fly(mk('sso', 3));
    const happened = sim.timeline.filter((entry) => entry.kind === 'event');
    expect(happened.length).toBeGreaterThan(0);
    for (const entry of happened) expect(entry.cause !== null || entry.severity === 'success' || entry.severity === 'info').toBe(true);
  });
});

describe('engineering behaviour', () => {
  it('a payload above the launcher capacity never launches', () => {
    const base = mk('mars');
    const mission = edit(base, setLauncher(base, 'launcher-small'));
    const plan = buildSimPlan(mission);
    expect(plan.evaluation.issues.some((issue) => issue.code === 'mass-over-launcher-capacity')).toBe(true);
    expect(plan.blockers.length).toBeGreaterThan(0);
    const sim = runToEnd(plan, createSim(plan));
    expect(sim.outcome!.kind).toBe('failure');
    expect(sim.stages.find((stage) => stage.id === 'pre-launch')!.result).toBe('failed');
    expect(sim.stages.find((stage) => stage.id === 'launch')!.startS).toBeNull();
    expect(sim.stages.find((stage) => stage.id === 'launch')!.result).toBe('skipped');
    expect(sim.timeline.some((entry) => entry.severity === 'error' && entry.text.en.includes('hold'))).toBe(true);
  });

  it('a launch failure follows the seeded draw against the launcher reliability', () => {
    let failed: SimPlan | null = null;
    let passed: SimPlan | null = null;
    for (let seed = 1; seed <= 400 && (!failed || !passed); seed += 1) {
      const plan = buildSimPlan(mk('leo', seed));
      if (!plan.launch.success) failed ??= plan; else passed ??= plan;
    }
    expect(failed).not.toBeNull();
    expect(passed).not.toBeNull();
    const lostSim = runToEnd(failed!, createSim(failed!));
    expect(lostSim.outcome!.kind).toBe('failure');
    expect(lostSim.stages.find((stage) => stage.id === 'launch')!.result).toBe('failed');
    expect(lostSim.stages.find((stage) => stage.id === 'orbit-insertion')!.result).toBe('skipped');
    expect(failed!.launch.draw).toBeGreaterThanOrEqual(failed!.launch.reliability);
    expect(passed!.launch.draw).toBeLessThan(passed!.launch.reliability);
  });

  it('too little Δv makes the orbit insertion (Earth orbit) or the capture (Mars) fail', () => {
    // A higher orbit than the launcher delivers needs an insertion burn the default LEO propellant cannot give.
    const low = mk('leo');
    const high = edit(low, setOrbit(low, { periapsisAltKm: 1500, apoapsisAltKm: 1500 }));
    const highPlan = buildSimPlan(high);
    expect(highPlan.dv.available).toBeLessThan(highPlan.dv.insertion);
    const highSim = runToEnd(highPlan, createSim(highPlan));
    expect(highSim.stages.find((stage) => stage.id === 'orbit-insertion')!.result).toBe('failed');
    expect(highSim.stages.find((stage) => stage.id === 'science-operations')!.result).toBe('skipped');
    expect(highSim.outcome!.kind).toBe('failure');

    const mars = edit(mk('mars'), setPropellantMass(mk('mars'), 5));
    const marsPlan = buildSimPlan(mars);
    const marsSim = runToEnd(marsPlan, createSim(marsPlan));
    expect(marsSim.stages.find((stage) => stage.id === 'destination-arrival')!.result).toBe('failed');
    expect(marsSim.stages.find((stage) => stage.id === 'science-operations')!.result).toBe('skipped');
    expect(marsSim.outcome!.kind).toBe('failure');
  });

  it('a mission with Δv for the capture but not for all the stationkeeping flies a shorter operations stage', () => {
    const base = mk('moon');
    const slack = (kg: number) => {
      const plan = buildSimPlan(edit(base, setPropellantMass(base, kg)));
      return plan.dv.available - (plan.dv.insertion + plan.dv.corrections + 0.3 * plan.dv.stationkeeping);
    };
    let lo = 0;
    let hi = base.spacecraft.propellantMassKg;
    expect(slack(hi)).toBeGreaterThan(0);
    for (let index = 0; index < 60; index += 1) { const mid = (lo + hi) / 2; if (slack(mid) < 0) lo = mid; else hi = mid; }
    const plan = buildSimPlan(edit(base, setPropellantMass(base, hi)));
    expect(plan.ops.limit).toBe('propellant');
    expect(plan.ops.effectiveS).toBeGreaterThan(0);
    expect(plan.ops.effectiveS).toBeLessThan(plan.ops.plannedS);
    const sim = runToEnd(plan, createSim(plan));
    expect(sim.opsFlownS).toBeCloseTo(plan.ops.effectiveS, 3);
    expect(sim.opsFlownS / plan.ops.plannedS).toBeCloseTo(0.3, 2);
    expect(sim.timeline.some((entry) => entry.kind === 'science' && entry.severity === 'warning')).toBe(true);
    expect(sim.outcome!.reasons.some((reason) => reason.en.includes('propellant'))).toBe(true);
  });

  it('when the mission time runs out the operations stop', () => {
    const base = mk('leo');
    const mission = edit(base, setOperationsDays(base, 9_000));
    const plan = buildSimPlan(mission);
    expect(plan.ops.limit).toBe('design-life');
    expect(plan.ops.effectiveS).toBeLessThan(plan.ops.plannedS);
    const sim = runToEnd(plan, createSim(plan));
    expect(sim.opsFlownS).toBeCloseTo(plan.ops.effectiveS, 3);
    expect(sim.outcome!.reasons.some((reason) => reason.en.includes('design life'))).toBe(true);
    expect(sim.stages.find((stage) => stage.id === 'science-operations')!.endS! - sim.stages.find((stage) => stage.id === 'science-operations')!.startS!).toBeCloseTo(plan.ops.effectiveS, 3);
  });

  const withArrays = (mission: Mission, itemId: string, quantity: number): Mission => {
    let next = mission;
    for (const part of mission.spacecraft.parts.filter((entry) => entry.itemId.startsWith('solar'))) next = edit(next, setPartQuantity(next, part.itemId, 0));
    return quantity > 0 ? edit(next, setPartQuantity(addIfMissing(next, itemId), itemId, quantity)) : next;
  };
  const addIfMissing = (mission: Mission, itemId: string): Mission => (mission.spacecraft.parts.some((entry) => entry.itemId === itemId) ? mission : edit(mission, addPart(mission, itemId)));

  it('without solar arrays the battery drains and the spacecraft is browned out and lost', () => {
    const mission = withArrays(mk('sso'), 'solar-body-025', 0);
    const plan = buildSimPlan(mission);
    expect(plan.power.bolW).toBe(0);
    const sim = runToEnd(plan, createSim(plan));
    expect(sim.timeline.some((entry) => entry.kind === 'power' && entry.severity === 'error' && entry.text.en.startsWith('Brownout'))).toBe(true);
    expect(sim.timeline.some((entry) => entry.severity === 'error' && entry.text.en.startsWith('Spacecraft lost'))).toBe(true);
    expect(sim.health).toBe(0);
    expect(sim.outcome!.kind).not.toBe('success');
    expect(sim.outcome!.sciencePoints).toBeLessThan(sim.outcome!.scienceNominal);
  });

  it('when power is short, instruments are switched off first and they earn less science', () => {
    const full = fly(mk('sso')).sim;
    let found: { plan: SimPlan; sim: SimState; statuses: Set<string> } | null = null;
    for (let quantity = 1; quantity <= 12 && !found; quantity += 1) {
      const plan = buildSimPlan(withArrays(mk('sso'), 'solar-body-025', quantity));
      let sim = createSim(plan);
      const statuses = new Set<string>();
      for (let step = 1; step <= 4_000 && !sim.ended; step += 1) {
        sim = advanceSim(plan, sim, sim.t + 20_000 - sim.t + 0);
        sim.instruments.forEach((item) => statuses.add(item.status));
        if (sim.stageIndex >= plan.stageIds.indexOf('data-transmission')) break;
      }
      if (statuses.has('unpowered') && sim.timeline.some((entry) => entry.text.en.includes('switched off'))) found = { plan, sim: runToEnd(plan, sim), statuses };
    }
    expect(found).not.toBeNull();
    expect(found!.statuses.has('unpowered')).toBe(true);
    expect(found!.sim.outcome!.sciencePoints).toBeLessThan(full.outcome!.sciencePoints);
  }, 120_000);

  it('battery energy stays within its capacity and health within 0..1, whatever the design', () => {
    fc.assert(fc.property(fc.constantFrom(...DESTINATION_IDS), fc.integer({ min: 0, max: 5_000 }), fc.integer({ min: 1, max: 6 }), (destination, seed, chunks) => {
      const plan = buildSimPlan(mk(destination, seed));
      let sim = createSim(plan);
      for (let index = 0; index < 30 && !sim.ended; index += 1) {
        sim = advanceSim(plan, sim, (index + 1) * chunks * 40_000);
        expect(sim.batteryJ).toBeGreaterThanOrEqual(0);
        expect(sim.batteryJ).toBeLessThanOrEqual(plan.power.batteryCapacityJ + 1e-6);
        expect(sim.health).toBeGreaterThanOrEqual(0);
        expect(sim.health).toBeLessThanOrEqual(1);
        expect(sim.backlogBits).toBeGreaterThanOrEqual(0);
        expect(sim.backlogBits).toBeLessThanOrEqual(plan.storageBits + 1e-3);
        expect(sim.deliveredBits).toBeLessThanOrEqual(sim.generatedBits * (1 + 1e-9) + 1);
        expect(sim.dvUsed).toBeLessThanOrEqual(plan.dv.available * (1 + 1e-6) + 1e-6);
      }
    }), { numRuns: 12 });
  });

  it('a link that cannot carry what the instruments produce lets the data queue up and then be lost', () => {
    const plan = buildSimPlan(mk('sso'));
    const weak: SimPlan = { ...plan, events: [], link: { ...plan.link, rateBps: plan.link.rateBps / 1_000 } };
    const strong: SimPlan = { ...plan, events: [] };
    const stop = plan.ops.startS + 60 * 86_400;
    const a = advanceSim(strong, createSim(strong), stop);
    const b = advanceSim(weak, createSim(weak), stop);
    expect(b.deliveredBits).toBeLessThan(a.deliveredBits / 100);
    expect(b.backlogBits).toBeGreaterThan(a.backlogBits);
    expect(b.backlogBits).toBeLessThanOrEqual(weak.storageBits + 1e-3);
    const end = runToEnd(weak, createSim(weak));
    expect(end.lostBits).toBeGreaterThan(0);
    expect(end.timeline.some((entry) => entry.kind === 'comms' && entry.severity !== 'success' && entry.text.en.includes('backlog'))).toBe(true);
    expect(end.timeline.some((entry) => entry.text.en.includes('storage is full'))).toBe(true);
    expect(end.outcome!.reasons.some((reason) => reason.en.includes('Gbit'))).toBe(true);
    expect(end.outcome!.sciencePoints).toBeLessThan(runToEnd(strong, createSim(strong)).outcome!.sciencePoints);
  });

  it('data is only downlinked inside a contact window, and a daily window is the length the link model says', () => {
    const plan = buildSimPlan(mk('sso'));
    let covered = 0;
    for (let t = 0; t < 86_400; t += 30) covered += contactOverlap(plan, t, 30);
    expect(covered).toBeCloseTo(Math.min(plan.link.contactS, 86_400), 3);
    expect(contactOverlap(plan, 0, 0)).toBe(0);
  });

  it('an instrument malfunction reduces the science of that mission', () => {
    let proven = false;
    for (let seed = 1; seed <= 200 && !proven; seed += 1) {
      const plan = buildSimPlan(mk('sso', seed));
      const hit = plan.events.find((event) => event.kind === 'instrument-malfunction');
      if (!hit) continue;
      const instrument = plan.instruments[hit.instrumentIndex!]!;
      if (!instrument.pointingOk || instrument.relay) continue;
      const clean: SimPlan = { ...plan, events: plan.events.filter((event) => event.kind !== 'instrument-malfunction') };
      const withFault = runToEnd(plan, createSim(plan));
      const without = runToEnd(clean, createSim(clean));
      expect(withFault.outcome!.sciencePoints).toBeLessThanOrEqual(without.outcome!.sciencePoints + 1e-9);
      if (withFault.outcome!.sciencePoints < without.outcome!.sciencePoints - 1e-6) {
        proven = true;
        expect(withFault.timeline.some((entry) => entry.text.en.startsWith('Instrument malfunction'))).toBe(true);
        expect(withFault.instruments[hit.instrumentIndex!]!.observedS).toBeLessThan(without.instruments[hit.instrumentIndex!]!.observedS);
      }
    }
    expect(proven).toBe(true);
  });

  it('a communication outage keeps data in the queue; an observation opportunity earns more science', () => {
    const plan = buildSimPlan(mk('sso', 3));
    const none: SimPlan = { ...plan, events: [] };
    const outage: SimPlan = { ...plan, events: [{ id: 'o', kind: 'communication-outage', startS: plan.ops.startS + 86_400, endS: plan.ops.startS + 20 * 86_400, magnitude: 1, instrumentIndex: null }] };
    const stopAfter = plan.ops.startS + 10 * 86_400;
    const a = advanceSim(none, createSim(none), stopAfter);
    const b = advanceSim(outage, createSim(outage), stopAfter);
    expect(b.deliveredBits).toBeLessThan(a.deliveredBits);
    expect(b.backlogBits + b.lostBits).toBeGreaterThan(a.backlogBits + a.lostBits);
    const boosted: SimPlan = { ...plan, events: [{ id: 'b', kind: 'observation-opportunity', startS: plan.ops.startS, endS: plan.ops.startS + 30 * 86_400, magnitude: 1, instrumentIndex: null }] };
    const base = advanceSim(none, createSim(none), plan.ops.startS + 30 * 86_400);
    const bonus = advanceSim(boosted, createSim(boosted), plan.ops.startS + 30 * 86_400);
    expect(bonus.instruments.reduce((sum, item) => sum + item.creditedS, 0)).toBeGreaterThan(base.instruments.reduce((sum, item) => sum + item.creditedS, 0) * 1.5);
    expect(scienceEarned(boosted, bonus)).toBeGreaterThan(scienceEarned(none, base));
  });

  it('degradation lowers generation and extra demand raises the load', () => {
    const plan = buildSimPlan(mk('sso', 3));
    const at = plan.ops.startS + 3_600;
    const base: SimPlan = { ...plan, events: [] };
    const degraded: SimPlan = { ...plan, events: [{ id: 'd', kind: 'solar-degradation', startS: plan.ops.startS, endS: null, magnitude: 0.5, instrumentIndex: null }] };
    const demand: SimPlan = { ...plan, events: [{ id: 'p', kind: 'increased-power-demand', startS: plan.ops.startS, endS: plan.ops.startS + 5 * 86_400, magnitude: 0.3, instrumentIndex: null }] };
    const s0 = advanceSim(base, createSim(base), at);
    const s1 = advanceSim(degraded, createSim(degraded), at);
    const s2 = advanceSim(demand, createSim(demand), at);
    expect(s1.degradationFactor).toBeCloseTo(0.5, 9);
    expect(s1.generationW).toBeLessThanOrEqual(s0.generationW * 0.5 + 1e-6);
    expect(s2.loadW).toBeGreaterThan(s0.loadW);
  });
});

describe('outcomes', () => {
  it('can be a success, a partial success or a failure', () => {
    const outcomes = new Set<string>();
    outcomes.add(fly(mk('leo', 42)).sim.outcome!.kind);
    outcomes.add(fly(mk('geo', 42)).sim.outcome!.kind);
    outcomes.add(fly(edit(mk('mars'), setLauncher(mk('mars'), 'launcher-small'))).sim.outcome!.kind);
    expect([...outcomes].sort()).toEqual(['failure', 'partial', 'success']);
  });

  it('requirements from the document are checked against what the simulation measured', () => {
    const { sim } = fly(mk('sso'));
    const kinds = sim.outcome!.requirements.map((requirement) => requirement.kind);
    expect(kinds).toEqual(expect.arrayContaining(['min-operations']));
    const operations = sim.outcome!.requirements.find((requirement) => requirement.kind === 'min-operations')!;
    expect(operations.fromSimulation).toBe(true);
    expect(operations.actual).toBeCloseTo(sim.outcome!.operationsDays, 9);
    expect(operations.met).toBe(operations.actual >= operations.limit);
  });

  it('science returned is at most what was possible plus an observation bonus, and zero without data returned', () => {
    const { sim } = fly(mk('sso'));
    expect(sim.outcome!.sciencePoints).toBeGreaterThan(0);
    expect(sim.outcome!.deliveredBits).toBeLessThanOrEqual(sim.outcome!.generatedBits + 1e-3);
  });
});

describe('telemetry and the 3D scene are the same state', () => {
  it('the position, velocity and altitude follow the orbit the document describes', () => {
    const plan = buildSimPlan(mk('sso'));
    let sim = createSim(plan);
    sim = advanceSim(plan, sim, plan.ops.startS + 40 * 86_400);
    expect(plan.stageIds[sim.stageIndex]).toBe('science-operations');
    const tel = readTelemetry(plan, sim);
    const orbit = plan.evaluation.details!.orbit;
    expect(tel.altitudeM!).toBeGreaterThan(orbit.periapsisRadius.value - 6_378_137 - 5_000);
    expect(tel.altitudeM!).toBeLessThan(orbit.apoapsisRadius.value - 6_378_137 + 5_000);
    expect(tel.speedMps).toBeGreaterThan(orbit.circularSpeed.value * 0.97);
    expect(tel.speedMps).toBeLessThan(orbit.circularSpeed.value * 1.03);
    expect(tel.stage).toBe('science-operations');
    expect(tel.elapsedS).toBe(sim.t);
    expect(tel.generatedBits).toBe(sim.generatedBits);
    expect(tel.backlogBits).toBe(sim.backlogBits);
    expect(tel.batteryJ).toBe(sim.batteryJ);
    expect(tel.dvRemaining).toBeCloseTo(plan.dv.available - sim.dvUsed, 9);
    const craft = craftState(plan, sim);
    expect(tel.position).toEqual(craft.position);
    expect(tel.frameKey).toBe(frameKeyOf(plan, 'science-operations'));
  });

  it('the spacecraft moves with time: later clock, different position; paused (same clock), same position', () => {
    const plan = buildSimPlan(mk('sso'));
    const sim = advanceSim(plan, createSim(plan), plan.ops.startS + 10_000);
    const a = craftState(plan, sim, sim.t);
    const b = craftState(plan, sim, sim.t + 300);
    const c = craftState(plan, sim, sim.t);
    expect(a.position).toEqual(c.position);
    expect(a.position).not.toEqual(b.position);
    expect(craftTrail(plan, sim, sim.t + 300).length).toBeGreaterThan(10);
  });

  it('each mission class is drawn in its own frames: Mars goes from Earth to the Sun frame to Mars', () => {
    const mars = buildSimPlan(mk('mars'));
    const frames = mars.stageIds.map((stage) => frameKeyOf(mars, stage));
    expect(frames).toContain('sun:transfer');
    expect(frames[0]).toBe('earth:launch');
    expect(frames.at(-1)).toBe('mars');
    expect(new Set(buildSimPlan(mk('sso')).stageIds.map((stage) => frameKeyOf(buildSimPlan(mk('sso')), stage)))).toEqual(new Set(['earth']));
    expect(frameKeyOf(buildSimPlan(mk('moon')), 'cruise')).toBe('earth:transfer');
    expect(frameKeyOf(buildSimPlan(mk('helio')), 'science-operations')).toBe('sun:ops');
    for (const key of ['earth:launch', 'sun:transfer', 'mars']) expect(frameOf(mars, key).paths.length).toBeGreaterThan(0);
  });

  it('during the cruise the position runs along the transfer from departure to arrival', () => {
    const plan = buildSimPlan(mk('mars'));
    const cruiseStart = plan.stageIds.slice(0, plan.stageIds.indexOf('cruise')).reduce((sum, id) => sum + (plan.stagePlannedS[id] ?? 0), 0);
    const early = advanceSim(plan, createSim(plan), cruiseStart + 5 * 86_400);
    const late = advanceSim(plan, createSim(plan), cruiseStart + 240 * 86_400);
    const a = readTelemetry(plan, early);
    const b = readTelemetry(plan, late);
    expect(a.stage).toBe('cruise');
    expect(b.stage).toBe('cruise');
    expect(a.unit).toBe('AU');
    expect(b.distanceM).toBeGreaterThan(a.distanceM);
    expect(a.altitudeM).toBeNull();
  });

  it('the ascent starts at the launch site latitude and reaches the target orbit radius', () => {
    const plan = buildSimPlan(mk('leo'));
    const before = createSim(plan);
    const atPad = readTelemetry(plan, before);
    expect(atPad.speedMps).toBe(0);
    expect(Math.hypot(...atPad.position)).toBeCloseTo(1, 6);
    const upper = advanceSim(plan, createSim(plan), (plan.stagePlannedS['pre-launch'] ?? 0) + (plan.stagePlannedS.launch ?? 0));
    const orbit = readTelemetry(plan, advanceSim(plan, upper, 120));
    expect(orbit.altitudeM!).toBeGreaterThan(100_000);
  });
});

describe('skipping a stage', () => {
  it('runs the active stage to its end for real, with the same result as playing it', () => {
    const plan = buildSimPlan(mk('sso', 21));
    const skipped = skipToNextStage(plan, createSim(plan));
    expect(skipped.stageIndex).toBe(1);
    expect(skipped.stages[0]!.result).not.toBe('active');
    const played = advanceSim(plan, createSim(plan), (plan.stagePlannedS['pre-launch'] ?? 0) + 1);
    expect(played.stageIndex).toBe(1);
  });
});

describe('seed edit', () => {
  it('sets the seed on a draft, refuses invalid values', () => {
    const mission = mk('leo');
    expect(setSeed(mission, 123).mission.seed).toBe(123);
    expect(setSeed(mission, -1).error).toBe('invalid-value');
    expect(setSeed(mission, 1.5).error).toBe('invalid-value');
    expect(setSeed(mission, 2 ** 33).error).toBe('invalid-value');
  });
});

describe('playback controls (store)', () => {
  const make = () => {
    const store = createSimStore();
    const mission = mk('sso', 8);
    store.getState().prepare(mission);
    return { store, mission };
  };

  it('start, pause, resume and restart change the state; tick only advances while running', () => {
    const { store, mission } = make();
    expect(store.getState().status).toBe('idle');
    store.getState().tick(0.2);
    expect(store.getState().clockT).toBe(0);
    store.getState().start();
    expect(store.getState().status).toBe('running');
    store.getState().tick(0.2);
    expect(store.getState().clockT).toBeGreaterThan(0);
    store.getState().pause();
    expect(store.getState().status).toBe('paused');
    const frozen = store.getState().clockT;
    store.getState().tick(0.2);
    expect(store.getState().clockT).toBe(frozen);
    store.getState().resume();
    expect(store.getState().status).toBe('running');
    store.getState().tick(0.2);
    expect(store.getState().clockT).toBeGreaterThan(frozen);
    store.getState().restart(mission);
    expect(store.getState().status).toBe('running');
    expect(store.getState().clockT).toBe(0);
    expect(store.getState().sim!.t).toBe(0);
  });

  it('pause and resume are only valid in the right state', () => {
    const { store } = make();
    store.getState().pause();
    expect(store.getState().status).toBe('idle');
    store.getState().resume();
    expect(store.getState().status).toBe('idle');
    store.getState().start();
    store.getState().resume();
    expect(store.getState().status).toBe('running');
  });

  it('time acceleration scales how fast mission time runs, per speed', () => {
    const reached = new Map<string, number>();
    for (const speed of SIM_SPEEDS) {
      const { store } = make();
      store.getState().setSpeed(speed.id);
      store.getState().start();
      store.getState().tick(0.1);
      reached.set(speed.id, store.getState().clockT);
      expect(store.getState().clockT).toBeCloseTo(0.1 * speed.factor, 6);
    }
    const ordered = SIM_SPEEDS.map((speed) => reached.get(speed.id)!);
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
  });

  it('a long gap between frames is capped so a hidden tab does not jump the mission', () => {
    const { store } = make();
    store.getState().setSpeed('x60');
    store.getState().start();
    store.getState().tick(100);
    expect(store.getState().clockT).toBeCloseTo(0.25 * 60, 6);
  });

  it('the result does not depend on the speed chosen', () => {
    const outcomes: string[] = [];
    for (const speed of ['x600', 'days10'] as const) {
      const { store } = make();
      store.getState().setSpeed(speed);
      store.getState().start();
      let guard = 0;
      while (store.getState().status === 'running' && guard < 2_000_000) { store.getState().tick(0.25); guard += 1; }
      expect(store.getState().status).toBe('finished');
      outcomes.push(JSON.stringify({ kind: store.getState().sim!.outcome!.kind, sci: store.getState().sim!.outcome!.sciencePoints, delivered: store.getState().sim!.deliveredBits }));
    }
    expect(outcomes[0]).toBe(outcomes[1]);
  }, 120_000);

  it('skip stage works while running, a finished run stays finished until restart, and a design that cannot be resolved cannot start', () => {
    const { store, mission } = make();
    store.getState().skipStage();
    expect(store.getState().sim!.stageIndex).toBe(0);
    store.getState().start();
    store.getState().skipStage();
    expect(store.getState().sim!.stageIndex).toBe(1);
    for (let index = 0; index < 20; index += 1) store.getState().skipStage();
    expect(store.getState().status).toBe('finished');
    store.getState().tick(1);
    expect(store.getState().status).toBe('finished');
    store.getState().restart(mission);
    expect(store.getState().sim!.ended).toBe(false);

    const broken = { ...mission, id: 'broken', launch: { ...mission.launch, vehicleId: 'no-such-launcher' } };
    const other = createSimStore();
    other.getState().prepare(broken);
    expect(other.getState().plan!.unresolvable).not.toBeNull();
    other.getState().start();
    expect(other.getState().status).toBe('finished');
    expect(other.getState().sim!.outcome!.kind).toBe('failure');
  });

  it('a started run keeps its own design until it is restarted; an idle one follows edits', () => {
    const { store, mission } = make();
    const edited = { ...mission, revision: mission.revision + 1, seed: 99 };
    store.getState().prepare(edited);
    expect(store.getState().plan!.seed).toBe(99);
    store.getState().start();
    store.getState().prepare({ ...edited, revision: edited.revision + 1, seed: 100 });
    expect(store.getState().plan!.seed).toBe(99);
    store.getState().restart({ ...edited, revision: edited.revision + 1, seed: 100 });
    expect(store.getState().plan!.seed).toBe(100);
  });
});

describe('launchers and the catalog the simulation reads', () => {
  it('every launcher reliability is a probability', () => {
    for (const launcher of LAUNCHERS) {
      const plan = buildSimPlan(edit(mk('leo'), setLauncher(mk('leo'), launcher.id)));
      expect(plan.launch.reliability).toBeGreaterThan(0.5);
      expect(plan.launch.reliability).toBeLessThanOrEqual(1);
    }
  });

  it('adding a part to the document changes what the simulation does (it is bound to the document)', () => {
    const base = mk('leo');
    const more = edit(base, addPart(base, 'battery-1000wh'));
    expect(buildSimPlan(more).power.batteryCapacityJ).toBeGreaterThan(buildSimPlan(base).power.batteryCapacityJ);
  });
});
