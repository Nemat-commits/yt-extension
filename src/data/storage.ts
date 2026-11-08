import { browser } from 'wxt/browser';
import {
  DEFAULT_DEVICE_CONFIG,
  DEFAULT_PREFERENCES,
  EMPTY_FEATURE_HEALTH,
  SCHEMA_VERSION,
  type Collection,
  type DeviceConfig,
  type ExtensionState,
  type FeatureHealth,
  type FeedSnapshot,
  type ResumeState,
  type UserPreferences,
  type VideoMeta,
} from './models';
import { exportCollections, makeVideoMeta, parseCollectionsImport, sanitizeText, isValidVideoId } from './validation';

const KEY = {
  deviceConfig: 'deviceConfig',
  preferences: 'preferences',
  collections: 'collections',
  resumeStates: 'resumeStates',
  feedSnapshots: 'feedSnapshots',
  featureHealth: 'featureHealth',
} as const;

const PROGRESS_LIMIT = 200;
const FEED_LIMIT = 100;
const RESUME_TTL = 90 * 24 * 60 * 60 * 1000;
const FEED_TTL = 24 * 60 * 60 * 1000;

export type DeviceConfigPatch = Omit<Partial<DeviceConfig>, 'privacy' | 'killSwitches'> & {
  privacy?: Partial<DeviceConfig['privacy']>;
  killSwitches?: Record<string, boolean>;
};
export type UserPreferencesPatch = Omit<Partial<UserPreferences>, 'home' | 'watch' | 'global'> & {
  home?: Partial<UserPreferences['home']>;
  watch?: Partial<UserPreferences['watch']>;
  global?: Partial<UserPreferences['global']>;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeDeviceConfig(value: unknown): DeviceConfig {
  const raw = objectValue(value);
  const privacy = objectValue(raw.privacy);
  const rawKillSwitches = objectValue(raw.killSwitches);
  const killSwitches = { ...DEFAULT_DEVICE_CONFIG.killSwitches };
  for (const [key, flag] of Object.entries(rawKillSwitches)) {
    if (typeof flag === 'boolean' && key.length <= 80) killSwitches[key] = flag;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    consentVersion: Number.isFinite(raw.consentVersion) ? Math.max(0, Number(raw.consentVersion)) : 0,
    enabled: raw.enabled === true,
    privacy: {
      trackProgress: privacy.trackProgress === true,
      cacheFeeds: privacy.cacheFeeds === true,
      diagnostics: privacy.diagnostics === true,
    },
    killSwitches,
  };
}

export function normalizePreferences(value: unknown): UserPreferences {
  const raw = objectValue(value);
  const home = objectValue(raw.home);
  const watch = objectValue(raw.watch);
  const global = objectValue(raw.global);
  const allowedSections = new Set(['hero', 'continue', 'subscriptions', 'collections', 'shortcuts']);
  const sections = Array.isArray(home.sections)
    ? home.sections.filter((section): section is UserPreferences['home']['sections'][number] => typeof section === 'string' && allowedSections.has(section))
    : DEFAULT_PREFERENCES.home.sections;

  return {
    schemaVersion: SCHEMA_VERSION,
    theme: raw.theme === 'system' ? 'system' : 'midnight',
    density: raw.density === 'compact' ? 'compact' : 'comfortable',
    home: {
      destination: home.destination === 'subscriptions' || home.destination === 'original' ? home.destination : 'dashboard',
      sections: sections.length ? [...new Set(sections)] : [...DEFAULT_PREFERENCES.home.sections],
      showRecommendations: home.showRecommendations === true,
      ...(isValidVideoId(home.pinnedVideoId) ? { pinnedVideoId: home.pinnedVideoId } : {}),
    },
    watch: {
      focusMode: watch.focusMode === true,
      collapseComments: watch.collapseComments === true,
      collapseDescription: watch.collapseDescription === true,
    },
    global: { hideShortsSurfaces: global.hideShortsSurfaces === true },
  };
}

function normalizeFeatureHealth(value: unknown): FeatureHealth {
  const raw = objectValue(value);
  const failures = objectValue(raw.failures);
  const disabled = objectValue(raw.disabled);
  return {
    failures: Object.fromEntries(Object.entries(failures).filter(([, count]) => Number.isFinite(count)).map(([id, count]) => [id, Math.max(0, Number(count))])),
    disabled: Object.fromEntries(Object.entries(disabled).filter(([, state]) => typeof state === 'boolean')) as Record<string, boolean>,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : 0,
  };
}

function normalizeCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  return value.slice(0, 100).flatMap((raw) => {
    const item = objectValue(raw);
    const id = sanitizeText(item.id, 80);
    const name = sanitizeText(item.name, 80);
    if (!id || !name || unique.has(id)) return [];
    unique.add(id);
    const videos: VideoMeta[] = [];
    const videoIds = new Set<string>();
    for (const rawVideo of Array.isArray(item.videos) ? item.videos.slice(0, 500) : []) {
      const video = objectValue(rawVideo);
      if (!isValidVideoId(video.id) || videoIds.has(video.id)) continue;
      videoIds.add(video.id);
      const fallback = makeVideoMeta(video.id, typeof video.title === 'string' ? video.title : '', typeof video.channelTitle === 'string' ? video.channelTitle : '');
      videos.push({
        ...fallback,
        thumbnailUrl: typeof video.thumbnailUrl === 'string' && video.thumbnailUrl.startsWith('https://i.ytimg.com/') ? video.thumbnailUrl : fallback.thumbnailUrl,
        durationText: sanitizeText(video.durationText, 24) || undefined,
        capturedAt: Number.isFinite(video.capturedAt) ? Number(video.capturedAt) : undefined,
      });
    }
    const now = Date.now();
    return [{
      id,
      name,
      description: sanitizeText(item.description, 280),
      createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : now,
      updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : now,
      videos,
    }];
  });
}

