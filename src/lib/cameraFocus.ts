/** Plain 3D point, deliberately not a THREE.Vector3 so this stays testable. */
export type Point3 = { x: number; y: number; z: number };

export type FocusView = { position: Point3; target: Point3 };

/** How many body radii away the camera settles when framing one. */
const FRAMING_RADII = 8;
const MIN_FRAMING_DISTANCE = 5;
const MAX_FRAMING_DISTANCE = 26;

/**
 * Where to put the camera to look at a body: keep the current viewing
 * direction, move along it until the body fills a sensible part of the frame.
 *
 * PROVENANCE: artistic — the distance is a framing choice, not a real one.
 */
export function focusView(bodyCenter: Point3, bodyRadius: number, from: Point3, limits?: { min: number; max: number }): FocusView {
  const minDistance = limits?.min ?? MIN_FRAMING_DISTANCE;
  const maxDistance = limits?.max ?? MAX_FRAMING_DISTANCE;
  const distance = Math.min(Math.max(bodyRadius * FRAMING_RADII, minDistance), maxDistance);

  let dx = from.x - bodyCenter.x;
  let dy = from.y - bodyCenter.y;
  let dz = from.z - bodyCenter.z;
  const length = Math.hypot(dx, dy, dz);

  // Already sitting on the body: fall back to looking down from above it.
  if (length < 1e-6) return { position: { x: bodyCenter.x, y: bodyCenter.y + distance, z: bodyCenter.z }, target: bodyCenter };

  dx /= length;
  dy /= length;
  dz /= length;

  return {
    position: {
      x: bodyCenter.x + dx * distance,
      y: bodyCenter.y + dy * distance,
      z: bodyCenter.z + dz * distance,
    },
    target: bodyCenter,
  };
}
