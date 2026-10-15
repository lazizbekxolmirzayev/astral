import { z } from 'zod';
import type { CelestialObject, Provenance } from '@/types/celestial';

export const provenanceSchema = z.enum([
  'measured',
  'derived',
  'estimated',
  'fictional',
  'artistic',
] satisfies readonly Provenance[]);

/** Provenance values that assert a real-world origin, so they must cite one. */
const sourcedProvenances: readonly Provenance[] = ['measured', 'derived'];

export const quantitySchema = z
  .object({
    value: z.number().finite(),
    unit: z.string().min(1),
    provenance: provenanceSchema,
    source: z.string().min(1).optional(),
    uncertainty: z.number().finite().nonnegative().optional(),
  })
  .refine(
    (quantity) =>
      !sourcedProvenances.includes(quantity.provenance) ||
      quantity.source !== undefined,
    {
      message: 'measured/derived values need a source',
      path: ['source'],
    },
  );

export const celestialObjectTypeSchema = z.enum([
  'star',
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
]);

export const celestialObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: celestialObjectTypeSchema,
  parentId: z.string().min(1).nullable(),
  mass: quantitySchema.optional(),
  radius: quantitySchema.optional(),
  semiMajorAxis: quantitySchema.optional(),
  orbitalPeriod: quantitySchema.optional(),
  rotationPeriod: quantitySchema.optional(),
  axialTilt: quantitySchema.optional(),
  eccentricity: quantitySchema.optional(),
  meanTemperature: quantitySchema.optional(),
  description: z.string().min(1).optional(),
});

export const celestialObjectListSchema = z
  .array(celestialObjectSchema)
  .superRefine((objects, ctx) => {
    const ids = new Set(objects.map((object) => object.id));
    for (const object of objects) {
      if (object.parentId !== null && !ids.has(object.parentId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown parentId "${object.parentId}"`,
          path: ['parentId'],
        });
      }
    }
  });

/** Compile-time guarantee that the Zod schemas and the TS types agree. */
export type ParsedQuantity = z.infer<typeof quantitySchema>;
export type ParsedCelestialObject = z.infer<typeof celestialObjectSchema>;

const _typeCheck: CelestialObject extends ParsedCelestialObject
  ? true
  : never = true;
void _typeCheck;
