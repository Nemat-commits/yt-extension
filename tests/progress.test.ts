import { describe, expect, it } from 'vitest';
import { clampProgress, decideProgressSample } from '../src/data/progress';

const eligible = {
  enabled: true,
  trackingEnabled: true,
  routeVideoId: 'abcdefghijk',
  lockedVideoId: 'abcdefghijk',
  navigating: false,
  inAd: false,
  isLive: false,
  duration: 600,
  currentTime: 60,
};

describe('ad-aware progress gate', () => {
  it('saves only eligible mid-video samples and clears near completion', () => {
    expect(decideProgressSample(eligible)).toBe('save');
    expect(decideProgressSample({ ...eligible, currentTime: 570 })).toBe('complete');
    expect(decideProgressSample({ ...eligible, currentTime: 20 })).toBe('ignore');
  });

  it('ignores ads, SPA transition events, ID mismatches, live streams and short videos', () => {
    expect(decideProgressSample({ ...eligible, inAd: true })).toBe('ignore');
    expect(decideProgressSample({ ...eligible, navigating: true })).toBe('ignore');
    expect(decideProgressSample({ ...eligible, lockedVideoId: 'lmnopqrstuv' })).toBe('ignore');
    expect(decideProgressSample({ ...eligible, isLive: true })).toBe('ignore');
    expect(decideProgressSample({ ...eligible, duration: 90 })).toBe('ignore');
    expect(decideProgressSample({ ...eligible, enabled: false })).toBe('ignore');
  });

  it('clamps unsafe playback values', () => {
    expect(clampProgress(800, 600)).toEqual({ currentTime: 600, duration: 600, percent: 100 });
    expect(clampProgress(Number.NaN, Number.NaN)).toEqual({ currentTime: 0, duration: 0, percent: 0 });
  });
});
