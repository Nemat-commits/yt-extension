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
  :global(*) { box-sizing: border-box; }
  :global(html), :global(body) { margin: 0; width: 380px; min-width: 360px; min-height: 100%; color-scheme: dark; background: #090b12; }
  :global(body) { color: #f5f6fa; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  button, input { font: inherit; }
  button { cursor: pointer; }
  .popup { min-height: 100vh; position: relative; overflow: hidden; padding: 19px; background: radial-gradient(ellipse at 8% -4%,rgba(255,118,95,.2),transparent 47%),radial-gradient(ellipse at 100% 34%,rgba(107,128,255,.12),transparent 44%),linear-gradient(155deg,#0d1019,#090b12 68%); }
  .popup::before { width: 200px; height: 200px; position: absolute; right: -110px; bottom: -115px; border-radius: 50%; content: ""; background: rgba(255,118,95,.13); filter: blur(38px); pointer-events: none; }
  .popup > * { position: relative; }
  header { display: flex; align-items: center; gap: 11px; margin-block-end: 17px; }
  .mark { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.42); border-radius: 13px; color: #24100c; background: linear-gradient(145deg,#ffd093,#ff9271 55%,#f36361); box-shadow: 0 8px 22px rgba(255,112,91,.23),inset 0 1px 0 rgba(255,255,255,.65); font-weight: 950; font-size: 19px; letter-spacing: -.08em; }
  header div { display: grid; gap: 1px; flex: 1; }
  header strong { font-size: 17px; letter-spacing: -.06em; }
  header small { color: #9ea8ba; font-size: 9px; }
  .settings { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.13); border-radius: 11px; color: #dce1ea; background: rgba(255,255,255,.055); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); transition: border-color 150ms ease,background 150ms ease,transform 150ms ease; }
  .settings:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.24); background: rgba(255,255,255,.1); }
  .status-card { position: relative; overflow: hidden; padding: 16px; border: 1px solid rgba(255,255,255,.13); border-radius: 18px; background: linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035)); box-shadow: 0 16px 38px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.1); -webkit-backdrop-filter: blur(20px) saturate(135%); backdrop-filter: blur(20px) saturate(135%); }
  .status-card::before { width: 130px; height: 130px; position: absolute; right: -75px; top: -90px; border-radius: 50%; content: ""; background: rgba(255,255,255,.06); filter: blur(18px); }
  .status-card > div { position: relative; display: flex; align-items: center; gap: 9px; font-size: 11px; }
  .dot { width: 8px; height: 8px; position: relative; border-radius: 50%; background: #798493; box-shadow: 0 0 0 4px rgba(121,132,147,.1); }
  .enabled .dot { background: #8be4d3; box-shadow: 0 0 0 4px rgba(139,228,211,.1),0 0 15px rgba(139,228,211,.6); }
  .status-card p { position: relative; margin: 8px 0 15px 17px; color: #aab4c4; font-size: 9px; line-height: 1.55; }
  .primary { width: 100%; min-height: 39px; border: 1px solid rgba(255,255,255,.33); border-radius: 999px; color: #24100c; background: linear-gradient(135deg,#ffd093,#ff9572 56%,#ff725f); box-shadow: 0 7px 20px rgba(255,118,95,.2),inset 0 1px 0 rgba(255,255,255,.62); font-size: 9px; font-weight: 850; transition: transform 150ms ease,box-shadow 150ms ease,filter 150ms ease; }
  .primary:hover:not(:disabled) { transform: translateY(-1px); filter: saturate(1.08); box-shadow: 0 10px 25px rgba(255,118,95,.28),inset 0 1px 0 rgba(255,255,255,.65); }
  .primary:disabled { opacity: .6; cursor: wait; }
  .quick-toggles { margin-block-start: 11px; padding: 3px 12px; border: 1px solid rgba(255,255,255,.095); border-radius: 16px; background: rgba(255,255,255,.035); box-shadow: inset 0 1px 0 rgba(255,255,255,.05); }
  .quick-toggles label { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-block-end: 1px solid rgba(255,255,255,.06); cursor: pointer; }
  .quick-toggles label:last-child { border: 0; }
  .quick-toggles label span { display: grid; gap: 3px; }
  .quick-toggles strong { font-size: 9px; }
  .quick-toggles small { color: #939eb0; font-size: 8px; }
  input[type=checkbox] { appearance: none; width: 36px; height: 21px; position: relative; flex: none; margin: 0; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; background: rgba(255,255,255,.09); box-shadow: inset 0 2px 4px rgba(0,0,0,.22); cursor: pointer; transition: background 170ms ease,border-color 170ms ease,box-shadow 170ms ease; }
  input[type=checkbox]::before { width: 13px; height: 13px; position: absolute; left: 3px; top: 3px; border-radius: 50%; content: ""; background: #a6afbf; box-shadow: 0 1px 3px rgba(0,0,0,.24); transition: transform 170ms cubic-bezier(.2,.8,.2,1),background 170ms ease; }
  input[type=checkbox]:checked { border-color: rgba(255,157,131,.68); background: linear-gradient(100deg,#ff9d7d,#ff6e5d); box-shadow: 0 0 14px rgba(255,118,95,.15),inset 0 1px 0 rgba(255,255,255,.18); }
  input[type=checkbox]:checked::before { transform: translateX(15px); background: #fff7f1; }
  input[type=checkbox]:focus-visible { outline: 2px solid #ffd093; outline-offset: 3px; }
  .setup-note, .privacy-note { margin: 12px 2px 0; color: #a8b2c3; font-size: 9px; line-height: 1.6; }
  .privacy-note { color: #8bd9ca; }
  .error { margin: 10px 0 0; padding: 9px 10px; border: 1px solid rgba(255,127,119,.25); border-radius: 11px; color: #ffc1b7; background: rgba(155,60,50,.17); font-size: 9px; line-height: 1.5; }
  .loading { padding: 22px 0; color: #a8b0bf; font-size: 10px; }
  footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-block-start: 14px; color: #798497; font-size: 7px; }
  footer button { border: 0; color: #c8cfda; background: none; font-size: 8px; font-weight: 700; text-decoration: underline; text-decoration-color: rgba(200,207,218,.32); text-underline-offset: 3px; }
  footer button:hover { color: white; }
  @media (prefers-reduced-motion: reduce) { *,*::before,*::after { transition-duration: .01ms !important; animation-duration: .01ms !important; } }

</style>
