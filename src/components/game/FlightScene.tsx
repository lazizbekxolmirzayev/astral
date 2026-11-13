'use client';

import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial, type Fog, type Group, type Mesh, type Object3D, type PointLight, type Sprite } from 'three';
import { craftState, craftTrail, frameKeyOf, frameOf, operationalCraft, operationalTrail, type SceneFrame, type SimPlan } from '@/mission/sim';
import { blast, blip, setThrust } from '@/game/audio';
import { usesVisualOrbit, visualOrbitSeconds } from '@/game/orbitPacing';
import { layoutSpacecraft } from '@/mission/spacecraftLayout';
import { simStore } from '@/stores/simStore';
import { planets, SUN_LOOK } from '../3d/layout';
import { createGlowTexture, GLOW_BLENDING } from '../3d/proceduralTextures';
import { CameraDirector, type CameraPose } from './CameraDirector';
import { Cosmos, SkyPlanets } from './Cosmos';
import { CloudField, Contrail } from './LaunchAtmosphere';
import { createGroundTexture } from './groundTexture';
import { skyLevel } from '@/game/skyLevel';
import { triggerSceneFade } from '@/game/sceneFade';
import { GamePlanet, GameSun } from './GamePlanet';
import { removeAnchors, setAnchor } from './labels';
import { gameStore, type LaunchCameraMode } from '@/game/gameStore';
import { ascentPose, ASCENT_DISTANCE, autoCameraAt, EARTH_SCENE_RADIUS, padThrottle, padWindowProgress, SEPARATION, shakeAmount, skyAmount } from './launchPath';
import { Plume } from './Particles';
import { ALL_PARTS, RocketModel, rocketDims, ROCKET_LOOKS, type RocketClass, type RocketParts } from './RocketModel';
import { ShipModel } from './ShipModel';

const EARTH = planets.find((planet) => planet.id === 'earth')!;
const MARS = planets.find((planet) => planet.id === 'mars')!;
/** The rocket is drawn larger than life on the pad so it reads on screen next to the tower. */
const LAUNCH_SCALE = 2.3;
const MOON_LOOK = { mode: 'blobs' as const, palette: ['#3b3b3d', '#6d6d70', '#9c9c9f', '#c4c4c6'], seed: 77, scale: 5, seaLevel: 0.45 };

/** Advances the simulation from the frame clock; the only place that drives time in the game. */
export function SimDriver() {
  useFrame((_state, delta) => simStore.getState().tick(delta));
  return null;
}

/* ------------------------------------------------------------------ the launch */

