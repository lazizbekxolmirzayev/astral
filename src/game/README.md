# Game (the home page)

The home page `/` is the mission game: one full-screen 3D scene with the interface laid over it. The
Solar System explorer that used to be the home page now lives at `/universe`; the Engineer pages
(`/missions`, the workspace tabs) are unchanged and open the same mission document.

## Flow

`map → hangar → flight → result` (`gameStore.ts`, only *where the player is*):

1. **Map** – a stylised, not-to-scale solar-system map (`mapLayout.ts`). Destinations are objects in the scene
   (Earth rings, the Moon, Mars, a heliocentric orbit); clicking one flies the camera to it. The card shows
   catalog facts only (cruise time, target orbit). "Build the mission" creates the mission from the
   destination's template (`missionStore.createFromTemplate`).
2. **Hangar** – the spacecraft (`layoutSpacecraft`) on its stand and the four launch vehicles in the rocket
   bay (click one to choose it: `setLauncher`). The parts bay edits the same document through the same pure
   edit functions as the Engineer pages (`addPart`, `removePart`, `setBus`, `setPropulsion`). Gauges
   (mass, power, budget, downlink) and the launch checks come from `evaluateMissionCached`; the LAUNCH button is
   enabled exactly when the readiness report says `launchReady`.
3. **Flight** – the Phase 5 simulation (`simStore`) drives everything. The scene shows the launch
   cinematic for the first two stages, then the frame of each stage (`frameOf`, `craftState`, `craftTrail`).
   The HUD is `readTelemetry` and the simulation's timeline.
4. **Result** – the simulation's `MissionOutcome`: success / partial / failure, the reasons and the
   requirement checks. "Improve the design" returns to the hangar with the same document.

## Pacing (`cinematic.ts`, `orbitPacing.ts`)

The simulation computes real mission time. The game plays each stage in a few seconds by choosing the
simulated seconds per real second per stage (`cinematicRate`, installed as `simStore.rateModel`). This
changes how fast the clock runs, never a number: the simulation takes whole steps, so the outcome does not
depend on the pacing. While the clock runs far faster than an orbit, the operational orbit is drawn at a fixed
visual pace (one orbit per 12 s, `operationalCraft` in `src/mission/sim/scene.ts`) instead of at the clock's pace.

## What is artistic

Everything drawn is a picture of the design, not a physical model: planet textures are procedural, the map is
not to scale, the ascent path and the rocket sizes are drawn (`launchPath.ts`, `RocketModel.tsx`), and the
exhaust and explosion are particles with their own clock. None of it feeds the simulation or the score.

## Sound

`audio.ts` synthesises an engine rumble, a blast and interface blips with Web Audio (no files). It starts on
the first click, and the top bar has a mute button.
