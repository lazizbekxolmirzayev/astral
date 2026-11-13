import { describe, expect, it } from 'vitest';
import { advanceSim, createSim, runToEnd, buildSimPlan } from '@/mission/sim';
import { missionStore } from '@/stores/missionStore';
import { simStore } from '@/stores/simStore';
import { SEPARATION } from '@/components/game/launchPath';
import { createGameStore } from './gameStore';
import { crewStore, createCrewStore } from './crewStore';
import { aiDelayS, clampPlayers, createCrewScheduler, isAiRole, padStatus, playerOfRole, rolesOfPlayer, CREW_ROLES, judgeAnswer, type CrewInput } from './crew';
import { collectMistakes } from './mistakes';
import { positionOf, replaySegments, timeAt } from './replay';
import { computeScore, gradeOf } from './score';

const base: CrewInput = { stage: 'pre-launch', stageElapsedS: 0, stageLengthS: 3600, speed: 1, hasBoosters: true, hasCorrections: true, separation: SEPARATION, eventsStarted: [], openKeys: [], ended: false };

describe('crew roles', () => {
  it('seats the players at the first stations and leaves the rest to the AI crew member', () => {
    for (let count = 1; count <= 4; count += 1) {
      const human = Array.from({ length: count }, (_, player) => rolesOfPlayer(player, count)).flat();
      expect(human).toEqual(CREW_ROLES.slice(0, count));
      for (const role of CREW_ROLES) expect(isAiRole(role, count)).toBe(CREW_ROLES.indexOf(role) >= count);
      expect(rolesOfPlayer(count, count)).toEqual([]);
    }
    expect(playerOfRole('power', 1)).toBe(2);
    expect(clampPlayers(9)).toBe(4);
    expect(clampPlayers(0)).toBe(1);
  });
  it('makes the AI answer between 1.5 and 4 seconds, differently per job', () => {
    for (const key of ['maxq', 'go-power', 'stage-sep', 'deploy-panels']) {
      const delay = aiDelayS(key);
      expect(delay).toBeGreaterThanOrEqual(1.5);
      expect(delay).toBeLessThanOrEqual(4.1);
    }
    expect(aiDelayS('maxq')).toBe(aiDelayS('maxq'));
  });
  it('says NO-GO only for a station with a real error in its area', () => {
    const issues = [{ code: 'power-deficit', severity: 'error' as const }, { code: 'link-below-hardware-rate', severity: 'warning' as const }];
    expect(padStatus('power', issues).expected).toBe('nogo');
    expect(padStatus('comms', issues).expected).toBe('go');
    expect(padStatus('propulsion', issues).expected).toBe('go');
  });
  it('judges answers', () => {
    expect(judgeAnswer({ kind: 'poll', expected: 'nogo', choice: 'go', responseS: 1, windowS: 10 })).toBe('wrong-go');
    expect(judgeAnswer({ kind: 'poll', expected: 'go', choice: 'nogo', responseS: 1, windowS: 10 })).toBe('false-hold');
    expect(judgeAnswer({ kind: 'poll', expected: 'nogo', choice: 'nogo', responseS: 1, windowS: 10 })).toBe('correct-nogo');
    expect(judgeAnswer({ kind: 'action', expected: null, choice: 'do', responseS: 2, windowS: 10 })).toBe('perfect');
    expect(judgeAnswer({ kind: 'action', expected: null, choice: 'do', responseS: 8, windowS: 10 })).toBe('good');
  });
});

describe('crew scheduler', () => {
  it('opens each job once, in the stage it belongs to', () => {
    const scheduler = createCrewScheduler();
    expect(scheduler.update({ ...base, stageElapsedS: 3000 }).open).toEqual([]);
    const first = scheduler.update({ ...base, stageElapsedS: 3550 }).open.map((o) => o.key);
    expect(first).toEqual(['go-power']);
    expect(scheduler.update({ ...base, stageElapsedS: 3551 }).open).toEqual([]);
    const later = scheduler.update({ ...base, stageElapsedS: 3585 }).open.map((o) => o.key);
    expect(later).toEqual(['go-propulsion', 'go-comms', 'go-director']);
  });
  it('opens launch jobs before each separation and marks them due at it', () => {
    const scheduler = createCrewScheduler();
    const launch = { ...base, stage: 'launch' as const, stageLengthS: 540 };
    const open = scheduler.update({ ...launch, stageElapsedS: 540 * (SEPARATION.boosters - 0.01) }).open.map((o) => o.key);
    expect(open).toContain('booster-sep');
    expect(scheduler.update({ ...launch, stageElapsedS: 540 * (SEPARATION.boosters + 0.001), openKeys: ['booster-sep'] }).due).toContain('booster-sep');
    expect(createCrewScheduler().update({ ...launch, hasBoosters: false, stageElapsedS: 540 * SEPARATION.boosters }).open.map((o) => o.key)).not.toContain('booster-sep');
  });
  it('turns the simulation\'s events into jobs, capped', () => {
    const scheduler = createCrewScheduler();
    const events = Array.from({ length: 9 }, (_, i) => `communication-outage-${i + 1}`);
    const open = scheduler.update({ ...base, stage: 'science-operations', stageLengthS: 1e6, eventsStarted: events }).open;
    expect(open).toHaveLength(6);
    expect(open[0]!.defId).toBe('ev-communication-outage');
  });
});

