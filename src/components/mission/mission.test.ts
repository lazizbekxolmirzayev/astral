import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import uz from '@/messages/uz.json';
import { INSTRUMENTS } from '@/mission/catalog';
import { removePart, setPartQuantity } from '@/mission/edit';
import { evaluateMission } from '@/mission/engine';
import { createBlankMission } from '@/mission/templates/blank';
import { createDefaultMission } from '@/mission/templates/defaults';
import type { Editor } from './hooks';
import { LiveResourcePanel, ResourceBar } from './LiveResourcePanel';
import { IssueList } from './IssueList';
import { OverviewSection } from './OverviewSection';
import { PayloadSection } from './PayloadSection';
import { RequirementsSection } from './RequirementsSection';
import { ResourcesSection } from './ResourcesSection';
import { SpacecraftSection } from './SpacecraftSection';
import { WORKSPACE_CLASSES, WORKSPACE_TABS } from './MissionWorkspace';

const NOW = '2026-05-05T00:00:00.000Z';
const MESSAGES = { uz, en, ru } as const;
type Locale = keyof typeof MESSAGES;

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (value && typeof value === 'object') {
    return Object.assign({}, ...Object.entries(value).map(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key)));
  }
  return {};
}

const missing: string[] = [];
function render(locale: Locale, element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: MESSAGES[locale] as never,
        timeZone: 'UTC',
        onError: (error: { message: string }) => void missing.push(error.message),
        children: element,
      },
    ),
  );
}

const editor: Editor = { apply: () => true, error: null };
const noop = () => {};

describe('translations', () => {
  const mission = leaves((MESSAGES.en as Record<string, unknown>).mission);
  it('uz, en and ru define exactly the same mission keys, none empty', () => {
    for (const locale of ['uz', 'ru'] as const) {
      const other = leaves((MESSAGES[locale] as Record<string, unknown>).mission);
      expect(Object.keys(other).sort(), locale).toEqual(Object.keys(mission).sort());
      for (const [key, value] of Object.entries(other)) expect(value.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    }
    expect(Object.keys(mission).length).toBeGreaterThan(200);
  });

  it('the Uzbek copy is Latin script and really translated', () => {
    const uzbek = leaves((uz as Record<string, unknown>).mission);
    for (const [key, value] of Object.entries(uzbek)) expect(/[Ѐ-ӿ]/.test(value), key).toBe(false);
    const same = Object.keys(uzbek).filter((key) => uzbek[key] === mission[key] && /[a-z]{4,}/i.test(mission[key] ?? ''));
    expect(same.length / Object.keys(uzbek).length).toBeLessThan(0.1);
  });

  it('the navigation has the missions link in every language', () => {
    for (const locale of ['uz', 'en', 'ru'] as const) {
      expect(((MESSAGES[locale] as { nav: Record<string, string> }).nav.missions ?? '').length, locale).toBeGreaterThan(0);
    }
  });
});

describe.each(['en', 'uz'] as const)('workspace rendering (%s)', (locale) => {
  const mission = createDefaultMission('sso', { id: 'm1', now: NOW, title: 'Test' });
  const evaluation = evaluateMission(mission);

  it('every section renders with no missing message and no raw keys', () => {
    missing.length = 0;
    const html = [
      render(locale, createElement(OverviewSection, { mission, evaluation, editor })),
      render(locale, createElement(SpacecraftSection, { mission, editor, selectedPartId: null, onSelectPart: noop })),
      render(locale, createElement(PayloadSection, { mission, evaluation, editor, selectedPartId: null, onSelectPart: noop })),
      render(locale, createElement(ResourcesSection, { evaluation })),
      render(locale, createElement(RequirementsSection, { mission, evaluation, editor })),
      render(locale, createElement(IssueList, { evaluation })),
    ].join('\n');
    expect(missing).toEqual([]);
    expect(html).not.toMatch(/mission\.[a-z]+\.[a-z]+/i);
    expect(html.length).toBeGreaterThan(2000);
  });

  it('the live panel shows all seven indicators with a tone each, and the mobile bar mirrors it', () => {
    missing.length = 0;
    const panel = render(locale, createElement(LiveResourcePanel, { evaluation }));
    const bar = render(locale, createElement(ResourceBar, { evaluation }));
    expect(missing).toEqual([]);
    for (const id of ['mass', 'power', 'battery', 'deltaV', 'data', 'cost', 'readiness']) expect(panel).toContain(`data-indicator="${id}"`);
    expect((panel.match(/data-tone="(normal|warning|critical)"/g) ?? []).length).toBe(7);
    expect(bar).toContain('data-tone=');
  });

  it('the payload laboratory lists all 12 instruments, with a control to add and remove each', () => {
    const html = render(locale, createElement(PayloadSection, { mission, evaluation, editor, selectedPartId: null, onSelectPart: noop }));
    const instruments = INSTRUMENTS;
    expect(instruments).toHaveLength(12);
    for (const instrument of instruments) expect(html, instrument.id).toContain(`data-instrument="${instrument.id}"`);
    const cards = html.split('data-instrument=').slice(1);
    expect(cards).toHaveLength(12);
    const installed = new Set(mission.spacecraft.parts.map((line) => line.itemId));
    for (const card of cards) {
      const id = /^"([^"]+)"/.exec(card)?.[1] ?? '';
      const instrument = INSTRUMENTS.find((entry) => entry.id === id)!;
      const buttons = (card.match(/<button/g) ?? []).length;
      // select + add (available here) or select only + a notice; plus remove/quantity when installed.
      expect(buttons, id).toBeGreaterThanOrEqual(instrument.destinations.includes(mission.objective.destinationId) ? 2 : 1);
      if (installed.has(id)) expect(card, id).toContain('role="group"');
    }
  });

  it('the spacecraft builder offers an add and a remove control for the parts', () => {
    const html = render(locale, createElement(SpacecraftSection, { mission, editor, selectedPartId: null, onSelectPart: noop }));
    expect((html.match(/<button/g) ?? []).length).toBeGreaterThan(20);
  });
});

