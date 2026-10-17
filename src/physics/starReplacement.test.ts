import { describe, expect, it } from 'vitest';
import { initialConditions } from '@/data/initialConditions';
import { replaceStarMass, STAR_REPLACEMENT_MODEL_CARD } from './starReplacement';

describe('star replacement thought experiment', () => {
  it('changes only the selected star gravitational parameter', () => {
    const replaced = replaceStarMass(initialConditions, 'sun', 0.5);
    const originalStar = initialConditions.find((body) => body.id === 'sun');
    const replacedStar = replaced.find((body) => body.id === 'sun');
    const originalEarth = initialConditions.find((body) => body.id === 'earth');
    const replacedEarth = replaced.find((body) => body.id === 'earth');

    expect(replacedStar?.gm).toBe((originalStar?.gm ?? 0) * 0.5);
    expect(replacedStar?.position).toEqual(originalStar?.position);
    expect(replacedStar?.velocity).toEqual(originalStar?.velocity);
    expect(replacedEarth).toEqual(originalEarth);
    expect(replacedEarth).not.toBe(originalEarth);
    expect(STAR_REPLACEMENT_MODEL_CARD.limitations.length).toBeGreaterThan(0);
  });

  it('rejects missing stars and invalid replacement ratios', () => {
    expect(() => replaceStarMass(initialConditions, 'missing', 1)).toThrow(/no star named/);
    expect(() => replaceStarMass(initialConditions, 'sun', 0)).toThrow(/mass ratio/);
  });
});
