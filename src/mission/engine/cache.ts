import { evaluateMission, type Evaluation } from './evaluate';

const cache = new WeakMap<object, Evaluation>();

/**
 * Evaluates a mission once per document object. Mission documents are immutable
 * (every edit makes a new object), so the object identity is a safe cache key; the
 * cache holds no state of its own and entries disappear with their mission. The UI
 * uses this so several panels can read one evaluation without it being stored.
 * Only the default catalog is cached; use `evaluateMission` directly for others.
 */
export function evaluateMissionCached(mission: Parameters<typeof evaluateMission>[0]): Evaluation {
  let evaluation = cache.get(mission);
  if (!evaluation) {
    evaluation = evaluateMission(mission);
    cache.set(mission, evaluation);
  }
  return evaluation;
}
