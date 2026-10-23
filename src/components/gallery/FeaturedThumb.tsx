import type { ThumbKind } from '@/data/featured';

/** Small deterministic pseudo-random so thumbnails are stable across renders. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Schematic illustration of an experiment. Decorative only — not to scale,
 * and not a render of the real object.
 */
export function FeaturedThumb({ kind, seed }: { kind: ThumbKind; seed: string }) {
  const rand = rng(hash(seed));
  const stars = Array.from({ length: 36 }, () => ({ x: rand() * 320, y: rand() * 160, r: rand() * 0.9 + 0.3, o: rand() * 0.6 + 0.2 }));
  const id = `g-${kind}-${hash(seed)}`;
  return (
    <svg viewBox="0 0 320 160" className="h-full w-full" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${id}-core`}>
          <stop offset="0%" stopColor="#fff6d6" />
          <stop offset="45%" stopColor="#f5b041" />
          <stop offset="100%" stopColor="#f5b041" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-cyan`}>
          <stop offset="0%" stopColor="#bff9ff" />
          <stop offset="50%" stopColor="#00f0ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-bg`} cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#151b2c" />
          <stop offset="100%" stopColor="#070a10" />
        </radialGradient>
        <linearGradient id={`${id}-disk`} x1="0" x2="1">
          <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="160" fill={`url(#${id}-bg)`} />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}

      {kind === 'orbit' && (
        <g>
          {[22, 38, 56, 78, 104].map((r, i) => <ellipse key={r} cx="160" cy="80" rx={r * 1.5} ry={r * 0.62} fill="none" stroke="#00f0ff" strokeOpacity={0.35 - i * 0.04} />)}
          <circle cx="160" cy="80" r="26" fill={`url(#${id}-core)`} />
          <circle cx="205" cy="62" r="3.2" fill="#7fd1ff" />
          <circle cx="104" cy="104" r="4" fill="#d9a066" />
          <circle cx="267" cy="92" r="5" fill="#e8c27a" />
        </g>
      )}
      {kind === 'binary' && (
        <g>
          <ellipse cx="160" cy="80" rx="95" ry="38" fill="none" stroke="#00f0ff" strokeOpacity="0.35" strokeDasharray="3 4" />
          <circle cx="112" cy="68" r="22" fill={`url(#${id}-core)`} />
          <circle cx="218" cy="94" r="12" fill={`url(#${id}-cyan)`} />
          <circle cx="218" cy="94" r="4.5" fill="#bff9ff" />
        </g>
      )}
      {kind === 'star' && (
        <g>
          <circle cx="110" cy="80" r="46" fill={`url(#${id}-core)`} opacity="0.9" />
          <circle cx="110" cy="80" r="14" fill="#fff6d6" />
          <ellipse cx="110" cy="80" rx="98" ry="40" fill="none" stroke="#00f0ff" strokeOpacity="0.3" />
          <circle cx="206" cy="66" r="4.5" fill="#7fd1ff" />
          <circle cx="262" cy="96" r="6" fill="#d9a066" />
        </g>
      )}
      {kind === 'impact' && (
        <g>
          <circle cx="226" cy="96" r="44" fill="#1f4a73" />
          <circle cx="226" cy="96" r="44" fill="none" stroke="#00f0ff" strokeOpacity="0.4" strokeWidth="2" />
          <path d="M20 14 Q120 40 214 90" fill="none" stroke="#ffb347" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
          <path d="M20 14 Q120 40 214 90" fill="none" stroke="#fff6d6" strokeWidth="1" strokeLinecap="round" />
          <circle cx="220" cy="92" r="16" fill={`url(#${id}-core)`} />
          <circle cx="220" cy="92" r="30" fill="none" stroke="#ff7a45" strokeOpacity="0.5" />
        </g>
      )}
      {kind === 'blackhole' && (
        <g>
          <ellipse cx="160" cy="80" rx="108" ry="22" fill={`url(#${id}-disk)`} opacity="0.9" />
          <circle cx="160" cy="80" r="26" fill="#000" stroke="#ffb347" strokeOpacity="0.5" strokeWidth="1.5" />
          <ellipse cx="160" cy="80" rx="108" ry="22" fill="none" stroke="#ffb347" strokeOpacity="0.25" />
          <path d="M60 130 C 110 110, 140 120, 160 100" fill="none" stroke="#00f0ff" strokeOpacity="0.5" strokeDasharray="2 3" />
          <circle cx="60" cy="130" r="3" fill="#7fd1ff" />
        </g>
      )}
      {kind === 'exo' && (
        <g>
          <circle cx="66" cy="80" r="34" fill={`url(#${id}-core)`} />
          <circle cx="66" cy="80" r="9" fill="#ffe4c4" />
          <ellipse cx="66" cy="80" rx="120" ry="30" fill="none" stroke="#00f0ff" strokeOpacity="0.35" />
          <circle cx="186" cy="80" r="14" fill="#2f6ea6" />
          <circle cx="186" cy="80" r="14" fill="none" stroke="#00f0ff" strokeOpacity="0.6" />
          <circle cx="181" cy="76" r="5" fill="#ffffff" opacity="0.18" />
        </g>
      )}
      {kind === 'comet' && (
        <g>
          <ellipse cx="190" cy="80" rx="160" ry="48" fill="none" stroke="#00f0ff" strokeOpacity="0.3" transform="rotate(-14 190 80)" />
          <circle cx="62" cy="88" r="14" fill={`url(#${id}-core)`} />
          <path d="M214 70 L300 40 L300 62 Z" fill="#7fd1ff" opacity="0.28" />
          <circle cx="214" cy="70" r="5" fill="#eaf8ff" />
        </g>
      )}
    </svg>
  );
}
