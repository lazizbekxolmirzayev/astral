import { PhysicsInputError, type BodyDefinition } from './gravity';

export type StarReplacementModelCard = {
  title: string;
  scope: string;
  assumptions: readonly string[];
  limitations: readonly string[];
};

/**
 * A controlled thought experiment: change one body's gravitational parameter
 * instantaneously while preserving every body's position and velocity.
 */
export const STAR_REPLACEMENT_MODEL_CARD: StarReplacementModelCard = {
  title: 'Instantaneous star replacement model card',
  scope: 'N-body initial-condition transform for an instantaneous central-star mass change.',
  assumptions: [
    'The replacement star occupies the original star position and inherits its velocity.',
    'All other bodies keep their position and velocity at the replacement instant.',
    'The replacement mass ratio is an illustrative user-selected scenario parameter.',
  ],
  limitations: [
    'No stellar evolution, mass loss, ejecta, radiation, or replacement-star encounter is modelled.',
    'This is a Newtonian initial-condition experiment, not a prediction of a real stellar event.',
  ],
};

/** Return new initial conditions; input records are not mutated. */
export function replaceStarMass(
  bodies: readonly BodyDefinition[],
  starId: string,
  replacementMassRatio: number,
): BodyDefinition[] {
  if (!Number.isFinite(replacementMassRatio) || replacementMassRatio <= 0) {
    throw new PhysicsInputError('replacement star mass ratio must be finite and positive');
  }
  const star = bodies.find((body) => body.id === starId);
  if (!star) throw new PhysicsInputError(`no star named "${starId}" in the body set`);
  return bodies.map((body) => body.id === starId
    ? { ...body, gm: body.gm * replacementMassRatio }
    : { ...body, position: [...body.position], velocity: [...body.velocity] });
}
