import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import uz from '@/messages/uz.json';
import { gameStore } from '@/game/gameStore';
import { createDefaultMission, DESTINATION_IDS, setLauncher } from '@/mission';
import { missionStore } from '@/stores/missionStore';
import { simStore } from '@/stores/simStore';
import { cinematicRate } from '@/game/cinematic';
import { FlightHud } from './FlightHud';
import { GameHome } from './GameHome';
import { HangarPanel } from './HangarPanel';
import { MapPanel } from './MapPanel';
import { ResultPanel } from './ResultPanel';

const MESSAGES = { uz, en, ru } as const;
type Locale = keyof typeof MESSAGES;
const problems: string[] = [];

function render(locale: Locale, element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider as unknown as ComponentType<Record<string, unknown>>, { locale, messages: MESSAGES[locale] as never, timeZone: 'UTC', onError: (error: { message: string }) => void problems.push(error.message) }, element),
  );
}

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (value && typeof value === 'object') return Object.assign({}, ...Object.entries(value).map(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key)));
  return {};
}

beforeEach(() => {
  problems.length = 0;
  gameStore.getState().newMission();
});

describe('game translations', () => {
  const english = leaves((en as Record<string, unknown>).game);
  it('uz, en and ru define the same game keys, none empty', () => {
    for (const locale of ['uz', 'ru'] as const) {
      const other = leaves((MESSAGES[locale] as Record<string, unknown>).game);
      expect(Object.keys(other).sort(), locale).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(other)) expect(value.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
    }
    expect(Object.keys(english).length).toBeGreaterThan(100);
  });
  it('the Uzbek game copy is Latin script', () => {
    for (const [key, value] of Object.entries(leaves((uz as Record<string, unknown>).game))) expect(/[Ѐ-ӿ]/.test(value), key).toBe(false);
  });
});

describe('game screens render with real data', () => {
  it('the map offers every destination and a build button once one is focused', () => {
    for (const locale of ['uz', 'en'] as const) {
      gameStore.getState().newMission();
      const idle = render(locale, createElement(MapPanel, { focus: null, onBuild: () => undefined }));
      for (const id of DESTINATION_IDS) expect(idle).toContain(`data-destination="${id}"`);
      expect(idle).not.toContain('data-action="build-mission"');
      const focused = render(locale, createElement(MapPanel, { focus: 'moon', onBuild: () => undefined }));
      expect(focused).toContain('data-action="build-mission"');
      expect(focused).toContain(locale === 'uz' ? 'Oy orbitasi' : 'Lunar');
    }
    expect(problems).toEqual([]);
  });

  it('the hangar shows live gauges from the engine and a launch button that follows readiness', () => {
    const ready = createDefaultMission('leo', { id: 'h1', now: '2026-01-01T00:00:00Z', title: 'h', seed: 1 });
    const html = render('en', createElement(HangarPanel, { mission: ready, view: 'ship', onLaunch: () => undefined }));
    expect(html).toContain('data-gauge="Mass"');
    expect(html).toMatch(/data-ready="true"/);
    expect(html).not.toContain('data-action="launch" disabled=""');
    // a rocket that cannot carry the spacecraft blocks the launch and says why
    const heavy = createDefaultMission('geo', { id: 'h2', now: '2026-01-01T00:00:00Z', title: 'h', seed: 1 });
    const tooSmall = setLauncher(heavy, 'launcher-small').mission;
    const blocked = render('en', createElement(HangarPanel, { mission: tooSmall, view: 'ship', onLaunch: () => undefined }));
    expect(blocked).toMatch(/data-ready="false"/);
    expect(blocked).toContain('data-action="launch" disabled=""');
    expect(blocked).toContain('data-check-fail=');
    expect(problems).toEqual([]);
  });

  it('the flight HUD and the result card read the simulation', () => {
    const game = gameStore;
    game.getState().focusDestination('leo');
    const id = game.getState().confirmDestination('Test');
    expect(id).not.toBeNull();
    expect(game.getState().launch()).toBe(true);
    expect(simStore.getState().rateModel).toBe(cinematicRate);
    const hud = render('en', createElement(FlightHud));
    expect(hud).toContain('data-testid="countdown"');
    expect(hud).toContain('data-testid="telemetry"');
    for (let index = 0; index < 4000 && simStore.getState().status === 'running'; index += 1) simStore.getState().tick(0.25);
    game.getState().showResult();
    for (const locale of ['uz', 'en'] as const) {
      const card = render(locale, createElement(ResultPanel, { missionId: id }));
      expect(card).toMatch(/data-outcome="(success|partial|failure)"/);
      expect(card).toContain('data-action="improve"');
      expect(card).toContain('data-action="new-mission"');
    }
    expect(problems).toEqual([]);
  });

  it('the home page renders on the server without WebGL and links to the Engineer pages', () => {
    missionStore.getState();
    const html = render('en', createElement(GameHome));
    expect(html).toContain('data-game-phase="map"');
    expect(html).toContain('href="/universe"');
    expect(html).toContain('href="/missions"');
    expect(html).toContain('Choose your destination');
    expect(problems).toEqual([]);
  });
});