describe('crew store, score and mistakes', () => {
  it('records answers and penalises a missed job', () => {
    const store = createCrewStore();
    store.getState().setPlayerCount(4);
    const s = store.getState();
    s.openTask({ key: 'go-power', defId: 'go-power', stage: 'pre-launch', expected: 'go' });
    s.openTask({ key: 'maxq', defId: 'maxq', stage: 'launch' });
    expect(store.getState().holding).toBe(true);
    store.getState().advance(1);
    const entry = store.getState().respond('power', 'go', 100);
    expect(entry?.result).toBe('perfect');
    expect(store.getState().respond('power', 'go', 101)).toBeNull();
    store.getState().autoComplete(['maxq'], 120);
    const log = store.getState().log;
    expect(log.map((e) => e.points)).toEqual([30, -20]);
    expect(store.getState().open).toHaveLength(0);
  });
  it('answers for a station without a player: no points, never a penalty', () => {
    const store = createCrewStore();
    store.getState().setPlayerCount(1);
    store.getState().openTask({ key: 'go-power', defId: 'go-power', stage: 'pre-launch', expected: 'go' });
    const entry = store.getState().respond('power', 'go', 5, true);
    expect(entry?.ai).toBe(true);
    expect(entry?.points).toBe(0);
    store.getState().openTask({ key: 'maxq', defId: 'maxq', stage: 'launch' });
    store.getState().autoComplete(['maxq'], 9);
    expect(store.getState().log.every((e) => e.points === 0 && e.ai)).toBe(true);
  });
  it('holds the playback while a slow-stage job is open, and scrubs on a correct NO-GO', () => {
    const store = createCrewStore();
    store.getState().setPlayerCount(4);
    store.getState().openTask({ key: 'downlink', defId: 'downlink', stage: 'data-transmission' });
    expect(store.getState().holding).toBe(true);
    store.getState().openTask({ key: 'go-comms', defId: 'go-comms', stage: 'pre-launch', expected: 'nogo', issueCodes: ['no-radio'] });
    store.getState().respond('comms', 'nogo', 10);
    expect(store.getState().abort?.role).toBe('comms');
  });
  it('scores a flight and lists its mistakes', () => {
    const id = missionStore.getState().createFromTemplate('leo', 'Score');
    const plan = buildSimPlan(missionStore.getState().missions[id]!);
    const end = runToEnd(plan, createSim(plan));
    const outcome = end.outcome!;
    const store = createCrewStore();
    store.getState().setPlayerCount(4);
    store.getState().openTask({ key: 'go-power', defId: 'go-power', stage: 'pre-launch', expected: 'nogo', issueCodes: ['power-deficit'] });
    store.getState().respond('power', 'go', 5);
    store.getState().openTask({ key: 'downlink', defId: 'downlink', stage: 'data-transmission' });
    store.getState().autoComplete(['downlink'], 9);
    const log = store.getState().log;
    const score = computeScore({ outcome, health: end.health, log, playerCount: 4 });
    expect(score.total).toBeLessThanOrEqual(score.max);
    expect(score.lines.find((l) => l.id === 'crew')!.points).toBe(0);
    expect(score.players).toHaveLength(4);
    const mistakes = collectMistakes({ outcome, timeline: end.timeline, log, designIssues: [] });
    expect(mistakes.filter((m) => m.category === 'crew')).toHaveLength(2);
    expect(gradeOf(0.95)).toBe('S');
    expect(gradeOf(0.1)).toBe('D');
  });
});

describe('replay', () => {
  it('maps mission time to the timeline and back', () => {
    const id = missionStore.getState().createFromTemplate('moon', 'Replay');
    const plan = buildSimPlan(missionStore.getState().missions[id]!);
    const end = runToEnd(plan, createSim(plan));
    const segments = replaySegments(end.stages, end.t);
    expect(segments.length).toBe(plan.stageIds.length);
    expect(positionOf(segments, 0)).toBe(0);
    for (const p of [0.1, 0.4, 0.77]) expect(positionOf(segments, timeAt(segments, p))).toBeCloseTo(p, 6);
  });
  it('replays the same flight deterministically after a seek', () => {
    const id = missionStore.getState().createFromTemplate('leo', 'Seek');
    const mission = missionStore.getState().missions[id]!;
    const plan = buildSimPlan(mission);
    const direct = advanceSim(plan, createSim(plan), 4000);
    simStore.getState().restart(mission);
    simStore.getState().seek(4000);
    expect(simStore.getState().sim!.stageIndex).toBe(direct.stageIndex);
    expect(simStore.getState().sim!.t).toBe(direct.t);
    simStore.getState().clear();
  });
  it('starts a replay of a recorded flight and returns to the result', () => {
    const store = createGameStore();
    const mission = missionStore.getState().createFromTemplate('leo', 'Flow');
    missionStore.getState().missions[mission];
    store.setState({ phase: 'hangar', missionId: mission, destinationId: 'leo' });
    crewStore.getState().reset();
    expect(store.getState().launch()).toBe(true);
    simStore.getState().finishNow();
    store.getState().showResult();
    const record = store.getState().record;
    expect(record?.score.total).toBeGreaterThan(0);
    expect(store.getState().startReplay()).toBe(true);
    expect(store.getState().phase).toBe('replay');
    store.getState().endReplay();
    expect(store.getState().phase).toBe('result');
    expect(simStore.getState().status).toBe('finished');
  });
});
