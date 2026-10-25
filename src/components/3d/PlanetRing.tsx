'use client';

import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, ShaderMaterial, type BufferGeometry, type Texture } from 'three';
import type { Vector3Uniform } from './Atmosphere';

const VERTEX = `
varying vec3 vWorld;
varying vec3 vNormalWorld;
varying vec2 vStripe;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  vStripe = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/**
 * A ring plate that knows where the planet and the Sun are.
 *
 * Rings are the one place in this scene where a shadow is unmissable, so it is
 * done analytically instead of with a shadow map: the fragment tests whether the
 * planet's disc blocks the line back to the Sun (a cylinder shadow, because a
 * thin plate is crossed by parallel light the same way anywhere along it).
 *
 * The lighting term uses the absolute dot product, since a ring is lit from
 * either face, and forward scattering brightens the ring when the viewer looks
 * roughly sunward — the reason real ring images glow at the edges.
 */
const FRAGMENT = `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform vec3 uSunPosition;
uniform vec3 uPlanetPosition;
uniform float uPlanetRadius;
uniform float uOpacity;
varying vec3 vWorld;
varying vec3 vNormalWorld;
varying vec2 vStripe;
void main() {
  vec3 toSun = normalize(uSunPosition - vWorld);
  float lambert = abs(dot(normalize(vNormalWorld), toSun));
  float lit = 0.22 + 0.78 * lambert;

  vec3 relative = vWorld - uPlanetPosition;
  float alongLight = dot(relative, toSun);
  float perpendicular = length(relative - toSun * alongLight);
  float insideShadow = step(0.0, alongLight) * (1.0 - smoothstep(uPlanetRadius * 0.9, uPlanetRadius * 1.12, perpendicular));
  float shadow = mix(1.0, 0.1, insideShadow);

  vec4 stripes = texture2D(uMap, vStripe);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float forward = pow(clamp(dot(viewDir, -toSun), 0.0, 1.0), 3.0);

  vec3 color = stripes.rgb * uColor * (lit * shadow + forward * 0.35 * shadow);
  gl_FragColor = vec4(color, stripes.a * uOpacity);
}`;

export function PlanetRing({
  geometry,
  texture,
  color,
  opacity = 1,
  planetRadius,
  sunPosition,
  planetPosition,
  rotation = [0, 0, 0],
}: {
  geometry: BufferGeometry;
  texture: Texture;
  color: string;
  opacity?: number;
  planetRadius: number;
  sunPosition: Vector3Uniform;
  planetPosition: Vector3Uniform;
  /** Places the plate in the ring plane and applies the planet's axial tilt. */
  rotation?: [number, number, number];
}) {
  const material = useMemo(() => {
    const tint = new Color(color);
    return new ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uColor: { value: new Color(1.18, 1.12, 1.02).multiply(tint) },
        uSunPosition: sunPosition,
        uPlanetPosition: planetPosition,
        uPlanetRadius: { value: planetRadius },
        uOpacity: { value: opacity },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    });
  }, [texture, color, opacity, planetRadius, sunPosition, planetPosition]);

  useEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} rotation={rotation} raycast={() => null} />;
}
