import { getDestination } from '../catalog';
import { L, type Localized } from '../i18n';
import type { DestinationId } from '../models/catalog';
import { MISSION_SCHEMA_VERSION, missionSchema, type Mission, type Requirement, type SpacecraftDesign } from '../models/mission';

/**
 * Starting designs, one per destination, so a new mission is never an empty page.
 *
 * They are sensible *starting points*: parts are compatible and fit the launcher by
 * mass, but nothing here has been checked against the power, Δv, link and cost
 * models yet. Phase 2 adds a test that runs the resource engine on every default
 * and retunes any that do not close.
 */

export const DEFAULT_MISSION_TITLES: Record<DestinationId, Localized> = {
  leo: L('First CubeSat in low orbit', "Past orbitadagi birinchi CubeSat"),
  sso: L('Earth-observation satellite', "Yerni kuzatuvchi sun'iy yo'ldosh"),
  geo: L('Geostationary communications satellite', "Geostatsionar aloqa yo'ldoshi"),
  moon: L('Lunar orbiter', "Oy orbital apparati"),
  mars: L('Mars orbiter', "Mars orbital apparati"),
};

type Template = {
  spacecraft: SpacecraftDesign;
  vehicleId: string;
  plannedOperationsDays: number;
  requirements: Requirement[];
};

const TEMPLATES: Record<DestinationId, Template> = {
  leo: {
    spacecraft: {
      busId: 'bus-cubesat-6u',
      propulsionId: 'prop-cold-gas',
      propellantMassKg: 1,
      parts: [
        { itemId: 'solar-body-025', quantity: 2 },
        { itemId: 'battery-100wh', quantity: 1 },
        { itemId: 'comms-s-band', quantity: 1 },
        { itemId: 'obc-small', quantity: 1 },
        { itemId: 'adcs-cubesat', quantity: 1 },
        { itemId: 'inst-eo-cube-imager', quantity: 1 },
      ],
    },
    vehicleId: 'launcher-small',
    plannedOperationsDays: 365,
    requirements: [
      { id: 'req-cost', kind: 'max-cost', limit: 15e6 },
      { id: 'req-ops', kind: 'min-operations', limit: 365 },
      { id: 'req-science', kind: 'min-science', limit: 8 },
    ],
  },
  sso: {
    spacecraft: {
      busId: 'bus-smallsat-150',
      propulsionId: 'prop-monoprop',
      propellantMassKg: 25,
      parts: [
        { itemId: 'solar-wing-4', quantity: 1 },
        { itemId: 'battery-1000wh', quantity: 1 },
        { itemId: 'comms-x-band-medium', quantity: 1 },
        { itemId: 'obc-standard', quantity: 1 },
        { itemId: 'adcs-3axis-fine', quantity: 1 },
        { itemId: 'inst-eo-multispectral', quantity: 1 },
      ],
    },
    vehicleId: 'launcher-small',
    plannedOperationsDays: 730,
    requirements: [
      { id: 'req-cost', kind: 'max-cost', limit: 40e6 },
      { id: 'req-ops', kind: 'min-operations', limit: 730 },
      { id: 'req-science', kind: 'min-science', limit: 40 },
    ],
  },
  geo: {
    spacecraft: {
      busId: 'bus-geo-3000',
      propulsionId: 'prop-biprop-large',
      propellantMassKg: 2200,
      parts: [
        { itemId: 'solar-wing-40', quantity: 1 },
        { itemId: 'battery-5000wh', quantity: 2 },
        { itemId: 'comms-x-band-medium', quantity: 1 },
        { itemId: 'obc-rad-hard', quantity: 1 },
        { itemId: 'adcs-3axis-fine', quantity: 1 },
        { itemId: 'inst-geo-transponder', quantity: 1 },
      ],
    },
    vehicleId: 'launcher-heavy',
    plannedOperationsDays: 3650,
    requirements: [
      { id: 'req-cost', kind: 'max-cost', limit: 400e6 },
      { id: 'req-ops', kind: 'min-operations', limit: 3650 },
      { id: 'req-science', kind: 'min-science', limit: 120 },
    ],
  },
  moon: {
    spacecraft: {
      busId: 'bus-midsat-600',
      propulsionId: 'prop-biprop-small',
      propellantMassKg: 180,
      parts: [
        { itemId: 'solar-wing-4', quantity: 1 },
        { itemId: 'battery-1000wh', quantity: 1 },
        { itemId: 'comms-x-band-medium', quantity: 1 },
        { itemId: 'obc-standard', quantity: 1 },
        { itemId: 'adcs-3axis-fine', quantity: 1 },
        { itemId: 'inst-moon-camera', quantity: 1 },
        { itemId: 'inst-moon-neutron', quantity: 1 },
      ],
    },
    vehicleId: 'launcher-medium',
    plannedOperationsDays: 365,
    requirements: [
      { id: 'req-cost', kind: 'max-cost', limit: 200e6 },
      { id: 'req-ops', kind: 'min-operations', limit: 365 },
      { id: 'req-science', kind: 'min-science', limit: 80 },
    ],
  },
  mars: {
    spacecraft: {
      busId: 'bus-deepspace-1500',
      propulsionId: 'prop-biprop-large',
      propellantMassKg: 1300,
      parts: [
        { itemId: 'solar-wing-16', quantity: 1 },
        { itemId: 'battery-5000wh', quantity: 1 },
        { itemId: 'comms-x-band-hga', quantity: 1 },
        { itemId: 'obc-rad-hard', quantity: 1 },
        { itemId: 'adcs-precision', quantity: 1 },
        { itemId: 'inst-mars-camera', quantity: 1 },
        { itemId: 'inst-mars-spectrometer', quantity: 1 },
      ],
    },
    vehicleId: 'launcher-heavy',
    plannedOperationsDays: 687,
    requirements: [
      { id: 'req-cost', kind: 'max-cost', limit: 500e6 },
      { id: 'req-ops', kind: 'min-operations', limit: 687 },
      { id: 'req-science', kind: 'min-science', limit: 120 },
    ],
  },
};

export type DefaultMissionOptions = {
  /** Supplied by the caller so this module stays pure and deterministic. */
  id: string;
  /** ISO timestamp used for both `createdAt` and `updatedAt`. */
  now: string;
  title: string;
  seed?: number;
  ownerId?: string | null;
};

export function createDefaultMission(destinationId: DestinationId, options: DefaultMissionOptions): Mission {
  const destination = getDestination(destinationId);
  if (!destination) throw new Error(`catalog has no destination "${destinationId}"`);
  const template = TEMPLATES[destinationId];

  return missionSchema.parse({
    schemaVersion: MISSION_SCHEMA_VERSION,
    id: options.id,
    revision: 0,
    ownerId: options.ownerId ?? null,
    title: options.title,
    status: 'draft',
    createdAt: options.now,
    updatedAt: options.now,
    seed: options.seed ?? 1,
    objective: { destinationId, requirements: structuredClone(template.requirements) },
    spacecraft: structuredClone(template.spacecraft),
    launch: { vehicleId: template.vehicleId },
    orbit: { ...destination.defaultOrbit },
    plannedOperationsDays: template.plannedOperationsDays,
  });
}
