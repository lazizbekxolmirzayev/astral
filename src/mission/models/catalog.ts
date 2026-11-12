import { z } from 'zod';
import { BODY_IDS } from '../constants';
import { quantityOf } from './quantity';

/**
 * Catalog data models: what the player can pick from. Every numeric property is a
 * `Quantity` (value + unit + provenance), and the unit is checked against the
 * property's dimension, so a mass can never be given in watts.
 *
 * Provenance policy for catalog numbers (documented in src/mission/README.md):
 * - measured   physical constants of real bodies, with a citation
 * - estimated  typical performance of a technology class (specific mass, Isp, …)
 * - fictional  game-balance values: prices, science points, operations cost
 */

export const DESTINATION_IDS = ['leo', 'sso', 'geo', 'moon', 'mars', 'helio'] as const;
export type DestinationId = (typeof DESTINATION_IDS)[number];
export const destinationIdSchema = z.enum(DESTINATION_IDS);

/** Where a launcher drops the spacecraft; the spacecraft's own propulsion does the rest. */
export const LAUNCH_TARGET_IDS = ['leo', 'sso', 'gto', 'tli', 'tmi'] as const;
export type LaunchTargetId = (typeof LAUNCH_TARGET_IDS)[number];
export const launchTargetIdSchema = z.enum(LAUNCH_TARGET_IDS);

export const bodyIdSchema = z.enum(BODY_IDS);

export const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase letters, digits and hyphens');
export const localizedSchema = z.object({ en: z.string().min(1), uz: z.string().min(1) }).strict();

const baseShape = {
  id: idSchema,
  name: localizedSchema,
  summary: localizedSchema,
  /** Mass of one unit of this item, including its own structure. */
  mass: quantityOf('mass'),
  /** Price of one unit. Game-balance value. */
  cost: quantityOf('currency'),
};

/* ----------------------------- spacecraft parts ----------------------------- */

export const busSchema = z
  .object({
    ...baseShape,
    category: z.literal('bus'),
    /** Housekeeping power drawn continuously by the bus itself. */
    basePowerDraw: quantityOf('power'),
    /** Largest total mass of instruments the bus structure can carry. */
    payloadMassLimit: quantityOf('mass'),
    designLife: quantityOf('time'),
    destinations: z.array(destinationIdSchema).min(1),
  })
  .strict();

export const propulsionSchema = z
  .object({
    ...baseShape,
    category: z.literal('propulsion'),
    technology: z.enum(['cold-gas', 'monopropellant', 'bipropellant', 'electric']),
    /** Specific impulse in seconds (a time-dimension quantity). */
    isp: quantityOf('time'),
    /** Most propellant the tanks hold. `mass` is the dry subsystem. */
    propellantCapacity: quantityOf('mass'),
    /** Electrical power while thrusting (zero for chemical systems). */
    powerDraw: quantityOf('power'),
    /** Low-thrust systems cannot perform impulsive burns; Phase 2 limits them to small corrections. */
    thrustClass: z.enum(['impulsive', 'low-thrust']),
  })
  .strict();

export const solarArraySchema = z
  .object({
    ...baseShape,
    category: z.literal('solar-array'),
    area: quantityOf('area'),
    /** Body-mounted cells cannot face the Sun; wings turn to track it. Sets the average cosine loss. */
    mounting: z.enum(['body-mounted', 'sun-tracking']),
    /** Array-level beginning-of-life efficiency, packing factor included. */
    efficiency: quantityOf('ratio'),
    /** Fractional output loss per year from radiation and thermal cycling. */
    degradationPerYear: quantityOf('ratio'),
  })
  .strict();

export const batterySchema = z
  .object({
    ...baseShape,
    category: z.literal('battery'),
    capacity: quantityOf('energy'),
    /** Fraction of capacity that may be used per cycle. */
    depthOfDischarge: quantityOf('ratio'),
  })
  .strict();

export const commsSchema = z
  .object({
    ...baseShape,
    category: z.literal('comms'),
    band: z.enum(['uhf', 's', 'x', 'ka']),
    frequency: quantityOf('frequency'),
    txPower: quantityOf('power'),
    antennaGain: quantityOf('gain'),
    powerDraw: quantityOf('power'),
    /** Hardware ceiling; the link budget (Phase 2) may allow less at distance. */
    maxDataRate: quantityOf('dataRate'),
  })
  .strict();

export const obcSchema = z
  .object({
    ...baseShape,
    category: z.literal('obc'),
    storage: quantityOf('data'),
    powerDraw: quantityOf('power'),
  })
  .strict();

export const adcsSchema = z
  .object({
    ...baseShape,
    category: z.literal('adcs'),
    /** Best pointing error the attitude system can hold. */
    pointingAccuracy: quantityOf('angle'),
    powerDraw: quantityOf('power'),
  })
  .strict();

export const INSTRUMENT_KINDS = [
  'multispectral-imager',
  'optical-imager',
  'thermal-imager',
  'radar-imager',
  'transponder',
  'neutron-spectrometer',
  'radar-sounder',
  'imaging-spectrometer',
  'particle-suite',
] as const;
export type InstrumentKind = (typeof INSTRUMENT_KINDS)[number];

export const instrumentSchema = z
  .object({
    ...baseShape,
    category: z.literal('instrument'),
    kind: z.enum(INSTRUMENT_KINDS),
    powerDraw: quantityOf('power'),
    /** Average data produced while the instrument is operating, after onboard processing and compression. */
    dataRate: quantityOf('dataRate'),
    /** Fraction of the mission the instrument is operating. */
    dutyCycle: quantityOf('ratio'),
    /** Game-defined value of the science return when all the data the instrument plans to produce reaches Earth. */
    scienceValue: quantityOf('score'),
    /** Pointing error the instrument tolerates; compared with the ADCS in Phase 2. */
    requiredPointing: quantityOf('angle'),
    /** `relay` data passes through (transponder) and uses neither storage nor the downlink. */
    dataHandling: z.enum(['store-and-forward', 'relay']),
    destinations: z.array(destinationIdSchema).min(1),
  })
  .strict();

