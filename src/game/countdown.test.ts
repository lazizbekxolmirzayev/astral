import { describe, expect, it } from 'vitest';
import { ascentPose, countdownSeconds, padThrottle, skyAmount } from '@/components/game/launchPath';

describe('launch path', () => {
  it('starts on the pad and climbs monotonically', () => {
    expect(ascentPose(0)).toMatchObject({ x: 0, y: 0, distance: 0 });
    let previous = -1;
    for (let tau = 0; tau <= 1.0001; tau += 0.05) {
      const pose = ascentPose(tau);
      expect(pose.distance).toBeGreaterThanOrEqual(previous);
      previous = pose.distance;
    }
    expect(ascentPose(1).pitch).toBeGreaterThan(1);
    expect(ascentPose(-1).distance).toBe(0);
    expect(ascentPose(5).distance).toBe(ascentPose(1).distance);
  });
  it('counts down to zero and spools the engines only at the end', () => {
    expect(countdownSeconds(0)).toBe(10);
    expect(countdownSeconds(0.55)).toBe(5);
    expect(countdownSeconds(1)).toBe(0);
    expect(padThrottle(0.5)).toBe(0);
    expect(padThrottle(1)).toBeCloseTo(0.65, 9);
  });
  it('fades the sky to black on the way to space', () => {
    expect(skyAmount(0)).toBe(1);
    expect(skyAmount(1)).toBe(0);
  });
});