function normalizeResumeStates(value: unknown): ResumeState[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((raw) => {
    const item = objectValue(raw);
    const video = objectValue(item.video);
    if (!isValidVideoId(video.id) || seen.has(video.id)) return [];
    const duration = Number(item.duration);
    const currentTime = Number(item.currentTime);
    const updatedAt = Number(item.updatedAt);
    if (!Number.isFinite(duration) || duration < 120 || !Number.isFinite(currentTime) || !Number.isFinite(updatedAt)) return [];
    const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));
    if (percent < 5 || percent >= 95 || Date.now() - updatedAt > RESUME_TTL) return [];
    seen.add(video.id);
    return [{
      video: {
        ...makeVideoMeta(video.id, typeof video.title === 'string' ? video.title : '', typeof video.channelTitle === 'string' ? video.channelTitle : ''),
        durationText: sanitizeText(video.durationText, 24) || undefined,
      },
      currentTime,
      duration,
      percent,
      updatedAt,
    }];
  }).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, PROGRESS_LIMIT);
}

function normalizeFeedSnapshots(value: unknown): FeedSnapshot[] {
  if (!Array.isArray(value)) return [];
  const raw = value.find((item) => objectValue(item).id === 'subscriptions');
  if (!raw) return [];
  const snapshot = objectValue(raw);
  const updatedAt = Number(snapshot.updatedAt);
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > FEED_TTL) return [];
  const seen = new Set<string>();
  const items: VideoMeta[] = [];
  for (const rawVideo of Array.isArray(snapshot.items) ? snapshot.items.slice(0, FEED_LIMIT) : []) {
    const video = objectValue(rawVideo);
    if (!isValidVideoId(video.id) || seen.has(video.id)) continue;
    seen.add(video.id);
    items.push({
      ...makeVideoMeta(video.id, typeof video.title === 'string' ? video.title : '', typeof video.channelTitle === 'string' ? video.channelTitle : ''),
      thumbnailUrl: typeof video.thumbnailUrl === 'string' && video.thumbnailUrl.startsWith('https://i.ytimg.com/')
        ? video.thumbnailUrl
        : `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      durationText: sanitizeText(video.durationText, 24) || undefined,
      capturedAt: Number.isFinite(video.capturedAt) ? Number(video.capturedAt) : undefined,
    });
  }
  return [{ id: 'subscriptions', items, updatedAt }];
}

export async function getDeviceConfig(): Promise<DeviceConfig> {
  const result = await browser.storage.local.get(KEY.deviceConfig);
  return normalizeDeviceConfig(result[KEY.deviceConfig]);
}

export async function saveDeviceConfig(patch: DeviceConfigPatch): Promise<DeviceConfig> {
  const current = await getDeviceConfig();
  const next = normalizeDeviceConfig({
    ...current,
    ...patch,
    privacy: { ...current.privacy, ...(patch.privacy ?? {}) },
    killSwitches: { ...current.killSwitches, ...(patch.killSwitches ?? {}) },
  });
  await browser.storage.local.set({ [KEY.deviceConfig]: next });
  return next;
}

export async function getPreferences(): Promise<UserPreferences> {
  const config = await getDeviceConfig();
  if (config.consentVersion < 1) return normalizePreferences(DEFAULT_PREFERENCES);
  const result = await browser.storage.sync.get(KEY.preferences);
  return normalizePreferences(result[KEY.preferences]);
}

export async function savePreferences(patch: UserPreferencesPatch): Promise<UserPreferences> {
  const config = await getDeviceConfig();
  if (config.consentVersion < 1) throw new Error('Please choose a Reframe privacy mode before saving preferences.');
  const current = await getPreferences();
  const next = normalizePreferences({
    ...current,
    ...patch,
    home: { ...current.home, ...(patch.home ?? {}) },
    watch: { ...current.watch, ...(patch.watch ?? {}) },
    global: { ...current.global, ...(patch.global ?? {}) },
  });
  await browser.storage.sync.set({ [KEY.preferences]: next });
  return next;
}

export async function loadExtensionState(): Promise<ExtensionState> {
  const local = await browser.storage.local.get([KEY.deviceConfig, KEY.collections, KEY.resumeStates, KEY.feedSnapshots]);
  const deviceConfig = normalizeDeviceConfig(local[KEY.deviceConfig]);
  let preferences = normalizePreferences(DEFAULT_PREFERENCES);
  if (deviceConfig.consentVersion >= 1) {
    const synced = await browser.storage.sync.get(KEY.preferences);
    preferences = normalizePreferences(synced[KEY.preferences]);
  }

  let featureHealth = EMPTY_FEATURE_HEALTH;
  try {
    const session = await browser.storage.session.get(KEY.featureHealth);
    featureHealth = normalizeFeatureHealth(session[KEY.featureHealth]);
  } catch {
    // The service worker opens storage.session for content scripts. Other browsers may not implement it.
  }

  let storageBytes: number | null = null;
  try {
    storageBytes = await browser.storage.local.getBytesInUse(null);
  } catch {
    // Keep the settings UI usable when a browser omits getBytesInUse.
  }

  return {
    deviceConfig,
    preferences,
    collections: normalizeCollections(local[KEY.collections]),
    resumeStates: normalizeResumeStates(local[KEY.resumeStates]),
    feedSnapshots: normalizeFeedSnapshots(local[KEY.feedSnapshots]),
    featureHealth,
    storageBytes,
  };
}

export async function getCollections(): Promise<Collection[]> {
  const result = await browser.storage.local.get(KEY.collections);
  return normalizeCollections(result[KEY.collections]);
}

async function writeCollections(collections: Collection[]): Promise<Collection[]> {
  const normalized = normalizeCollections(collections);
  if (normalized.length > 100) throw new Error('You can keep up to 100 collections.');
  await browser.storage.local.set({ [KEY.collections]: normalized });
  return normalized;
}

export async function createCollection(name: string): Promise<Collection> {
  const safeName = sanitizeText(name, 80);
  if (!safeName) throw new Error('Enter a collection name.');
  const collections = await getCollections();
  if (collections.length >= 100) throw new Error('You have reached the 100 collection limit.');
  const now = Date.now();
  const collection: Collection = {
    id: globalThis.crypto?.randomUUID?.() ?? `rf-${now}-${Math.random().toString(36).slice(2, 10)}`,
    name: safeName,
    description: '',
    createdAt: now,
    updatedAt: now,
    videos: [],
  };
  await writeCollections([collection, ...collections]);
  return collection;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const safeName = sanitizeText(name, 80);
  if (!safeName) throw new Error('Enter a collection name.');
  const collections = await getCollections();
  const target = collections.find((collection) => collection.id === id);
  if (!target) throw new Error('That collection no longer exists.');
  target.name = safeName;
  target.updatedAt = Date.now();
  await writeCollections(collections);
}

export async function deleteCollection(id: string): Promise<void> {
  const collections = await getCollections();
  await writeCollections(collections.filter((collection) => collection.id !== id));
}

export async function addVideoToCollection(collectionId: string, video: VideoMeta): Promise<void> {
  if (!isValidVideoId(video.id)) throw new Error('Invalid YouTube video ID.');
  const collections = await getCollections();
  const target = collections.find((collection) => collection.id === collectionId);
  if (!target) throw new Error('Choose a collection first.');
  if (!target.videos.some((item) => item.id === video.id)) {
    if (target.videos.length >= 500) throw new Error('A collection can hold up to 500 videos.');
    target.videos.unshift({
      ...makeVideoMeta(video.id, video.title, video.channelTitle),
      thumbnailUrl: video.thumbnailUrl.startsWith('https://i.ytimg.com/') ? video.thumbnailUrl : `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      durationText: sanitizeText(video.durationText, 24) || undefined,
      capturedAt: Date.now(),
    });
    target.updatedAt = Date.now();
    await writeCollections(collections);
  }
}

