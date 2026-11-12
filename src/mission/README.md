# mission

The domain core of the Space Mission Design Game: pure TypeScript with no React, no Three.js and no network. It sits beside the existing `src/physics` core and does not change it.

```
UI  →  stores  →  mission (this folder)  →  physics (existing, unchanged)
```

## Phase 1 contents (this folder)

| Path | What it holds |
|---|---|
| `units.ts` | Unit table, `convert`, `toBase`, `valueIn`, dB helpers. A cross-dimension conversion throws. |
| `constants.ts` | Measured reference data (Sun, Earth, Moon, Mars, J2, sidereal day, solar constant), each with a citation. |
| `models/` | Zod schemas and types: catalog items, destinations, launchers, the `Mission` document, the resource-budget contract. |
| `catalog/` | The data the player chooses from: 5 buses, 5 propulsion systems, 5 solar arrays, 3 batteries, 5 radios, 3 computers, 3 attitude systems, 12 instruments, 4 launchers, 5 launch targets, 5 destinations. |
| `templates/defaults.ts` | One starting mission per destination. |
| `validation.ts` | Catalog-reference and compatibility checks on a mission. |
| `modelCards.ts` | What each future calculation computes, assumes and leaves out. |
| `i18n.ts` | `Localized = { en, uz }` and `pickText`. Russian falls back to English. |

Not here yet: UI, persistence, and simulation.

## Phase 2: the resource engine (`engine/`)

`evaluateMission(mission, catalog?)` is the only entry point. It is pure: one `Mission` in, one `Evaluation` out, nothing stored, no UI, no React. The catalog can be injected, which is how the tests prove the results do not depend on the units the catalog is written in.

| File | What it computes |
| --- | --- |
| `resolve.ts` | ids → catalog items (fatal reference problems stop here and are reported) |
| `mass.ts` | dry, payload, propellant and launch mass; launcher capacity; bus payload limit |
| `power.ts` | worst-case solar generation (aphelion, end of life), loads, eclipse, battery, recharge balance |
| `deltaV.ts` | Tsiolkovsky Δv available; Δv required (insertion, corrections, stationkeeping, margin); propellant needed; departure C3 |
| `link.ts` | free-space downlink budget, contact time, usable data rate |
| `data.ts` | daily science data, daily downlink capacity, day-by-day onboard queue, data returned |
| `cost.ts` | hardware + launch + operations |
| `requirements.ts` | requirement checks and provisional science points |
| `evaluate.ts` | the six `ResourceBudget` lines, every issue, `status`, `feasible` |
| `assumptions.ts` | every tunable engine assumption, with unit, provenance and bilingual text |
| `orbit.ts`, `derived.ts` | orbit helpers; the `Derived` quantity (value, unit, provenance, model) |

Rules the engine keeps:

- **Units:** every catalog number is converted to the SI base unit with `toBase` before use; the result is a `Derived` quantity with an explicit unit. Mixing dimensions throws.
- **Provenance:** a result inherits the weakest provenance of its inputs. Physical constants give `derived`, catalog values `estimated`, prices `fictional`. Nothing the engine computes is ever `measured`.
- **Nothing hidden:** an unknown id gives `status: 'unresolvable'` with `resources: null`; every other problem is an `EngineIssue` (`error` or `warning`) and the numbers behind it. `feasible` is false while any error or reference issue remains.
- **Δv is not a `ResourceKey`:** it is reported in `details.deltaV` and in issues, because it has a requirement/capability pair rather than one used/limit line.
- **The `data` line is per day (bit); the `comms` line is a rate (bit/s).** `data` compares production with what the link can send per day; `comms` compares the rate needed to clear a day of data in the contact time with what the link budget supports.

Phase 1 data changed in Phase 2 (so the defaults close): instrument `dataRate` now means the average rate after onboard compression and was lowered for the imagers, radar and particle suite; solar arrays gained `mounting`; the GEO default carries 3 batteries and 2800 kg of propellant, the Mars default 1500 kg; the LEO and SSO science requirements were lowered to 6 and 30.

