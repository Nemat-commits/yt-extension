import { browser } from 'wxt/browser';
import { DEFAULT_DEVICE_CONFIG } from '@src/data/models';
import { pruneExpiredSnapshotsAndProgress } from '@src/data/cache';

export default defineBackground(() => {
  const unlockSessionStorage = async (): Promise<void> => {
    try {
      const session = browser.storage.session;
      if (session?.setAccessLevel) {
        await session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
      }
    } catch {
      // Session storage is an optimization for per-session circuit-breaker state, never a boot dependency.
    }
  };

  const initializeDefaults = async (): Promise<void> => {
    const current = await browser.storage.local.get('deviceConfig');
    if (!current.deviceConfig) {
      await browser.storage.local.set({ deviceConfig: DEFAULT_DEVICE_CONFIG });
    }
  };

  void unlockSessionStorage();

  browser.runtime.onStartup.addListener(() => {
    void unlockSessionStorage();
    void pruneExpiredSnapshotsAndProgress();
  });

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await unlockSessionStorage();
    await initializeDefaults();
    await pruneExpiredSnapshotsAndProgress();
    if (reason === 'install') await browser.runtime.openOptionsPage();
  });
});