export async function removeVideoFromCollection(collectionId: string, videoId: string): Promise<void> {
  const collections = await getCollections();
  const target = collections.find((collection) => collection.id === collectionId);
  if (!target) return;
  target.videos = target.videos.filter((video) => video.id !== videoId);
  target.updatedAt = Date.now();
  await writeCollections(collections);
}

export async function reorderCollection(collectionId: string, direction: -1 | 1): Promise<void> {
  const collections = await getCollections();
  const currentIndex = collections.findIndex((collection) => collection.id === collectionId);
  if (currentIndex < 0) return;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= collections.length) return;
  [collections[currentIndex], collections[nextIndex]] = [collections[nextIndex]!, collections[currentIndex]!];
  collections[nextIndex]!.updatedAt = Date.now();
  await writeCollections(collections);
}

export async function importCollections(json: string, merge = true): Promise<number> {
  const imported = parseCollectionsImport(json).collections;
  let collections = merge ? await getCollections() : [];
  const indexById = new Map(collections.map((collection, index) => [collection.id, index]));
  for (const collection of imported) {
    const existingIndex = indexById.get(collection.id);
    if (existingIndex !== undefined) collections[existingIndex] = collection;
    else collections.unshift(collection);
  }
  if (collections.length > 100) throw new Error('This import would exceed the 100 collection limit.');
  await writeCollections(collections);
  return imported.length;
}

