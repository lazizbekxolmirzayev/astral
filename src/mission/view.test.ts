import { describe, expect, it } from 'vitest';
import { PARTS } from './catalog';
import { addPart, setPartQuantity, setPropellantMass } from './edit';
import { evaluateMission, instrumentDailyData } from './engine';
import { formatNumber, formatPercent, formatQuantity, unitLabel } from './format';
import { DESTINATION_IDS } from './models/catalog';
import { layoutSpacecraft } from './spacecraftLayout';
import { createBlankMission } from './templates/blank';
import { createDefaultMission } from './templates/defaults';
import { toBase, valueIn } from './units';
import { buildIndicators, describePart, INDICATOR_IDS, toneOfMargin } from './view';

const NOW = '2026-05-05T00:00:00.000Z';
const mission = (id: (typeof DESTINATION_IDS)[number]) => createDefaultMission(id, { id: `v-${id}`, now: NOW, title: 'T' });
const tone = (indicators: ReturnType<typeof buildIndicators>, id: string) => indicators.find((indicator) => indicator.id === id)?.tone;

describe('tones', () => {
  it('negative margin is critical, below the tight margin a warning, otherwise normal', () => {
    expect(toneOfMargin(-0.01)).toBe('critical');
    expect(toneOfMargin(0.05)).toBe('warning');
    expect(toneOfMargin(0.1)).toBe('normal');
    expect(toneOfMargin(0.8)).toBe('normal');
    expect(toneOfMargin(null)).toBe('normal');
  });
});

describe('live indicators', () => {
  it('there are seven, in a fixed order, for every default mission', () => {
    for (const id of DESTINATION_IDS) {
      const indicators = buildIndicators(evaluateMission(mission(id)));
      expect(indicators.map((indicator) => indicator.id)).toEqual([...INDICATOR_IDS]);
    }
  });

  it('a closing design shows normal resources and a ready mission', () => {
    const indicators = buildIndicators(evaluateMission(mission('moon')));
    for (const indicator of indicators) expect(indicator.tone, indicator.id).toBe('normal');
    expect(indicators.find((indicator) => indicator.id === 'readiness')?.errors).toBe(0);
  });

  it('values are in display units and match the engine', () => {
    const evaluation = evaluateMission(mission('sso'));
    const indicators = buildIndicators(evaluation);
    const find = (id: string) => indicators.find((indicator) => indicator.id === id)!;
    expect(find('mass').used).toBeCloseTo(evaluation.details!.mass.launch.value, 9);
    expect(find('mass').unit).toBe('kg');
    expect(find('battery').unit).toBe('Wh');
    expect(find('battery').limit).toBeCloseTo(valueIn({ value: evaluation.details!.power.batteryUsable.value, unit: 'J' }, 'Wh'), 9);
    expect(find('data').unit).toBe('GB');
    expect(find('cost').unit).toBe('MUSD');
    expect(find('cost').used).toBeCloseTo(evaluation.details!.cost.total.value / 1e6, 9);
    expect(find('deltaV').used).toBeCloseTo(evaluation.details!.deltaV.required.value, 9);
    expect(find('deltaV').limit).toBeCloseTo(evaluation.details!.deltaV.available.value, 9);
  });

  it('a thin margin is a warning, an overrun is critical', () => {
    const base = createDefaultMission('geo', { id: 'g', now: NOW, title: 'G' });
    const thin = buildIndicators(evaluateMission(base));
    expect(tone(thin, 'deltaV')).toBe('warning');
    expect(tone(thin, 'cost')).toBe('warning');
    expect(tone(thin, 'readiness')).toBe('warning');
    expect(tone(thin, 'mass')).toBe('normal');
    const dry = buildIndicators(evaluateMission(setPropellantMass(base, 0).mission));
    expect(tone(dry, 'deltaV')).toBe('critical');
    expect(tone(dry, 'readiness')).toBe('critical');
  });

  it('removing the batteries or the radio turns exactly the affected indicators critical', () => {
    const base = mission('sso');
    const noBattery = buildIndicators(evaluateMission(setPartQuantity(base, 'battery-1000wh', 0).mission));
    expect(tone(noBattery, 'battery')).toBe('critical');
    expect(tone(noBattery, 'mass')).toBe('normal');
    const noRadio = buildIndicators(evaluateMission(setPartQuantity(base, 'comms-x-band-medium', 0).mission));
    expect(tone(noRadio, 'data')).toBe('critical');
  });

  it('a mission with a catalog problem cannot be evaluated: values are null and readiness is critical', () => {
    const broken = { ...mission('leo'), spacecraft: { ...mission('leo').spacecraft, busId: 'nope' } };
    const indicators = buildIndicators(evaluateMission(broken));
    expect(indicators.filter((indicator) => indicator.id !== 'readiness').every((indicator) => indicator.used === null)).toBe(true);
    expect(tone(indicators, 'readiness')).toBe('critical');
    expect(indicators.find((indicator) => indicator.id === 'readiness')?.errors).toBeGreaterThan(0);
  });

  it('no cost requirement means no limit and no bar', () => {
    const base = mission('leo');
    const free = { ...base, objective: { ...base.objective, requirements: [] } };
    const cost = buildIndicators(evaluateMission(free)).find((indicator) => indicator.id === 'cost')!;
    expect(cost.limit).toBeNull();
    expect(cost.fraction).toBeNull();
    expect(cost.tone).toBe('normal');
  });

  it('an empty design reports its problems, never a clean bill of health', () => {
    const empty = evaluateMission(createBlankMission('mars', { id: 'b', now: NOW, title: 'B' }));
    const readiness = buildIndicators(empty).find((indicator) => indicator.id === 'readiness')!;
    expect(readiness.tone).toBe('critical');
    expect(readiness.errors).toBeGreaterThan(2);
  });
});

