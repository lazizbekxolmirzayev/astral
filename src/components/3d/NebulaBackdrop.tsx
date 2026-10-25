'use client';

import { useEffect, useMemo } from 'react';
import { createNebulaTexture, GLOW_BLENDING } from './proceduralTextures';

/**
 * A faint, warm nebula behind the Sun in the system view. It gives the void
 * colour instead of flat black and is far outside the planets, so it never
 * occludes anything.
 *
 * PROVENANCE: entirely artistic.
 */
export function NebulaBackdrop() {
  const nebula = useMemo(
    () =>
      createNebulaTexture(
        ['rgba(40,20,60,1)', 'rgba(90,40,110,1)', 'rgba(40,90,140,1)', 'rgba(255,200,140,1)'],
        13,
      ),
    [],
  );
  useEffect(() => () => nebula.dispose(), [nebula]);

  return (
    <sprite position={[0, 0, -120]} scale={[240, 240, 1]} raycast={() => null}>
      <spriteMaterial map={nebula} blending={GLOW_BLENDING} transparent depthWrite={false} opacity={0.5} />
    </sprite>
  );
}
