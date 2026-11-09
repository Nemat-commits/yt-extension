import { describe, expect, it } from 'vitest';
import { classifyRoute, isSameOriginYouTubeUrl } from '../src/core/router';

describe('classifyRoute', () => {
  it('classifies the main routes, including both library aliases', () => {
    expect(classifyRoute({ pathname: '/', search: '' }).kind).toBe('home');
    expect(classifyRoute({ pathname: '/feed/subscriptions', search: '' }).kind).toBe('subscriptions');
    expect(classifyRoute({ pathname: '/feed/you', search: '' }).kind).toBe('library');
    expect(classifyRoute({ pathname: '/feed/library', search: '' }).kind).toBe('library');
    expect(classifyRoute({ pathname: '/results', search: '?search_query=ambient' })).toMatchObject({ kind: 'search', query: 'ambient' });
  });

  it('requires valid video IDs for watch and Shorts routes', () => {
    expect(classifyRoute({ pathname: '/watch', search: '?v=abcdefghijk' })).toMatchObject({ kind: 'watch', videoId: 'abcdefghijk' });
    expect(classifyRoute({ pathname: '/watch', search: '?v=bad' }).kind).toBe('other');
    expect(classifyRoute({ pathname: '/shorts/abcdefghijk', search: '' })).toMatchObject({ kind: 'shorts', videoId: 'abcdefghijk' });
  });
});

describe('isSameOriginYouTubeUrl', () => {
  it('accepts internal relative and absolute URLs', () => {
    expect(isSameOriginYouTubeUrl('/watch?v=abcdefghijk')?.origin).toBe('https://www.youtube.com');
    expect(isSameOriginYouTubeUrl('https://www.youtube.com/feed/you')?.pathname).toBe('/feed/you');
  });

  it('rejects external and lookalike hosts', () => {
    expect(isSameOriginYouTubeUrl('https://example.com/')).toBeNull();
    expect(isSameOriginYouTubeUrl('https://www.youtube.com.evil.test/')).toBeNull();
  });
});
