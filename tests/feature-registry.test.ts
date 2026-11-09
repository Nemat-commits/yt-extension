import { describe, expect, it, vi } from 'vitest';
import { createFeatureRegistry } from '../src/core/feature-registry';
import { DEFAULT_DEVICE_CONFIG, type AppRoute } from '../src/data/models';

const homeRoute: AppRoute = { kind: 'home', path: '/' };

describe('feature lifecycle registry', () => {
  it('starts once, stops when disabled, and ignores duplicate reconciliations', () => {
    const registry = createFeatureRegistry();
    const start = vi.fn(() => vi.fn());
    registry.register({ id: 'homeDashboard', matches: (route) => route.kind === 'home', start });
    const config = { ...DEFAULT_DEVICE_CONFIG, enabled: true, consentVersion: 1 };

    registry.reconcile(homeRoute, config);
    registry.reconcile(homeRoute, config);
    expect(start).toHaveBeenCalledTimes(1);
    expect(registry.activeIds()).toEqual(['homeDashboard']);
    registry.reconcile(homeRoute, { ...config, killSwitches: { ...config.killSwitches, homeDashboard: true } });
    expect(registry.activeIds()).toEqual([]);
  });
});
