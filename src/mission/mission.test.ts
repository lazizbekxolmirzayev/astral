import { describe, expect, it } from 'vitest';
import { analyzeDesign, hasBlockers } from './analysis';
import { OBJECTIVES, startingDesign } from './data';
import { eclipseFraction, hohmannTransferDays, linkRateMbps, orbitalPeriodMinutes, propellantForDeltaV, solarArrayPowerW, synodicPeriodDays } from './physics';
import { scoreMission } from './score';
import { simulateMission } from './simulate';
import type { MissionDesign } from './types';

const SEEDS = Array.from({ length: 40 }, (_, index) => index * 37 + 1);

/** Proof that every scenario can be won, and that more than one design can win it. */
const WINNING_DESIGNS: Record<string, MissionDesign[]> = {
  'earth-climate': [
    { objectiveId: 'earth-climate', busId: 'bus-medium', powerId: 'solar-2', batteryId: 'battery-medium', commsId: 'comms-small', computerId: 'computer-standard', adcsId: 'adcs-wheels', propulsionId: 'prop-mono', instrumentIds: ['camera-hires', 'radiometer'], orbitId: 'leo-sso', launcherId: 'alpha', lifetimeMonths: 24 },
    { objectiveId: 'earth-climate', busId: 'bus-small', powerId: 'solar-2', batteryId: 'battery-medium', commsId: 'comms-small', computerId: 'computer-standard', adcsId: 'adcs-wheels', propulsionId: 'prop-mono', instrumentIds: ['camera-wide', 'radiometer', 'spectrometer'], orbitId: 'leo-sso', launcherId: 'alpha', lifetimeMonths: 24 },
  ],
  'moon-ice': [
    { objectiveId: 'moon-ice', busId: 'bus-medium', powerId: 'solar-6', batteryId: 'battery-large', commsId: 'comms-medium', computerId: 'computer-standard', adcsId: 'adcs-wheels', propulsionId: 'prop-biprop', instrumentIds: ['spectrometer', 'radiometer', 'laser-altimeter', 'camera-wide'], orbitId: 'llo-polar', launcherId: 'falcon-9', lifetimeMonths: 14 },
  ],
  'mars-water': [
    { objectiveId: 'mars-water', busId: 'bus-medium', powerId: 'solar-16', batteryId: 'battery-large', commsId: 'comms-deep', computerId: 'computer-standard', adcsId: 'adcs-redundant', propulsionId: 'prop-biprop', instrumentIds: ['radar', 'spectrometer', 'radiometer'], orbitId: 'mars-low-polar', launcherId: 'atlas-v', lifetimeMonths: 26 },
  ],
  'jupiter-magnetosphere': [
    { objectiveId: 'jupiter-magnetosphere', busId: 'bus-large', powerId: 'solar-60', batteryId: 'battery-large', commsId: 'comms-deep', computerId: 'computer-hardened', adcsId: 'adcs-redundant', propulsionId: 'prop-biprop', instrumentIds: ['magnetometer', 'particle-detector', 'radiometer'], orbitId: 'jupiter-polar', launcherId: 'atlas-v', lifetimeMonths: 24 },
  ],
};

describe('mission physics', () => {
  it('reproduces known spaceflight numbers', () => {
    expect(orbitalPeriodMinutes(6371 + 400, 398_600)).toBeCloseTo(92.4, 0);
    expect(hohmannTransferDays(1, 1.524)).toBeCloseTo(259, -1);
    expect(hohmannTransferDays(1, 5.203)).toBeCloseTo(997, -1);
    expect(synodicPeriodDays(1, 1.524)).toBeCloseTo(780, -1);
    expect(solarArrayPowerW(1, 1)).toBeCloseTo(335, -1);
    expect(eclipseFraction(6371 + 700, 6371)).toBeGreaterThan(0.3);
  });

  it('falls with distance as physics says', () => {
    expect(solarArrayPowerW(10, 2) / solarArrayPowerW(10, 1)).toBeCloseTo(0.25);
    expect(linkRateMbps(20, 1, 2e6, 34, 30) / linkRateMbps(20, 1, 1e6, 34, 30)).toBeCloseTo(0.25);
    expect(linkRateMbps(20, 2, 1e6, 34, 30) / linkRateMbps(20, 1, 1e6, 34, 30)).toBeCloseTo(4);
  });

  it('gives a Mars Reconnaissance Orbiter-class link a few megabits per second', () => {
    const rate = linkRateMbps(100, 3, 225_000_000, 34, 30);
    expect(rate).toBeGreaterThan(0.5);
    expect(rate).toBeLessThan(20);
  });

  it('computes propellant with the rocket equation and rejects impossible burns', () => {
    expect(propellantForDeltaV(1000, 0, 300)).toBe(0);
    expect(propellantForDeltaV(1000, 2000, 320)).toBeGreaterThan(800);
    expect(propellantForDeltaV(1000, 20000, 70)).toBe(Infinity);
  });
});

