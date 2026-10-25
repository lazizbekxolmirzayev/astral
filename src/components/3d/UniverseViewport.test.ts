import { describe, expect, it } from 'vitest';
import { getViewportControlPanelClassName } from './UniverseViewport';

describe('getViewportControlPanelClassName', () => {
  it('keeps the galaxy controls interactive', () => {
    expect(getViewportControlPanelClassName()).toContain('pointer-events-auto');
    expect(getViewportControlPanelClassName()).toContain('absolute');
  });
});
