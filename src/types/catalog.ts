import { z } from 'zod';

export const quantitySchema = z.object({
  value: z.number().finite(),
  unit: z.string().trim().min(1),
  provenance: z
    .enum(['measured', 'derived', 'estimated', 'fictional', 'artistic'])
    .optional(),
  source: z.string().optional(),
  uncertainty: z.number().finite().optional(),
});

const vector3InputSchema = z.union([
  z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  }),
  z.array(z.number().finite()).length(3),
]);

export const catalogObjectSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  type: z
    .enum(['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'comet', 'unknown'])
    .optional(),
  parentId: z.string().nullable().optional(),
  mass: quantitySchema.optional(),
  radius: quantitySchema.optional(),
  density: quantitySchema.optional(),
  semiMajorAxis: quantitySchema.optional(),
  orbitalPeriod: quantitySchema.optional(),
  rotationPeriod: quantitySchema.optional(),
  axialTilt: quantitySchema.optional(),
  eccentricity: quantitySchema.optional(),
  meanTemperature: quantitySchema.optional(),
  gm: quantitySchema.optional(),
  position: vector3InputSchema.optional(),
  velocity: vector3InputSchema.optional(),
  targetType: z.enum(['rocky', 'gas-giant', 'star', 'asteroid', 'unknown']).optional(),
  targetHasAtmosphere: z.boolean().optional(),
  description: z.string().optional(),
  distance: quantitySchema.optional(),
});

export type Quantity = z.infer<typeof quantitySchema>;
export type CatalogObject = z.infer<typeof catalogObjectSchema>;

export type CatalogAdapterFailure = {
  ok: false;
  missing: string[];
};

export type CatalogAdapterSuccess<T> = {
  ok: true;
  value: T;
};

export type CatalogAdapterResult<T> = CatalogAdapterSuccess<T> | CatalogAdapterFailure;

export const CatalogObjectSchema = catalogObjectSchema;
