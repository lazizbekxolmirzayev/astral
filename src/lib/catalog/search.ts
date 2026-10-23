import type { CatalogEntry, CatalogType } from '@/data/catalog/types';

/** Lowercase, strip diacritics and punctuation so "Qutb yulduzi", "QUTB-yulduzi" and "Quṭb" all match. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export type SearchOptions = { type?: CatalogType | 'all'; limit?: number };

/** Ranked name search: exact > prefix > word-prefix > substring. Empty query lists everything. */
export function searchCatalog(entries: readonly CatalogEntry[], query: string, options: SearchOptions = {}): CatalogEntry[] {
  const { type = 'all', limit = 50 } = options;
  const q = normalize(query);
  const scored: Array<{ entry: CatalogEntry; score: number }> = [];
  for (const entry of entries) {
    if (type !== 'all' && entry.type !== type) continue;
    if (!q) {
      scored.push({ entry, score: 0 });
      continue;
    }
    let best = -1;
    for (const name of [entry.name, ...entry.aliases]) {
      const n = normalize(name);
      let score = -1;
      if (n === q) score = 100;
      else if (n.startsWith(q)) score = 80;
      else if (n.split(' ').some((word) => word.startsWith(q))) score = 60;
      else if (n.includes(q)) score = 40;
      if (score > best) best = score;
    }
    if (best >= 0) scored.push({ entry, score: best });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((s) => s.entry);
}
