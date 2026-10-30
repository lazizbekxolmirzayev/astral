import { describe, expect, it } from 'vitest';
import { analyzeDesign, hasBlockers } from './analysis';
import { startingDesign } from './data';
import { decodeDesign, encodeDesign } from './share';

describe('shared design links', () => {
  const design = { ...startingDesign('mars-water'), instrumentIds: ['radar', 'spectrometer'] };

  it('round-trips a design', () => {
    expect(decodeDesign(encodeDesign(design))).toEqual(design);
  });

  it.each([null, '', 'not base64!!', btoa('{"objectiveId":"x"}'), 'a'.repeat(3000)])('rejects %s', (input) => {
    expect(decodeDesign(input)).toBeNull();
  });

  it('rejects unknown parts, an orbit around the wrong world, and duplicates', () => {
    expect(decodeDesign(encodeDesign({ ...design, busId: 'bus-free' }))).toBeNull();
    expect(decodeDesign(encodeDesign({ ...design, orbitId: 'leo-sso' }))).toBeNull();
    expect(decodeDesign(encodeDesign({ ...design, instrumentIds: ['radar', 'radar'] }))).toBeNull();
  });
});

describe('sandbox', () => {
  it('lifts budget and schedule limits but keeps the physics', () => {
    const costly = { ...startingDesign('earth-climate'), busId: 'bus-large', powerId: 'solar-60', instrumentIds: ['camera-hires', 'radar', 'spectrometer', 'laser-altimeter'], launcherId: 'falcon-heavy' };
    const ids = (sandbox: boolean) => analyzeDesign({ ...costly, sandbox }).issues.map((issue) => issue.id);
    expect(ids(false)).toContain('overBudget');
    expect(ids(true)).not.toContain('overBudget');
    expect(hasBlockers(analyzeDesign({ ...costly, launcherId: 'electron', sandbox: true }))).toBe(true);
  });
});
