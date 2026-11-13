'use client';

import { useEffect } from 'react';
import { playerOfRole, type CrewRole } from '@/game/crew';
import { crewStore } from '@/game/crewStore';
import { formatLiftoffTime } from '@/game/format';
import { gameStore } from '@/game/gameStore';
import { onlineStore, publishSnapshot, setActionHandler, useOnline, type RoomSnapshot } from '@/game/online';
import { readTelemetry, stageTitle } from '@/mission/sim';
import { simStore } from '@/stores/simStore';

/** Whether a station is played from another device in the host's room. */
export function isRemoteRole(role: CrewRole): boolean {
  const { mode, roster } = onlineStore.getState();
  return mode === 'host' && playerOfRole(role, Math.max(1, roster.length)) !== 0;
}

function buildSnapshot(): RoomSnapshot {
  const game = gameStore.getState();
  const crew = crewStore.getState();
  const { plan, sim, clockT } = simStore.getState();
  const base = { v: 1 as const, phase: game.phase, names: crew.names, playerCount: crew.playerCount, points: crew.log.reduce((sum, entry) => sum + entry.points, 0) };
  const tasks = crew.open.map((task) => ({ key: task.key, defId: task.defId, role: task.role, kind: task.kind, leftS: Math.max(0, task.deadlineS - crew.clockS), windowS: task.windowS }));
  const record = game.record;
  const result = record ? { outcome: record.outcome.kind, grade: record.score.grade, total: record.score.total, max: record.score.max, players: record.score.players.map((entry) => ({ player: entry.player, points: entry.points })), mvp: record.score.mvp } : null;
  if (!plan || !sim) return { ...base, stage: '', stageTitle: null, clock: '', tm: { altitudeKm: null, distanceKm: 0, speedKms: 0, battery: 0, health: 1 }, tasks, lost: false, result };
  const stage = plan.stageIds[sim.stageIndex]!;
  const tm = readTelemetry(plan, sim, clockT);
  return {
    ...base,
    stage,
    stageTitle: stageTitle(plan, stage),
    clock: formatLiftoffTime(tm.elapsedS - (plan.stagePlannedS['pre-launch'] ?? 0)),
    tm: { altitudeKm: tm.altitudeM === null ? null : tm.altitudeM / 1000, distanceKm: tm.distanceM / 1000, speedKms: tm.speedMps / 1000, battery: tm.batteryFraction, health: tm.health },
    tasks,
    lost: Boolean(sim.ended && sim.outcome?.kind === 'failure'),
    result,
  };
}

/** The host's side of an online room: players' answers are applied, the game state is published four times a second. Renders nothing. */
export function OnlineHost() {
  const mode = useOnline((state) => state.mode);
  const roster = useOnline((state) => state.roster);

  // the room decides how many players and stations-per-player there are
  useEffect(() => {
    if (mode !== 'host' || roster.length === 0) return;
    if (gameStore.getState().phase === 'flight') return;
    crewStore.getState().setPlayerCount(roster.length);
    roster.forEach((entry) => crewStore.getState().setName(entry.index, entry.name));
  }, [mode, roster]);

  useEffect(() => {
    if (mode !== 'host') return;
    setActionHandler((action) => {
      // only the player who owns the station may answer for it
      if (playerOfRole(action.role, Math.max(1, onlineStore.getState().roster.length)) !== action.player) return;
      crewStore.getState().respond(action.role, action.choice, simStore.getState().clockT);
    });
    const id = window.setInterval(() => { void publishSnapshot(buildSnapshot()); }, 300);
    return () => { window.clearInterval(id); setActionHandler(null); };
  }, [mode]);
  return null;
}
