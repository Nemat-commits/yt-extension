import { VIDEO_ID_RE, type Collection, type VideoMeta } from './models';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_COLLECTIONS = 100;
export const MAX_VIDEOS_PER_COLLECTION = 500;

export function sanitizeText(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isValidVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID_RE.test(value);
}

export function parseVideoId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID_RE.test(text)) return text;

  try {
    const url = new URL(text.startsWith('/') ? `https://www.youtube.com${text}` : text);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return isValidVideoId(id) ? id : null;
    }
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return null;

    const pathParts = url.pathname.split('/').filter(Boolean);
    const id = url.pathname === '/watch'
      ? url.searchParams.get('v')
      : ['shorts', 'embed', 'live'].includes(pathParts[0] ?? '')
        ? pathParts[1]
        : null;
    return isValidVideoId(id) ? id : null;
  } catch {
    return null;
  }
}

export function makeVideoMeta(videoId: string, title = '', channelTitle = ''): VideoMeta {
  if (!isValidVideoId(videoId)) throw new Error('Invalid YouTube video ID.');
  return {
    id: videoId,
    title: sanitizeText(title, 240) || `YouTube video ${videoId}`,
    channelTitle: sanitizeText(channelTitle, 120),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function normalizeImportedVideo(value: unknown): VideoMeta | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<VideoMeta>;
  if (!isValidVideoId(candidate.id)) return null;
  const fallback = makeVideoMeta(candidate.id, candidate.title, candidate.channelTitle);
  const thumbnail = typeof candidate.thumbnailUrl === 'string' && candidate.thumbnailUrl.startsWith('https://i.ytimg.com/')
    ? candidate.thumbnailUrl
    : fallback.thumbnailUrl;
  return {
    ...fallback,
    thumbnailUrl: thumbnail,
    durationText: sanitizeText(candidate.durationText, 24) || undefined,
    capturedAt: Number.isFinite(candidate.capturedAt) ? Number(candidate.capturedAt) : undefined,
  };
}

export interface CollectionImport {
  schemaVersion: 1;
  collections: Collection[];
}

export function parseCollectionsImport(json: string): CollectionImport {
  if (new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('Import files must be 2 MB or smaller.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!raw || typeof raw !== 'object') throw new Error('The import file must contain a JSON object.');
  const payload = raw as { schemaVersion?: unknown; collections?: unknown };
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.collections)) {
    throw new Error('Unsupported collection backup. Expected schemaVersion 1 and a collections array.');
  }
  if (payload.collections.length > MAX_COLLECTIONS) throw new Error(`A backup can contain at most ${MAX_COLLECTIONS} collections.`);

  const collections: Collection[] = [];
  const ids = new Set<string>();
  for (const item of payload.collections) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<Collection>;
    const id = sanitizeText(candidate.id, 80);
    const name = sanitizeText(candidate.name, 80);
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);

    const videos: VideoMeta[] = [];
    const seenVideos = new Set<string>();
    for (const rawVideo of Array.isArray(candidate.videos) ? candidate.videos.slice(0, MAX_VIDEOS_PER_COLLECTION) : []) {
      const video = normalizeImportedVideo(rawVideo);
      if (!video || seenVideos.has(video.id)) continue;
      seenVideos.add(video.id);
      videos.push(video);
    }

    const now = Date.now();
    collections.push({
      id,
      name,
      description: sanitizeText(candidate.description, 280),
      createdAt: Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : now,
      updatedAt: Number.isFinite(candidate.updatedAt) ? Number(candidate.updatedAt) : now,
      videos,
    });
  }

  return { schemaVersion: 1, collections };
}

export function exportCollections(collections: Collection[], exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ schemaVersion: 1, exportedAt, collections }, null, 2);
}
