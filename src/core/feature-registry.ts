import type { AppRoute, DeviceConfig } from '@src/data/models';

export interface RuntimeFeature {
  id: string;
  matches(route: AppRoute, config: DeviceConfig): boolean;
  start(route: AppRoute, config: DeviceConfig): void | (() => void);
}

/** Idempotent route/config lifecycle for independently kill-switchable runtime features. */
export function createFeatureRegistry() {
  const features = new Map<string, RuntimeFeature>();
  const active = new Map<string, () => void>();

  return {
    register(feature: RuntimeFeature) {
      if (features.has(feature.id)) throw new Error(`Duplicate feature registration: ${feature.id}`);
      features.set(feature.id, feature);
    },
    reconcile(route: AppRoute, config: DeviceConfig) {
      for (const [id, feature] of features) {
        const enabled = config.enabled && config.consentVersion >= 1 && !config.killSwitches[id] && feature.matches(route, config);
        const cleanup = active.get(id);
        if (enabled && !cleanup) {
          const dispose = feature.start(route, config);
          active.set(id, typeof dispose === 'function' ? dispose : () => undefined);
        } else if (!enabled && cleanup) {
          cleanup();
          active.delete(id);
        }
      }
    },
    dispose() {
      for (const cleanup of active.values()) cleanup();
      active.clear();
      features.clear();
    },
    activeIds() {
      return [...active.keys()];
    },
  };
}
