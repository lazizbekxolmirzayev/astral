import { describe, expect, it } from 'vitest';
import { addPart, removePart } from '@/mission';
import { evaluateMissionCached } from '@/mission/engine';
import { createMissionStore } from './missionStore';

function makeStore() {
  let counter = 0;
  return createMissionStore({ newId: () => `id-${(counter += 1)}`, now: () => '2026-04-04T00:00:00.000Z', newSeed: () => 7 });
}

describe('mission store', () => {
  it('creates a mission from a template and opens it by id; newest first', () => {
    const store = makeStore();
    const a = store.getState().createFromTemplate('leo', 'First');
    const b = store.getState().createBlank('mars', 'Second');
    const { missions, order } = store.getState();
    expect(order).toEqual([b, a]);
    expect(missions[a]?.title).toBe('First');
    expect(missions[a]?.spacecraft.parts.length).toBeGreaterThan(0);
    expect(missions[b]?.spacecraft.parts).toEqual([]);
    expect(missions[a]?.seed).toBe(7);
    expect(missions[a]?.ownerId).toBeNull();
  });

  it('adds and removes parts through pure edits, and reports refusals', () => {
    const store = makeStore();
    const id = store.getState().createFromTemplate('sso', 'M');
    const before = store.getState().missions[id]!;
    expect(store.getState().edit(id, (m) => addPart(m, 'battery-100wh'))).toBeNull();
    const after = store.getState().missions[id]!;
    expect(after.revision).toBe(before.revision + 1);
    expect(after.spacecraft.parts.find((line) => line.itemId === 'battery-100wh')?.quantity).toBe(1);
    expect(store.getState().edit(id, (m) => addPart(m, 'no-such-part'))).toBe('unknown-part');
    expect(store.getState().missions[id]).toBe(after);
    expect(store.getState().edit(id, (m) => removePart(m, 'battery-100wh'))).toBeNull();
    expect(store.getState().edit('missing', (m) => addPart(m, 'battery-100wh'))).not.toBeNull();
  });

  it('keeps no derived resource state: only missions, order and selection', () => {
    const store = makeStore();
    store.getState().createFromTemplate('leo', 'M');
    expect(Object.keys(store.getState()).sort()).toEqual(['createBlank', 'createFromTemplate', 'duplicate', 'edit', 'missions', 'order', 'remove', 'selectPart', 'selectedPartId']);
  });

  it('resources follow the document: the evaluation of the edited mission differs, the old one is untouched', () => {
    const store = makeStore();
    const id = store.getState().createFromTemplate('sso', 'M');
    const mission = store.getState().missions[id]!;
    const massBefore = evaluateMissionCached(mission).details!.mass.launch.value;
    store.getState().edit(id, (m) => addPart(m, 'battery-1000wh'));
    const edited = store.getState().missions[id]!;
    expect(evaluateMissionCached(edited).details!.mass.launch.value).toBeGreaterThan(massBefore);
    expect(evaluateMissionCached(mission).details!.mass.launch.value).toBe(massBefore);
    expect(evaluateMissionCached(edited)).toBe(evaluateMissionCached(edited));
  });

  it('duplicates as a new draft with its own id, and removes', () => {
    const store = makeStore();
    const id = store.getState().createFromTemplate('moon', 'Original');
    const copy = store.getState().duplicate(id, 'Copy')!;
    expect(copy).not.toBe(id);
    const missions = store.getState().missions;
    expect(missions[copy]?.title).toBe('Copy');
    expect(missions[copy]?.spacecraft).toEqual(missions[id]?.spacecraft);
    expect(missions[copy]?.spacecraft).not.toBe(missions[id]?.spacecraft);
    store.getState().remove(id);
    expect(store.getState().order).toEqual([copy]);
    expect(store.getState().duplicate('gone', 'x')).toBeNull();
  });

  it('selection is cleared when missions change', () => {
    const store = makeStore();
    const id = store.getState().createFromTemplate('leo', 'M');
    store.getState().selectPart('obc-small');
    expect(store.getState().selectedPartId).toBe('obc-small');
    store.getState().remove(id);
    expect(store.getState().selectedPartId).toBeNull();
  });
});