describe('warnings stay visible after edits', () => {
  it('an invalid configuration renders its issues in both languages', () => {
    const broken = removePart(setPartQuantity(createDefaultMission('sso', { id: 'w', now: NOW, title: 'W' }), 'comms-x-band-medium', 0).mission, 'obc-standard').mission;
    const evaluation = evaluateMission(broken);
    expect(evaluation.issues.length).toBeGreaterThan(0);
    for (const locale of ['en', 'uz'] as const) {
      missing.length = 0;
      const html = render(locale, createElement(IssueList, { evaluation }));
      expect(missing).toEqual([]);
      expect(html).toContain('<li');
    }
  });

  it('an empty mission renders in both languages without a crash', () => {
    const blank = createBlankMission('mars', { id: 'b', now: NOW, title: 'Blank' });
    const evaluation = evaluateMission(blank);
    for (const locale of ['en', 'uz'] as const) {
      missing.length = 0;
      render(locale, createElement(LiveResourcePanel, { evaluation }));
      render(locale, createElement(ResourcesSection, { evaluation }));
      render(locale, createElement(RequirementsSection, { mission: blank, evaluation, editor }));
      expect(missing).toEqual([]);
    }
  });
});

describe('responsive contract', () => {
  it('the grid has a shrinkable single column, and two columns only from lg', () => {
    expect(WORKSPACE_CLASSES.grid).toContain('grid-cols-[minmax(0,1fr)]');
    expect(WORKSPACE_CLASSES.grid).toContain('lg:grid-cols-[minmax(0,1fr)_320px]');
  });
  it('tabs scroll sideways instead of overflowing the page', () => {
    expect(WORKSPACE_CLASSES.tabs).toContain('overflow-x-auto');
  });
  it('the side panel is hidden below lg and the bottom bar only below lg', () => {
    expect(WORKSPACE_CLASSES.aside).toMatch(/\bhidden\b/);
    expect(WORKSPACE_CLASSES.aside).toContain('lg:block');
    const bar = render('en', createElement(ResourceBar, { evaluation: evaluateMission(createDefaultMission('leo', { id: 'r', now: NOW, title: 'R' })) }));
    expect(bar).toContain('lg:hidden');
    expect(WORKSPACE_CLASSES.main).toContain('pb-28');
  });
  it('has the five required sections', () => {
    expect([...WORKSPACE_TABS]).toEqual(['overview', 'spacecraft', 'payload', 'resources', 'requirements']);
  });
});
