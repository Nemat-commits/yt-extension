import type { AppRoute, DeviceConfig, UserPreferences } from '@src/data/models';
import { DEFAULT_PREFERENCES } from '@src/data/models';
import { classifyRoute } from './router';

const BOOT = {
  enabled: 'rf_boot_enabled',
  theme: 'rf_boot_theme',
  home: 'rf_boot_home',
  focus: 'rf_boot_focus',
  comments: 'rf_boot_comments',
  description: 'rf_boot_description',
  hideShorts: 'rf_boot_hide_shorts',
  density: 'rf_boot_density',
} as const;

function getBootValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setBootValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be disabled by the browser/user; the extension still works without the FOUC hint.
  }
}

/** Must stay synchronous and contain only non-sensitive booleans / UI preferences. */
export function applySyncBootAttributes(): void {
  const root = document.documentElement;
  if (!root) return;

  const route = classifyRoute(window.location);
  root.dataset.rfRoute = route.kind;
  if (getBootValue(BOOT.enabled) === 'true') root.dataset.rfEnabled = 'true';
  const bootTheme = getBootValue(BOOT.theme);
  if (bootTheme === 'midnight' || bootTheme === 'system') root.dataset.rfTheme = bootTheme;
  if (getBootValue(BOOT.home) === 'true' && route.kind === 'home') root.dataset.rfHomeMode = 'dashboard';
  if (getBootValue(BOOT.focus) === 'true' && route.kind === 'watch') root.dataset.rfFocus = 'true';
  if (getBootValue(BOOT.comments) === 'true' && route.kind === 'watch') root.dataset.rfComments = 'collapsed';
  if (getBootValue(BOOT.description) === 'true' && route.kind === 'watch') root.dataset.rfDescription = 'collapsed';
  if (getBootValue(BOOT.hideShorts) === 'true') root.dataset.rfHideShorts = 'true';
  if (window.innerWidth < 768) root.dataset.rfViewport = 'compact';
}

export function syncBootMirror(config: DeviceConfig, preferences: UserPreferences): void {
  const canRun = config.enabled && config.consentVersion >= 1;
  const homeActive = canRun && preferences.home.destination === 'dashboard' && !config.killSwitches.homeDashboard;
  setBootValue(BOOT.enabled, String(canRun));
  setBootValue(BOOT.theme, preferences.theme);
  setBootValue(BOOT.home, String(homeActive));
  setBootValue(BOOT.focus, String(canRun && preferences.watch.focusMode && !config.killSwitches.watchControls));
  setBootValue(BOOT.comments, String(canRun && preferences.watch.collapseComments && !config.killSwitches.watchControls));
  setBootValue(BOOT.description, String(canRun && preferences.watch.collapseDescription && !config.killSwitches.watchControls));
  setBootValue(BOOT.hideShorts, String(canRun && preferences.global.hideShortsSurfaces));
  setBootValue(BOOT.density, preferences.density);
}

export function applyRuntimeAttributes(
  route: AppRoute,
  config: DeviceConfig,
  preferences: UserPreferences,
): void {
  const root = document.documentElement;
  if (!root) return;

  const enabled = config.enabled && config.consentVersion >= 1;
  const compact = window.innerWidth < 768;
  root.dataset.rfRoute = route.kind;
  root.dataset.rfTheme = preferences.theme;
  root.dataset.rfViewport = compact ? 'compact' : 'desktop';

  if (enabled) root.dataset.rfEnabled = 'true';
  else delete root.dataset.rfEnabled;

  const homeDashboardEnabled = enabled
    && route.kind === 'home'
    && preferences.home.destination === 'dashboard'
    && !compact
    && !config.killSwitches.homeDashboard;
  if (homeDashboardEnabled) root.dataset.rfHomeMode = 'dashboard';
  else {
    delete root.dataset.rfHomeMode;
    delete root.dataset.rfHomeReady;
  }

  if (enabled && route.kind === 'watch' && preferences.watch.focusMode && !config.killSwitches.watchControls) root.dataset.rfFocus = 'true';
  else delete root.dataset.rfFocus;
  if (enabled && route.kind === 'watch' && preferences.watch.collapseComments && !config.killSwitches.watchControls) root.dataset.rfComments = 'collapsed';
  else delete root.dataset.rfComments;
  if (enabled && route.kind === 'watch' && preferences.watch.collapseDescription && !config.killSwitches.watchControls) root.dataset.rfDescription = 'collapsed';
  else delete root.dataset.rfDescription;
  if (enabled && preferences.global.hideShortsSurfaces) root.dataset.rfHideShorts = 'true';
  else delete root.dataset.rfHideShorts;

  syncBootMirror(config, preferences ?? DEFAULT_PREFERENCES);
}