describe('design trade-offs', () => {
  const base = WINNING_DESIGNS['mars-water']![0]!;

  it('adding an instrument raises mass, power, cost and data at once', () => {
    const before = analyzeDesign({ ...base, instrumentIds: ['radar'] });
    const after = analyzeDesign({ ...base, instrumentIds: ['radar', 'camera-hires'] });
    expect(after.mass.wetKg).toBeGreaterThan(before.mass.wetKg);
    expect(after.mass.propellantKg).toBeGreaterThan(before.mass.propellantKg);
    expect(after.power.loadW).toBeGreaterThan(before.power.loadW);
    expect(after.budget.totalM).toBeGreaterThan(before.budget.totalM);
    expect(after.data.generatedGbPerDay).toBeGreaterThan(before.data.generatedGbPerDay);
    expect(after.science.potential).toBeGreaterThan(before.science.potential);
  });

  it('blocks a launcher that cannot reach the destination', () => {
    const analysis = analyzeDesign({ ...base, launcherId: 'electron' });
    expect(analysis.issues.map((issue) => issue.id)).toContain('launcherCannotReach');
    expect(hasBlockers(analysis)).toBe(true);
  });

  it('blocks a spacecraft too heavy for the launcher', () => {
    const analysis = analyzeDesign({ ...base, launcherId: 'falcon-9' });
    expect(analysis.issues.map((issue) => issue.id)).toContain('launcherOverweight');
  });

  it('warns that a tiny dish cannot return Mars data', () => {
    const analysis = analyzeDesign({ ...base, commsId: 'comms-small' });
    expect(analysis.issues.map((issue) => issue.id)).toContain('downlinkShort');
  });

  it('makes planetary launches wait for a window', () => {
    const time = analyzeDesign(base).time;
    expect(time.launchMonth).toBeGreaterThanOrEqual(time.developmentMonths);
    expect(time.windowWaitMonths).toBeLessThan(26);
  });

  it('starts every scenario unflyable, so the player has to design something', () => {
    for (const objective of OBJECTIVES) expect(hasBlockers(analyzeDesign(startingDesign(objective.id)))).toBe(true);
  });
});

describe('flight simulation', () => {
  it('is reproducible for a design and seed', () => {
    const design = WINNING_DESIGNS['earth-climate']![0]!;
    expect(simulateMission(design, 7)).toEqual(simulateMission(design, 7));
  });

  it.each(Object.entries(WINNING_DESIGNS))('%s has flyable winning designs', (_id, designs) => {
    for (const design of designs) {
      const analysis = analyzeDesign(design);
      expect(analysis.issues.filter((issue) => issue.severity === 'blocker'), design.objectiveId).toEqual([]);
      const wins = SEEDS.filter((seed) => simulateMission(design, seed).outcome === 'full').length;
      expect(wins, `${design.objectiveId} wins`).toBeGreaterThanOrEqual(SEEDS.length * 0.75);
    }
  });

  it('never produces invalid numbers', () => {
    for (const designs of Object.values(WINNING_DESIGNS)) {
      for (const design of designs) {
        for (const seed of SEEDS) {
          const flight = simulateMission(design, seed);
          const score = scoreMission(analyzeDesign(design), flight, true);
          expect(Number.isFinite(score.total)).toBe(true);
          expect(score.total).toBeGreaterThanOrEqual(0);
          expect(score.total).toBeLessThanOrEqual(120);
          for (const frame of flight.frames) expect(Object.values(frame).every((value) => typeof value === 'string' || Number.isFinite(value))).toBe(true);
          expect(flight.returnedGb).toBeLessThanOrEqual(flight.generatedGb + 1e-6);
        }
      }
    }
  });

  it('fails a Mars mission with a weak radio for the right reason', () => {
    const design = { ...WINNING_DESIGNS['mars-water']![0]!, commsId: 'comms-small' };
    const flight = simulateMission(design, SEEDS[0]!);
    const score = scoreMission(analyzeDesign(design), flight, false);
    expect(flight.outcome).not.toBe('full');
    expect(score.insights.map((insight) => insight.id)).toContain('dataLost');
  });

  it('kills unhardened electronics at Jupiter more often than hardened ones', () => {
    const design = WINNING_DESIGNS['jupiter-magnetosphere']![0]!;
    const losses = (computerId: string) => SEEDS.filter((seed) => simulateMission({ ...design, computerId }, seed).endCause === 'radiationKill').length;
    expect(losses('computer-hardened')).toBe(0);
    expect(losses('computer-basic')).toBeGreaterThan(0);
  });

  it('awards the team bonus only in team play', () => {
    const design = WINNING_DESIGNS['earth-climate']![0]!;
    const analysis = analyzeDesign(design);
    const flight = simulateMission(design, SEEDS[0]!);
    expect(scoreMission(analysis, flight, false).teamBonus).toBe(0);
    expect(scoreMission(analysis, flight, true).teamBonus).toBeGreaterThan(0);
  });
});
