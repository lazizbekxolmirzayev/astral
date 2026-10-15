/**
 * Where a displayed number came from. Required on every `Quantity` so the UI
 * can never present an invented value as a measured one.
 *
 * - measured   – read from an observation/catalogue source (needs `source`)
 * - derived    – computed from measured values (needs `source` for the inputs)
 * - estimated  – best current guess with real uncertainty attached
 * - fictional  – made up for the simulation, never presented as real
 * - artistic   – chosen for looks (colors, glow, scale factors)
 */
export type Provenance =
  | 'measured'
  | 'derived'
  | 'estimated'
  | 'fictional'
  | 'artistic';

/** A number that cannot be shown without its unit or its provenance. */
export type Quantity = {
  value: number;
  /** Unit symbol as printed by the source, e.g. 'kg', 'km', 'd', 'deg', 'K'. */
  unit: string;
  provenance: Provenance;
  /** Citation for measured/derived values; a URL where possible. */
  source?: string;
  /** One standard deviation, in `unit`. */
  uncertainty?: number;
};

export type CelestialObjectType =
  | 'star'
  | 'planet'
  | 'dwarf-planet'
  | 'moon'
  | 'asteroid'
  | 'comet';

export type CelestialObject = {
  id: string;
  name: string;
  type: CelestialObjectType;
  /** Body this one orbits; null for the Sun (and for detached test fixtures). */
  parentId: string | null;
  mass?: Quantity;
  radius?: Quantity;
  semiMajorAxis?: Quantity;
  orbitalPeriod?: Quantity;
  rotationPeriod?: Quantity;
  axialTilt?: Quantity;
  /** Dimensionless, so its `unit` is the empty-safe placeholder '1'. */
  eccentricity?: Quantity;
  meanTemperature?: Quantity;
  description?: string;
};
