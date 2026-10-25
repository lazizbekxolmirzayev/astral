'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import type { QualityTier } from '@/lib/performance';

/**
 * UE5-style post pipeline: filmic tone mapping on the renderer, plus a render
 * pass, a restrained bloom, a gamma correction, and a colour-grading pass that
 * pushes midtones toward a cool cinematic teal-and-orange split.
 */
const COLOR_GRADE_FRAGMENT = `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  // Split-toning: lift shadows cool, highlights warm.
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float highlightWeight = smoothstep(0.08, 0.9, luma);
  vec3 shadowTint = vec3(0.94, 0.98, 1.04);
  vec3 highlightTint = vec3(1.06, 1.02, 0.96);
  vec3 tint = mix(shadowTint, highlightTint, highlightWeight);
  vec3 graded = c.rgb * tint;
  // Keep the source luminance: saturated nebulae pop while space stays dark.
  float gradedLuma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = max(mix(vec3(gradedLuma), graded, 1.12), vec3(0.0));
  gl_FragColor = vec4(c.rgb, c.a);
}`;

const FULLSCREEN_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export function SceneEffects({ qualityTier }: { qualityTier: QualityTier }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const pipeline = new EffectComposer(gl);
    const render = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      qualityTier === 'low' ? 0.3 : qualityTier === 'medium' ? 0.5 : 0.72,
      0.72,
      0.82,
    );
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: COLOR_GRADE_FRAGMENT,
    });
    pipeline.addPass(render);
    pipeline.addPass(bloom);
    pipeline.addPass(grade);
    pipeline.addPass(new OutputPass());
    pipeline.setPixelRatio(gl.getPixelRatio());
    pipeline.setSize(size.width, size.height);
    return pipeline;
  }, [gl, scene, camera, size.width, size.height, qualityTier]);

  useEffect(() => () => {
    composer.passes.forEach((pass) => pass.dispose?.());
    composer.dispose();
  }, [composer]);
  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);

  useFrame((_state, delta) => composer.render(delta), 1);
  return null;
}
