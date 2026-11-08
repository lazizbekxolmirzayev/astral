import { describe, expect, it } from 'vitest';
import { L, pickText } from './i18n';
import { MODEL_CARDS, MODEL_CARD_IDS, getModelCard } from './modelCards';

const CYRILLIC = /[Ѐ-ӿ]/;

describe('model cards', () => {
  it('exist exactly once for every model', () => {
    expect(MODEL_CARDS.map((card) => card.id).sort()).toEqual([...MODEL_CARD_IDS].sort());
    for (const id of MODEL_CARD_IDS) expect(getModelCard(id)?.id).toBe(id);
  });

  it('state their assumptions and limitations, in both languages', () => {
    for (const card of MODEL_CARDS) {
      expect(card.equations.length, card.id).toBeGreaterThan(0);
      expect(card.assumptions.length, card.id).toBeGreaterThanOrEqual(1);
      expect(card.limitations.length, card.id).toBeGreaterThanOrEqual(2);
      const texts = [card.title, card.scope, ...card.assumptions, ...card.limitations];
      for (const text of texts) {
        expect(text.en.trim().length, card.id).toBeGreaterThan(0);
        expect(text.uz.trim().length, card.id).toBeGreaterThan(0);
        expect(text.uz, `${card.id}: ${text.en}`).not.toBe(text.en);
        expect(CYRILLIC.test(text.uz), text.uz).toBe(false);
      }
    }
  });

  it('are honest about status: planned until their engine exists', () => {
    // Phase 1 has no calculation engines. A card may only become "implemented" in the
    // same change that adds and tests its engine; update this expectation then.
    for (const card of MODEL_CARDS) expect(card.status, card.id).toBe('planned');
    for (const card of MODEL_CARDS) expect([2, 4, 5, 6]).toContain(card.phase);
  });

  it('cite published references for the physical models', () => {
    for (const id of ['delta-v', 'orbit-geometry', 'transfer-approximation', 'power-budget'] as const) {
      expect(getModelCard(id)?.references.length, id).toBeGreaterThan(0);
    }
  });
});

describe('localised text', () => {
  it('picks Uzbek for uz and English for everything else, Russian included', () => {
    const text = L('Mass', 'Massa');
    expect(pickText(text, 'uz')).toBe('Massa');
    expect(pickText(text, 'en')).toBe('Mass');
    expect(pickText(text, 'ru')).toBe('Mass');
  });
});