## Rules

- **Every number has a unit and a provenance.** Catalog values are `Quantity` objects, and the unit is checked against the property's dimension.
- **Provenance policy:** `measured` for physical constants (with a source), `estimated` for class-typical technical performance (specific mass, Isp, efficiency, launcher capacity), `fictional` for game-balance values (prices, science points, operations cost). The UI must show which is which.
- **Nothing here is a real product.** Parts and launchers are generic classes, named by type.
- **Derived values are never stored in the mission.** Totals, margins, Δv and scores are computed from the `Mission` document, so modules cannot disagree.
- **Model cards stay `planned` until the engine exists.** A card is switched to `implemented` in the same change that adds and tests its engine.
- **Defaults are starting points.** Their parts are compatible, and a test runs the resource engine on every default: none has an error (a few carry honest warnings, for example the Mars link at conjunction distance).
- **Languages:** names, summaries, titles and model cards carry English and Uzbek text. UI labels go to the `mission` namespace in `src/messages/*.json` in Phase 3, with the same keys in `ru`.

## Team mode later

`Mission.revision` is bumped on every accepted edit (optimistic concurrency) and `ownerId` is `null` for guests. A four-player mode adds members and roles through a `schemaVersion` bump; the engine and catalog do not change.

## Tests

`npx vitest run src/mission` — unit conversions, schema validity, catalog integrity, provenance policy, bilingual completeness, and physical plausibility. Several catalog numbers are re-derived in the tests from the measured constants (geostationary altitude from the sidereal day, the sun-synchronous inclination from J2, the Hohmann Earth–Mars energy and transfer time).

## Phase 3 additions (workspace support)

- `edit.ts` — pure, immutable edits of a `Mission` (rename, bus, propulsion, propellant, add/remove/quantity of parts, launcher, destination, orbit, operations days, requirements). Each accepted edit bumps `revision`/`updatedAt`; only unrepresentable edits are refused (`EditError`). Questionable designs stay visible as engine issues, never silently corrected.
- `templates/blank.ts` — an empty draft for a destination (first compatible bus, cheapest capable launcher, no parts).
- `engine/cache.ts` — `evaluateMissionCached`, a WeakMap keyed by document identity. Results are never stored in state.
- `view.ts` — `buildIndicators` (the seven live-panel indicators, display units, normal/warning/critical tones), `describePart` (parameter rows for the part cards). No physics here: everything comes from the engine.
- `spacecraftLayout.ts` — pure schematic layout for the 3D preview. Panel area equals the catalog area; other sizes are display scaling only.
- `format.ts` — locale-aware number and unit formatting.

## Phase 4 additions (orbit designer, launch center, readiness)

- `catalog/launchSites.ts`: 5 launch sites (coordinates sourced; Mahia estimated; launcher-to-site assignment is a fictional game rule). `launch` in the mission document is now `{ vehicleId, siteId }`.
- `destinations.ts`: new `helio` destination (heliocentric orbit, C3 ≈ 10 km²/s² injection).
- `engine/orbitReport.ts`: periapsis/apoapsis, a, e, period, speeds, sun-synchronous facts.
  a=(rp+ra)/2, e=(ra−rp)/(ra+rp), T=2π√(a³/μ), v=√(μ(2/r−1/a)).
- `engine/orbit.ts`: nodal precession Ω̇=−3/2·J2·(R/p)²·n·cos i; sun-sync cos i = −Ω̇sun·p²/(3/2·J2·R²·n).
- `engine/deltaV.ts`: site inclination window `i_delivered = clamp(i, min, max)`; plane-change Δv merged into the insertion burn; helio Hohmann-type model.
- `engine/readiness.ts`: 22 checks in 7 groups (PASS/WARNING/FAIL, reason + fix, EN/UZ). `launchReady` only when nothing fails; FAIL is never hidden.
- Views: `orbitView.ts`, `launchView.ts`, `orbitLayout.ts` (pure, tested in `phase4.test.ts`).
