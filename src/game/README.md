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

## Launch cameras, shaking and separation

The launch can be watched from seven cameras (`LAUNCH_CAMERAS` in `gameStore.ts`): **Auto** (a broadcast-style schedule,
`autoCameraAt`), **Pad** (wide, from the ground), **Tracking** (long lens from far away), **Chase** (beside the vehicle),
**Rear** (below and behind, looking at the engines), **Onboard** (bolted to the side of the vehicle, looking out at the
Earth) and **Crew** (from the nose, through a window frame). Press **C** or use the buttons to switch. A lost vehicle is
always watched from outside.

What is drawn and what is not:
- *Drawn only*: when the pieces separate (`SEPARATION`, fractions of the launch stage), how they tumble, the camera shake
  (`shakeAmount`: lift-off rumble, max-Q, a jolt after each separation) and the solar-panel unfolding after the launch.
  The catalog does not model staging events, so these are the same story for every launch and do not change any result.
- *From the simulation*: the stage, the progress through it, altitude, speed and whether the launch fails.

Separating pieces (boosters of the heavy-lift vehicle, the first stage, the two fairing halves) are the same
`RocketModel` drawn with only that piece on (`RocketParts`), so each one leaves from exactly where it was attached,
keeps the vehicle's speed, then falls and spins on its own. After the first stage is gone the flame comes from the
second-stage engine.

## Real-time launch, voices and instruments

- **Pacing of the launch.** The hour-long hold on the pad is skipped through, but the last 60 seconds of the countdown and the
  whole climb (the simulation's 540 s ascent) play in real time. The player can speed them up (x2, x4, x8). Other stages are
  still compressed to a few seconds each. The mission clock shows `T-` before liftoff and `T+` after it.
- **Voices.** `voice.ts` decides what mission control and the crew say (countdown, liftoff, max-Q, separations, altitude and
  "km to orbit", orbit confirmed, and one line per later stage) from the simulation state, each line once. Lines are shown as
  subtitles and spoken with the browser's speech synthesis (Uzbek falls back to Turkish or Russian voices, which read Latin
  Uzbek best), with a radio click before each line. The mute button silences speech too. No audio files are used.
- **Instruments.** During the ascent: an attitude indicator, altitude and speed tapes, an acceleration meter and a strip chart of the
  flown altitude and speed. Altitude, speed and acceleration come from the simulation's telemetry (acceleration is the change of
  speed per mission second). The attitude is *drawn* from the schematic ascent profile; the panel says so. After the ascent
  the panel shows dials for distance/altitude, speed, delta-v left and battery.
- **Transfer view.** The Sun, Earth, the destination, the arrival point and the spacecraft are named on screen.

## Crew, score, mistakes and the mission video

- **Crew (1–4 players, one device).** `crew.ts` splits four stations (flight director, propulsion, power & systems, comms & science) among the players; one player runs all four. Players take turns on one screen or keyboard: keys 1–4 answer for a station (Shift = NO-GO), or tap the buttons. There is no network multiplayer.
- **Real jobs.** At the pad every station is polled GO / NO-GO. The truthful answer comes from the engine's own issue list (`padStatus`): a station with a real *error* in its area should say NO-GO, which scrubs the launch and returns to the hangar with the reason. Later jobs open as the flight reaches them: Max-Q, booster / stage / fairing separation, engine cut-off, panel deployment, link check, course correction, arrival, downlink, and one job for each of the simulation's own events (malfunction, outage, power demand, solar loss, rare target; at most six). While a job on a slow stage is open, playback slows down. The climb is already real time.
- **Honest limits.** The crew changes the **score**, not the physics. The design decides how the mission flies (the simulation is deterministic); a job nobody does is done by the flight computer for fewer points. Separation moments, shake and the horizon are still the drawn parts listed above.
- **Score (`score.ts`).** Result 400 / 200 / 0, requirements 150, science 200, data 100, spacecraft health 50, crew performance (30 quick, 20 done, −20 missed, −30 GO against a known fault, −15 needless NO-GO). Grades S/A/B/C/D by share of the maximum. Per-player points and a best-crew-member star. Per flight only: **no leaderboard**.
- **Mistakes (`mistakes.ts`).** One list: crew mistakes, the simulation's own warnings and errors (with their causes), unmet requirements, and design errors that were left in. Each flight moment can be watched in the video.
- **Mission video (`replay.ts`).** The finished flight is flown again from the same plan, faster (ascent ×8, speed ×1/×2/×4), with a timeline of one segment per stage flown, mistakes marked on it, clickable to jump (the simulation is replayed deterministically up to that moment), and a caption for each crew answer. It is a replay of the simulation in the 3D scene, not a recorded video file.

## Online rooms

A player can open **Online** in the top bar, create a room (5-letter code, up to 4 players) and share the code or an invite link (`/?room=CODE`). Others join from their own phone or computer.

- **No game server.** Browsers connect directly to each other (WebRTC through PeerJS, `src/game/online.ts`); the public PeerJS broker only introduces them, so it works on any static/serverless host such as Vercel. Set `NEXT_PUBLIC_PEER_HOST` (+ `_PORT`, `_PATH`, `_SECURE`) to use your own broker. Strict corporate networks without a TURN relay may block direct connections.
- The **host's browser runs the simulation** and publishes a small snapshot (stage, clock, key telemetry, open jobs, points) about 3 times a second. Joiners see a full-screen **station console** with big GO / NO-GO / action buttons for the stations they own (`playerOfRole`), the key numbers, and the result. The 3D flight is shown on the host screen only.
- Answers are validated on the host: only the player who owns a station can answer for it. Each joiner's console speaks new jobs in that player's own language (uz/ru/en).
- Rooms live only while the host's tab is open. There is no account system and no leaderboard.

## Looking around and the cosmos

- **Free look** (`CameraDirector`, `freeLook`): drag with the mouse or a finger and the camera swings around what it is looking at; the wheel or a two-finger pinch zooms. A few seconds after the drag ends the view eases back to the director's shot.
- **Heliocentric flights** draw the rest of the Solar System (`Cosmos.tsx`): the other planets at their real mean distances and approximate current positions (circular orbits, J2000 mean longitude + mean motion), the main asteroid belt, and orbit lines. Sizes are exaggerated; surfaces are procedural.
- The launch sky is an opaque dome drawn first (a transparent, depth-test-free dome paints over the vehicle) and goes black with altitude by about 100 km. The drawn height near the ground is exaggerated so the vehicle visibly leaves the tower; the HUD altitude is the real one.

- **Uzbek voice:** browsers rarely have an Uzbek voice. When none is installed the line is read by the Google Translate Uzbek text-to-speech voice (an unofficial public endpoint, played through an `<audio>` element); if it cannot be reached the browser's fallback voice is used. English and Russian use the best installed browser voice.
- The HUD layers no longer sit over the canvas (`[&>*:not(.pointer-events-none)]`), which is what lets the drag and wheel reach the 3D view.
- Earth/Moon flights show the Sun's glare and the planets as points at their approximate real directions (`SkyPlanets`).
