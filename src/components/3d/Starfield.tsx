'use client';

import { BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { mulberry32, randomUnitVector } from '@/lib/random';
import { GLOW_BLENDING } from './proceduralTextures';
import { STAR_COUNT, STAR_SHELL_MAX, STAR_SHELL_MIN } from './layout';

const VERTEX = `
attribute float aSize;
attribute float aTwinkle;
attribute vec3 aColor;
varying vec3 vColor;
varying float vTwinkle;
uniform float uTime;
void main() {
  vColor = aColor;
  // Slow, independent twinkle so the sky is not a frozen photograph.
  float phase = mod(uTime * 0.25 + aTwinkle * 6.2831, 6.2831);
  vTwinkle = 0.55 + 0.45 * sin(phase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z) * vTwinkle;
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
varying vec3 vColor;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = 1.0 - smoothstep(0.04, 0.5, d);
  float core = exp(-d * d * 34.0);
  gl_FragColor = vec4(vColor * (0.7 + core * 0.8) * vTwinkle, a * a);
}`;

/** Star colors from hot blue-white to cool orange; artistic proportions, not a survey. */
const STAR_TINTS = ['#9db4ff', '#cad7ff', '#f8f7ff', '#fff4e8', '#ffd2a1', '#ffb06b'].map((hex) => new Color(hex));
const MILKY_WAY_TINT = new Color('#a9b8d8');

/** Unit vector of the galactic plane's pole in this scene's frame (artistic tilt). */
const POLE: [number, number, number] = [0.32, 0.9, 0.29];

function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}

function normalize(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Sky for the Solar System view: scattered coloured stars of different sizes
 * plus a faint, dense band of stars along a tilted plane that reads as the
 * Milky Way seen from inside. Seeded, so the sky is identical on every load.
 */
export function Starfield() {
  const { geometry, material } = useMemo(() => {
    const random = mulberry32(20261014);
    const bandCount = 14000;
    const total = STAR_COUNT + bandCount;
    const positions = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const colors = new Float32Array(total * 3);
    const twinkle = new Float32Array(total);
    const u = normalize(cross(POLE, [1, 0, 0]));
    const v = normalize(cross(POLE, u));

    for (let i = 0; i < total; i += 1) {
      const inBand = i >= STAR_COUNT;
      const radius = STAR_SHELL_MIN + random() * (STAR_SHELL_MAX - STAR_SHELL_MIN);
      let dir: [number, number, number];
      if (inBand) {
        // Gaussian-ish spread about the galactic plane; denser toward one side (the "centre").
        const angle = random() * Math.PI * 2;
        const lat = (random() + random() + random() - 1.5) * 0.22;
        const c = Math.cos(lat);
        dir = normalize([
          c * (Math.cos(angle) * u[0] + Math.sin(angle) * v[0]) + Math.sin(lat) * POLE[0],
          c * (Math.cos(angle) * u[1] + Math.sin(angle) * v[1]) + Math.sin(lat) * POLE[1],
          c * (Math.cos(angle) * u[2] + Math.sin(angle) * v[2]) + Math.sin(lat) * POLE[2],
        ]);
      } else {
        dir = randomUnitVector(random);
      }
      positions[i * 3] = dir[0] * radius;
      positions[i * 3 + 1] = dir[1] * radius;
      positions[i * 3 + 2] = dir[2] * radius;

      const tint = inBand ? MILKY_WAY_TINT : STAR_TINTS[Math.floor(Math.pow(random(), 0.8) * STAR_TINTS.length)]!;
      const brightness = inBand ? 0.35 + random() * 0.4 : 0.55 + random() * 0.45;
      colors[i * 3] = tint.r * brightness;
      colors[i * 3 + 1] = tint.g * brightness;
      colors[i * 3 + 2] = tint.b * brightness;
      // A few bright stars; most are faint.
      sizes[i] = inBand ? 0.35 + random() * 0.5 : 0.5 + Math.pow(random(), 6) * 3;
      twinkle[i] = random();
    }

    const next = new BufferGeometry();
    next.setAttribute('position', new BufferAttribute(positions, 3));
    next.setAttribute('aSize', new BufferAttribute(sizes, 1));
    next.setAttribute('aColor', new BufferAttribute(colors, 3));
    next.setAttribute('aTwinkle', new BufferAttribute(twinkle, 1));
    const mat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: GLOW_BLENDING,
      uniforms: { uTime: { value: 0 } },
    });
    return { geometry: next, material: mat };
  }, []);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
