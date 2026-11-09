export const SELECTORS = {
  app: ['ytd-app'],
  pageManager: ['ytd-page-manager#page-manager', '#page-manager'],
  subscriptionsBrowse: ['ytd-browse[page-subtype="subscriptions"]'],
  subscriptionCards: ['ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer'],
  videoLinks: ['a#video-title-link[href*="/watch?v="]', 'a#thumbnail[href*="/watch?v="]', 'a[href*="/watch?v="]'],
  watchTitle: ['ytd-watch-metadata h1 yt-formatted-string', 'h1.ytd-watch-metadata', 'h1.title'],
  channelTitle: ['ytd-channel-name a', '#channel-name a'],
} as const;

export function firstMatch<T extends Element>(root: ParentNode, selectors: readonly string[]): T | null {
  for (const selector of selectors) {
    const match = root.querySelector<T>(selector);
    if (match) return match;
  }
  return null;
}
