'use client';

import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BackSide, Color, FrontSide, ShaderMaterial, Vector3 } from 'three';

export type Vector3Uniform = { value: Vector3 };

const SHELL_VERTEX = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

/**
 * The outer halo, drawn on the inside of a shell just larger than the body.
 *
 * Two things make this read as an atmosphere rather than a glow decal: the
 * brightness follows the Sun (so the night side carries no halo), and the tint
 * turns warm where light grazes the limb — sunrise and sunset seen from orbit.
 */
const HALO_FRAGMENT = `
uniform vec3 uColor;
uniform vec3 uSunsetColor;
uniform vec3 uSunDirectionView;
uniform float uStrength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 sun = normalize(uSunDirectionView);
  float rim = pow(max(0.0, 0.78 - dot(normal, normalize(vView))), 2.6);
  float facing = clamp(dot(normal, sun) * 0.5 + 0.5, 0.0, 1.0);
  float scatter = pow(facing, 1.6);
  float grazing = pow(1.0 - abs(dot(normal, sun)), 5.0);
  vec3 tint = mix(uColor, uSunsetColor, grazing * 0.75);
  float alpha = rim * (0.1 + 0.9 * scatter) * uStrength;
  // Values above 1 on purpose: the lit limb is a highlight the bloom should catch.
  gl_FragColor = vec4(tint * (1.0 + grazing * 0.8), alpha);
}`;

/**
 * The haze lying over the disc itself. Weak, but it is what softens the
 * terminator and keeps a bright limb from reading as a sticker edge.
 */
const HAZE_FRAGMENT = `
uniform vec3 uColor;
uniform vec3 uSunDirectionView;
uniform float uStrength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 normal = normalize(vNormal);
  float limb = pow(1.0 - abs(dot(normal, normalize(vView))), 3.0);
  float facing = clamp(dot(normal, normalize(uSunDirectionView)) * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(uColor, limb * facing * uStrength);
}`;

type AtmosphereProps = {
  radius: number;
  /** Rim colour of the gas, usually the planet's own atmosphere hue. */
  color: string;
  /** Terminator colour; defaults to a warm scattering orange. */
  sunsetColor?: string;
  /** Body → Sun in view space, written by the owning body once per frame. */
  sunDirectionView: Vector3Uniform;
  /** Skip the second shell on the low tier. */
  haze?: boolean;
};

/**
 * An atmosphere for one body: a limb halo plus, optionally, a scattering haze.
 *
 * Both shells share the same uniform objects, so the owning body writes one
 * sun direction per frame and they can never disagree about where daylight is.
 */
export function AtmosphereShells({
  radius,
  color,
  sunsetColor = '#ff9a5a',
  sunDirectionView,
  haze = true,
}: AtmosphereProps) {
  const materials = useMemo(() => {
    const tint = new Color(color);
    const sunset = new Color(sunsetColor);
    const uniforms = {
      uColor: { value: new Vector3(tint.r, tint.g, tint.b) },
      uSunsetColor: { value: new Vector3(sunset.r, sunset.g, sunset.b) },
      uStrength: { value: 0.9 },
      uSunDirectionView: sunDirectionView,
    };
    const halo = new ShaderMaterial({
      uniforms,
      vertexShader: SHELL_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      side: BackSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const hazeMaterial = new ShaderMaterial({
      uniforms: {
        uColor: uniforms.uColor,
        uStrength: { value: 0.34 },
        uSunDirectionView: sunDirectionView,
      },
      vertexShader: SHELL_VERTEX,
      fragmentShader: HAZE_FRAGMENT,
      side: FrontSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { halo, hazeMaterial };
  }, [color, sunsetColor, sunDirectionView]);

  useEffect(
    () => () => {
      materials.halo.dispose();
      materials.hazeMaterial.dispose();
    },
    [materials],
  );

  return (
    <group>
      <mesh material={materials.halo} scale={1.1} raycast={() => null}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
      {haze ? (
        <mesh material={materials.hazeMaterial} scale={1.004} raycast={() => null}>
          <sphereGeometry args={[radius, 48, 32]} />
        </mesh>
      ) : null}
    </group>
  );
}
