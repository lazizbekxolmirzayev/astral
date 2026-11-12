import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import uz from '@/messages/uz.json';
import { INSTRUMENTS } from '@/mission/catalog';
import { removePart, setPartQuantity } from '@/mission/edit';
import { evaluateMission } from '@/mission/engine';
import { CHECK_IDS, CHECK_GROUPS } from '@/mission/engine';
import { setLaunchSite, setOrbit, setPropellantMass } from '@/mission/edit';
import { DESTINATION_IDS } from '@/mission/models/catalog';
import { LAUNCH_SITES, LAUNCHERS } from '@/mission/catalog';
import { createBlankMission } from '@/mission/templates/blank';
import { createDefaultMission } from '@/mission/templates/defaults';
import type { Editor } from './hooks';
import { LiveResourcePanel, ResourceBar } from './LiveResourcePanel';
import { IssueList } from './IssueList';
import { LaunchSection } from './LaunchSection';
import { OrbitSection } from './OrbitSection';
import { OverviewSection } from './OverviewSection';
import { ReadinessSection } from './ReadinessSection';
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
      NextIntlClientProvider as unknown as ComponentType<Record<string, unknown>>,
      {
        locale,
        messages: MESSAGES[locale] as never,
        timeZone: 'UTC',
        onError: (error: { message: string }) => void missing.push(error.message),
      },
      element,
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

  it('every readiness check, group and status has a label in every language', () => {
    for (const locale of ['uz', 'en', 'ru'] as const) {
      const m = (MESSAGES[locale] as unknown as { mission: Record<string, Record<string, string>> }).mission;
      for (const id of CHECK_IDS) expect(m.check?.[id]?.length ?? 0, `${locale}:${id}`).toBeGreaterThan(0);
      for (const group of CHECK_GROUPS) expect(m.group?.[group]?.length ?? 0, `${locale}:${group}`).toBeGreaterThan(0);
      for (const status of ['pass', 'warning', 'fail']) expect(m.checkStatus?.[status]?.length ?? 0, `${locale}:${status}`).toBeGreaterThan(0);
    }
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

describe.each(['en', 'uz'] as const)('Orbit Designer, Launch Center and Readiness (%s)', (locale) => {
  const sso = createDefaultMission('sso', { id: 'p4', now: NOW, title: 'P4' });

  it.each(DESTINATION_IDS)('the Orbit tab renders for %s with no missing message', (id) => {
    const mission = createDefaultMission(id, { id: `o-${id}`, now: NOW, title: 'O' });
    missing.length = 0;
    const html = render(locale, createElement(OrbitSection, { mission, evaluation: evaluateMission(mission), editor }));
    expect(missing).toEqual([]);
    for (const type of DESTINATION_IDS) expect(html).toContain(`data-orbit-type="${type}"`);
    expect(html).toContain('data-orbit-preview');
    expect(html).toContain('data-delta-v');
    expect(html).toContain('data-model="orbit-geometry"');
    expect(html).not.toMatch(/mission\.orbit\./);
  });

  it('only a sun-synchronous-capable orbit offers the sun-synchronous button', () => {
    const earth = render(locale, createElement(OrbitSection, { mission: sso, evaluation: evaluateMission(sso), editor }));
    expect(earth).toContain('data-sun-sync');
    const mars = createDefaultMission('mars', { id: 'm', now: NOW, title: 'M' });
    expect(render(locale, createElement(OrbitSection, { mission: mars, evaluation: evaluateMission(mars), editor }))).not.toContain('data-sun-sync');
  });

  it('the heliocentric editor speaks AU, the others km', () => {
    const helio = createDefaultMission('helio', { id: 'h', now: NOW, title: 'H' });
    expect(render(locale, createElement(OrbitSection, { mission: helio, evaluation: evaluateMission(helio), editor }))).toContain('AU');
    expect(render(locale, createElement(OrbitSection, { mission: sso, evaluation: evaluateMission(sso), editor }))).toContain('km');
  });

  it('the Launch tab lists the four vehicles and the five sites with a select button each', () => {
    missing.length = 0;
    const html = render(locale, createElement(LaunchSection, { mission: sso, evaluation: evaluateMission(sso), editor }));
    expect(missing).toEqual([]);
    for (const launcher of LAUNCHERS) expect(html).toContain(`data-launcher="${launcher.id}"`);
    for (const site of LAUNCH_SITES) {
      expect(html).toContain(`data-site="${site.id}"`);
      expect(html).toContain(`data-map-site="${site.id}"`);
    }
    expect(LAUNCHERS).toHaveLength(4);
    expect(LAUNCH_SITES).toHaveLength(5);
    expect(html).toContain('data-site-map');
    expect(html).toContain('data-check="launch-mass"');
  });

  it('the Launch tab shows the effect of the site on the orbit, including a failing one', () => {
    const wrongSite = setLaunchSite(sso, 'site-cape-canaveral').mission;
    const html = render(locale, createElement(LaunchSection, { mission: wrongSite, evaluation: evaluateMission(wrongSite), editor }));
    expect(html).toContain('data-check="site-inclination"');
    expect(html).toContain('data-status="fail"');
    expect(html).toContain('data-site-effect="orbit"');
  });

  it('the Readiness tab shows every group, PASS/WARNING/FAIL, and the launch-ready verdict', () => {
    missing.length = 0;
    const ready = render(locale, createElement(ReadinessSection, { evaluation: evaluateMission(sso) }));
    expect(missing).toEqual([]);
    expect(ready).toContain('data-launch-ready="true"');
    for (const group of ['spacecraft', 'payload', 'resources', 'orbit', 'launch-vehicle', 'launch-site', 'budget']) expect(ready).toContain(`data-group="${group}"`);
    const broken = setPropellantMass(setOrbit(setLaunchSite(sso, 'site-mahia').mission, { inclinationDeg: 99.5 }).mission, 0).mission;
    const blocked = render(locale, createElement(ReadinessSection, { evaluation: evaluateMission(broken) }));
    expect(blocked).toContain('data-launch-ready="false"');
    expect(blocked).toContain('data-overall="fail"');
    expect(blocked).toContain('data-status="fail"');
    expect(blocked).toMatch(locale === 'en' ? /How to fix/ : /Qanday tuzatish/);
  });

  it('the report never hides a failing check: each one is on the page', () => {
    const broken = setLaunchSite(setPropellantMass(sso, 0).mission, 'site-cape-canaveral').mission;
    const evaluation = evaluateMission(broken);
    const html = render(locale, createElement(ReadinessSection, { evaluation }));
    const failing = evaluation.readiness.groups.flatMap((group) => group.checks).filter((check) => check.status === 'fail');
    expect(failing.length).toBeGreaterThan(1);
    for (const check of failing) expect(html).toContain(`data-check="${check.id}"`);
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
  it('has the required sections, including the Phase 4 orbit, launch and readiness tabs', () => {
    expect([...WORKSPACE_TABS]).toEqual(['overview', 'spacecraft', 'payload', 'orbit', 'launch', 'resources', 'requirements', 'readiness']);
  });
});
