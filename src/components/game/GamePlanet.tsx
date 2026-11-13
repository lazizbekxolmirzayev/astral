'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, Color, DoubleSide, ShaderMaterial, Vector3, type Mesh } from 'three';
import { createCloudTexture, createGlowTexture, createNightLightsTexture, createPlanetSurface, GLOW_BLENDING, type TextureLook } from '../3d/proceduralTextures';

/**
 * Self-contained bodies for the game scenes. They share the universe's procedural textures, but no store
 * or simulation state, so a scene can place them anywhere. Colours and surface patterns are artistic.
 */

const SHELL_VERTEX = `
varying vec3 vWorldNormal;
varying vec3 vWorldView;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vWorldView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const ATMOSPHERE_FRAGMENT = `
uniform vec3 uColor;
uniform vec3 uSun;
uniform float uStrength;
varying vec3 vWorldNormal;
varying vec3 vWorldView;
void main() {
  vec3 n = normalize(vWorldNormal);
  // abs(): the shell is drawn from the inside, so the sign of the normal must not matter.
  float rim = pow(1.0 - abs(dot(n, normalize(vWorldView))), 3.0);
  float lit = clamp(dot(n, normalize(uSun)) * 0.6 + 0.55, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (1.0 + rim * 0.5), min(1.0, rim * lit * uStrength));
}`;

/** Direction to the light, in the scene. All game scenes light bodies from this side. */
export const GAME_SUN_DIRECTION: [number, number, number] = [-0.8, 0.28, 0.45];

export type GamePlanetProps = {
  radius: number;
  look: TextureLook;
  position?: [number, number, number];
  /** Spin, radians per second. */
  spin?: number;
  /** Atmosphere rim colour. */
  atmosphere?: string;
  /** Outer radius of the atmosphere shell as a multiple of the planet radius (the real air is a thin skin; 1.1 is for stylised planets). */
  atmosphereScale?: number;
  cloudCover?: number;
  nightLights?: boolean;
  /** Where the sun is, for the atmosphere. Defaults to the shared game light direction. */
  sun?: [number, number, number];
  segments?: number;
};

export function GamePlanet({ radius, look, position = [0, 0, 0], spin = 0.05, atmosphere, atmosphereScale = 1.1, cloudCover, nightLights = false, sun = GAME_SUN_DIRECTION, segments = 64 }: GamePlanetProps) {
  const surface = useMemo(() => createPlanetSurface(look), [look]);
  const clouds = useMemo(() => (cloudCover ? createCloudTexture(look.seed, cloudCover) : null), [look.seed, cloudCover]);
  const night = useMemo(() => (nightLights ? createNightLightsTexture(look) : null), [look, nightLights]);
  const shell = useMemo(
    () =>
      atmosphere
        ? new ShaderMaterial({
            uniforms: { uColor: { value: new Color(atmosphere) }, uSun: { value: new Vector3(...sun) }, uStrength: { value: 0.85 } },
            vertexShader: SHELL_VERTEX,
            fragmentShader: ATMOSPHERE_FRAGMENT,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: BackSide,
          })
        : null,
    [atmosphere, sun],
  );
  useEffect(() => () => { surface.dispose(); clouds?.dispose(); night?.dispose(); shell?.dispose(); }, [surface, clouds, night, shell]);

  const body = useRef<Mesh>(null);
  const cloudMesh = useRef<Mesh>(null);
  useFrame((_state, delta) => {
    if (body.current) body.current.rotation.y += delta * spin;
    if (cloudMesh.current) cloudMesh.current.rotation.y += delta * spin * 1.25;
  });

  return (
    <group position={position}>
      <mesh ref={body} raycast={() => null}>
        <sphereGeometry args={[radius, segments, Math.round(segments * 0.75)]} />
        <meshStandardMaterial
          map={surface.map}
          roughnessMap={surface.roughnessMap}
          normalMap={surface.normalMap}
          roughness={1}
          metalness={0}
          emissiveMap={night ?? undefined}
          emissive={night ? new Color('#ffcf8a') : new Color('#000000')}
          emissiveIntensity={night ? 1.1 : 0}
        />
      </mesh>
      {clouds ? (
        <mesh ref={cloudMesh} scale={1.012} raycast={() => null}>
          <sphereGeometry args={[radius, segments, Math.round(segments * 0.75)]} />
          <meshStandardMaterial map={clouds} transparent depthWrite={false} roughness={1} opacity={0.92} />
        </mesh>
      ) : null}
      {shell ? (
        <mesh scale={atmosphereScale} raycast={() => null}>
          <sphereGeometry args={[radius, 48, 36]} />
          <primitive object={shell} attach="material" />
        </mesh>
      ) : null}
    </group>
  );
}

const CORONA_FRAGMENT = `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vWorldNormal;
varying vec3 vWorldView;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), normalize(vWorldView))), 2.6);
  float pulse = 0.88 + 0.12 * sin(uTime * 0.7);
  gl_FragColor = vec4(uColor, min(1.0, rim * pulse));
}`;

export function GameSun({ radius, look, position = [0, 0, 0], intensity = 1.5 }: { radius: number; look: TextureLook; position?: [number, number, number]; intensity?: number }) {
  const surface = useMemo(() => createPlanetSurface(look, 0.6), [look]);
  const glow = useMemo(() => createGlowTexture('#ffd27a', 'rgba(255,140,40,0)'), []);
  const corona = useMemo(
    () => new ShaderMaterial({ uniforms: { uColor: { value: new Color('#ffe9a8') }, uTime: { value: 0 } }, vertexShader: SHELL_VERTEX, fragmentShader: CORONA_FRAGMENT, transparent: true, depthWrite: false, blending: AdditiveBlending, side: BackSide }),
    [],
  );
  useEffect(() => () => { surface.dispose(); glow.dispose(); corona.dispose(); }, [surface, glow, corona]);
  const body = useRef<Mesh>(null);
  const coronaRef = useRef<ShaderMaterial>(null);
  useFrame(({ clock }, delta) => {
    if (body.current) body.current.rotation.y += delta * 0.03;
    if (coronaRef.current) coronaRef.current.uniforms.uTime!.value = clock.elapsedTime;
  });
  return (
    <group position={position}>
      <mesh ref={body} raycast={() => null}>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshStandardMaterial map={surface.map} emissiveMap={surface.map} emissive="#ffffff" emissiveIntensity={intensity} color="#000000" roughness={1} />
      </mesh>
      <mesh scale={1.22} raycast={() => null}>
        <sphereGeometry args={[radius, 48, 36]} />
        <primitive object={corona} attach="material" ref={coronaRef} />
      </mesh>
      <sprite scale={[radius * 7, radius * 7, 1]} raycast={() => null}>
        <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.45} side={DoubleSide} />
      </sprite>
    </group>
  );
}
