'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, Object3D, Points, ShaderMaterial, Vector3 } from 'three';
import { createGlowTexture } from '../3d/proceduralTextures';

const VERTEX = `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (420.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const FRAGMENT = `
uniform sampler2D uMap;
varying vec4 vColor;
void main() {
  vec4 tex = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * tex.a);
}`;

type Particle = { age: number; life: number; vx: number; vy: number; vz: number; x: number; y: number; z: number; size: number };
type Pool = { particles: Particle[]; cursor: number; carry: number; world: Vector3; last: Vector3; hasLast: boolean; scratch: Color };

export type PlumeKind = 'flame' | 'smoke' | 'burst';

const FLAME_STOPS = [new Color('#ffffff'), new Color('#ffd27a'), new Color('#ff7a1a'), new Color('#a03a10')];
const SMOKE_STOPS = [new Color('#cfd6e0'), new Color('#9aa3b0'), new Color('#59606b')];

function sampleGradient(stops: Color[], t: number, into: Color) {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const index = Math.floor(scaled);
  return into.copy(stops[index]!).lerp(stops[index + 1]!, scaled - index);
}

const newPool = (count: number): Pool => ({
  particles: Array.from({ length: count }, () => ({ age: 1, life: 1, vx: 0, vy: 0, vz: 0, x: 0, y: -1e6, z: 0, size: 0 })),
  cursor: 0,
  carry: 0,
  world: new Vector3(),
  last: new Vector3(),
  hasLast: false,
  scratch: new Color(),
});

/**
 * A pool of billboard particles that live in world space: a rocket plume, the smoke it leaves behind, or the
 * fireball of a failed launch. Purely visual, so it uses its own clock and never feeds the simulation.
 * `emitter` is the object it spawns from; `throttle.current` (0..1) is how strongly it emits right now.
 */
export function Plume({ kind, emitter, throttle, count = 160, spread = 0.3, speed = 6, size = 1, life = 1 }: { kind: PlumeKind; emitter: MutableRefObject<Object3D | null>; throttle: MutableRefObject<number>; count?: number; spread?: number; speed?: number; size?: number; life?: number }) {
  const assets = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(count * 4), 4));
    geometry.setAttribute('aSize', new BufferAttribute(new Float32Array(count), 1));
    const map = createGlowTexture('#ffffff', 'rgba(255,255,255,0)');
    const material = new ShaderMaterial({ uniforms: { uMap: { value: map } }, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: kind === 'smoke' ? NormalBlending : AdditiveBlending });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.raycast = () => undefined;
    return { geometry, material, map, points };
  }, [count, kind]);
  const pointsRef = useRef<Points>(null);
  const pool = useRef<Pool | null>(null);

  useEffect(() => () => { assets.geometry.dispose(); assets.material.dispose(); assets.map.dispose(); }, [assets]);

  useFrame((_frame, rawDelta) => {
    const points = pointsRef.current;
    if (!points) return;
    pool.current ??= newPool(count);
    const state = pool.current;
    const delta = Math.min(rawDelta, 0.25);
    const geometry = points.geometry;
    const positions = geometry.attributes.position!.array as Float32Array;
    const colors = geometry.attributes.aColor!.array as Float32Array;
    const sizes = geometry.attributes.aSize!.array as Float32Array;
    const { particles, scratch } = state;
    const origin = emitter.current;
    const power = Math.max(0, throttle.current);
    if (origin && power > 0) {
      origin.getWorldPosition(state.world);
      if (!state.hasLast) { state.last.copy(state.world); state.hasLast = true; }
      const perSecond = kind === 'burst' ? count * 4 : (count / (life * (kind === 'smoke' ? 2.4 : 0.55))) * power;
      state.carry += perSecond * delta;
      while (state.carry >= 1) {
        state.carry -= 1;
        const particle = particles[state.cursor]!;
        state.cursor = (state.cursor + 1) % count;
        const angle = Math.random() * Math.PI * 2;
        const lateral = Math.random() * spread;
        if (kind === 'burst') {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const velocity = speed * (0.35 + Math.random());
          particle.vx = Math.sin(phi) * Math.cos(theta) * velocity;
          particle.vy = Math.cos(phi) * velocity * 0.8 + 2;
          particle.vz = Math.sin(phi) * Math.sin(theta) * velocity;
          particle.life = life * (0.6 + Math.random() * 0.8);
        } else {
          particle.vx = Math.cos(angle) * lateral * speed * 0.3;
          particle.vz = Math.sin(angle) * lateral * speed * 0.3;
          particle.vy = -speed * (0.7 + Math.random() * 0.6);
          particle.life = life * (kind === 'smoke' ? 1.6 + Math.random() : 0.35 + Math.random() * 0.4);
        }
        // spawn somewhere along the path the emitter travelled this frame, so a fast rocket leaves a continuous trail
        const along = Math.random();
        particle.age = -along * delta;
        particle.x = state.last.x + (state.world.x - state.last.x) * along + (Math.random() - 0.5) * spread;
        particle.y = state.last.y + (state.world.y - state.last.y) * along;
        particle.z = state.last.z + (state.world.z - state.last.z) * along + (Math.random() - 0.5) * spread;
        particle.size = size * (0.7 + Math.random() * 0.8);
      }
    }
    if (origin && power > 0) state.last.copy(state.world);
    else state.hasLast = false;
    for (let index = 0; index < count; index += 1) {
      const particle = particles[index]!;
      particle.age += delta;
      const t = particle.age / particle.life;
      if (t >= 1) {
        sizes[index] = 0;
        colors[index * 4 + 3] = 0;
        positions[index * 3 + 1] = -1e6;
        continue;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
      if (kind === 'smoke') { particle.vx *= 1 - delta * 0.6; particle.vy *= 1 - delta * 0.9; particle.vz *= 1 - delta * 0.6; }
      if (kind === 'burst') particle.vy -= 3 * delta;
      positions[index * 3] = particle.x;
      positions[index * 3 + 1] = particle.y;
      positions[index * 3 + 2] = particle.z;
      sampleGradient(kind === 'smoke' ? SMOKE_STOPS : FLAME_STOPS, t, scratch);
      colors[index * 4] = scratch.r;
      colors[index * 4 + 1] = scratch.g;
      colors[index * 4 + 2] = scratch.b;
      if (kind === 'smoke') {
        colors[index * 4 + 3] = 0.5 * (1 - t) * Math.min(1, t * 6);
        sizes[index] = particle.size * (1 + t * 5);
      } else {
        colors[index * 4 + 3] = (1 - t) * (kind === 'burst' ? 0.9 : 0.85);
        sizes[index] = particle.size * (kind === 'burst' ? 1 + t * 2.5 : 1 - t * 0.5);
      }
    }
    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.aColor!.needsUpdate = true;
    geometry.attributes.aSize!.needsUpdate = true;
  });

  return <primitive object={assets.points} ref={pointsRef} />;
}
