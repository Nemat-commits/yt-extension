import { describe, expect, it } from 'vitest';
import { normalizeDeviceConfig, normalizePreferences } from '../src/data/storage';
import { DEFAULT_DEVICE_CONFIG, DEFAULT_PREFERENCES } from '../src/data/models';

describe('storage schema normalization', () => {
  it('fills device-local privacy defaults and preserves explicit kill switches', () => {
    const config = normalizeDeviceConfig({ enabled: true, privacy: { trackProgress: true }, killSwitches: { subscriptionsAdapter: true } });
    expect(config).toMatchObject({
      enabled: true,
      consentVersion: 0,
      privacy: { trackProgress: true, cacheFeeds: false, diagnostics: false },
      killSwitches: { ...DEFAULT_DEVICE_CONFIG.killSwitches, subscriptionsAdapter: true },
    });
  });

  it('falls back to safe preference defaults for unknown values', () => {
    expect(normalizePreferences({ theme: 'neon', density: 'tiny', home: { sections: ['unexpected'] } })).toEqual(DEFAULT_PREFERENCES);
  });
});
