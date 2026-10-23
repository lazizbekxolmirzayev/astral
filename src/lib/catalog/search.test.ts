import { describe, expect, it } from 'vitest';
import { catalogEntries } from '@/data/catalog/entries';
import { searchCatalog } from './search';

const ids = (query: string, type?: Parameters<typeof searchCatalog>[2]) => searchCatalog(catalogEntries, query, type).map((e) => e.id);

describe('catalog data', () => {
  it('has unique ids and honest provenance', () => {
    expect(new Set(catalogEntries.map((e) => e.id)).size).toBe(catalogEntries.length);
    for (const entry of catalogEntries) {
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      expect(entry.license.length).toBeGreaterThan(0);
      for (const value of Object.values(entry)) {
        if (value && typeof value === 'object' && 'provenance' in value) {
          expect(value.provenance).not.toBe('measured'); // curated values are never claimed as measured
          expect(Number.isFinite(value.value)).toBe(true);
        }
      }
    }
  });
  it('points exoplanets at existing host stars', () => {
    for (const entry of catalogEntries.filter((e) => e.hostId)) {
      expect(catalogEntries.some((e) => e.id === entry.hostId && e.type === 'star')).toBe(true);
    }
  });
});

describe('searchCatalog', () => {
  it('finds by name, alias and translation, ignoring case and diacritics', () => {
    expect(ids('sirius')[0]).toBe('sirius-a');
    expect(ids('QUTB yulduzi')[0]).toBe('polaris');
    expect(ids('Челябинск')[0]).toBe('chelyabinsk-2013');
    expect(ids('m87')[0]).toBe('m87-star');
    expect(ids('sgr a')[0]).toBe('sagittarius-a-star');
  });
  it('filters by type and handles no match', () => {
    expect(ids('', { type: 'black_hole' })).toHaveLength(3);
    expect(ids('zzzzqq')).toEqual([]);
  });
});
