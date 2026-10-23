/**
 * Ready-made experiments shown in the gallery. They need no database: each
 * one is just a link into the simulator (a preset or a catalog entry), so the
 * gallery always has something to open.
 */
export type ThumbKind = 'orbit' | 'binary' | 'impact' | 'blackhole' | 'exo' | 'comet' | 'star';

export type FeaturedExperiment = {
  id: string;
  kind: ThumbKind;
  href: string;
  /** Catalog id whose name is used as the title; otherwise `gallery.items.<id>.title`. */
  catalogId?: string;
  tags: readonly ('stars' | 'planets' | 'impacts' | 'blackholes' | 'basics')[];
};

export const FEATURED_EXPERIMENTS: readonly FeaturedExperiment[] = [
  { id: 'stable-system', kind: 'orbit', href: '/sandbox?preset=stable-system', tags: ['basics', 'planets'] },
  { id: 'two-body', kind: 'binary', href: '/sandbox?preset=two-body', tags: ['basics'] },
  { id: 'star-replacement', kind: 'star', href: '/sandbox?preset=star-replacement', tags: ['stars', 'planets'] },
  { id: 'asteroid-impact', kind: 'impact', href: '/sandbox?preset=asteroid-impact', tags: ['impacts', 'basics'] },
  { id: 'black-hole', kind: 'blackhole', href: '/sandbox?preset=black-hole', tags: ['blackholes', 'basics'] },
  { id: 'chelyabinsk-2013', kind: 'impact', href: '/sandbox?catalog=chelyabinsk-2013', catalogId: 'chelyabinsk-2013', tags: ['impacts'] },
  { id: 'tunguska-1908', kind: 'impact', href: '/sandbox?catalog=tunguska-1908', catalogId: 'tunguska-1908', tags: ['impacts'] },
  { id: 'chicxulub', kind: 'impact', href: '/sandbox?catalog=chicxulub', catalogId: 'chicxulub', tags: ['impacts'] },
  { id: 'apophis', kind: 'comet', href: '/sandbox?catalog=apophis', catalogId: 'apophis', tags: ['impacts'] },
  { id: 'halley', kind: 'comet', href: '/sandbox?catalog=halley', catalogId: 'halley', tags: ['planets'] },
  { id: 'sirius-a', kind: 'star', href: '/sandbox?catalog=sirius-a', catalogId: 'sirius-a', tags: ['stars'] },
  { id: 'betelgeuse', kind: 'star', href: '/sandbox?catalog=betelgeuse', catalogId: 'betelgeuse', tags: ['stars'] },
  { id: 'proxima-centauri', kind: 'star', href: '/sandbox?catalog=proxima-centauri', catalogId: 'proxima-centauri', tags: ['stars'] },
  { id: 'cygnus-x-1', kind: 'blackhole', href: '/sandbox?catalog=cygnus-x-1', catalogId: 'cygnus-x-1', tags: ['blackholes'] },
  { id: 'sagittarius-a-star', kind: 'blackhole', href: '/sandbox?catalog=sagittarius-a-star', catalogId: 'sagittarius-a-star', tags: ['blackholes'] },
  { id: 'm87-star', kind: 'blackhole', href: '/sandbox?catalog=m87-star', catalogId: 'm87-star', tags: ['blackholes'] },
  { id: 'proxima-b', kind: 'exo', href: '/sandbox?catalog=proxima-b', catalogId: 'proxima-b', tags: ['planets'] },
  { id: '51-pegasi-b', kind: 'exo', href: '/sandbox?catalog=51-pegasi-b', catalogId: '51-pegasi-b', tags: ['planets'] },
  { id: 'trappist-1e', kind: 'exo', href: '/sandbox?catalog=trappist-1e', catalogId: 'trappist-1e', tags: ['planets'] },
  { id: '55-cancri-e', kind: 'exo', href: '/sandbox?catalog=55-cancri-e', catalogId: '55-cancri-e', tags: ['planets'] },
];

export const FEATURED_FILTERS = ['all', 'basics', 'stars', 'planets', 'impacts', 'blackholes'] as const;
export type FeaturedFilter = (typeof FEATURED_FILTERS)[number];
