'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  Color,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Group,
} from 'three';
import { CENTRAL_BODY_INDEX, simulation } from '@/lib/simulation';
import { useSelectionStore } from '@/stores/selectionStore';
import { SUN_RADIUS, projectToScene } from './layout';
import { createGlowTexture, createStreakTexture, GLOW_BLENDING } from './proceduralTextures';
import { CelestialBody } from './CelestialBody';

/** Shared noise so the photosphere and the corona churn alike. */
const NOISE_GLSL = `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float amplitude = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 5; i += 1) {
    sum += amplitude * vnoise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}`;

const SHELL_VERTEX = `
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vLocal = normalize(position);
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

/**
 * The photosphere: boiling convection cells, sunspots and limb darkening, with
 * values pushed above 1 so the bloom pass treats the disc as a light source
 * rather than a painted circle.
 *
 * PROVENANCE: the motion and colours are artistic. The Sun's position comes from
 * the integrated simulation.
 */
const PHOTOSPHERE_FRAGMENT = `
${NOISE_GLSL}
uniform float uTime;
uniform float uIntensity;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 dir = normalize(vLocal);
  float cells = fbm(dir * 7.0 + vec3(0.0, uTime * 0.035, uTime * 0.012));
  float granules = fbm(dir * 21.0 - vec3(uTime * 0.06, 0.0, uTime * 0.02));
  float pattern = cells * 0.62 + granules * 0.38;

  vec3 color = mix(vec3(0.48, 0.10, 0.01), vec3(1.0, 0.42, 0.06), smoothstep(0.30, 0.52, pattern));
  color = mix(color, vec3(1.0, 0.78, 0.30), smoothstep(0.52, 0.72, pattern));
  color = mix(color, vec3(1.0, 0.97, 0.86), smoothstep(0.72, 0.92, pattern));

  float spots = smoothstep(0.70, 0.86, fbm(dir * 3.4 + vec3(11.0, 3.0, 7.0)));
  color *= 1.0 - spots * 0.55;

  // Limb darkening: the edge of a star is always dimmer than its centre.
  float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  float limb = 0.40 + 0.60 * pow(mu, 0.45);

  gl_FragColor = vec4(color * limb * uIntensity, 1.0);
}`;

/**
 * The corona: a rim glow broken into streamers by the same noise the surface
 * uses, so the halo moves in cells instead of breathing as one even ring.
 */
const CORONA_FRAGMENT = `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(max(0.0, 0.76 - dot(normalize(vNormal), normalize(vView))), 2.2);
  float streamers = fbm(normalize(vLocal) * 5.5 + vec3(uTime * 0.02, uTime * 0.01, 0.0));
  float pulse = 0.86 + 0.14 * sin(uTime * 0.55);
  float alpha = rim * (0.30 + 0.85 * streamers) * pulse * uStrength;
  gl_FragColor = vec4(uColor * (1.0 + streamers * 0.7), alpha);
}`;

const FLARE_COUNT = 5;
const cameraRight = new Vector3();
const cameraUp = new Vector3();

/**
 * Chromosphere corona plus limb prominences.
 *
 * The flares are placed in the camera's own plane, because a sprite is a
 * billboard: anchoring them to the scene's axes would make them collapse into a
 * line the moment the camera orbits to the side of the Sun.
 */
function SolarAtmosphere() {
  const corona = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color('#ffd06a') },
          uStrength: { value: 0.85 },
        },
        vertexShader: SHELL_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: BackSide,
      }),
    [],
  );
  useEffect(() => () => corona.dispose(), [corona]);

  const flares = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    corona.uniforms.uTime.value = clock.elapsedTime;
    const group = flares.current;
    if (!group) return;
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const t = clock.elapsedTime;
    group.children.forEach((child, index) => {
      const sprite = child as Sprite;
      const material = sprite.material as SpriteMaterial;
      const phase = t * (0.13 + index * 0.021) + index * 1.7;
      const angle = (index * Math.PI * 2) / FLARE_COUNT + Math.sin(phase * 0.45) * 0.3;
      const reach = SUN_RADIUS * (1.02 + 0.05 * Math.sin(phase));
      sprite.position
        .set(0, 0, 0)
        .addScaledVector(cameraRight, Math.cos(angle) * reach)
        .addScaledVector(cameraUp, Math.sin(angle) * reach);
      material.rotation = angle;
      material.opacity = 0.14 + 0.22 * (0.5 + 0.5 * Math.sin(phase));
    });
  });

  return (
    <group>
      <mesh material={corona} scale={1.3} raycast={() => null}>
        <sphereGeometry args={[SUN_RADIUS, 48, 32]} />
      </mesh>
      <group ref={flares}>
        {Array.from({ length: FLARE_COUNT }, (_unused, index) => (
          <sprite key={index} scale={[SUN_RADIUS * 2.6, SUN_RADIUS * 0.42, 1]} raycast={() => null}>
            <spriteMaterial color="#ff8c3a" blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.2} />
          </sprite>
        ))}
      </group>
    </group>
  );
}

/**
 * Emissive sphere plus the point light it casts, both sitting at the Sun's
 * integrated position. The Sun is a real body in the simulation, so it wobbles
 * as the planets pull on it — that is why the light is parented to the same
 * group instead of staying at the origin.
 *
 * Color and brightness are artistic; the Sun's real values live in `src/data`
 * with a source.
 *
 * `label` is passed in rather than read with `useTranslations` here: this
 * component renders inside the R3F reconciler, which does not inherit the
 * next-intl context from the DOM tree.
 */
export function Sun({ label }: { label: string }) {
  const groupRef = useRef<Group>(null);
  const halo = useMemo(() => createGlowTexture('#ffd48a', 'rgba(255,140,40,0)'), []);
  const streak = useMemo(() => createStreakTexture(), []);
  useEffect(
    () => () => {
      halo.dispose();
      streak.dispose();
    },
    [halo, streak],
  );

  const photosphere = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 2.6 } },
        vertexShader: SHELL_VERTEX,
        fragmentShader: PHOTOSPHERE_FRAGMENT,
      }),
    [],
  );
  useEffect(() => () => photosphere.dispose(), [photosphere]);

  const isActive = useSelectionStore((state) => state.selectedId === 'sun' || state.hoveredId === 'sun');

  useFrame(({ clock }) => {
    photosphere.uniforms.uTime.value = clock.elapsedTime;
    // Hover brightens the star itself instead of drawing a separate outline.
    photosphere.uniforms.uIntensity.value = isActive ? 3.4 : 2.6;
    const group = groupRef.current;
    if (!group) return;
    const { positions } = simulation.state;
    group.position.set(
      ...projectToScene([
        positions[CENTRAL_BODY_INDEX * 3] as number,
        positions[CENTRAL_BODY_INDEX * 3 + 1] as number,
        positions[CENTRAL_BODY_INDEX * 3 + 2] as number,
      ]),
    );
  });

  return (
    <group ref={groupRef}>
      <CelestialBody
        id="sun"
        label={label}
        color="#f5b041"
        radius={SUN_RADIUS}
        spin={0.04}
        materialOverride={photosphere}
      />
      <SolarAtmosphere />
      <sprite scale={[SUN_RADIUS * 8, SUN_RADIUS * 8, 1]} raycast={() => null}>
        <spriteMaterial map={halo} color="#ff9e48" blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.22} />
      </sprite>
      <sprite scale={[SUN_RADIUS * 6, SUN_RADIUS * 6, 1]} raycast={() => null}>
        <spriteMaterial map={halo} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.55} />
      </sprite>
      <sprite scale={[SUN_RADIUS * 3.3, SUN_RADIUS * 3.3, 1]} raycast={() => null}>
        <spriteMaterial map={halo} color="#fff0b0" blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.4} />
      </sprite>
      {/* Anamorphic streak: a bright star dragged horizontally across a lens. */}
      <sprite scale={[SUN_RADIUS * 30, SUN_RADIUS * 1.5, 1]} raycast={() => null}>
        <spriteMaterial
          map={streak}
          blending={GLOW_BLENDING}
          transparent
          depthWrite={false}
          opacity={0.34}
          toneMapped={false}
        />
      </sprite>
      <pointLight intensity={1400} distance={0} decay={2} color="#fff4e0" />
    </group>
  );
}
