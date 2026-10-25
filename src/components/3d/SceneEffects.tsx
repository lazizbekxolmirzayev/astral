'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { QualityTier } from '@/lib/performance';
import { CinematicShader, bloomSettingsFor, gradeSettingsFor, msaaSamplesFor } from './cinematicGrade';

/**
 * The render end of the pipeline: everything the scene draws goes through this
 * chain before it reaches the screen, the way a UE5 frame goes through its
 * post-process volume before display.
 *
 * Order matters and is deliberate:
 *   render → bloom → grade → tone map / sRGB output → (SMAA)
 *
 * Bloom and grading work on linear HDR values, which is why only genuinely hot
 * things (the Sun, bright stars, the accretion disk) bloom while lit planet
 * surfaces stay clean. Anti-aliasing is done by MSAA inside the composer's own
 * render target — the canvas's `antialias` flag cannot help once a composer is
 * in charge — and falls back to SMAA on the low tier, after tone mapping, where
 * edge detection expects display-referred values.
 */
export function SceneEffects({ qualityTier }: { qualityTier: QualityTier }) {
  const { gl, scene, camera, size } = useThree();
  const samples = msaaSamplesFor(qualityTier);
  const renderScale = qualityTier === 'low' ? 0.72 : qualityTier === 'medium' ? 0.82 : qualityTier === 'high' ? 0.9 : 0.94;

  const { composer, gradePass } = useMemo(() => {
    const target = new WebGLRenderTarget(size.width, size.height, {
      type: HalfFloatType,
      samples,
    });
    const pipeline = new EffectComposer(gl, target);
    pipeline.addPass(new RenderPass(scene, camera));

    const bloom = bloomSettingsFor(qualityTier);
    pipeline.addPass(
      new UnrealBloomPass(new Vector2(size.width, size.height), bloom.strength, bloom.radius, bloom.threshold),
    );

    const grade = gradeSettingsFor(qualityTier);
    const gradePass = new ShaderPass(CinematicShader);
    gradePass.uniforms.uAberration.value = grade.aberration;
    gradePass.uniforms.uGrain.value = grade.grain;
    gradePass.uniforms.uVignette.value = grade.vignette;
    gradePass.uniforms.uSaturation.value = grade.saturation;
    gradePass.uniforms.uCrush.value = grade.crush;
    gradePass.uniforms.uExposure.value = grade.exposure;
    gradePass.uniforms.uShadowTint.value = [...grade.shadowTint];
    gradePass.uniforms.uHighlightTint.value = [...grade.highlightTint];
    pipeline.addPass(gradePass);

    pipeline.addPass(new OutputPass());
    if (samples === 0) pipeline.addPass(new SMAAPass());

    // Render the multi-pass chain below native resolution on everyday devices;
    // the final pass scales to the canvas and avoids several full-size GPU passes.
    pipeline.setPixelRatio(gl.getPixelRatio() * renderScale);
    pipeline.setSize(size.width, size.height);
    return { composer: pipeline, gradePass };
  }, [gl, scene, camera, size.width, size.height, qualityTier, samples, renderScale]);

  useEffect(() => () => {
    composer.passes.forEach((pass) => pass.dispose?.());
    composer.dispose();
  }, [composer]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);

  useFrame(({ clock }, delta) => {
    // Grain needs to move; a frozen grain pattern reads as dirty glass.
    gradePass.uniforms.uTime.value = clock.elapsedTime;
    composer.render(delta);
  }, 1);

  return null;
}
