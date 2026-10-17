import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { celestialObjectListSchema } from '@/data/celestialSchema';
import type { CelestialObject } from '@/types/celestial';

const DATABASE_NAME = 'nexus-local-scenarios';
const DATABASE_VERSION = 1;
const STORE_NAME = 'scenarios';

export type SavedScenario = {
  id: string;
  name: string;
  createdAt: string;
  objects: CelestialObject[];
};

export type ScenarioErrorCode =
  | 'storageUnavailable'
  | 'nameRequired'
  | 'invalidJson'
  | 'invalidScenario';

export class ScenarioError extends Error {
  constructor(
    readonly code: ScenarioErrorCode,
    readonly fields: string[] = [],
  ) {
    super(code);
    this.name = 'ScenarioError';
  }
}

interface ScenarioDatabase extends DBSchema {
  scenarios: {
    key: string;
    value: SavedScenario;
    indexes: { 'by-created-at': string };
  };
}

const scenarioRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  objects: celestialObjectListSchema,
});

export const scenarioFileSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1),
  objects: celestialObjectListSchema,
});

export const scenarioSchema = scenarioFileSchema;
export type ScenarioFile = z.infer<typeof scenarioSchema>;

let databasePromise: Promise<IDBPDatabase<ScenarioDatabase>> | undefined;

function getDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new ScenarioError('storageUnavailable'));
  }

  databasePromise ??= openDB<ScenarioDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-created-at', 'createdAt');
    },
  }).catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

function copyObjects(objects: readonly CelestialObject[]): CelestialObject[] {
  return celestialObjectListSchema.parse(structuredClone(objects));
}

export async function saveScenario(name: string, objects: readonly CelestialObject[]) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new ScenarioError('nameRequired');

  const scenario = scenarioRecordSchema.parse({
    id: crypto.randomUUID(),
    name: normalizedName,
    createdAt: new Date().toISOString(),
    objects: copyObjects(objects),
  });
  const database = await getDatabase();
  await database.put(STORE_NAME, scenario);
  return scenario;
}

export async function listScenarios(): Promise<SavedScenario[]> {
  const database = await getDatabase();
  const records = await database.getAllFromIndex(STORE_NAME, 'by-created-at');
  return records
    .map((record) => scenarioRecordSchema.parse(record))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function loadScenario(id: string): Promise<SavedScenario | undefined> {
  const database = await getDatabase();
  const record = await database.get(STORE_NAME, id);
  return record === undefined ? undefined : scenarioRecordSchema.parse(record);
}

export async function deleteScenario(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(STORE_NAME, id);
}

export function serializeScenario(scenario: Pick<SavedScenario, 'name' | 'objects'>): string {
  const parsed = scenarioFileSchema.parse({
    schemaVersion: 1,
    name: scenario.name,
    objects: scenario.objects,
  });
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function parseScenarioFile(text: string): { name: string; objects: CelestialObject[] } {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new ScenarioError('invalidJson');
  }

  const result = scenarioFileSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) =>
      issue.path.length > 0 ? issue.path.join('.') : 'file',
    );
    throw new ScenarioError('invalidScenario', fields);
  }

  return { name: result.data.name, objects: result.data.objects };
}

export async function importScenarioFile(text: string): Promise<SavedScenario> {
  const parsed = parseScenarioFile(text);
  return saveScenario(parsed.name, parsed.objects);
}
