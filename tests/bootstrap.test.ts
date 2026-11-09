import { afterEach, describe, expect, it } from 'vitest';
import { applyRuntimeAttributes } from '../src/core/bootstrap';
import { DEFAULT_DEVICE_CONFIG, DEFAULT_PREFERENCES } from '../src/data/models';

const enabledConfig = {
  ...DEFAULT_DEVICE_CONFIG,
  consentVersion: 1,
  enabled: true,
};

const dashboardPreferences = {
  ...DEFAULT_PREFERENCES,
  home: { ...DEFAULT_PREFERENCES.home, destination: 'dashboard' as const },
};

afterEach(() => {
  for (const key of ['rfEnabled', 'rfRoute', 'rfTheme', 'rfHomeMode', 'rfHomeReady', 'rfViewport']) {
    delete document.documentElement.dataset[key];
  }
  localStorage.clear();
});

describe('page bootstrap', () => {
  it('keeps native Home visible until the Reframe UI confirms it mounted', () => {
    applyRuntimeAttributes({ kind: 'home', path: '/' }, enabledConfig, dashboardPreferences);

    expect(document.documentElement.dataset.rfHomeMode).toBe('dashboard');
    expect(document.documentElement.dataset.rfHomeReady).toBeUndefined();

    document.documentElement.dataset.rfHomeReady = 'true';
    applyRuntimeAttributes({ kind: 'home', path: '/' }, enabledConfig, dashboardPreferences);
    expect(document.documentElement.dataset.rfHomeReady).toBe('true');
  });

  it('clears Home suppression state when leaving the dashboard route', () => {
    document.documentElement.dataset.rfHomeReady = 'true';
    applyRuntimeAttributes({ kind: 'watch', path: '/watch', videoId: 'abcdefghijk' }, enabledConfig, dashboardPreferences);

    expect(document.documentElement.dataset.rfHomeMode).toBeUndefined();
    expect(document.documentElement.dataset.rfHomeReady).toBeUndefined();
  });

  it('clears Home suppression state when Reframe is disabled', () => {
    document.documentElement.dataset.rfHomeReady = 'true';
    applyRuntimeAttributes({ kind: 'home', path: '/' }, DEFAULT_DEVICE_CONFIG, dashboardPreferences);

    expect(document.documentElement.dataset.rfHomeMode).toBeUndefined();
    expect(document.documentElement.dataset.rfHomeReady).toBeUndefined();
  });
});