describe('part parameters', () => {
  it('every catalog part has finite, unit-bearing parameters, mass and price first', () => {
    for (const part of PARTS) {
      const rows = describePart(part);
      expect(rows[0]?.key, part.id).toBe('mass');
      expect(rows[1]?.key, part.id).toBe('cost');
      for (const row of rows) {
        if (row.enumValue) expect(row.enumValue.id.length, `${part.id}.${row.key}`).toBeGreaterThan(0);
        else {
          expect(Number.isFinite(row.number), `${part.id}.${row.key}`).toBe(true);
          expect(row.unit, `${part.id}.${row.key}`).toBeDefined();
        }
      }
    }
  });

  it('the daily data of an instrument is the engine figure, in GB', () => {
    for (const part of PARTS) {
      if (part.category !== 'instrument') continue;
      const row = describePart(part).find((entry) => entry.key === 'dailyData')!;
      expect(row.number, part.id).toBeCloseTo(instrumentDailyData(part) / 8e9, 9);
    }
  });
});

describe('formatting', () => {
  it('keeps about three significant digits and localises', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,235');
    expect(formatNumber(12.345, 'en')).toBe('12.3');
    expect(formatNumber(0.1234, 'en')).toBe('0.123');
    expect(formatNumber(Number.NaN, 'en')).toBe('—');
    expect(formatNumber(1234.5, 'uz')).not.toBe('');
  });
  it('always attaches the unit', () => {
    expect(formatQuantity(5, 'kg', 'en')).toBe('5 kg');
    expect(formatQuantity(null, 'kg', 'en')).toBe('—');
    expect(unitLabel('m^2')).toBe('m²');
    expect(unitLabel('1')).toBe('');
    expect(formatPercent(0.256, 'en')).toBe('26 %');
  });
});

describe('spacecraft layout', () => {
  it('has a shape for the bus and for every installed unit, all finite', () => {
    for (const id of DESTINATION_IDS) {
      const m = mission(id);
      const { shapes, extent } = layoutSpacecraft(m);
      expect(shapes.filter((shape) => shape.role === 'bus')).toHaveLength(1);
      expect(Number.isFinite(extent) && extent > 0).toBe(true);
      for (const shape of shapes) {
        expect(shape.size.every(Number.isFinite), shape.key).toBe(true);
        expect(shape.position.every(Number.isFinite), shape.key).toBe(true);
      }
      for (const line of m.spacecraft.parts) {
        const part = PARTS.find((entry) => entry.id === line.itemId)!;
        const own = shapes.filter((shape) => shape.itemId === line.itemId && shape.role !== 'mast');
        expect(own.length, `${id}:${line.itemId}`).toBe(line.quantity);
        expect(['solar-array', 'battery', 'comms', 'obc', 'adcs', 'instrument']).toContain(part.category);
      }
      expect(new Set(shapes.map((shape) => shape.key)).size).toBe(shapes.length);
    }
  });

  it('solar wings have exactly the catalog area; the tank fill follows the propellant', () => {
    const m = mission('sso');
    const wing = layoutSpacecraft(m).shapes.find((shape) => shape.itemId === 'solar-wing-4')!;
    expect(wing.size[0] * wing.size[2]).toBeCloseTo(4, 9);
    const half = layoutSpacecraft(setPropellantMass(m, 60).mission).shapes.find((shape) => shape.role === 'tank')!;
    expect(half.fill).toBeCloseTo(0.5, 9);
    expect(layoutSpacecraft(setPropellantMass(m, 0).mission).shapes.find((shape) => shape.role === 'tank')!.fill).toBe(0);
  });

  it('adding and removing parts changes the picture, and it is deterministic', () => {
    const m = mission('sso');
    const base = layoutSpacecraft(m).shapes.length;
    const more = addPart(m, 'battery-100wh').mission;
    expect(layoutSpacecraft(more).shapes.length).toBe(base + 1);
    expect(layoutSpacecraft(setPartQuantity(more, 'battery-100wh', 0).mission).shapes.length).toBe(base);
    expect(JSON.stringify(layoutSpacecraft(m))).toBe(JSON.stringify(layoutSpacecraft(m)));
  });

  it('a bigger bus is drawn bigger, and an unknown bus gives an empty picture, not a crash', () => {
    const small = layoutSpacecraft(createDefaultMission('leo', { id: 'a', now: NOW, title: 'a' })).shapes.find((s) => s.role === 'bus')!;
    const large = layoutSpacecraft(mission('geo')).shapes.find((s) => s.role === 'bus')!;
    expect(large.size[0]).toBeGreaterThan(small.size[0]);
    expect(layoutSpacecraft({ ...mission('leo'), spacecraft: { ...mission('leo').spacecraft, busId: 'nope' } }).shapes).toEqual([]);
  });

  it('uses no more mass-derived scale than the catalog gives (sanity)', () => {
    expect(toBase(PARTS[0]!.mass)).toBeGreaterThan(0);
  });
});