export async function exportCollectionBackup(): Promise<string> {
  return exportCollections(await getCollections());
}

export async function getResumeStates(): Promise<ResumeState[]> {
  const result = await browser.storage.local.get(KEY.resumeStates);
  return normalizeResumeStates(result[KEY.resumeStates]);
}

export async function saveResumeState(state: ResumeState): Promise<void> {
  if (!isValidVideoId(state.video.id)) return;
  const current = await getResumeStates();
  const next = [state, ...current.filter((item) => item.video.id !== state.video.id)]
    .filter((item) => Date.now() - item.updatedAt <= RESUME_TTL)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PROGRESS_LIMIT);
  await browser.storage.local.set({ [KEY.resumeStates]: next });
}

export async function removeResumeState(videoId: string): Promise<void> {
  const current = await getResumeStates();
  await browser.storage.local.set({ [KEY.resumeStates]: current.filter((item) => item.video.id !== videoId) });
}

export async function getFeedSnapshots(): Promise<FeedSnapshot[]> {
  const result = await browser.storage.local.get(KEY.feedSnapshots);
  return normalizeFeedSnapshots(result[KEY.feedSnapshots]);
}

export async function saveFeedSnapshot(items: VideoMeta[], updatedAt = Date.now()): Promise<void> {
  const current = (await getFeedSnapshots()).find((snapshot) => snapshot.id === 'subscriptions');
  const merged: VideoMeta[] = [];
  const seen = new Set<string>();
  for (const video of [...items, ...(current?.items ?? [])]) {
    if (!isValidVideoId(video.id) || seen.has(video.id)) continue;
    seen.add(video.id);
    merged.push({
      ...makeVideoMeta(video.id, video.title, video.channelTitle),
      thumbnailUrl: video.thumbnailUrl.startsWith('https://i.ytimg.com/') ? video.thumbnailUrl : `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      durationText: sanitizeText(video.durationText, 24) || undefined,
      capturedAt: video.capturedAt ?? updatedAt,
    });
    if (merged.length >= FEED_LIMIT) break;
  }
  await browser.storage.local.set({
    [KEY.feedSnapshots]: [{ id: 'subscriptions', items: merged, updatedAt } satisfies FeedSnapshot],
  });
}

export async function readFeatureHealth(): Promise<FeatureHealth> {
  try {
    const result = await browser.storage.session.get(KEY.featureHealth);
    return normalizeFeatureHealth(result[KEY.featureHealth]);
  } catch {
    return { failures: {}, disabled: {}, updatedAt: 0 };
  }
}

export async function writeFeatureHealth(value: FeatureHealth): Promise<void> {
  try {
    await browser.storage.session.set({ [KEY.featureHealth]: normalizeFeatureHealth(value) });
  } catch {
    // Session health is best-effort. It never blocks playback or storage features.
  }
}

export async function pruneExpiredData(): Promise<void> {
  const progress = await getResumeStates();
  const snapshots = await getFeedSnapshots();
  const now = Date.now();
  const freshProgress = progress.filter((item) => now - item.updatedAt <= RESUME_TTL);
  const freshSnapshots = snapshots.filter((item) => now - item.updatedAt <= FEED_TTL);
  await browser.storage.local.set({ [KEY.resumeStates]: freshProgress, [KEY.feedSnapshots]: freshSnapshots });
}

export async function clearAllReframeData(): Promise<void> {
  await Promise.all([
    browser.storage.local.remove([KEY.deviceConfig, KEY.collections, KEY.resumeStates, KEY.feedSnapshots]),
    browser.storage.sync.remove(KEY.preferences),
    browser.storage.session.remove(KEY.featureHealth).catch(() => undefined),
  ]);
}
