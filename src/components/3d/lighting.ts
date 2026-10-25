import { Vector3 } from 'three';
import { CENTRAL_BODY_INDEX, simulation } from '@/lib/simulation';
import { projectToScene } from './layout';

const scratch = new Vector3();

/**
 * The Sun's *current* scene position, read straight from the integrated
 * simulation. Materials need it because the Sun is a real body in the n-body
 * state: it wobbles around the barycentre, so the light direction is not fixed.
 *
 * Shared by every shader that cares about day/night (atmospheres, rings, night
 * lights) so they all agree on where the light comes from.
 */
export function sunScenePosition(target: Vector3 = scratch): Vector3 {
  const { positions } = simulation.state;
  const index = CENTRAL_BODY_INDEX * 3;
  const [x, y, z] = projectToScene([
    positions[index] as number,
    positions[index + 1] as number,
    positions[index + 2] as number,
  ]);
  return target.set(x, y, z);
}
