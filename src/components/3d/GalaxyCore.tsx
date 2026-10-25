'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import { MILKY_WAY_RADIUS } from '@/lib/universeLayout';

const VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform vec3 uCore;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float fresnel = pow(0.6 - dot(vNormal, vView), 2.0);
  float a = fresnel * 0.9;
  gl_FragColor = vec4(uCore, a);
}`;

/**
 * The Milky Way's galactic nucleus: a soft, Fresnel-rimmed sphere that sits at
 * the centre and glows through the dust. Combined with the bright core particles
 * in `GalaxyField` this reads as a real supermassive black hole's accretion glow.
 *
 * PROVENANCE: entirely artistic.
 */
export function GalaxyCore() {
  const materialRef = useRef<ShaderMaterial>(null);
  const radius = MILKY_WAY_RADIUS * 0.08;

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uCore: { value: new Color('#fff0c8') } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: 1, // BackSide
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      // A slow, breathing pulse so the nucleus is not a static blob.
      const pulse = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 0.4);
      materialRef.current.uniforms.uCore.value.setRGB(1, 0.94 * pulse, 0.82 * pulse);
    }
  });

  return (
    <mesh scale={1.6} raycast={() => null}>
      <sphereGeometry args={[radius, 32, 24]} />
      <primitive object={material} attach="material" ref={materialRef} />
    </mesh>
  );
}