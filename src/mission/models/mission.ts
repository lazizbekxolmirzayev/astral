import { z } from 'zod';
import { destinationIdSchema, idSchema, orbitSpecSchema } from './catalog';

/**
 * The mission document: the single source of truth every module reads and writes.
 *
 * Derived values (mass totals, power margins, Δv, scores) are NOT stored here; they
 * are computed from this document by the engine so the modules can never disagree.
 *
 * Design inputs are plain numbers with the unit in the field name (`...Kg`, `...Km`,
 * `...Days`): they are the player's choices, not data with provenance.
 *
 * Team-readiness: `revision` is bumped on every accepted edit (optimistic
 * concurrency) and `ownerId` is null for guests. A 4-player mode can later add
 * members and roles through a `schemaVersion` bump without touching the engine.
 */

export const MISSION_SCHEMA_VERSION = 1 as const;
export const MAX_PART_QUANTITY = 50;

/** Requirement kinds with the unit their `limit` is expressed in and whether it is a floor or a ceiling. */
export const REQUIREMENT_KINDS = {
  'max-cost': { direction: 'max', unit: 'USD' },
  'max-launch-mass': { direction: 'max', unit: 'kg' },
  'min-operations': { direction: 'min', unit: 'd' },
  'min-science': { direction: 'min', unit: 'pt' },
  'min-data-return': { direction: 'min', unit: 'Gbit' },
  'min-launch-success': { direction: 'min', unit: '1' },
} as const;
export type RequirementKind = keyof typeof REQUIREMENT_KINDS;
const requirementKindSchema = z.enum(Object.keys(REQUIREMENT_KINDS) as [RequirementKind, ...RequirementKind[]]);

export const requirementSchema = z
  .object({
    id: idSchema,
    kind: requirementKindSchema,
    /** In the unit given by `REQUIREMENT_KINDS[kind].unit`. */
    limit: z.number().finite().positive(),
  })
  .strict()
  .refine((requirement) => requirement.kind !== 'min-launch-success' || requirement.limit <= 1, {
    message: 'a success probability cannot exceed 1',
    path: ['limit'],
  });
export type Requirement = z.infer<typeof requirementSchema>;

export const partSelectionSchema = z
  .object({
    itemId: idSchema,
    quantity: z.number().int().min(1).max(MAX_PART_QUANTITY),
  })
  .strict();
export type PartSelection = z.infer<typeof partSelectionSchema>;

export const spacecraftDesignSchema = z
  .object({
    busId: idSchema,
    propulsionId: idSchema.nullable(),
    /** Propellant loaded at launch. */
    propellantMassKg: z.number().finite().min(0),
    /** Solar arrays, batteries, comms, computers, attitude control and instruments. */
    parts: z.array(partSelectionSchema).max(40),
  })
  .strict();
export type SpacecraftDesign = z.infer<typeof spacecraftDesignSchema>;

export const missionSchema = z
  .object({
    schemaVersion: z.literal(MISSION_SCHEMA_VERSION),
    id: z.string().min(1).max(64),
    /** Starts at 0 and increases by 1 with every accepted edit. */
    revision: z.number().int().min(0),
    /** Null for guest missions kept only in this browser. */
    ownerId: z.string().min(1).nullable(),
    title: z.string().trim().min(1).max(120),
    status: z.enum(['draft', 'launched', 'completed']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    /** Seeds every random event, so one design always plays out the same way. */
    seed: z.number().int().min(0).max(0xffff_ffff),
    objective: z
      .object({
        destinationId: destinationIdSchema,
        requirements: z.array(requirementSchema).max(12),
      })
      .strict(),
    spacecraft: spacecraftDesignSchema,
    launch: z.object({ vehicleId: idSchema, siteId: idSchema }).strict(),
    orbit: orbitSpecSchema,
    /** How long the mission operates after arriving; cruise time is added by the destination. */
    plannedOperationsDays: z.number().int().min(1).max(10_000),
  })
  .strict();
export type Mission = z.infer<typeof missionSchema>;
