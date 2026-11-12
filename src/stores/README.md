# stores

Zustand stores: simulation settings, selection, clock/time state. Keep per-frame animated values in refs, not store state.

## missionStore (Phase 3)

`missionStore.ts` holds the session's missions (`missions`, `order`) and the selected part. It stores only `Mission` documents — never derived resources; views call `evaluateMissionCached`. Edits go through the pure functions in `src/mission/edit.ts` via `edit(id, change)`. Guest mode works as-is: state is in memory and is lost on reload (no persistence yet).

## simStore (Phase 5)

`simStore.ts` holds the one running mission simulation: plan, state, status (`idle`, `running`, `paused`, `finished`), playback speed and the continuous clock. `tick(realSeconds)` advances mission time by `realSeconds × speed` (a tick is capped at 0.25 s so a hidden tab cannot jump the mission). It never holds a number the simulation did not compute, and a started run keeps its own snapshot of the design until `restart(mission)`.
