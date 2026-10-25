import { describe, expect, it } from 'vitest';
import { getPulsarPlaybackAction } from './PulsarExperience';

describe('getPulsarPlaybackAction', () => {
  it('starts audio from a direct user toggle', () => {
    expect(getPulsarPlaybackAction({ playing: false, kind: 'audio', videoOpen: false })).toEqual({
      action: 'play-audio',
      openVideo: false,
    });
  });

  it('pauses when already playing', () => {
    expect(getPulsarPlaybackAction({ playing: true, kind: 'audio', videoOpen: false })).toEqual({
      action: 'pause',
      openVideo: false,
    });
  });
});
