import { SELECTORS, firstMatch } from '@src/adapters/selector-registry';
import type { AppRoute, DeviceConfig, VideoMeta } from './models';
import { clampProgress, decideProgressSample } from './progress';
import { makeVideoMeta } from './validation';
import { removeResumeState, saveResumeState } from './storage';

export class ProgressTracker {
  private route: AppRoute = { kind: 'other', path: '/' };
  private config: DeviceConfig | null = null;
  private video: HTMLVideoElement | null = null;
  private observer: MutationObserver | null = null;
  private lockedVideoId: string | null = null;
  private navigating = false;
  private lastWriteAt = 0;

  private readonly onTimeUpdate = () => this.sample(false);
  private readonly onPause = () => this.sample(true);
  private readonly onEnded = () => this.sample(true);
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') this.sample(true);
  };

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  update(route: AppRoute, config: DeviceConfig): void {
    const changedVideo = route.videoId !== this.route.videoId || route.kind !== this.route.kind;
    this.route = route;
    this.config = config;
    if (changedVideo || route.kind !== 'watch') {
      this.detachVideo();
      this.lastWriteAt = 0;
    }
    if (route.kind !== 'watch' || !this.isEnabled()) {
      this.lockedVideoId = null;
      this.detachVideo();
      return;
    }

    this.navigating = false;
    this.lockedVideoId = route.videoId ?? null;
    if (this.video && this.video.isConnected) return;
    this.tryAttach();
  }

  navigationStarted(): void {
    this.navigating = true;
    this.lockedVideoId = null;
    this.detachVideo();
  }

  dispose(): void {
    this.detachVideo();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.config = null;
  }

  private isEnabled(): boolean {
    return Boolean(
      this.config?.enabled &&
      this.config.consentVersion >= 1 &&
      this.config.privacy.trackProgress &&
      !this.config.killSwitches.progressTracker,
    );
  }

  private tryAttach(): void {
    if (!this.isEnabled() || this.route.kind !== 'watch' || !this.lockedVideoId) return;
    const candidate = document.querySelector<HTMLVideoElement>('#movie_player video.video-stream, #movie_player video.html5-main-video');
    if (candidate) {
      this.video = candidate;
      candidate.addEventListener('timeupdate', this.onTimeUpdate);
      candidate.addEventListener('pause', this.onPause);
      candidate.addEventListener('ended', this.onEnded);
      this.observer?.disconnect();
      this.observer = null;
      return;
    }

    if (!this.observer && document.documentElement) {
      this.observer = new MutationObserver(() => {
        if (document.querySelector('#movie_player video.video-stream, #movie_player video.html5-main-video')) this.tryAttach();
      });
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  private detachVideo(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.video) {
      this.video.removeEventListener('timeupdate', this.onTimeUpdate);
      this.video.removeEventListener('pause', this.onPause);
      this.video.removeEventListener('ended', this.onEnded);
    }
    this.video = null;
  }

  private sample(force: boolean): void {
    const video = this.video;
    const videoId = this.route.videoId ?? null;
    if (!video || !videoId) return;
    const player = document.getElementById('movie_player');
    const decision = decideProgressSample({
      enabled: this.config?.enabled === true && this.config.consentVersion >= 1,
      trackingEnabled: this.config?.privacy.trackProgress === true && this.config.killSwitches.progressTracker !== true,
      routeVideoId: videoId,
      lockedVideoId: this.lockedVideoId,
      navigating: this.navigating,
      inAd: Boolean(player?.classList.contains('ad-showing') || player?.classList.contains('ad-interrupting')),
      isLive: Boolean(player?.querySelector('.ytp-live') || player?.classList.contains('ytp-live')),
      duration: video.duration,
      currentTime: video.currentTime,
    });

    if (decision === 'complete') {
      void removeResumeState(videoId).catch(() => undefined);
      this.lastWriteAt = Date.now();
      return;
    }
    if (decision !== 'save' || (!force && Date.now() - this.lastWriteAt < 5_000)) return;

    const progress = clampProgress(video.currentTime, video.duration);
    const meta = this.readVideoMeta(videoId);
    this.lastWriteAt = Date.now();
    void saveResumeState({
      video: meta,
      ...progress,
      updatedAt: Date.now(),
    }).catch(() => undefined);
  }

  private readVideoMeta(videoId: string): VideoMeta {
    const titleElement = firstMatch<HTMLElement>(document, SELECTORS.watchTitle);
    const channelElement = firstMatch<HTMLElement>(document, SELECTORS.channelTitle);
    const title = titleElement?.textContent?.replace(/\s+-\s+YouTube\s*$/i, '').trim() ?? document.title.replace(/\s+-\s+YouTube\s*$/i, '').trim();
    const channel = channelElement?.textContent?.trim() ?? '';
    return makeVideoMeta(videoId, title, channel);
  }
}
