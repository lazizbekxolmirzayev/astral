import { z } from 'zod';
import { ADCS_SYSTEMS, BATTERIES, BUSES, COMMS_SYSTEMS, COMPUTERS, INSTRUMENTS, LAUNCHERS, objectiveById, OBJECTIVES, orbitById, ORBITS, POWER_SOURCES, PROPULSION_SYSTEMS } from './data';
import type { MissionDesign } from './types';

export const SHARE_PARAM = 'design';

const MAX_ENCODED_LENGTH = 2000;
const MAX_LIFETIME_MONTHS = 240;

const oneOf = (items: readonly { id: string }[]) => z.string().refine((id) => items.some((item) => item.id === id));

/** Links are untrusted input: only known part ids and sane numbers get through. */
const designSchema = z.object({
  objectiveId: oneOf(OBJECTIVES),
  busId: oneOf(BUSES),
  powerId: oneOf(POWER_SOURCES),
  batteryId: oneOf(BATTERIES),
  commsId: oneOf(COMMS_SYSTEMS),
  computerId: oneOf(COMPUTERS),
  adcsId: oneOf(ADCS_SYSTEMS),
  propulsionId: oneOf(PROPULSION_SYSTEMS),
  instrumentIds: z.array(oneOf(INSTRUMENTS)).max(INSTRUMENTS.length),
  orbitId: oneOf(ORBITS),
  launcherId: oneOf(LAUNCHERS),
  lifetimeMonths: z.number().int().positive().max(MAX_LIFETIME_MONTHS),
  sandbox: z.boolean().optional(),
}).refine((design) => orbitById(design.orbitId).target === objectiveById(design.objectiveId).target && new Set(design.instrumentIds).size === design.instrumentIds.length);

export function encodeDesign(design: MissionDesign): string {
  return btoa(encodeURIComponent(JSON.stringify(design))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDesign(encoded: string | null): MissionDesign | null {
  if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return null;
  try {
    const json = decodeURIComponent(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    const parsed = designSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
