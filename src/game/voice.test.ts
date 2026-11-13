import { describe, expect, it } from 'vitest';

describe('cloud voice chunks (Uzbek)', () => {
  it('splits long text into short chunks and normalises apostrophes', async () => {
    const { cloudChunks } = await import('./voice');
    const text = `Parvoz direktori, uchirishga ruxsat bering. ${'Sinov jumlasi bilan uzun matn. '.repeat(12)}O‘zbek tilida g‘alaba!`;
    const chunks = cloudChunks(text);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((chunk) => chunk.length <= 170)).toBe(true);
    expect(chunks.join(' ')).toContain("O'zbek");
    expect(chunks.join(' ')).not.toContain('‘');
  });
});
