<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import type { ExtensionState } from '@src/data/models';
  import { loadExtensionState, saveDeviceConfig, savePreferences } from '@src/data/storage';

  let state: ExtensionState | null = null;
  let error = '';
  let saving = false;

  async function refresh(): Promise<void> {
    try { state = await loadExtensionState(); error = ''; }
    catch { error = 'Extension storage is unavailable. Try reopening the popup.'; }
  }

  onMount(() => {
    let active = true;
    const listener = () => { if (active) void refresh(); };
    void refresh();
    browser.storage.onChanged.addListener(listener);
    return () => { active = false; browser.storage.onChanged.removeListener(listener); };
  });

  async function toggleEnabled(): Promise<void> {
    if (!state) return;
    if (state.deviceConfig.consentVersion < 1) { await browser.runtime.openOptionsPage(); return; }
    saving = true;
    try {
      await saveDeviceConfig({ enabled: !state.deviceConfig.enabled });
      await refresh();
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not update Reframe.'; }
    finally { saving = false; }
  }

  async function setFocus(value: boolean): Promise<void> {
    if (!state || state.deviceConfig.consentVersion < 1) { await browser.runtime.openOptionsPage(); return; }
    try {
      await savePreferences({ watch: { ...state.preferences.watch, focusMode: value } });
      await refresh();
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not update Focus Mode.'; }
  }

  async function setHideShorts(value: boolean): Promise<void> {
    if (!state || state.deviceConfig.consentVersion < 1) { await browser.runtime.openOptionsPage(); return; }
    try {
      await savePreferences({ global: { hideShortsSurfaces: value } });
      await refresh();
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not update this preference.'; }
  }

  function openSettings(): void { void browser.runtime.openOptionsPage(); }
</script>

<svelte:head><title>Reframe</title></svelte:head>
<main class="popup" aria-label="Reframe quick settings">
  <header>
    <span class="mark" aria-hidden="true">R</span>
    <div><strong>reframe</strong><small>your YouTube, intentionally</small></div>
    <button class="settings" type="button" aria-label="Open settings" on:click={openSettings}>⚙</button>
  </header>

  {#if state}
    <section class="status-card" class:enabled={state.deviceConfig.enabled}>
      <div><span class="dot"></span><strong>{state.deviceConfig.enabled ? 'Reframe is on' : 'Original YouTube is on'}</strong></div>
      <p>{state.deviceConfig.enabled ? 'Your personal streaming shelf is active.' : 'Your YouTube experience is currently untouched.'}</p>
      <button class="primary" type="button" disabled={saving} on:click={toggleEnabled}>
        {state.deviceConfig.consentVersion < 1 ? 'Set up Reframe' : state.deviceConfig.enabled ? 'Switch to Original Mode' : 'Enable Reframe'}
      </button>
    </section>

    {#if state.deviceConfig.consentVersion >= 1}
      <section class="quick-toggles" aria-label="Quick preferences">
        <label><span><strong>Focus Mode</strong><small>Hide watch-page distractions</small></span><input type="checkbox" checked={state.preferences.watch.focusMode} on:change={(event) => setFocus(event.currentTarget.checked)} /></label>
        <label><span><strong>Hide Shorts shelves</strong><small>Only on Home, Subscriptions, and Search</small></span><input type="checkbox" checked={state.preferences.global.hideShortsSurfaces} on:change={(event) => setHideShorts(event.currentTarget.checked)} /></label>
      </section>
    {:else}
      <p class="setup-note">Choose your privacy mode in the setup screen. Progress and feed caching are always optional.</p>
    {/if}
    {#if state.deviceConfig.enabled && !state.deviceConfig.privacy.trackProgress}
      <p class="privacy-note">Local progress tracking is off. You can enable it in settings at any time.</p>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {:else}
    <div class="loading" aria-live="polite">Loading your settings…</div>
  {/if}
  <footer><span>Personal data stays in this browser profile.</span><button type="button" on:click={openSettings}>Full settings →</button></footer>
</main>

<style>
  :global(html), :global(body) { margin: 0; width: 360px; min-width: 360px; background: #0a0c10; }
  :global(body) { color: #f2f4f8; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .popup { padding: 17px; background: #0a0c10; }
  header { display: flex; align-items: center; gap: 10px; margin-block-end: 15px; }
  .mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; color: #1b0b08; background: #ff684a; font-weight: 950; font-size: 18px; }
  header div { display: grid; gap: 1px; flex: 1; }
  header strong { font-size: 16px; letter-spacing: -.04em; }
  header small { color: #9aa3b2; font-size: 9px; }
  button, input { font: inherit; }
  button { cursor: pointer; }
  .settings { border: 1px solid rgba(255,255,255,.1); border-radius: 9px; padding: 7px 9px; color: #dbe0e8; background: #151a22; }
  .status-card { padding: 15px; border: 1px solid rgba(255,255,255,.09); border-radius: 14px; background: linear-gradient(120deg,#171c24,#10141a); }
  .status-card > div { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #798493; }
  .enabled .dot { background: #42d6c4; box-shadow: 0 0 9px #42d6c477; }
  .status-card p { margin: 7px 0 13px; color: #a8b0bf; font-size: 10px; }
  .primary { width: 100%; padding: 10px; border: 0; border-radius: 9px; color: #190a07; background: #ff684a; font-size: 10px; font-weight: 850; }
  .primary:disabled { opacity: .6; cursor: wait; }
  .quick-toggles { margin-block-start: 12px; padding: 2px 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #11151b; }
  .quick-toggles label { min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-block-end: 1px solid rgba(255,255,255,.06); cursor: pointer; }
  .quick-toggles label:last-child { border: 0; }
  .quick-toggles label span { display: grid; gap: 2px; }
  .quick-toggles strong { font-size: 10px; }
  .quick-toggles small { color: #9aa3b2; font-size: 9px; }
  input[type=checkbox] { width: 16px; height: 16px; accent-color: #ff684a; }
  .setup-note, .privacy-note { color: #a8b0bf; font-size: 10px; line-height: 1.5; }
  .error { color: #ff9e89; font-size: 10px; }
  .loading { padding: 20px 0; color: #a8b0bf; font-size: 11px; }
  footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-block-start: 14px; color: #7f8998; font-size: 8px; }
  footer button { border: 0; color: #bbc4d0; background: none; font-size: 9px; }
</style>
