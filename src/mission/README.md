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

Not here yet: any calculation (Phase 2 onward), UI, persistence, and simulation.

## Rules

- **Every number has a unit and a provenance.** Catalog values are `Quantity` objects, and the unit is checked against the property's dimension.
- **Provenance policy:** `measured` for physical constants (with a source), `estimated` for class-typical technical performance (specific mass, Isp, efficiency, launcher capacity), `fictional` for game-balance values (prices, science points, operations cost). The UI must show which is which.
- **Nothing here is a real product.** Parts and launchers are generic classes, named by type.
- **Derived values are never stored in the mission.** Totals, margins, Δv and scores are computed from the `Mission` document, so modules cannot disagree.
- **Model cards stay `planned` until the engine exists.** A card is switched to `implemented` in the same change that adds and tests its engine.
- **Defaults are starting points.** Their parts are compatible and fit the launcher by mass (tested), but they are not checked against the power, Δv, link and cost models until Phase 2.
- **Languages:** names, summaries, titles and model cards carry English and Uzbek text. UI labels go to the `mission` namespace in `src/messages/*.json` in Phase 3, with the same keys in `ru`.

## Team mode later

`Mission.revision` is bumped on every accepted edit (optimistic concurrency) and `ownerId` is `null` for guests. A four-player mode adds members and roles through a `schemaVersion` bump; the engine and catalog do not change.

## Tests

`npx vitest run src/mission` — unit conversions, schema validity, catalog integrity, provenance policy, bilingual completeness, and physical plausibility. Several catalog numbers are re-derived in the tests from the measured constants (geostationary altitude from the sidereal day, the sun-synchronous inclination from J2, the Hohmann Earth–Mars energy and transfer time).
