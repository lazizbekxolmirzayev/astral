import type { QualityTier } from '@/lib/performance';

/**
 * Tuning tables for the cinematic post chain. Kept as pure functions of the
 * quality tier so they can be unit-tested and read in one place: the passes in
 * `SceneEffects` only consume these numbers.
 *
 * PROVENANCE: every value here is an artistic grade, chosen so the scene reads
 * like a rendered film (deep black crush, cool shadows, warm highlights, one
 * controlled bloom). Nothing is measured.
 */
export type BloomSettings = { strength: number; radius: number; threshold: number };

export type GradeSettings = {
  /** Lens-style RGB spread that grows toward the edge of the frame. */
  aberration: number;
  /** Film grain amplitude, 0 to disable. */
  grain: number;
  /** Corner darkening, 0..1. */
  vignette: number;
  /** 1 keeps colours neutral; above 1 pushes saturation. */
  saturation: number;
  /** Linear values below this are lifted to pure black (crush). */
  crush: number;
  /** Overall linear gain applied before tone mapping. */
  exposure: number;
  /** Multiplier applied to dark areas — cool, filmic shadows. */
  shadowTint: readonly [number, number, number];
  /** Multiplier applied to bright areas — warm highlights. */
  highlightTint: readonly [number, number, number];
};

export const GRADE_PRESETS: Record<QualityTier, GradeSettings> = {
  low: {
    aberration: 0,
    grain: 0,
    vignette: 0.42,
    saturation: 1.02,
    crush: 0.004,
    exposure: 1,
    shadowTint: [0.88, 0.96, 1.14],
    highlightTint: [1.08, 1.02, 0.92],
  },
  medium: {
    aberration: 0.0035,
    grain: 0.018,
    vignette: 0.52,
    saturation: 1.06,
    crush: 0.006,
    exposure: 1,
    shadowTint: [0.86, 0.95, 1.18],
    highlightTint: [1.1, 1.02, 0.9],
  },
  high: {
    aberration: 0.005,
    grain: 0.028,
    vignette: 0.58,
    saturation: 1.08,
    crush: 0.008,
    exposure: 1.02,
    shadowTint: [0.85, 0.94, 1.2],
    highlightTint: [1.11, 1.02, 0.89],
  },
  ultra: {
    aberration: 0.0065,
    grain: 0.034,
    vignette: 0.6,
    saturation: 1.1,
    crush: 0.008,
    exposure: 1.04,
    shadowTint: [0.85, 0.94, 1.2],
    highlightTint: [1.12, 1.02, 0.88],
  },
};

const BLOOM_PRESETS: Record<QualityTier, BloomSettings> = {
  low: { strength: 0.55, radius: 0.55, threshold: 0.8 },
  medium: { strength: 0.68, radius: 0.6, threshold: 0.78 },
  high: { strength: 0.82, radius: 0.62, threshold: 0.8 },
  ultra: { strength: 0.9, radius: 0.66, threshold: 0.82 },
};

/** MSAA samples for the composer's own render target; 0 means fall back to SMAA. */
const MSAA_PRESETS: Record<QualityTier, number> = { low: 0, medium: 0, high: 2, ultra: 4 };

export function bloomSettingsFor(tier: QualityTier): BloomSettings {
  return BLOOM_PRESETS[tier];
}

export function gradeSettingsFor(tier: QualityTier): GradeSettings {
  return GRADE_PRESETS[tier];
}

export function msaaSamplesFor(tier: QualityTier): number {
  return MSAA_PRESETS[tier];
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Runs in linear HDR, before `OutputPass` tone-maps, so the crush, split tone
 * and vignette behave like a real grading stage instead of painting on sRGB.
 */
const FRAGMENT = `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAberration;
uniform float uGrain;
uniform float uVignette;
uniform float uSaturation;
uniform float uCrush;
uniform float uExposure;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 grade(vec3 color, float luma) {
  vec3 graded = color;
  graded = mix(graded, graded * uShadowTint, clamp(1.0 - luma * 2.4, 0.0, 1.0) * 0.55);
  graded = mix(graded, graded * uHighlightTint, clamp(luma * 1.3 - 0.5, 0.0, 1.0) * 0.4);
  graded = mix(vec3(dot(graded, vec3(0.2126, 0.7152, 0.0722))), graded, uSaturation);
  return max(graded - uCrush, vec3(0.0));
}

void main() {
  vec2 centred = vUv - 0.5;
  float radius2 = dot(centred, centred);

  vec3 color = texture2D(tDiffuse, vUv).rgb;
  if (uAberration > 0.0) {
    vec2 shift = centred * radius2 * uAberration * 8.0;
    color.r = texture2D(tDiffuse, vUv + shift).r;
    color.b = texture2D(tDiffuse, vUv - shift).b;
  }

  float falloff = length(centred);
  color *= mix(1.0, smoothstep(0.92, 0.22, falloff * 1.12), uVignette);
  color = grade(color, dot(color, vec3(0.2126, 0.7152, 0.0722)));
  color *= uExposure;

  if (uGrain > 0.0) {
    vec2 cell = vUv * vec2(1600.0, 900.0) + vec2(mod(uTime * 41.0, 512.0), mod(uTime * 67.0, 512.0));
    float noise = hash(cell) - 0.5;
    color += noise * uGrain * (1.0 - falloff * 0.55);
  }

  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}`;

/** Shader definition for `ShaderPass`; matches three's built-in pass shader shape. */
export const CinematicShader = {
  name: 'CinematicShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0 },
    uGrain: { value: 0 },
    uVignette: { value: 0.5 },
    uSaturation: { value: 1.06 },
    uCrush: { value: 0.006 },
    uExposure: { value: 1 },
    uShadowTint: { value: [0.86, 0.95, 1.18] },
    uHighlightTint: { value: [1.1, 1.02, 0.9] },
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
};
