# stores

Zustand stores: simulation settings, selection, clock/time state. Keep per-frame animated values in refs, not store state.

## missionStore (Phase 3)

`missionStore.ts` holds the session's missions (`missions`, `order`) and the selected part. It stores only `Mission` documents — never derived resources; views call `evaluateMissionCached`. Edits go through the pure functions in `src/mission/edit.ts` via `edit(id, change)`. Guest mode works as-is: state is in memory and is lost on reload (no persistence yet).
