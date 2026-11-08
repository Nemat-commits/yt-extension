import type { AppRoute } from '@src/data/models';
import { VIDEO_ID_RE } from '@src/data/models';

export interface RouteLocation {
  pathname: string;
  search: string;
}

export function classifyRoute(location: RouteLocation): AppRoute {
  const path = location.pathname || '/';
  const params = new URLSearchParams(location.search);

  if (path === '/') return { kind: 'home', path };
  if (path === '/feed/subscriptions') return { kind: 'subscriptions', path };
  if (path === '/feed/you' || path === '/feed/library') return { kind: 'library', path };

  if (path === '/watch') {
    const videoId = params.get('v') ?? undefined;
    return videoId && VIDEO_ID_RE.test(videoId)
      ? { kind: 'watch', path, videoId }
      : { kind: 'other', path };
  }

  if (path === '/results') {
    return { kind: 'search', path, query: params.get('search_query') ?? '' };
  }

  if (path.startsWith('/shorts/')) {
    const videoId = path.split('/')[2];
    return videoId && VIDEO_ID_RE.test(videoId)
      ? { kind: 'shorts', path, videoId }
      : { kind: 'other', path };
  }

  if (path.startsWith('/@') || path.startsWith('/channel/') || path.startsWith('/c/')) {
    return { kind: 'channel', path, channel: path.split('/')[1] };
  }

  if (path === '/playlist') return { kind: 'playlist', path };
  return { kind: 'other', path };
}

export function isSameOriginYouTubeUrl(input: string, base = 'https://www.youtube.com/'): URL | null {
  try {
    const url = new URL(input, base);
    if (url.origin !== 'https://www.youtube.com' || !url.pathname.startsWith('/')) return null;
    return url;
  } catch {
    return null;
  }
}

export interface Router {
  current(): AppRoute;
  subscribe(listener: (route: AppRoute) => void): () => void;
  navigate(url: string): boolean;
  dispose(): void;
}

/**
 * Tracks YouTube's Polymer SPA lifecycle and forwards custom UI navigation
 * through a light-DOM endpoint so YouTube can preserve its native Miniplayer.
 */
export function createRouter(): Router {
  let route = classifyRoute(window.location);
  const listeners = new Set<(next: AppRoute) => void>();
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

  const emit = () => {
    const next = classifyRoute(window.location);
    if (next.kind === route.kind && next.path === route.path && next.videoId === route.videoId && next.query === route.query) {
      return;
    }
    route = next;
    listeners.forEach((listener) => listener(next));
  };

  const scheduleEmit = () => {
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = setTimeout(emit, 0);
  };

  document.addEventListener('yt-navigate-finish', scheduleEmit, true);
  document.addEventListener('yt-page-data-updated', scheduleEmit, true);
  window.addEventListener('popstate', scheduleEmit);

  return {
    current: () => route,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigate(input) {
      const url = isSameOriginYouTubeUrl(input);
      if (!url) return false;

      const app = document.querySelector('ytd-app');
      if (!app) {
        window.location.assign(url.href);
        return true;
      }

      let bridge = app.querySelector<HTMLAnchorElement>('#rf-spa-bridge');
      if (!bridge) {
        bridge = document.createElement('a');
        bridge.id = 'rf-spa-bridge';
        bridge.className = 'yt-simple-endpoint';
        bridge.setAttribute('aria-hidden', 'true');
        bridge.tabIndex = -1;
        bridge.style.cssText = 'position:fixed;inset-inline-start:-10000px;top:-10000px;width:1px;height:1px;opacity:0;pointer-events:none;';
        app.append(bridge);
      }
      bridge.href = url.href;
      bridge.click();
      return true;
    },
    dispose() {
      if (finishTimer) clearTimeout(finishTimer);
      document.removeEventListener('yt-navigate-finish', scheduleEmit, true);
      document.removeEventListener('yt-page-data-updated', scheduleEmit, true);
      window.removeEventListener('popstate', scheduleEmit);
      listeners.clear();
      document.querySelector('#rf-spa-bridge')?.remove();
    },
  };
}
