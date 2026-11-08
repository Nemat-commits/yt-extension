import { describe, expect, it } from 'vitest';
import { extractVideoFromCard, extractVisibleSubscriptions } from '../src/adapters/subscriptions-dom';

const id = 'abcdefghijk';

describe('visible subscription DOM adapter', () => {
  it('normalizes cards and derives a deterministic lazy-thumbnail fallback', () => {
    const card = document.createElement('ytd-rich-item-renderer');
    card.innerHTML = `<a id="video-title-link" href="/watch?v=${id}" title="A useful video"></a><ytd-channel-name>Creator</ytd-channel-name><img src="data:image/gif;base64,AA==">`;
    const result = extractVideoFromCard(card, 123);
    expect(result).toMatchObject({
      id,
      title: 'A useful video',
      channelTitle: 'Creator',
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      capturedAt: 123,
    });
  });

  it('deduplicates cards and ignores invalid links', () => {
    const root = document.createElement('section');
    root.innerHTML = `
      <ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=${id}" title="First"></a></ytd-rich-item-renderer>
      <ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=${id}" title="Duplicate"></a></ytd-rich-item-renderer>
      <ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=bad" title="Invalid"></a></ytd-rich-item-renderer>`;
    const items = extractVisibleSubscriptions(root);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('First');
  });
});
