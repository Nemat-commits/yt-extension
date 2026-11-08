export interface ProgressDecisionInput {
  enabled: boolean;
  trackingEnabled: boolean;
  routeVideoId?: string | null;
  lockedVideoId?: string | null;
  navigating: boolean;
  inAd: boolean;
  isLive: boolean;
  duration: number;
  currentTime: number;
}

export type ProgressDecision = 'ignore' | 'save' | 'complete';

/** Pure state gate: ad time, stale SPA events, live streams, shorts, and unknown durations never persist. */
export function decideProgressSample(input: ProgressDecisionInput): ProgressDecision {
  if (!input.enabled || !input.trackingEnabled || input.navigating || input.inAd || input.isLive) return 'ignore';
  if (!input.routeVideoId || input.routeVideoId !== input.lockedVideoId) return 'ignore';
  if (!Number.isFinite(input.duration) || input.duration < 120 || !Number.isFinite(input.currentTime) || input.currentTime < 0) return 'ignore';

  const percent = (input.currentTime / input.duration) * 100;
  return percent >= 95 ? 'complete' : percent >= 5 ? 'save' : 'ignore';
}

export function clampProgress(currentTime: number, duration: number): { currentTime: number; duration: number; percent: number } {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const safeTime = Math.min(safeDuration, Math.max(0, Number.isFinite(currentTime) ? currentTime : 0));
  return {
    currentTime: safeTime,
    duration: safeDuration,
    percent: safeDuration > 0 ? (safeTime / safeDuration) * 100 : 0,
  };
}
