import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { solarSystem } from '@/data/solarSystem';
import {
  parseScenarioFile,
  ScenarioError,
  serializeScenario,
} from './scenarios';

describe('local scenario JSON', () => {
  it('round-trips the saved objects through the Zod schema', () => {
    const json = serializeScenario({ name: 'Baseline', objects: solarSystem });

    expect(parseScenarioFile(json)).toEqual({ name: 'Baseline', objects: solarSystem });
  });

  it('rejects malformed JSON with a readable error code', () => {
    expect(() => parseScenarioFile('{broken')).toThrowError(
      expect.objectContaining({ code: 'invalidJson' }),
    );
  });

  it('rejects a corrupted scenario and identifies invalid fields', () => {
    try {
      parseScenarioFile(JSON.stringify({ schemaVersion: 1, name: 'Broken', objects: [{ id: '' }] }));
      expect.fail('Expected invalid scenario data to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(ScenarioError);
      expect((error as ScenarioError).code).toBe('invalidScenario');
      expect((error as ScenarioError).fields).toContain('objects.0.id');
    }
  });

  it('saves, lists, reloads, and deletes a scenario in IndexedDB', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();

    const firstSession = await import('./scenarios');
    const saved = await firstSession.saveScenario('Persistence check', solarSystem);
    expect(await firstSession.listScenarios()).toEqual([saved]);

    // Reload the module while retaining the IndexedDB database, as a page refresh does.
    vi.resetModules();
    const refreshedSession = await import('./scenarios');
    expect(await refreshedSession.loadScenario(saved.id)).toEqual(saved);

    await refreshedSession.deleteScenario(saved.id);
    expect(await refreshedSession.listScenarios()).toEqual([]);
    vi.unstubAllGlobals();
  });
});
