import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { BATTERIES, ADCS_SYSTEMS, BUSES, COMMS_SYSTEMS, COMPUTERS, INSTRUMENTS, LAUNCHERS, OBJECTIVES, ORBITS, POWER_SOURCES, PROPULSION_SYSTEMS } from '@/mission/data';
import en from './en.json';
import ru from './ru.json';
import uz from './uz.json';

type Tree = { [key: string]: unknown };

function leaves(tree: unknown, prefix = ''): Record<string, string> {
  if (typeof tree === 'string') return { [prefix]: tree };
  if (!tree || typeof tree !== 'object') return {};
  return Object.entries(tree as Tree).reduce<Record<string, string>>((out, [key, value]) => ({ ...out, ...leaves(value, prefix ? `${prefix}.${key}` : key) }), {});
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const CATALOGS = { en, ru, uz };

describe('mission translations', () => {
  const reference = leaves(en.mission);

  it.each(Object.entries(CATALOGS))('%s has every key and placeholder', (_locale, catalog) => {
    const strings = leaves(catalog.mission);
    expect(Object.keys(strings).sort()).toEqual(Object.keys(reference).sort());
    for (const [key, text] of Object.entries(reference)) expect(placeholders(strings[key]!), key).toEqual(placeholders(text));
  });

  it.each(Object.entries(CATALOGS))('%s has a name for every game item', (_locale, catalog) => {
    const { mission } = catalog;
    const parts = [...BUSES, ...POWER_SOURCES, ...BATTERIES, ...COMMS_SYSTEMS, ...COMPUTERS, ...ADCS_SYSTEMS, ...PROPULSION_SYSTEMS, ...INSTRUMENTS];
    for (const part of parts) expect(mission.parts, part.id).toHaveProperty([part.id, 'name']);
    for (const orbit of ORBITS) expect(mission.orbits, orbit.id).toHaveProperty([orbit.id, 'desc']);
    for (const launcher of LAUNCHERS) expect(mission.launchers, launcher.id).toHaveProperty([launcher.id]);
    for (const objective of OBJECTIVES) expect(mission.objectives, objective.id).toHaveProperty([objective.id, 'brief']);
  });

  it.each(Object.entries(CATALOGS))('%s messages all format', (locale, catalog) => {
    const t = createTranslator({ locale, messages: catalog, onError: (error) => { throw error; } });
    for (const [key, text] of Object.entries(leaves(catalog.mission))) {
      const params = Object.fromEntries(placeholders(text).map((name) => [name!, 1]));
      expect(() => t(`mission.${key}` as never, params as never), key).not.toThrow();
    }
  });
});

describe('message catalogues', () => {
  it.each(Object.entries(CATALOGS))('%s contains no garbled encoding', (_locale, catalog) => {
    for (const [key, text] of Object.entries(leaves(catalog))) expect(text, key).not.toMatch(/вЂ|Г—|В·|РЅ|Рѕ/);
  });
});
