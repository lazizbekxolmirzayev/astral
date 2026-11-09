import { DEFAULT_CATALOG, type CatalogLookup } from './catalog';
import type { Mission } from './models/mission';
import { toBase } from './units';

/**
 * A schematic 3D layout of the spacecraft design, as plain data (no Three.js).
 *
 * It is a picture of the design the player chose, not a structural model:
 * - the bus edge grows with the cube root of its mass (display scaling only);
 * - solar panels have exactly the catalog area, in metres;
 * - tank size follows the cube root of the propellant capacity and its fill level
 *   follows the propellant actually loaded;
 * - antennas, batteries, computers and instruments are drawn at a size that grows
 *   with antenna gain or the cube root of mass.
 * Nothing here feeds the resource engine. The scene only renders these shapes.
 */

export type ShapeRole = 'bus' | 'tank' | 'nozzle' | 'panel' | 'dish' | 'mast' | 'battery' | 'computer' | 'attitude' | 'instrument';

export type PartShape = {
  key: string;
  /** Catalog id of the part this shape belongs to (bus, propulsion or a part line). */
  itemId: string;
  role: ShapeRole;
  geometry: 'box' | 'cylinder';
  /** Box: width, height, depth. Cylinder: radius, height, radius. Metres. */
  size: [number, number, number];
  position: [number, number, number];
  /** Fraction of the tank that is filled (tank only). */
  fill?: number;
};

export type SpacecraftLayout = { shapes: PartShape[]; /** Distance from the centre to the farthest corner, metres. */ extent: number };

type Vec3 = [number, number, number];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const cube = (kilograms: number) => Math.cbrt(Math.max(kilograms, 0));

export function layoutSpacecraft(mission: Mission, catalog: CatalogLookup = DEFAULT_CATALOG): SpacecraftLayout {
  const shapes: PartShape[] = [];
  const bus = catalog.getPart(mission.spacecraft.busId);
  if (bus?.category !== 'bus') return { shapes, extent: 1 };

  const edge = clamp(0.2 * cube(toBase(bus.mass)), 0.35, 3);
  shapes.push({ key: `${bus.id}#0`, itemId: bus.id, role: 'bus', geometry: 'box', size: [edge, edge, edge], position: [0, 0, 0] });

  // Inside the bus: tank, batteries, computers, attitude control, placed on a simple grid.
  let slot = 0;
  const inner = (size: number): Vec3 => {
    const columns = 3;
    const column = slot % columns;
    const row = Math.floor(slot / columns);
    slot += 1;
    const pitch = (edge * 0.7) / columns;
    return [(-edge * 0.35 + (column + 0.5) * pitch) * 1.0, -edge * 0.3 + row * (size + 0.02) , -edge * 0.2];
  };

  const propulsion = mission.spacecraft.propulsionId ? catalog.getPart(mission.spacecraft.propulsionId) : undefined;
  if (propulsion?.category === 'propulsion') {
    const capacity = toBase(propulsion.propellantCapacity);
    const radius = clamp(0.05 * cube(capacity) + 0.04, 0.05, edge * 0.4);
    const height = edge * 0.6;
    shapes.push({ key: `${propulsion.id}#tank`, itemId: propulsion.id, role: 'tank', geometry: 'cylinder', size: [radius, height, radius], position: [0, 0, 0], fill: capacity > 0 ? clamp(mission.spacecraft.propellantMassKg / capacity, 0, 1) : 0 });
    shapes.push({ key: `${propulsion.id}#nozzle`, itemId: propulsion.id, role: 'nozzle', geometry: 'cylinder', size: [radius * 0.6, edge * 0.25, radius * 0.6], position: [0, -edge / 2 - edge * 0.12, 0] });
  }

  let panelsLeft = 0;
  let panelsRight = 0;
  let bodyPanels = 0;
  let instrumentsPlaced = 0;
  let dishes = 0;

  for (const { itemId, quantity } of mission.spacecraft.parts) {
    const part = catalog.getPart(itemId);
    if (!part) continue;
    for (let index = 0; index < quantity; index += 1) {
      const key = `${itemId}#${index}`;
      switch (part.category) {
        case 'solar-array': {
          const area = toBase(part.area);
          if (part.mounting === 'body-mounted') {
            const side = Math.sqrt(area);
            shapes.push({ key, itemId, role: 'panel', geometry: 'box', size: [side, 0.02, side], position: [0, edge / 2 + 0.011, -edge / 2 + side / 2 + bodyPanels * (side + 0.02)] });
            bodyPanels += 1;
          } else {
            const width = Math.sqrt(2 * area);
            const height = area / width;
            const right = (panelsLeft + panelsRight) % 2 === 0;
            const rank = right ? panelsRight : panelsLeft;
            const x = (edge / 2 + 0.12 + width / 2 + rank * (width + 0.1)) * (right ? 1 : -1);
            shapes.push({ key, itemId, role: 'panel', geometry: 'box', size: [width, 0.04, height], position: [x, 0, 0] });
            if (right) panelsRight += 1;
            else panelsLeft += 1;
          }
          break;
        }
        case 'battery': {
          const size = 0.1 * cube(toBase(part.mass));
          shapes.push({ key, itemId, role: 'battery', geometry: 'box', size: [size, size * 0.6, size], position: inner(size) });
          break;
        }
        case 'obc': {
          const size = 0.1 * cube(toBase(part.mass)) + 0.04;
          shapes.push({ key, itemId, role: 'computer', geometry: 'box', size: [size, size * 0.4, size], position: inner(size) });
          break;
        }
        case 'adcs': {
          const size = 0.1 * cube(toBase(part.mass)) + 0.04;
          shapes.push({ key, itemId, role: 'attitude', geometry: 'cylinder', size: [size / 2, size * 0.5, size / 2], position: inner(size) });
          break;
        }
        case 'comms': {
          const radius = clamp(0.1 + 0.012 * toBase(part.antennaGain), 0.08, edge * 1.2);
          const mastHeight = edge * 0.5 + radius * 0.4 + dishes * 0.3;
          shapes.push({ key: `${key}-mast`, itemId, role: 'mast', geometry: 'cylinder', size: [0.02, mastHeight, 0.02], position: [edge * 0.3, 0, -edge / 2 - mastHeight / 2] });
          shapes.push({ key, itemId, role: 'dish', geometry: 'cylinder', size: [radius, 0.03, radius], position: [edge * 0.3, 0, -edge / 2 - mastHeight - 0.015] });
          dishes += 1;
          break;
        }
        case 'instrument': {
          const size = clamp(0.12 * cube(toBase(part.mass)), 0.08, edge * 0.5);
          const column = instrumentsPlaced % 3;
          const row = Math.floor(instrumentsPlaced / 3);
          shapes.push({ key, itemId, role: 'instrument', geometry: 'box', size: [size, size, size], position: [-edge * 0.3 + column * (edge * 0.3), -edge * 0.25 + row * (size + 0.04), edge / 2 + size / 2] });
          instrumentsPlaced += 1;
          break;
        }
        default:
          break;
      }
    }
  }

  let extent = 0.5;
  for (const shape of shapes) {
    const [sx, sy, sz] = shape.size;
    const halfX = shape.geometry === 'box' ? sx / 2 : sx;
    const halfZ = shape.geometry === 'box' ? sz / 2 : sx;
    const corner = Math.hypot(Math.abs(shape.position[0]) + halfX, Math.abs(shape.position[1]) + sy / 2, Math.abs(shape.position[2]) + halfZ);
    extent = Math.max(extent, corner);
  }
  return { shapes, extent };
}
