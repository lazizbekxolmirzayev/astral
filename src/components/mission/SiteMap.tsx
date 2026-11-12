'use client';

import { useTranslations } from 'next-intl';
import type { SiteRow } from '@/mission/launchView';
import { useText } from './primitives';

const W = 360;
const H = 180;
const x = (longitude: number) => ((longitude + 180) / 360) * W;
const y = (latitude: number) => ((90 - latitude) / 180) * H;

/**
 * Where the sites are: an equirectangular grid (every 30°) with the sites at their true
 * coordinates. It has no coastlines on purpose: it shows positions, not geography.
 * The selected site is filled; a site that cannot host the chosen vehicle is hollow.
 */
export function SiteMap({ rows, onSelect, disabled }: { rows: SiteRow[]; onSelect: (siteId: string) => void; disabled: boolean }) {
  const t = useTranslations('mission.launch');
  const { text } = useText();
  const meridians = Array.from({ length: 11 }, (_, index) => -150 + index * 30);
  const parallels = Array.from({ length: 5 }, (_, index) => -60 + index * 30);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('mapLabel')} className="w-full rounded-xl border border-panel-border bg-[#070a10]" data-site-map>
      {meridians.map((longitude) => <line key={`m${longitude}`} x1={x(longitude)} x2={x(longitude)} y1={0} y2={H} stroke="#1f2937" strokeWidth={0.5} />)}
      {parallels.map((latitude) => <line key={`p${latitude}`} x1={0} x2={W} y1={y(latitude)} y2={y(latitude)} stroke={latitude === 0 ? '#334155' : '#1f2937'} strokeWidth={latitude === 0 ? 1 : 0.5} />)}
      {rows.map((row) => {
        const cx = x(row.longitudeDeg);
        const cy = y(row.latitudeDeg);
        const labelRight = cx < W * 0.7;
        return (
          <g key={row.site.id} data-map-site={row.site.id} data-selected={row.selected}>
            <circle cx={cx} cy={cy} r={row.selected ? 6 : 4.5} fill={row.selected ? '#00f0ff' : row.hostsLauncher ? '#34d399' : 'none'} stroke={row.selected ? '#00f0ff' : row.hostsLauncher ? '#34d399' : '#fb923c'} strokeWidth={1.5} />
            <text x={labelRight ? cx + 9 : cx - 9} y={cy + 3} textAnchor={labelRight ? 'start' : 'end'} fontSize={8} fill="#cbd5e1">{text(row.site.name)}</text>
            <circle
              cx={cx}
              cy={cy}
              r={12}
              fill="transparent"
              tabIndex={disabled ? -1 : 0}
              role="button"
              aria-label={text(row.site.name)}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
              onClick={() => { if (!disabled) onSelect(row.site.id); }}
              onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(row.site.id); } }}
            />
          </g>
        );
      })}
    </svg>
  );
}
