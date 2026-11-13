'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { aiDelayS, createCrewScheduler, isAiRole, padStatus, roleOfIssue, type CrewRole } from '@/game/crew';
import { crewStore } from '@/game/crewStore';
import { gameStore } from '@/game/gameStore';
import { speakLine } from '@/game/voice';
import { simStore } from '@/stores/simStore';
import { SEPARATION } from './launchPath';
import { rocketDims, type RocketClass } from './RocketModel';

/**
 * Hands the crew its jobs as the flight reaches them, takes a job over when its time is up, and scrubs the launch when
 * a station calls NO-GO on a real fault. Renders nothing. The crew's clock runs only while the flight runs.
 */
export function CrewDirector({ rocket }: { rocket: RocketClass }) {
  const t = useTranslations('game.crew');
  const locale = useLocale();
  useEffect(() => {
    const scheduler = createCrewScheduler();
    const hasBoosters = rocketDims(rocket).boosters > 0;
    let last = performance.now();
    let aborting = false;
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const { plan, sim, clockT, status } = simStore.getState();
      if (!plan || !sim) return;
      const crew = crewStore.getState();
      if (status === 'running') crew.advance(dt);
      const stage = plan.stageIds[sim.stageIndex]!;
      const ended = sim.ended;
      if (ended) { crew.cancelAll(); return; }
      const elapsed = sim.stageElapsedS + Math.max(0, clockT - sim.t);
      const { open, due } = scheduler.update({
        stage,
        stageElapsedS: elapsed,
        stageLengthS: stage === 'science-operations' ? plan.ops.effectiveS : (plan.stagePlannedS[stage] ?? 0),
        speed: gameStore.getState().ascentSpeed,
        hasBoosters,
        hasCorrections: plan.dv.corrections > 0,
        separation: SEPARATION,
        eventsStarted: sim.eventsStarted,
        openKeys: crew.open.map((task) => task.key),
        ended,
      });
      for (const opening of open) {
        const info = opening.defId.startsWith('go-') ? padStatus(opening.defId.slice(3) as CrewRole, plan.evaluation.issues) : null;
        const task = crew.openTask({ key: opening.key, defId: opening.defId, stage, expected: info?.expected, issueCodes: info?.errors });
        if (task) {
          // a station with a player is called by name; the AI crew member handles its own jobs quietly
          if (!isAiRole(task.role, crew.playerCount)) {
            const name = crewStore.getState().names[task.player]?.trim() || t('player', { n: task.player + 1 });
            speakLine(`crew-${task.key}`, 'mcc', t(`tasks.${task.defId}.call`, { name }), locale);
          }
        }
      }
      // the AI crew member answers for the stations nobody sits at: truthfully (NO-GO on a real fault), after a short delay
      if (status === 'running') {
        for (const task of crewStore.getState().open) {
          const state = crewStore.getState();
          if (!isAiRole(task.role, state.playerCount) || state.clockS - task.openedAtS < aiDelayS(task.key)) continue;
          const choice = task.kind === 'poll' ? (task.expected === 'nogo' ? 'nogo' : 'go') : 'do';
          const entry = state.respond(task.role, choice, clockT, true);
          if (entry && task.kind === 'poll') speakLine(`crew-ai-${task.key}`, 'mcc', t(choice === 'nogo' ? 'aiNogo' : 'aiGo', { role: t(`roles.${task.role}.name`) }), locale);
        }
      }
      if (due.length > 0) crew.autoComplete(due, clockT);
      crew.sweepStages(stage, clockT);
      const abort = crewStore.getState().abort;
      if (abort && !aborting) {
        aborting = true;
        const messages = plan.evaluation.issues.filter((issue) => issue.severity === 'error' && roleOfIssue(issue.code) === abort.role).map((issue) => issue.message);
        speakLine('crew-abort', 'mcc', t('aborted'), locale);
        window.setTimeout(() => { crewStore.getState().clearAbort(); gameStore.getState().abortLaunch({ info: abort, messages }); }, 1800);
      }
    };
    const id = window.setInterval(step, 120);
    return () => window.clearInterval(id);
  }, [t, locale, rocket]);
  return null;
}
