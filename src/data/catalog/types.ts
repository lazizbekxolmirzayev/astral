/** Provenance tiers for catalog values. Nothing here is ever shown as more certain than it is. */
export type CatalogProvenance = 'measured' | 'derived' | 'estimated' | 'fictional';

export type CatalogQuantity = {
  value: number;
  unit: string;
  provenance: CatalogProvenance;
  /** Short caveat, e.g. "minimum mass (m sin i)" or "very uncertain". */
  note?: string;
};

export type CatalogType =
  | 'star'
  | 'black_hole'
  | 'pulsar'
  | 'exoplanet'
  | 'asteroid'
  | 'comet'
  | 'meteorite_event'
  | 'galaxy';

/**
 * How trustworthy the record as a whole is.
 * - curated-unverified: typed in by hand from widely published values; the
 *   source link says where to verify. Shown with a visible warning.
 * - imported: produced by a documented import script from a named dataset.
 */
export type ReviewStatus = 'curated-unverified' | 'imported';

export type CatalogEntry = {
  id: string;
  type: CatalogType;
  /** Display name. */
  name: string;
  /** Other names and translations, matched by search (any language/script). */
  aliases: string[];
  description: string;
  /** Where to verify the numbers (a page, not a file we fetched). */
  sourceUrl: string;
  license: string;
  reviewStatus: ReviewStatus;
  massKg?: CatalogQuantity;
  massSolar?: CatalogQuantity;
  massEarth?: CatalogQuantity;
  radiusKm?: CatalogQuantity;
  radiusSolar?: CatalogQuantity;
  diameterM?: CatalogQuantity;
  densityKgM3?: CatalogQuantity;
  temperatureK?: CatalogQuantity;
  distanceLy?: CatalogQuantity;
  semiMajorAxisAu?: CatalogQuantity;
  eccentricity?: CatalogQuantity;
  orbitalPeriodDays?: CatalogQuantity;
  rotationPeriodMs?: CatalogQuantity;
  impactVelocityKmS?: CatalogQuantity;
  energyMegatons?: CatalogQuantity;
  /** exoplanet only: id of the host star entry. */
  hostId?: string;
  /** Short label such as "G2V main-sequence star". */
  classification?: string;
};