export const partSchema = z.discriminatedUnion('category', [
  busSchema,
  propulsionSchema,
  solarArraySchema,
  batterySchema,
  commsSchema,
  obcSchema,
  adcsSchema,
  instrumentSchema,
]);

export type Bus = z.infer<typeof busSchema>;
export type Propulsion = z.infer<typeof propulsionSchema>;
export type SolarArray = z.infer<typeof solarArraySchema>;
export type Battery = z.infer<typeof batterySchema>;
export type Comms = z.infer<typeof commsSchema>;
export type Obc = z.infer<typeof obcSchema>;
export type Adcs = z.infer<typeof adcsSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type Part = z.infer<typeof partSchema>;
export type PartCategory = Part['category'];

/* ------------------------------ launch segment ------------------------------ */

export const launchTargetSchema = z.discriminatedUnion('kind', [
  z
    .object({
      id: launchTargetIdSchema,
      kind: z.literal('orbit'),
      name: localizedSchema,
      centralBody: bodyIdSchema,
      periapsisAltKm: z.number().min(0),
      apoapsisAltKm: z.number().min(0),
      inclinationDeg: z.number().min(0).max(180),
    })
    .strict(),
  z
    .object({
      id: launchTargetIdSchema,
      kind: z.literal('escape'),
      name: localizedSchema,
      centralBody: bodyIdSchema,
      /** Characteristic energy C3 = v∞² of the departure hyperbola. */
      c3: quantityOf('specificEnergy'),
    })
    .strict(),
]);
export type LaunchTarget = z.infer<typeof launchTargetSchema>;

export const launcherSchema = z
  .object({
    id: idSchema,
    name: localizedSchema,
    summary: localizedSchema,
    sizeClass: z.enum(['small', 'medium', 'heavy', 'super-heavy']),
    /** Price of one launch. Game-balance value. */
    cost: quantityOf('currency'),
    /** Probability that the launch itself succeeds. */
    reliability: quantityOf('ratio'),
    /** Mass the vehicle can deliver to each target; a missing target means it cannot reach it. */
    capacity: z.partialRecord(launchTargetIdSchema, quantityOf('mass')),
  })
  .strict();
export type Launcher = z.infer<typeof launcherSchema>;

/**
 * A launch site: where the vehicle leaves Earth. Latitude and longitude are
 * geographic facts (measured/estimated, with a source); which vehicle classes fly
 * from which site, and the inclination corridor, are game rules (see `launchSites.ts`).
 */
export const launchSiteSchema = z
  .object({
    id: idSchema,
    name: localizedSchema,
    summary: localizedSchema,
    country: localizedSchema,
    /** Signed geodetic latitude, degrees (north positive). Sets the lowest inclination a launch can reach. */
    latitude: quantityOf('angle'),
    /** Signed longitude, degrees (east positive). */
    longitude: quantityOf('angle'),
    /** Orbit inclinations the range allows the vehicle to fly directly; anything outside costs a plane change. */
    inclinationRange: z.object({ min: quantityOf('angle'), max: quantityOf('angle') }).strict(),
    /** Vehicle ids that launch from this site. */
    launcherIds: z.array(idSchema).min(1),
    /** Practical limits of the site, shown to the player. */
    restrictions: z.array(localizedSchema),
  })
  .strict();
export type LaunchSite = z.infer<typeof launchSiteSchema>;

/* -------------------------------- destinations ------------------------------- */

export const orbitSpecSchema = z
  .object({
    periapsisAltKm: z.number().min(0),
    apoapsisAltKm: z.number().min(0),
    inclinationDeg: z.number().min(0).max(180),
  })
  .strict()
  .refine((orbit) => orbit.apoapsisAltKm >= orbit.periapsisAltKm, {
    message: 'apoapsis altitude must not be below periapsis altitude',
    path: ['apoapsisAltKm'],
  });
export type OrbitSpec = z.infer<typeof orbitSpecSchema>;

const rangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .strict()
  .refine((range) => range.max >= range.min, { message: 'max must not be below min' });

export const destinationSchema = z
  .object({
    id: destinationIdSchema,
    name: localizedSchema,
    summary: localizedSchema,
    centralBody: bodyIdSchema,
    deliveryTarget: launchTargetIdSchema,
    /** Starting point for the orbit editor; the player may change it within `orbitLimits`. */
    defaultOrbit: orbitSpecSchema,
    orbitLimits: z.object({ altitudeKm: rangeSchema, inclinationDeg: rangeSchema }).strict(),
    /** How the inclination is constrained (Phase 4 enforces it). */
    inclinationRule: z.enum(['free', 'sun-synchronous', 'equatorial']),
    /** Earth–spacecraft distance range for deep-space links. Earth orbits compute it from geometry. */
    earthDistance: z.object({ min: quantityOf('length'), max: quantityOf('length') }).strict().optional(),
    /** Time from launch to arriving in the operational orbit. */
    cruiseDuration: quantityOf('time'),
    operationsCostPerDay: quantityOf('currency'),
    /** Orbit maintenance Δv per year of operations. */
    stationkeepingDvPerYear: quantityOf('velocity'),
  })
  .strict();
export type Destination = z.infer<typeof destinationSchema>;
