'use client';

import { useCallback, useMemo, useState } from 'react';
import { evaluateMissionCached, type Evaluation } from '@/mission/engine';
import type { EditError, EditResult } from '@/mission/edit';
import type { Mission } from '@/mission';
import { missionStore, useMissionStore } from '@/stores/missionStore';

export function useMission(id: string): Mission | undefined {
  return useMissionStore((state) => state.missions[id]);
}

/** The engine's evaluation of this mission document. Memoised per document, never stored. */
export function useEvaluation(mission: Mission): Evaluation {
  return useMemo(() => evaluateMissionCached(mission), [mission]);
}

export type Editor = {
  /** Applies a pure edit; returns whether it was accepted. The refusal reason is in `error`. */
  apply: (change: (mission: Mission) => EditResult) => boolean;
  error: EditError | null;
};

export function useEditor(missionId: string): Editor {
  const [error, setError] = useState<EditError | null>(null);
  const apply = useCallback(
    (change: (mission: Mission) => EditResult) => {
      const refusal = missionStore.getState().edit(missionId, change);
      setError(refusal);
      return refusal === null;
    },
    [missionId],
  );
  return { apply, error };
}
