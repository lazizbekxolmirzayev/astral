'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, ShaderMaterial, Vector3, type Group } from 'three';
import { CENTRAL_BODY_INDEX, simulation } from '@/lib/simulation';
import { SUN_LOOK, SUN_RADIUS, projectToScene } from './layout';
import { createGlowTexture, GLOW_BLENDING } from './proceduralTextures';
import { CelestialBody } from './CelestialBody';

const CORONA_VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const CORONA_FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(0.75 - dot(vNormal, vView), 2.4);
  // A slow, breathing pulse so the corona is not a static halo.
  float pulse = 0.85 + 0.15 * sin(uTime * 0.6);
  float a = pow(rim, 0.8) * pulse;
  gl_FragColor = vec4(uColor, a);
}`;

/**
 * The Sun's chromosphere: a rim-lit shell that flares toward the camera.
 * Combined with the sprite halos and the bloom pass it reads as a real star.
 *
 * PROVENANCE: colour and falloff are artistic; the Sun's *position* comes from
 * the integrated simulation.
 */
export function SunCorona() {
  const materialRef = useRef<ShaderMaterial>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color('#fff0b0') }, uTime: { value: 0 } },
        vertexShader: CORONA_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: GLOW_BLENDING,
        side: 1, // BackSide
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh scale={1.18} raycast={() => null}>
      <sphereGeometry args={[SUN_RADIUS, 48, 36]} />
      <primitive object={material} attach="material" ref={materialRef} />
    </mesh>
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
  const corona = useMemo(() => createGlowTexture('#fff0b0', 'rgba(255,200,120,0)'), []);

  useFrame(() => {
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
      <CelestialBody id="sun" label={label} color="#f5b041" radius={SUN_RADIUS} emissiveIntensity={2.4} look={SUN_LOOK} spin={0.04} />
      <SunCorona />
      <sprite scale={[SUN_RADIUS * 8, SUN_RADIUS * 8, 1]} raycast={() => null}>
        <spriteMaterial map={halo} color="#ff9e48" blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.22} />
      </sprite>
      <sprite scale={[SUN_RADIUS * 6, SUN_RADIUS * 6, 1]} raycast={() => null}>
        <spriteMaterial map={halo} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.55} />
      </sprite>
      <sprite scale={[SUN_RADIUS * 3.3, SUN_RADIUS * 3.3, 1]} raycast={() => null}>
        <spriteMaterial map={corona} color="#fff0b0" blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.4} />
      </sprite>
      <pointLight intensity={1400} distance={0} decay={2} color="#fff4e0" />
    </group>
  );
}