const SKY_VERTEX = `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAGMENT = `
uniform vec3 uTop; uniform vec3 uHorizon; uniform float uAlpha;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uHorizon, uTop, pow(h, 0.7));
  // opaque on purpose: a transparent sky is drawn after every opaque object and, with no depth test, would paint over the vehicle
  gl_FragColor = vec4(c * uAlpha, 1.0);
}`;

function Gantry() {
  const steel = { color: '#2b3444', metalness: 0.6, roughness: 0.55 } as const;
  return (
    <group position={[-5.2, 0, 0]} scale={[1.5, 1.7, 1.5]}>
      <mesh position={[0, 9, 0]} raycast={() => null}><boxGeometry args={[1.1, 18, 1.1]} /><meshStandardMaterial {...steel} /></mesh>
      {[3, 7, 11, 15].map((y) => (
        <mesh key={y} position={[1.2, y, 0]} raycast={() => null}><boxGeometry args={[2.4, 0.18, 0.5]} /><meshStandardMaterial {...steel} /></mesh>
      ))}
      <mesh position={[0, 18.4, 0]} raycast={() => null}><coneGeometry args={[0.5, 1.4, 4]} /><meshStandardMaterial color="#8a93a4" metalness={0.7} roughness={0.4} /></mesh>
      <mesh position={[0, 18.9, 0]} raycast={() => null}><sphereGeometry args={[0.12, 8, 8]} /><meshBasicMaterial color="#ff4040" /></mesh>
    </group>
  );
}


/* ---- separation: pieces that fall away from the climbing vehicle ---- */

type PieceId = 'boosterL' | 'boosterR' | 'stage1' | 'fairingA' | 'fairingB';
type Piece = { t0: number; p0: [number, number]; v: [number, number]; pitch: number; spin: number };
const NO_PARTS: RocketParts = { stage1: false, upper: false, fairingA: false, fairingB: false, boosterL: false, boosterR: false };
const PIECE_PARTS: Record<PieceId, RocketParts> = {
  boosterL: { ...NO_PARTS, boosterL: true },
  boosterR: { ...NO_PARTS, boosterR: true },
  stage1: { ...NO_PARTS, stage1: true },
  fairingA: { ...NO_PARTS, fairingA: true },
  fairingB: { ...NO_PARTS, fairingB: true },
};
const PIECE_IDS = Object.keys(PIECE_PARTS) as PieceId[];
/** Pieces keep falling for this long (scene seconds) and are then hidden. */
const PIECE_LIFE = 9;
const PIECE_GRAVITY = -6;

/** Turns a vector in the vehicle's frame (x right, y along the nose) into the world, given its pitch. */
const toWorld = (a: number, b: number, pitch: number): [number, number] => [a * Math.cos(pitch) + b * Math.sin(pitch), -a * Math.sin(pitch) + b * Math.cos(pitch)];

function pieceSetup(rocket: RocketClass, id: PieceId) {
  const d = rocketDims(rocket);
  switch (id) {
    case 'boosterL':
    case 'boosterR': {
      const side = id === 'boosterL' ? -1 : 1;
      return { pivot: [side * (d.radius + d.boosterRadius * 1.02), d.engineBase + d.boosterHeight / 2] as const, impulse: [side * 7, -0.6] as const, spin: side * 0.55 };
    }
    case 'stage1':
      return { pivot: [0, d.engineBase + d.firstStage / 2] as const, impulse: [0, -3.2] as const, spin: 0.22 };
    case 'fairingA':
    case 'fairingB': {
      const side = id === 'fairingA' ? 1 : -1;
      return { pivot: [0, d.engineBase + d.body + d.noseHeight * 0.35] as const, impulse: [side * 9, 2] as const, spin: -side * 0.9 };
    }
  }
}

/** One detached piece: an outer group at the pivot (moved and spun by the scene), the model inside offset by -pivot. */
function DetachedPiece({ id, rocket, register }: { id: PieceId; rocket: RocketClass; register: (id: PieceId, group: Group | null) => void }) {
  const { pivot } = pieceSetup(rocket, id);
  return (
    <group ref={(group) => register(id, group)} visible={false} scale={LAUNCH_SCALE}>
      <group position={[-pivot[0], -pivot[1], 0]}>
        <RocketModel rocket={rocket} parts={PIECE_PARTS[id]} />
      </group>
    </group>
  );
}

/** Where the camera sits for each launch camera. `P` is the base of the vehicle, `U` its nose direction, `H` its drawn height. */
function launchCameraPose(mode: Exclude<LaunchCameraMode, 'auto'>, o: { px: number; py: number; ux: number; uy: number; H: number; r: number; pre: boolean; follow: number; failed: boolean }): CameraPose {
  const { px, py, ux, uy, H, r, pre, follow, failed } = o;
  const at = (k: number): [number, number] => [px + ux * H * k, py + uy * H * k];
  const mid = at(0.5);
  const lookY = pre ? H * 0.5 : Math.max(H * 0.5, py * 0.92 + H * 0.4);
  switch (mode) {
    case 'side':
      return { position: [26 + follow * 20, Math.max(3, mid[1] * 0.35 + 3), 40 + follow * 20], target: [mid[0], Math.max(H * 0.4, mid[1]), 0], fov: 50 };
    case 'track':
      // a long lens from the ground far to the side: the vehicle shrinks away like a real tracking-camera shot
      return { position: [92, 2.5 + Math.min(40, py * 0.12), 120], target: [mid[0], Math.max(H * 0.5, mid[1] + 3), 0], fov: 22 };
    case 'rear': {
      const base = at(-0.9);
      return { position: [base[0] + 7 + H * 0.28, Math.max(2.5, base[1]), H * 0.95], target: [at(0.1)[0], at(0.1)[1], 0], fov: 54, shake: 0 };
    }
    case 'onboard': {
      // bolted to the side of the vehicle, looking down its body toward the engines
      const cam = at(0.74);
      return { position: [cam[0], cam[1], r * 1.5], target: [cam[0] - ux * 14, cam[1] - uy * 14 - 10, r * 1.5 + 60], fov: 70 };
    }
    case 'crew': {
      // from the nose, the way the crew would look out of the window: forward, slightly to one side
      const cam = at(1.04);
      return { position: [cam[0], cam[1], 0.3], target: [cam[0] + ux * 50, cam[1] + uy * 50 - 42, 16], fov: 64 };
    }
    case 'orbit': {
      // far out, looking at the whole climb with the Earth in true proportion: the pad, the path and the orbit above it
      const span = Math.max(60, Math.hypot(px, py));
      return { position: [px * 0.55 + span * 0.35, py * 0.55 + span * 0.18 + 30, 140 + span * 1.15], target: [px * 0.55, py * 0.5, 0], fov: 40, shake: 0 };
    }
    case 'chase':
    default: {
      const distance = 22 + H * 0.8 + follow * 40;
      return { position: [distance * 0.45 + follow * 8, Math.max(3.5, lookY * 0.5 + 2), distance + (failed ? 8 : 0)], // high up the camera looks a little below the vehicle, so the curve of the Earth stays in the picture
      target: [pre ? 0 : px * 0.9, lookY - Math.min(py * 0.35, 110), 0], fov: 46 };
    }
  }
}

/** How much each camera feels the vehicle's shaking. */
const SHAKE_FACTOR: Record<Exclude<LaunchCameraMode, 'auto'>, number> = { side: 0.12, track: 0.08, chase: 0.25, rear: 0.4, onboard: 0.9, crew: 1.2, orbit: 0 };
const RIGID: ReadonlySet<string> = new Set(['onboard', 'crew']);

/**
 * Pad, ascent and the explosion of a failed launch. `progress` is read through a getter every frame, so the
 * scene follows the simulation (pre-launch / launch stage progress) without re-rendering React.
 */
export function LaunchScene({ rocket, read }: { rocket: RocketClass; read: () => LaunchRead }) {
  const { scene } = useThree();
  const rocketGroup = useRef<Group>(null);
  const flameEmitter = useRef<Object3D | null>(null);
  const smokeEmitter = useRef<Object3D | null>(null);
  const burstEmitter = useRef<Object3D | null>(null);
  const flameThrottle = useRef(0);
  const smokeThrottle = useRef(0);
  const burstThrottle = useRef(0);
  const dome = useRef<Group>(null);
  const skyRef = useRef<ShaderMaterial>(null);
  const ground = useRef<Mesh>(null);
  const marker = useRef<Sprite>(null);
  const orbitRing = useRef<Mesh>(null);
  const failedAt = useRef<number | null>(null);
  const smokeFlash = useRef<Mesh>(null);
  const shockwave = useRef<Mesh>(null);
  const flashLight = useRef<PointLight>(null);
  const failPos = useRef<[number, number]>([0, 2]);
  const debrisEmitter = useRef<Object3D | null>(null);
  const debrisThrottle = useRef(0);
  const poseRef = useRef<CameraPose>({ position: [14, 4, 22], target: [0, 6, 0] });

  // separation bookkeeping
  const [parts, setParts] = useState<RocketParts>(ALL_PARTS);
  const done = useRef({ boosters: false, stage1: false, fairing: false });
  const sepAt = useRef(-1);
  const pieces = useRef<Partial<Record<PieceId, Piece>>>({});
  const pieceGroups = useRef<Partial<Record<PieceId, Group | null>>>({});
  const sepEmitter = useRef<Object3D | null>(null);
  const sepThrottle = useRef(0);
  const sepLight = useRef<PointLight>(null);
  const lastPose = useRef<{ x: number; y: number; t: number } | null>(null);
  const velocity = useRef<[number, number]>([0, 0]);
  const flameOffset = useRef(0);
  const [camKey, setCamKey] = useState('pad');
  const camKeyRef = useRef('pad');
  const dims = useMemo(() => rocketDims(rocket), [rocket]);
  const register = useMemo(() => (id: PieceId, group: Group | null) => { pieceGroups.current[id] = group; }, []);

  const sky = useMemo(
    () => new ShaderMaterial({ uniforms: { uTop: { value: new Color('#1d5fc0') }, uHorizon: { value: new Color('#cfe3f4') }, uAlpha: { value: 1 } }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, transparent: false, depthWrite: false, depthTest: false, side: BackSide }),
    [],
  );
  const glow = useMemo(() => createGlowTexture('#ffd9a0', 'rgba(255,140,40,0)'), []);
  const groundMap = useMemo(() => createGroundTexture(384), []);
  useEffect(() => () => { sky.dispose(); glow.dispose(); groundMap.dispose(); skyLevel.value = 0; }, [sky, glow, groundMap]);
  useEffect(() => () => gameStore.getState().setActiveCamera(null), []);
  const earthPlanetLook = EARTH.look;
  const topNight = useMemo(() => new Color('#02040a'), []);
  const topDay = useMemo(() => new Color('#1d5fc0'), []);
  const horizonDay = useMemo(() => new Color('#cfe3f4'), []);
  const horizonNight = useMemo(() => new Color('#05070d'), []);
  const fogRef = useRef<Fog>(null);

  useFrame(({ camera, clock }, rawDelta) => {
    const delta = Math.max(1e-3, Math.min(rawDelta, 0.1));
    const { stage, progress, failed } = read();
    const tau = stage === 'launch' ? progress : stage === 'later' ? 1 : 0;
    const pose = ascentPose(tau);
    const t = clock.elapsedTime;
    const exploded = failed && stage !== 'pre-launch';
    if (exploded && failedAt.current === null) { failedAt.current = t; failPos.current = [pose.x, pose.y + 2]; }
    const sinceFail = failedAt.current === null ? -1 : t - failedAt.current;
    const ux = Math.sin(pose.pitch);
    const uy = Math.cos(pose.pitch);

    // a restart (tau back near zero) puts every piece back on the vehicle
    if (tau < 0.02 && (done.current.boosters || done.current.stage1 || done.current.fairing)) {
      done.current = { boosters: false, stage1: false, fairing: false };
      pieces.current = {};
      sepAt.current = -1;
      for (const id of PIECE_IDS) { const g = pieceGroups.current[id]; if (g) g.visible = false; }
      setParts(ALL_PARTS);
    }

    // vehicle speed in the scene, used so a piece leaves with the speed it had
    const previous = lastPose.current;
    if (previous && t > previous.t) {
      const dt = t - previous.t;
      velocity.current = [velocity.current[0] * 0.75 + ((pose.x - previous.x) / dt) * 0.25, velocity.current[1] * 0.75 + ((pose.y - previous.y) / dt) * 0.25];
    }
    lastPose.current = { x: pose.x, y: pose.y, t };

    // separation events, driven by how far the launch stage has come
    if (sinceFail < 0) {
      const spawn = (ids: PieceId[]) => {
        sepAt.current = t;
        for (const id of ids) {
          const setup = pieceSetup(rocket, id);
          const [wx, wy] = toWorld(setup.pivot[0] * LAUNCH_SCALE, setup.pivot[1] * LAUNCH_SCALE, pose.pitch);
          const [ix, iy] = toWorld(setup.impulse[0], setup.impulse[1], pose.pitch);
          pieces.current[id] = { t0: t, p0: [pose.x + wx, pose.y + wy], v: [velocity.current[0] + ix, velocity.current[1] + iy], pitch: pose.pitch, spin: setup.spin };
        }
        const first = pieces.current[ids[0]!]!;
        if (sepEmitter.current) sepEmitter.current.position.set(first.p0[0], first.p0[1], 0);
        sepThrottle.current = 1;
        blip();
      };
      let changed = false;
      if (!done.current.boosters && tau >= SEPARATION.boosters) {
        done.current.boosters = true;
        changed = true;
        if (dims.boosters > 0) spawn(['boosterL', 'boosterR']);
      }
      if (!done.current.stage1 && tau >= SEPARATION.stage1) { done.current.stage1 = true; changed = true; spawn(['stage1']); }
      if (!done.current.fairing && tau >= SEPARATION.fairing) { done.current.fairing = true; changed = true; spawn(['fairingA', 'fairingB']); }
      if (changed) setParts({ stage1: !done.current.stage1, upper: true, fairingA: !done.current.fairing, fairingB: !done.current.fairing, boosterL: !done.current.boosters, boosterR: !done.current.boosters });
    }
    const sinceSep = sepAt.current < 0 ? -1 : t - sepAt.current;
    if (sepThrottle.current > 0 && sinceSep > 0.12) sepThrottle.current = 0;
    if (sepLight.current) sepLight.current.intensity = sinceSep >= 0 ? 2600 * Math.exp(-sinceSep * 7) : 0;
    if (sepLight.current && sepEmitter.current) sepLight.current.position.copy(sepEmitter.current.position).setZ(6);

    // the pieces fly on their own
    for (const id of PIECE_IDS) {
      const piece = pieces.current[id];
      const group = pieceGroups.current[id];
      if (!piece || !group) continue;
      const dt = t - piece.t0;
      group.visible = dt < PIECE_LIFE;
      group.position.set(piece.p0[0] + piece.v[0] * dt, piece.p0[1] + piece.v[1] * dt + 0.5 * PIECE_GRAVITY * dt * dt, 0);
      group.rotation.set(0, 0, -piece.pitch + piece.spin * dt);
    }

    const group = rocketGroup.current;
    if (group) {
      const shake = stage === 'pre-launch' ? padThrottle(progress) * 0.025 : stage === 'launch' && tau < 0.08 ? 0.04 : 0;
      group.position.set(pose.x + (Math.random() - 0.5) * shake, pose.y + (Math.random() - 0.5) * shake, 0);
      group.rotation.set(0, 0, -pose.pitch);
      group.scale.setScalar(LAUNCH_SCALE);
      group.visible = sinceFail < 0 && !(stage === 'later');
    }
    const throttle = stage === 'pre-launch' ? padThrottle(progress) : stage === 'launch' ? (tau < 0.96 ? 1 : 1 - (tau - 0.96) / 0.04) : 0;
    flameThrottle.current = sinceFail < 0 ? throttle : 0;
    setThrust(flameThrottle.current);
    if (sinceFail >= 0 && sinceFail < 0.05) blast();
    smokeThrottle.current = sinceFail < 0 && pose.y < 70 ? throttle : 0;
    burstThrottle.current = sinceFail >= 0 && sinceFail < 0.35 ? 1 : 0;
    if (burstEmitter.current) burstEmitter.current.position.set(sinceFail < 0 ? pose.x : failPos.current[0], sinceFail < 0 ? pose.y + 2 : failPos.current[1], 0);
    if (debrisEmitter.current) debrisEmitter.current.position.set(failPos.current[0], failPos.current[1], 0);
    debrisThrottle.current = sinceFail >= 0 && sinceFail < 0.2 ? 1 : 0;
    // after the first stage is gone the flame comes from the second-stage engine, higher up the vehicle
    const targetOffset = done.current.stage1 ? (dims.engineBase + dims.firstStage + dims.interstage) * LAUNCH_SCALE : 0;
    flameOffset.current += (targetOffset - flameOffset.current) * Math.min(1, delta * 14);
    if (flameEmitter.current) flameEmitter.current.position.set(pose.x + ux * flameOffset.current, pose.y + 0.1 + uy * flameOffset.current, 0);
    if (smokeEmitter.current) smokeEmitter.current.position.set(pose.x * 0.3, Math.max(0.3, pose.y * 0.4), 0);
    const since = Math.max(0, sinceFail);
    if (smokeFlash.current) {
      smokeFlash.current.visible = sinceFail >= 0 && sinceFail < 1.6;
      smokeFlash.current.position.set(failPos.current[0], failPos.current[1], 0);
      smokeFlash.current.scale.setScalar(2 + since * 14);
      (smokeFlash.current.material as { opacity: number }).opacity = Math.max(0, 0.9 - since * 0.6);
    }
    if (shockwave.current) {
      shockwave.current.visible = sinceFail >= 0 && sinceFail < 2.2;
      shockwave.current.position.set(failPos.current[0], failPos.current[1], 0);
      shockwave.current.scale.setScalar(1 + since * 20);
      (shockwave.current.material as { opacity: number }).opacity = Math.max(0, 0.22 - since * 0.1);
    }
    if (flashLight.current) {
      flashLight.current.position.set(failPos.current[0], failPos.current[1], 4);
      flashLight.current.intensity = sinceFail >= 0 ? Math.max(0, 9000 * Math.exp(-since * 3.2)) : 0;
    }

    // sky colour follows the climb; the dome rides with the camera so it is always around it
    const amount = skyAmount(tau);
    const skyMaterial = skyRef.current;
    if (skyMaterial) {
      (skyMaterial.uniforms.uTop!.value as Color).copy(topNight).lerp(topDay, amount);
      (skyMaterial.uniforms.uHorizon!.value as Color).copy(horizonNight).lerp(horizonDay, amount);
      skyMaterial.uniforms.uAlpha!.value = Math.min(1, amount * 1.15);
      skyLevel.value = amount;
      const fog = fogRef.current;
      if (fog) {
        fog.color.copy(skyMaterial.uniforms.uHorizon!.value as Color).multiplyScalar(0.6);
        // the haze of the lowest layer of air thins out with altitude, so the Earth below is seen clearly from above
        fog.near = 160 + (1 - amount) * 6000;
        fog.far = 1300 + (1 - amount) * 24000;
      }
    }
    if (dome.current) dome.current.position.copy(camera.position);
    if (ground.current) {
      const groundAlpha = Math.min(1, Math.max(0, 1 - (ascentPose(tau).y - 30) / 90));
      (ground.current.material as { opacity: number }).opacity = groundAlpha;
      // a fully faded transparent disc would still write depth and hide the Earth behind it
      ground.current.visible = groundAlpha > 0.01;
    }

    // camera: the player's choice, or the broadcast schedule; a lost vehicle is always watched from outside
    const chosen = gameStore.getState().launchCamera;
    let mode: Exclude<LaunchCameraMode, 'auto'> = chosen === 'auto' ? autoCameraAt(tau) : chosen;
    const pre = stage === 'pre-launch';
    if (sinceFail >= 0) mode = 'chase';
    if (pre && (mode === 'crew' || mode === 'onboard' || mode === 'rear')) mode = 'chase';
    if (pre && chosen === 'auto') mode = 'chase';
    const orbitView = mode === 'orbit' && sinceFail < 0;
    if (marker.current) {
      marker.current.visible = orbitView;
      marker.current.position.set(pose.x, pose.y, 0);
      marker.current.scale.setScalar(14 + (clock.elapsedTime % 1) * 4);
    }
    if (orbitRing.current) orbitRing.current.visible = orbitView;
    const key = `launch-${mode}`;
    if (key !== camKeyRef.current) {
      camKeyRef.current = key;
      setCamKey(key);
      gameStore.getState().setActiveCamera(pre ? null : mode);
    }
    const height = ROCKET_LOOKS[rocket].height * LAUNCH_SCALE;
    const follow = Math.max(0, tau - 0.04);
    const cameraPose = launchCameraPose(mode, { px: pose.x, py: pose.y, ux, uy, H: height, r: ROCKET_LOOKS[rocket].radius * LAUNCH_SCALE, pre, follow, failed: sinceFail > 0 });
    const climbShake = sinceFail < 0 ? shakeAmount(tau, sinceSep) * (pre ? 0 : 1) : 0;
    const padShake = pre ? padThrottle(progress) * 0.5 : 0;
    poseRef.current = { ...cameraPose, shake: (climbShake + padShake) * SHAKE_FACTOR[mode] };
  });

  return (
    <>
      <CameraDirector freeLook getPose={() => poseRef.current} damping={RIGID.has(camKey.slice(7)) ? 40 : camKey === 'launch-track' ? 9 : 3.2} sway={RIGID.has(camKey.slice(7)) ? 0 : 0.18} snapKey={camKey} />
      <fog ref={fogRef} attach="fog" args={['#a9c4de', 160, 1300]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[-24, 18, 30]} intensity={1.7} color="#ffe9d0" />
      <directionalLight position={[30, 8, -20]} intensity={0.6} color="#9fc2ff" />
      <pointLight position={[8, 22, 14]} intensity={260} distance={160} color="#ffe2b8" />
      <group ref={dome} renderOrder={-10}>
        <mesh renderOrder={-10} raycast={() => null}>
          <sphereGeometry args={[250, 32, 24]} />
          <primitive object={sky} attach="material" ref={skyRef} />
        </mesh>
      </group>

      {/* ground and the planet below it, which shows once the ground fades out at altitude */}
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} raycast={() => null}>
        <circleGeometry args={[420, 64]} />
        <meshStandardMaterial map={groundMap} color="#ffffff" metalness={0} roughness={0.95} transparent opacity={1} />
      </mesh>
      {/* the pad sits at a mid latitude of the Earth, not at the texture's pole (a pole would pinch the picture into one grey patch) */}
      <group position={[0, -EARTH_SCENE_RADIUS - 0.4, 0]} rotation={[Math.PI / 2 - 0.49, 0, 0]}>
        <GamePlanet radius={EARTH_SCENE_RADIUS} look={earthPlanetLook} spin={0} segments={128} selfLight={0.45} atmosphere={EARTH.atmosphere} cloudCover={EARTH.cloudCover} atmosphereScale={1.012} />
      </group>

      {/* orbit view: where the rocket is, and the parking orbit above the true-size Earth */}
      <sprite ref={marker} visible={false} raycast={() => null}>
        <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} depthTest={false} />
      </sprite>
      <mesh ref={orbitRing} visible={false} position={[0, -EARTH_SCENE_RADIUS, 0]} rotation={[0, 0, Math.PI / 2 - 0.3]} raycast={() => null}>
        <torusGeometry args={[EARTH_SCENE_RADIUS + ASCENT_DISTANCE, 0.5, 6, 600, 0.6]} />
        <meshBasicMaterial color="#5ee6ff" transparent opacity={0.7} depthWrite={false} />
      </mesh>

      <CloudField />
      <Contrail source={rocketGroup} active={() => readLaunch().stage === 'launch' && !isLost()} />

      {/* the pad */}
      <mesh position={[0, 0.25, 0]} raycast={() => null}>
        <boxGeometry args={[18, 0.5, 18]} />
        <meshStandardMaterial color="#444c58" metalness={0.3} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[3.6, 4.0, 48]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      <Gantry />
      <mesh position={[5.5, 3, 4]} raycast={() => null}><cylinderGeometry args={[0.08, 0.08, 6, 8]} /><meshStandardMaterial color="#666" /></mesh>
      <sprite position={[5.5, 6.2, 4]} scale={[3.2, 3.2, 1]} raycast={() => null}>
        <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.8} />
      </sprite>

      <group ref={rocketGroup} position={[0, 0.5, 0]}>
        <RocketModel rocket={rocket} parts={parts} />
      </group>
      {PIECE_IDS.map((id) => <DetachedPiece key={id} id={id} rocket={rocket} register={register} />)}
      <object3D ref={sepEmitter} />
      <pointLight ref={sepLight} intensity={0} distance={140} color="#ffd9a0" />
      <Plume kind="burst" emitter={sepEmitter} throttle={sepThrottle} count={26} spread={1.3} speed={14} size={3.2} life={1.1} />
      <object3D ref={flameEmitter} />
      <object3D ref={smokeEmitter} />
      <object3D ref={burstEmitter} />
      <object3D ref={debrisEmitter} />
      <Plume kind="flame" emitter={flameEmitter} throttle={flameThrottle} count={320} spread={1.1} speed={34} size={3.1} life={0.8} />
      <Plume kind="smoke" emitter={smokeEmitter} throttle={smokeThrottle} count={260} spread={6} speed={8} size={7} life={2.6} />
      <Plume kind="burst" emitter={debrisEmitter} throttle={debrisThrottle} count={140} spread={3.2} speed={44} size={2.2} life={2.4} />
      <Plume kind="burst" emitter={burstEmitter} throttle={burstThrottle} count={300} spread={1.6} speed={26} size={7} life={1.8} />
      <pointLight ref={flashLight} intensity={0} distance={260} color="#ffb070" />
      <mesh ref={shockwave} visible={false} raycast={() => null}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#ffd9a0" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} wireframe />
      </mesh>
      <mesh ref={smokeFlash} visible={false} raycast={() => null}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshBasicMaterial color="#ffb060" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ the flight */

const WORLD_EXTENT = 10;
/** Seconds the solar panels take to unfold after the spacecraft leaves the rocket. Drawn, not simulated. */
const UNFOLD_SECONDS = 4;
/** How long the spent upper stage stays in view after the spacecraft leaves it (seconds). */
const SPENT_LIFE = 16;
const PATH_STYLE: Record<string, { color: string; width: number; opacity: number }> = {
  operational: { color: '#00f0ff', width: 2.6, opacity: 1 },
  transfer: { color: '#ffc14d', width: 2.6, opacity: 1 },
  parking: { color: '#7a8aa5', width: 1.3, opacity: 0.7 },
  reference: { color: '#5b6b85', width: 1, opacity: 0.5 },
};
const OVERVIEW_FRAMES = new Set(['earth:transfer', 'sun:transfer', 'sun:ops']);

function Body({ body, scale }: { body: SceneFrame['bodies'][number]; scale: number }) {
  const position: [number, number, number] = [body.position[0] * scale, body.position[1] * scale, body.position[2] * scale];
  const radius = Math.max(0.05, body.radius * scale);
  if (body.id === 'sun') return <GameSun radius={radius} look={SUN_LOOK} position={position} intensity={2.2} />;
  if (body.id === 'moon') return <GamePlanet radius={radius} look={MOON_LOOK} position={position} spin={0.02} />;
  if (body.id === 'mars') return <GamePlanet radius={radius} look={MARS.look} position={position} spin={0.05} atmosphere={MARS.atmosphere} />;
  return <GamePlanet radius={radius} look={EARTH.look} position={position} spin={0.05} atmosphere={EARTH.atmosphere} cloudCover={EARTH.cloudCover} nightLights />;
}

/**
 * One frame of the simulation (the central body, orbit lines and the spacecraft), drawn in a fixed world size.
 * Every position comes from `craftState`/`craftTrail` of the simulation; this component owns no motion.
 */
export function OrbitFrameView({ plan, frame, lost, rocket }: { plan: SimPlan; frame: SceneFrame; lost: () => boolean; rocket?: RocketClass }) {
  const scale = WORLD_EXTENT / Math.max(frame.extent, 1.2);
  const layout = useMemo(() => layoutSpacecraft(plan.mission), [plan.mission]);
  const ship = useRef<Group>(null);
  const marker = useRef<Group>(null);
  const glow = useMemo(() => createGlowTexture('#9ff4ff', 'rgba(0,200,255,0)'), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const poseRef = useRef<CameraPose>({ position: [0, 6, 20], target: [0, 0, 0] });
  const trail = useRef<Vec3Like[]>([[0, 0, 0], [0.001, 0, 0]]);
  const trailKey = useRef(0);
  // wide orbits (the planet is small next to the orbit) are watched from above and slowly circled instead of from behind
  const wideOrbit = !OVERVIEW_FRAMES.has(frame.key) && frame.unit === 'radii';
  const [epochMs] = useState(() => Date.now());
  const overview = OVERVIEW_FRAMES.has(frame.key) || wideOrbit;
  const shipRadius = wideOrbit ? 1.4 : overview ? 0.55 : 0.9;

  const visualClock = useRef(0);
  // the first frame after the launch is where the spacecraft unfolds its solar panels
  const unfolds = useMemo(() => {
    const { sim, plan: livePlan } = simStore.getState();
    return Boolean(sim && livePlan && sim.stageIndex === livePlan.stageIds.indexOf('launch') + 1);
  }, []);
  const unfoldClock = useRef(0);
  useEffect(() => () => removeAnchors('flight:'), []);
  // the spent upper stage the spacecraft just left: it stays where it was released while the spacecraft flies on
  const spent = useRef<Group>(null);
  const spentStart = useRef<Vec3Like | null>(null);
  const deploy = useMemo(() => (unfolds ? () => unfoldClock.current / UNFOLD_SECONDS : undefined), [unfolds]);

  useFrame(({ clock }, delta) => {
    const { plan: livePlan, sim, clockT, status } = simStore.getState();
    if (!livePlan || !sim) return;
    if (status !== 'paused') visualClock.current += Math.min(delta, 0.25);
    if (unfolds) unfoldClock.current = Math.min(SPENT_LIFE + 1, unfoldClock.current + Math.min(delta, 0.25));
    const stage = livePlan.stageIds[sim.stageIndex]!;
    const visual = usesVisualOrbit(livePlan, stage);
    const craft = visual ? operationalCraft(livePlan, sim, visualOrbitSeconds(livePlan, visualClock.current)) : craftState(livePlan, sim, clockT);
    const world: Vec3Like = [craft.position[0] * scale, craft.position[1] * scale, craft.position[2] * scale];
    if (ship.current) {
      ship.current.position.set(...world);
      ship.current.rotation.y = clock.elapsedTime * 0.5;
      ship.current.visible = !lost();
    }
    if (marker.current) marker.current.position.set(...world);
    if (overview) {
      // names for what is on screen: the Sun and planets, the arrival point and the spacecraft
      setAnchor('flight:craft', [world[0], world[1] + shipRadius * 1.3, world[2]]);
      for (const body of frame.bodies) setAnchor(`flight:body-${body.id}`, [body.position[0] * scale, body.position[1] * scale + Math.max(0.5, body.radius * scale) + 0.45, body.position[2] * scale]);
      if (frame.target) setAnchor('flight:target', [frame.target[0] * scale, frame.target[1] * scale - 1.3, frame.target[2] * scale]);
    }
    if (spent.current) {
      if (unfolds && !spentStart.current) spentStart.current = [world[0], world[1], world[2]];
      const start = spentStart.current;
      const age = unfoldClock.current;
      spent.current.visible = Boolean(start) && age < SPENT_LIFE;
      if (start) {
        spent.current.position.set(start[0] + age * 0.12, start[1] + age * 0.18, start[2] - age * 0.1);
        spent.current.rotation.set(age * 0.35, age * 0.5, age * 0.2);
      }
    }
    // refresh the trail a few times a second
    const bucket = Math.floor(clock.elapsedTime * (visual ? 20 : 8));
    if (bucket !== trailKey.current) {
      trailKey.current = bucket;
      const points = visual ? operationalTrail(livePlan, sim, visualOrbitSeconds(livePlan, visualClock.current), 40) : craftTrail(livePlan, sim, clockT, 40);
      trail.current = points.map((point) => [point[0] * scale, point[1] * scale, point[2] * scale] as Vec3Like);
    }
    if (overview) {
      const swing = visualClock.current * 0.06;
      // a small frame means a big planet on screen: back off so the whole globe and its orbit are in view
      const back = frame.unit === 'radii' ? Math.max(1, (scale * 4.6) / (WORLD_EXTENT * 1.3)) : 1;
      poseRef.current = wideOrbit
        ? { position: [Math.sin(swing) * WORLD_EXTENT * 1.1 * back, WORLD_EXTENT * 0.9 * back, Math.cos(swing) * WORLD_EXTENT * 1.5 * back], target: [world[0] * 0.2, 0, world[2] * 0.2] }
        : { position: [Math.sin(swing) * WORLD_EXTENT * 0.5, WORLD_EXTENT * 0.72, Math.cos(swing) * WORLD_EXTENT * 1.25], target: [world[0] * 0.3, 0, world[2] * 0.3] };
    } else {
      // Chase view: behind the spacecraft and a little above it, looking along its path, so the planet's
      // curved horizon fills the lower part of the picture and space the upper part.
      const length = Math.hypot(...world) || 1;
      const outward: Vec3Like = [world[0] / length, world[1] / length, world[2] / length];
      const points = trail.current;
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      let along: Vec3Like = a && b ? [b[0] - a[0], b[1] - a[1], b[2] - a[2]] : [0, 0, 0];
      const alongLength = Math.hypot(...along);
      if (alongLength < 1e-6) along = [-outward[2], 0, outward[0]];
      const unit = Math.hypot(...along) || 1;
      const forward: Vec3Like = [along[0] / unit, along[1] / unit, along[2] / unit];
      poseRef.current = {
        position: [world[0] + outward[0] * 1.8 - forward[0] * 4.6, world[1] + outward[1] * 1.8 - forward[1] * 4.6, world[2] + outward[2] * 1.8 - forward[2] * 4.6],
        target: [world[0] + forward[0] * 2.6 + outward[0] * 0.1, world[1] + forward[1] * 2.6 + outward[1] * 0.1, world[2] + forward[2] * 2.6 + outward[2] * 0.1],
      };
    }
  });

  return (
    <>
      <CameraDirector freeLook getPose={() => poseRef.current} damping={overview ? 1.6 : 5} sway={0.08} snapKey={`flight-${frame.key}`} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[-30, 8, 14]} intensity={4.4} color="#fff2dd" />
      {frame.center === 'sun' ? <Cosmos scale={scale} extent={frame.extent} epochMs={epochMs} /> : <SkyPlanets epochMs={epochMs} />}
      {frame.bodies.map((body) => (
        <Body key={`${body.id}-${body.position.join(',')}`} body={body} scale={scale} />
      ))}
      {frame.paths.map((path, index) => {
        const style = PATH_STYLE[path.kind] ?? PATH_STYLE.reference!;
        return <Line key={`${path.kind}-${index}`} points={path.points.map((point) => [point[0] * scale, point[1] * scale, point[2] * scale] as [number, number, number])} color={style.color} lineWidth={style.width} transparent opacity={style.opacity} dashed={path.dashed} dashSize={0.5} gapSize={0.4} raycast={() => null} />;
      })}
      {frame.target ? (
        <mesh position={[frame.target[0] * scale, frame.target[1] * scale, frame.target[2] * scale]} raycast={() => null}>
          <torusGeometry args={[0.6, 0.04, 8, 40]} />
          <meshBasicMaterial color="#34d399" />
        </mesh>
      ) : null}
      <TrailLine source={trail} />
      {unfolds && rocket ? (
        <group ref={spent} visible={false} scale={shipRadius * 0.16}>
          <RocketModel rocket={rocket} parts={{ ...NO_PARTS, upper: true }} />
        </group>
      ) : null}
      <group ref={ship}>
        <ShipModel shapes={layout.shapes} extent={layout.extent} radius={shipRadius} deploy={deploy} />
      </group>
      <group ref={marker}>
        <sprite scale={[shipRadius * 1.7, shipRadius * 1.7, 1]} raycast={() => null}>
          <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.22} />
        </sprite>
      </group>
    </>
  );
}

type Vec3Like = [number, number, number];

/** The spacecraft's recent path, redrawn from the simulation's `craftTrail` as the ref changes. */
function TrailLine({ source }: { source: { current: Vec3Like[] } }) {
  const ref = useRef<{ geometry: { setPositions: (positions: number[]) => void } } | null>(null);
  const last = useRef<Vec3Like[] | null>(null);
  useFrame(() => {
    if (!ref.current || last.current === source.current || source.current.length < 2) return;
    last.current = source.current;
    ref.current.geometry.setPositions(source.current.flat());
  });
  return <Line ref={ref as never} points={[[0, 0, 0], [0.001, 0, 0]]} color="#ff7ad9" lineWidth={2.4} raycast={() => null} />;
}

type LaunchRead = { stage: 'pre-launch' | 'launch' | 'later'; progress: number; failed: boolean };

/** Reads how far the simulation is through the launch stages; called every frame by the launch scene. */
function readLaunch(): LaunchRead {
  const { sim, plan, clockT } = simStore.getState();
  if (!sim || !plan) return { stage: 'pre-launch', progress: 0, failed: false };
  const id = plan.stageIds[sim.stageIndex]!;
  if (id !== 'pre-launch' && id !== 'launch') return { stage: 'later', progress: 1, failed: false };
  const planned = plan.stagePlannedS[id] ?? 0;
  const elapsed = Math.min(planned > 0 ? planned : 1, sim.stageElapsedS + Math.max(0, sim.ended ? 0 : clockT - sim.t));
  // on the pad only the last seconds matter: the engines spool up and the big countdown runs
  const progress = id === 'pre-launch' ? padWindowProgress(planned - elapsed) : planned > 0 ? Math.min(1, elapsed / planned) : 1;
  const failed = Boolean(sim.ended && sim.outcome?.kind === 'failure' && sim.outcome.endedIn === 'launch');
  return { stage: id, progress, failed };
}

const isLost = () => {
  const { sim } = simStore.getState();
  return Boolean(sim?.ended && sim.outcome?.kind === 'failure');
};

/** The scene key of the current stage: the launch cinematic for the first two stages, then the stage's frame. */
function useSceneKey(plan: SimPlan): string {
  const [key, setKey] = useState('launch-cinematic');
  useFrame(() => {
    const { sim } = simStore.getState();
    if (!sim) return;
    const id = plan.stageIds[sim.stageIndex]!;
    const next = id === 'pre-launch' || id === 'launch' ? 'launch-cinematic' : frameKeyOf(plan, id);
    setKey((current) => {
      if (current === next) return current;
      // the cut between the launch cinematic and the orbit views (and between orbit views) dips through black
      queueMicrotask(triggerSceneFade);
      return next;
    });
  });
  return key;
}

/**
 * What the game camera shows during the flight: the launch cinematic for the first two stages, then the frame
 * of the current stage. React re-renders only when the scene changes (a few times per mission); the motion
 * inside each scene is read from the simulation every frame.
 */
export function FlightScene({ plan, rocket }: { plan: SimPlan; rocket: RocketClass }) {
  const key = useSceneKey(plan);
  if (key === 'launch-cinematic') return <LaunchScene rocket={rocket} read={readLaunch} />;
  return <OrbitFrameView key={key} plan={plan} frame={frameOf(plan, key)} lost={isLost} rocket={rocket} />;
}
