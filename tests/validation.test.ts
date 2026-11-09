import { describe, expect, it } from 'vitest';
import { exportCollections, makeVideoMeta, parseCollectionsImport, parseVideoId } from '../src/data/validation';
import type { Collection } from '../src/data/models';

const validId = 'abcdefghijk';

function sampleCollection(): Collection {
  return {
    id: 'list-1',
    name: 'Weekend films',
    description: 'For later',
    createdAt: 1,
    updatedAt: 2,
    videos: [makeVideoMeta(validId, 'A film', 'A channel')],
  };
}

describe('YouTube URL and collection validation', () => {
  it('extracts IDs from supported YouTube URLs without accepting other hosts', () => {
    expect(parseVideoId(validId)).toBe(validId);
    expect(parseVideoId(`https://www.youtube.com/watch?v=${validId}`)).toBe(validId);
    expect(parseVideoId(`https://youtu.be/${validId}`)).toBe(validId);
    expect(parseVideoId(`https://www.youtube.com/shorts/${validId}`)).toBe(validId);
    expect(parseVideoId('https://example.com/watch?v=abcdefghijk')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
  });

  it('round-trips collections and sanitizes untrusted labels', () => {
    const json = exportCollections([sampleCollection()]);
    const parsed = parseCollectionsImport(json);
    expect(parsed.collections[0]?.videos[0]?.id).toBe(validId);
    expect(parseCollectionsImport(JSON.stringify({
      schemaVersion: 1,
      collections: [{ ...sampleCollection(), name: '<script> bad\u0000name ' }],
    })).collections[0]?.name).toBe('<script> bad name');
  });

  it('rejects unsupported versions, malformed JSON, oversized files, and invalid IDs', () => {
    expect(() => parseCollectionsImport('{')).toThrow('valid JSON');
    expect(() => parseCollectionsImport(JSON.stringify({ schemaVersion: 9, collections: [] }))).toThrow('Unsupported');
    expect(() => parseCollectionsImport(' '.repeat(2 * 1024 * 1024 + 1))).toThrow('2 MB');
    const invalid = parseCollectionsImport(JSON.stringify({ schemaVersion: 1, collections: [{ ...sampleCollection(), videos: [{ id: 'bad' }] }] }));
    expect(invalid.collections[0]?.videos).toEqual([]);
  });
});
