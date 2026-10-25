'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { ShaderMaterial } from 'three';
import { buildGalaxyGeometry, type GalaxyShape } from './galaxyBuilder';
import { createGlowTexture, GLOW_BLENDING } from './proceduralTextures';

const VERTEX = `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uSize;
uniform float uTime;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vColor = aColor;
  vTwinkle = 0.82 + 0.18 * sin(uTime * 0.55 + aPhase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uSize * (300.0 / -mv.z) * vTwinkle, 1.0, 32.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform float uAlpha;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = 1.0 - smoothstep(0.04, 0.5, d);
  float core = exp(-d * d * 42.0);
  float halo = exp(-d * d * 8.0);
  gl_FragColor = vec4(vColor * (0.58 + core * 1.25 + halo * 0.18) * vTwinkle, a * a * uAlpha);
}`;

/**
 * One galaxy as a glowing particle cloud plus a soft core. `size` scales the
 * particles with the galaxy: the Milky Way needs bigger specks than a distant spiral.
 */
export function GalaxyField({
  shape,
  size = 1,
  tilt = [0, 0, 0],
  coreGlow = 0.7,
  alpha = 0.9,
}: {
  shape: GalaxyShape;
  size?: number;
  tilt?: [number, number, number];
  /** Opacity of the core halo, 0 for none. */
  coreGlow?: number;
  /** Particle opacity; distant galaxies use less so overlapping points do not burn out to white. */
  alpha?: number;
}) {
  const groupRef = useRef<Group>(null);
  const geometry = useMemo(() => buildGalaxyGeometry(shape), [shape]);
  const material = useMemo(
    () => new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: GLOW_BLENDING, uniforms: { uSize: { value: size }, uAlpha: { value: alpha }, uTime: { value: 0 } } }),
    [size, alpha],
  );
  const glow = useMemo(() => createGlowTexture(shape.coreColor, 'rgba(0,0,0,0)'), [shape.coreColor]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); glow.dispose(); }, [geometry, material, glow]);
  useFrame(({ clock }, delta) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0035;
  });

  return (
    <group ref={groupRef} rotation={tilt}>
      <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      {coreGlow > 0 ? (
        <sprite scale={[shape.radius * 0.5, shape.radius * 0.5, 1]} raycast={() => null}>
          <spriteMaterial map={glow} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={coreGlow} />
        </sprite>
      ) : null}
    </group>
  );
}
