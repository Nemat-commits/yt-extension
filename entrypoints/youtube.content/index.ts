import './ui.css';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { writable } from 'svelte/store';
import App from './App.svelte';
import { SELECTORS, firstMatch } from '@src/adapters/selector-registry';
import { SubscriptionsSnapshotter } from '@src/adapters/subscriptions-snapshotter';
import { applyRuntimeAttributes, applySyncBootAttributes, syncBootMirror } from '@src/core/bootstrap';
import { createFeatureRegistry } from '@src/core/feature-registry';
import { createRouter, isSameOriginYouTubeUrl } from '@src/core/router';
import { loadExtensionState, saveDeviceConfig, savePreferences, createCollection, renameCollection, deleteCollection, addVideoToCollection, removeVideoFromCollection, reorderCollection as moveCollectionInStorage, importCollections } from '@src/data/storage';
import { ProgressTracker } from '@src/data/progress-tracker';
import { makeVideoMeta } from '@src/data/validation';
import { DEFAULT_DEVICE_CONFIG, DEFAULT_PREFERENCES, EMPTY_FEATURE_HEALTH, type AppRoute, type DeviceConfig, type ExtensionState } from '@src/data/models';
import type { ContentActions, ContentState } from '@src/ui/types';

type MountedApp = { $destroy(): void };
type ContentUi = { shadowHost: HTMLElement; mount(): void; remove(): void; mounted: MountedApp | undefined };

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  allFrames: false,
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // This is intentionally the first synchronous operation: the hint contains only UI booleans.
    applySyncBootAttributes();

    const router = createRouter();
    const tracker = new ProgressTracker();
    const snapshotter = new SubscriptionsSnapshotter();
    const registry = createFeatureRegistry();
    const firstRoute = router.current();

    let extensionState: ExtensionState;
    try {
      extensionState = await loadExtensionState();
    } catch {
      // Fail open to native YouTube if extension storage is unavailable during startup.
      extensionState = {
        deviceConfig: DEFAULT_DEVICE_CONFIG,
        preferences: DEFAULT_PREFERENCES,
        collections: [],
        resumeStates: [],
        feedSnapshots: [],
        featureHealth: EMPTY_FEATURE_HEALTH,
        storageBytes: null,
      };
    }
    let route: AppRoute = router.current();
    let config: DeviceConfig = extensionState.deviceConfig;
    syncBootMirror(config, extensionState.preferences);
    applyRuntimeAttributes(route, config, extensionState.preferences);
    let ui: ContentUi | undefined;
    let mountedKind = '';
    let uiBusy = false;
    let uiPending = false;
    let disposed = false;
    let homeRedirectPending = false;
    const contentState = writable<ContentState>({
      ...extensionState,
      route,
      currentVideo: readCurrentVideo(route),
    });

    const actions: ContentActions = {
      navigate(event, path) {
        const url = isSameOriginYouTubeUrl(path);
        if (!url || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        router.navigate(url.href);
      },
      async setEnabled(enabled) {
        await saveDeviceConfig({ enabled });
        await refreshState();
      },
      async enableProgress() {
        if (config.consentVersion < 1) { await browser.runtime.openOptionsPage(); return; }
        await saveDeviceConfig({ privacy: { trackProgress: true } });
        await refreshState();
      },
      async enableFeedCache() {
        if (config.consentVersion < 1) { await browser.runtime.openOptionsPage(); return; }
        await saveDeviceConfig({ privacy: { cacheFeeds: true } });
        await refreshState();
      },
      async toggleWatchPreference(key, value) {
        await savePreferences({ watch: { ...extensionState.preferences.watch, [key]: value } });
        await refreshState();
      },
      async setHideShorts(value) {
        await savePreferences({ global: { hideShortsSurfaces: value } });
        await refreshState();
      },
      async createCollection(name) {
        await createCollection(name);
        await refreshState();
      },
      async renameCollection(id, name) {
        await renameCollection(id, name);
        await refreshState();
      },
      async deleteCollection(id) {
        await deleteCollection(id);
        await refreshState();
      },
      async addVideoToCollection(collectionId, video) {
        await addVideoToCollection(collectionId, video);
        await refreshState();
      },
      async removeVideoFromCollection(collectionId, videoId) {
        await removeVideoFromCollection(collectionId, videoId);
        await refreshState();
      },
      async reorderCollection(collectionId, direction) {
        await moveCollectionInStorage(collectionId, direction);
        await refreshState();
      },
      async pinVideo(videoId) {
        await savePreferences({ home: { ...extensionState.preferences.home, pinnedVideoId: videoId } });
        await refreshState();
      },
      async importCollections(json) {
        const count = await importCollections(json, true);
        await refreshState();
        return count;
      },
      openSettings() {
        void browser.runtime.openOptionsPage();
      },
      refreshSubscriptions() {
        snapshotter.start(() => { void refreshState(); });
      },
    };

    function readCurrentVideo(currentRoute: AppRoute) {
      if (currentRoute.kind !== 'watch' || !currentRoute.videoId) return null;
      const titleElement = firstMatch<HTMLElement>(document, SELECTORS.watchTitle);
      const channelElement = firstMatch<HTMLElement>(document, SELECTORS.channelTitle);
      const title = titleElement?.textContent?.trim() || document.title.replace(/\s+-\s+YouTube\s*$/i, '').trim();
      const channel = channelElement?.textContent?.trim() ?? '';
      return makeVideoMeta(currentRoute.videoId, title, channel);
    }

    function redirectHomeIfRequested(): void {
      if (route.kind !== 'home') {
        homeRedirectPending = false;
        return;
      }
      if (!config.enabled || config.consentVersion < 1 || extensionState.preferences.home.destination !== 'subscriptions' || homeRedirectPending) return;
      homeRedirectPending = true;
      router.navigate('https://www.youtube.com/feed/subscriptions');
      setTimeout(() => {
        if (route.kind === 'home') homeRedirectPending = false;
      }, 2500);
    }

    function wantsUi(targetRoute: AppRoute): boolean {
      if (!config.enabled || config.consentVersion < 1) return false;
      if (targetRoute.kind === 'home') {
        return extensionState.preferences.home.destination === 'dashboard' && !config.killSwitches.homeDashboard && window.innerWidth >= 768;
      }
      if (targetRoute.kind === 'library') return !config.killSwitches.collections;
      if (targetRoute.kind === 'watch') return !config.killSwitches.watchControls;
      if (targetRoute.kind === 'subscriptions') return config.privacy.cacheFeeds && !config.killSwitches.subscriptionsAdapter;
      return false;
    }

    function hasPreferredAnchor(targetRoute: AppRoute): boolean {
      if (targetRoute.kind === 'watch') return Boolean(document.querySelector('#above-the-fold, ytd-watch-metadata'));
      if (targetRoute.kind === 'home') return Boolean(document.querySelector('ytd-browse[page-subtype="home"], #page-manager'));
      if (targetRoute.kind === 'subscriptions') return Boolean(document.querySelector('ytd-browse[page-subtype="subscriptions"], #page-manager'));
      if (targetRoute.kind === 'library') return Boolean(document.querySelector('ytd-browse[page-subtype="library"], ytd-browse[page-subtype="you"], #page-manager'));
      return Boolean(document.querySelector('#page-manager, ytd-app'));
    }

    function waitForPreferredAnchor(targetRoute: AppRoute): Promise<void> {
      if (hasPreferredAnchor(targetRoute)) return Promise.resolve();
      return new Promise((resolve) => {
        const finish = () => {
          observer.disconnect();
          clearTimeout(timeout);
          resolve();
        };
        const observer = new MutationObserver(() => {
          if (hasPreferredAnchor(targetRoute)) finish();
        });
        if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
        const timeout = setTimeout(finish, 2_500);
      });
    }

    function findAnchor(targetRoute: AppRoute): Element {
      if (targetRoute.kind === 'watch') {
        return document.querySelector('#above-the-fold')
          ?? document.querySelector('ytd-watch-metadata')
          ?? document.querySelector('#page-manager')
          ?? document.querySelector('ytd-app')
          ?? document.body
          ?? document.documentElement;
      }
      if (targetRoute.kind === 'home') {
        return document.querySelector('ytd-browse[page-subtype="home"]')
          ?? document.querySelector('#page-manager')
          ?? document.querySelector('ytd-app')
          ?? document.body
          ?? document.documentElement;
      }
      if (targetRoute.kind === 'subscriptions') {
        return firstMatch<Element>(document, SELECTORS.subscriptionsBrowse)
          ?? document.querySelector('#page-manager')
          ?? document.querySelector('ytd-app')
          ?? document.body
          ?? document.documentElement;
      }
      if (targetRoute.kind === 'library') {
        return document.querySelector('ytd-browse[page-subtype="library"], ytd-browse[page-subtype="you"]')
          ?? document.querySelector('#page-manager')
          ?? document.querySelector('ytd-app')
          ?? document.body
          ?? document.documentElement;
      }
      return document.querySelector('#page-manager') ?? document.querySelector('ytd-app') ?? document.body ?? document.documentElement;
    }

    function mountBeforeNative(target: Element, host: Element, targetRoute: AppRoute): void {
      const isBrowse = target.matches('ytd-browse[page-subtype]');
      if (targetRoute.kind === 'watch' || isBrowse) {
        target.parentElement?.insertBefore(host, target);
      } else {
        target.prepend(host);
      }
    }

    async function createUi(): Promise<void> {
      if (ui) return;
      const targetRoute = route;
      await waitForPreferredAnchor(targetRoute);
      if (disposed || ui) return;
      const created = await createShadowRootUi<MountedApp>(ctx, {
        name: 'reframe-youtube-ui',
        position: 'inline',
        anchor: () => findAnchor(route),
        append: (anchor: Element, host: Element) => mountBeforeNative(anchor, host, route),
        onMount(container: HTMLElement) {
          const mountPoint = document.createElement('div');
          mountPoint.id = 'rf-app-mount';
          container.append(mountPoint);
          return new App({ target: mountPoint, props: { appState: contentState, actions } });
        },
        onRemove(instance: MountedApp | undefined) {
          instance?.$destroy();
        },
      });
      ui = created;
    }

    async function reconcileUi(): Promise<void> {
      uiPending = true;
      if (uiBusy) return;
      uiBusy = true;
      try {
        while (uiPending && !disposed) {
          uiPending = false;
          const expectedRoute = route;
          if (!wantsUi(expectedRoute)) {
            if (ui?.shadowHost.isConnected) ui.remove();
            mountedKind = '';
            continue;
          }
          await createUi();
          if (disposed) break;
          if (expectedRoute !== route) { uiPending = true; continue; }
          if (!ui?.shadowHost.isConnected || mountedKind !== route.kind) {
            if (ui?.shadowHost.isConnected) ui.remove();
            ui?.mount();
            mountedKind = route.kind;
          }
        }
      } finally {
        uiBusy = false;
        if (uiPending && !disposed) void reconcileUi();
      }
    }

    async function refreshState(): Promise<void> {
      if (disposed) return;
      try {
        const next = await loadExtensionState();
        if (disposed) return;
        extensionState = next;
        config = next.deviceConfig;
        syncBootMirror(config, next.preferences);
        applyRuntimeAttributes(route, config, next.preferences);
        tracker.update(route, config);
        registry.reconcile(route, config);
        contentState.set({ ...next, route, currentVideo: readCurrentVideo(route) });
        redirectHomeIfRequested();
        void reconcileUi();
      } catch {
        // Extension storage can be temporarily unavailable during browser startup; native YouTube remains usable.
      }
    }

    const routeUnsubscribe = router.subscribe((nextRoute) => {
      route = nextRoute;
      applyRuntimeAttributes(route, config, extensionState.preferences);
      tracker.update(route, config);
      registry.reconcile(route, config);
      contentState.update((current) => ({ ...current, route, currentVideo: readCurrentVideo(route) }));
      redirectHomeIfRequested();
      void reconcileUi();
      // YouTube often updates title/channel nodes just after yt-navigate-finish.
      setTimeout(() => {
        if (!disposed && route === nextRoute) contentState.update((current) => ({ ...current, currentVideo: readCurrentVideo(route) }));
      }, 250);
    });

    registry.register({
      id: 'subscriptionsAdapter',
      matches: (currentRoute, currentConfig) => currentRoute.kind === 'subscriptions' && currentConfig.privacy.cacheFeeds,
      start: () => {
        snapshotter.start(() => { void refreshState(); });
        return () => snapshotter.stop();
      },
    });

    const onNavigateStart = () => tracker.navigationStarted();
    const onResize = () => {
      applyRuntimeAttributes(route, config, extensionState.preferences);
      void reconcileUi();
    };
    const onStorageChanged = () => { void refreshState(); };
    document.addEventListener('yt-navigate-start', onNavigateStart, true);
    window.addEventListener('resize', onResize, { passive: true });
    browser.storage.onChanged.addListener(onStorageChanged);

    // Ensure the session storage access unlock has had a chance to run before feature health reads.
    await refreshState();
    if (firstRoute !== route) await refreshState();
    await reconcileUi();

    ctx.onInvalidated(() => {
      disposed = true;
      routeUnsubscribe();
      document.removeEventListener('yt-navigate-start', onNavigateStart, true);
      window.removeEventListener('resize', onResize);
      browser.storage.onChanged.removeListener(onStorageChanged);
      tracker.dispose();
      snapshotter.stop();
      registry.dispose();
      router.dispose();
      ui?.remove();
      delete document.documentElement.dataset.rfEnabled;
      delete document.documentElement.dataset.rfRoute;
      delete document.documentElement.dataset.rfTheme;
      delete document.documentElement.dataset.rfHomeMode;
      delete document.documentElement.dataset.rfFocus;
      delete document.documentElement.dataset.rfComments;
      delete document.documentElement.dataset.rfDescription;
      delete document.documentElement.dataset.rfHideShorts;
      delete document.documentElement.dataset.rfViewport;
    });
  },
});
