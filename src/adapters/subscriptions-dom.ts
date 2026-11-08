import { SELECTORS } from './selector-registry';
import type { VideoMeta } from '@src/data/models';
import { makeVideoMeta, parseVideoId, sanitizeText } from '@src/data/validation';

function firstText(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    const value = element?.getAttribute('title') || element?.textContent;
    if (value?.trim()) return sanitizeText(value, 240);
  }
  return '';
}

function thumbnailFor(card: Element, videoId: string): string {
  const image = card.querySelector<HTMLImageElement>('img');
  const candidates = [image?.currentSrc, image?.src, image?.getAttribute('src'), image?.getAttribute('data-thumb'), image?.getAttribute('data-src')];
  const candidate = candidates.find((value) => value?.startsWith('https://i.ytimg.com/'));
  return candidate ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function extractVideoFromCard(card: Element, capturedAt = Date.now()): VideoMeta | null {
  for (const selector of SELECTORS.videoLinks) {
    const anchor = card.querySelector<HTMLAnchorElement>(selector);
    const videoId = anchor?.getAttribute('href') ? parseVideoId(anchor.getAttribute('href')!) : null;
    if (!videoId) continue;

    const title = firstText(card, ['a#video-title-link', '#video-title', 'a#thumbnail[title]', 'h3']);
    const channelTitle = firstText(card, ['ytd-channel-name', '#channel-name', 'a.yt-simple-endpoint.style-scope.yt-formatted-string']);
    const durationText = firstText(card, ['ytd-thumbnail-overlay-time-status-renderer span', '#overlays ytd-thumbnail-overlay-time-status-renderer']);
    return {
      ...makeVideoMeta(videoId, title, channelTitle),
      thumbnailUrl: thumbnailFor(card, videoId),
      durationText: durationText || undefined,
      capturedAt,
    };
  }
  return null;
}

/** Reads only cards currently rendered in YouTube's visible DOM; it performs no network requests. */
export function extractVisibleSubscriptions(root: ParentNode): VideoMeta[] {
  const selector = SELECTORS.subscriptionCards.join(',');
  const cards = Array.from(root.querySelectorAll(selector));
  const seen = new Set<string>();
  const items: VideoMeta[] = [];
  for (const card of cards) {
    const video = extractVideoFromCard(card);
    if (!video || seen.has(video.id)) continue;
    seen.add(video.id);
    items.push(video);
    if (items.length >= 100) break;
  }
  return items;
}
