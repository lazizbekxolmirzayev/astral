import type { CelestialObject } from '@/types/celestial';

const AU_IN_METERS = 149_597_870_700;

function usdString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
}

function primName(value: string): string {
  const safe = value.replace(/[^\p{L}\p{N}_]/gu, '_');
  return /^\p{L}/u.test(safe) ? safe : `Body_${safe}`;
}

function meters(quantity: CelestialObject['radius']): number | undefined {
  if (!quantity || !Number.isFinite(quantity.value) || quantity.value <= 0) return undefined;
  switch (quantity.unit.toLowerCase()) {
    case 'm': return quantity.value;
    case 'km': return quantity.value * 1000;
    case 'au': return quantity.value * AU_IN_METERS;
    default: return undefined;
  }
}

/** Export catalog bodies as real-scale USDA spheres, preserving provenance metadata. */
export function serializeScenarioAsUsd(name: string, objects: readonly CelestialObject[]): string {
  const lines = [
    '#usda 1.0',
    '(',
    '    defaultPrim = "Scenario"',
    '    metersPerUnit = 1',
    '    upAxis = "Y"',
    ')',
    '',
    'def Xform "Scenario"',
    '{',
    `    custom string scenarioName = ${usdString(name)}`,
    '    custom string exportSource = "NEXUS OpenUSD exporter"',
  ];

  const usedNames = new Set<string>();
  for (const object of objects) {
    const base = primName(object.id || object.name);
    let safeName = base;
    let suffix = 2;
    while (usedNames.has(safeName)) safeName = `${base}_${suffix++}`;
    usedNames.add(safeName);

    const radiusMeters = meters(object.radius);
    const distanceAu = object.semiMajorAxis?.unit.toLowerCase() === 'au' && Number.isFinite(object.semiMajorAxis.value)
      ? object.semiMajorAxis.value
      : 0;
    const provenanceLine = object.radius ? `        custom string radiusProvenance = ${usdString(object.radius.provenance)}` : null;
    lines.push(
      '',
      `    def Xform "${safeName}"`,
      '    {',
      `        custom string displayName = ${usdString(object.name)}`,
      `        custom string objectType = ${usdString(object.type)}`,
      `        custom string parentId = ${usdString(object.parentId ?? '')}`,
      `        double3 xformOp:translate = (${distanceAu * AU_IN_METERS}, 0, 0)`,
      '        uniform token[] xformOpOrder = ["xformOp:translate"]',
      ...(provenanceLine ? [provenanceLine] : []),
    );
    if (radiusMeters !== undefined) {
      lines.push('', '        def Sphere "Geometry"', '        {', `            double radius = ${radiusMeters}`, '        }');
    }
    lines.push('    }');
  }
  lines.push('}', '');
  return lines.join('\n');
}
