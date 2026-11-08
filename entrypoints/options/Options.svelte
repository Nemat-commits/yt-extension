<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import type { ExtensionState, UserPreferences } from '@src/data/models';
  import {
    clearAllReframeData,
    exportCollectionBackup,
    importCollections,
    loadExtensionState,
    saveDeviceConfig,
    savePreferences,
    writeFeatureHealth,
  } from '@src/data/storage';
  import { MAX_IMPORT_BYTES } from '@src/data/validation';
  import type { UserPreferencesPatch } from '@src/data/storage';

  let state: ExtensionState | null = null;
  let importInput: HTMLInputElement | undefined;
  let error = '';
  let notice = '';
  let busy = false;

  async function refresh(): Promise<void> {
    try { state = await loadExtensionState(); error = ''; }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not read extension storage.'; }
  }

  onMount(() => {
    let active = true;
    const listener = () => { if (active) void refresh(); };
    void refresh();
    browser.storage.onChanged.addListener(listener);
    return () => { active = false; browser.storage.onChanged.removeListener(listener); };
  });

  async function chooseMode(mode: 'recommended' | 'light'): Promise<void> {
    busy = true;
    error = '';
    try {
      await saveDeviceConfig({
        consentVersion: 1,
        enabled: true,
        privacy: {
          trackProgress: mode === 'recommended',
          cacheFeeds: mode === 'recommended',
          diagnostics: false,
        },
      });
      if (mode === 'recommended') await savePreferences({ home: { destination: 'dashboard' } });
      notice = mode === 'recommended'
        ? 'Reframe is enabled with local progress and subscription caching.'
        : 'Reframe is enabled in theme-only mode. Progress and caching remain off.';
      await refresh();
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not save your setup.'; }
    finally { busy = false; }
  }

  async function toggleEnabled(value: boolean): Promise<void> {
    if (!state) return;
    try { await saveDeviceConfig({ enabled: value }); await refresh(); notice = value ? 'Reframe enabled.' : 'Original Mode enabled. Native YouTube is restored.'; }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not update Reframe.'; }
  }

  async function setPrivacy(key: 'trackProgress' | 'cacheFeeds' | 'diagnostics', value: boolean): Promise<void> {
    if (!state) return;
    try { await saveDeviceConfig({ privacy: { ...state.deviceConfig.privacy, [key]: value } }); await refresh(); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not save privacy settings.'; }
  }

  async function setKillSwitch(key: string, disabled: boolean): Promise<void> {
    if (!state) return;
    try { await saveDeviceConfig({ killSwitches: { ...state.deviceConfig.killSwitches, [key]: disabled } }); await refresh(); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not update this feature.'; }
  }

  async function updatePreferences(patch: UserPreferencesPatch): Promise<void> {
    try { await savePreferences(patch); await refresh(); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Could not save preferences.'; }
  }

  async function setWatch(key: 'focusMode' | 'collapseComments' | 'collapseDescription', value: boolean): Promise<void> {
    if (!state) return;
    await updatePreferences({ watch: { ...state.preferences.watch, [key]: value } });
  }

  async function setTheme(value: string): Promise<void> {
    await updatePreferences({ theme: value === 'system' ? 'system' : 'midnight' });
  }

  async function setDensity(value: string): Promise<void> {
    await updatePreferences({ density: value === 'compact' ? 'compact' : 'comfortable' });
  }

  async function setHomeDestination(value: string): Promise<void> {
    if (!state) return;
    const destination = value === 'subscriptions' || value === 'original' ? value : 'dashboard';
    await updatePreferences({ home: { ...state.preferences.home, destination } });
  }

  async function downloadBackup(): Promise<void> {
    const json = await exportCollectionBackup();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reframe-collections-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notice = 'Collection backup downloaded.';
  }

  async function importBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { error = 'Import files must be 2 MB or smaller.'; input.value = ''; return; }
    busy = true;
    try {
      const count = await importCollections(await file.text(), true);
      await refresh();
      notice = `Imported ${count} collection${count === 1 ? '' : 's'} and merged them with existing lists.`;
      error = '';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Import failed.'; }
    finally { busy = false; input.value = ''; }
  }

  async function clearEverything(): Promise<void> {
    if (!window.confirm('Delete all Reframe settings, collections, snapshots, and saved progress from this browser profile? This cannot be undone.')) return;
    busy = true;
    try {
      await clearAllReframeData();
      await refresh();
      notice = 'All Reframe data was cleared. Reframe is now in Original Mode.';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Could not clear Reframe data.'; }
    finally { busy = false; }
  }

  async function resetAdapterHealth(): Promise<void> {
    await writeFeatureHealth({ failures: {}, disabled: {}, updatedAt: Date.now() });
    await refresh();
    notice = 'Session adapter health was reset.';
  }

  function formatBytes(value: number | null): string {
    if (value === null) return 'Not available';
    if (value < 1024) return `${value} bytes`;
    return `${(value / 1024).toFixed(1)} KB`;
  }
</script>

<svelte:head><title>Reframe settings</title></svelte:head>
<main class="page">
  <header class="hero-header">
    <a class="brand" href="https://www.youtube.com/" target="_blank" rel="noreferrer"><span class="mark">R</span><span><strong>reframe</strong><small>your YouTube, intentionally</small></span></a>
    <span class="version">VERSION 0.1.0 · LOCAL-FIRST</span>
  </header>

  {#if state?.deviceConfig.consentVersion === 0}
    <section class="onboarding panel">
      <span class="eyebrow">WELCOME TO REFRAME</span>
      <h1>A calmer way to watch.</h1>
      <p class="lead">Reframe redesigns the space around YouTube’s native player. Playback, your sign-in, ads, captions, and all YouTube controls stay native.</p>
      <div class="promise-grid">
        <article><span>01</span><strong>Your data stays here</strong><p>Collections, snapshots, and watch progress stay in this browser profile. Nothing is sent to Reframe.</p></article>
        <article><span>02</span><strong>Always reversible</strong><p>Use Original Mode in the popup or on YouTube to restore the native interface instantly.</p></article>
        <article><span>03</span><strong>Visible pages only</strong><p>Feed capture reads cards already shown on your Subscriptions page. No background scraping or API calls.</p></article>
      </div>
      <div class="choice-row">
        <button class="primary" type="button" disabled={busy} on:click={() => chooseMode('recommended')}>Enable Reframe<br /><small>Includes optional local progress &amp; subscription caching</small></button>
        <button class="secondary" type="button" disabled={busy} on:click={() => chooseMode('light')}>Theme &amp; Focus only<br /><small>No progress tracking or feed caching</small></button>
      </div>
      <p class="legal">Reframe is an independent browser extension and is not affiliated with YouTube or Google. You can change every choice below.</p>
    </section>
  {:else if state}
    <div class="page-title"><div><span class="eyebrow">YOUR EXPERIENCE</span><h1>Settings</h1><p>Change your setup at any time. Your choices apply to open YouTube tabs.</p></div><button class:active={state.deviceConfig.enabled} class="master" type="button" on:click={() => state && toggleEnabled(!state.deviceConfig.enabled)}><span class="master-dot"></span>{state.deviceConfig.enabled ? 'Reframe is on' : 'Original Mode is on'}</button></div>

    <div class="layout">
      <div class="main-column">
        <section class="panel">
          <div class="panel-heading"><div><span class="eyebrow">VISUAL EXPERIENCE</span><h2>Make it yours</h2></div><span class="pill">SYNCED PREFERENCES</span></div>
          <div class="setting-row"><div><strong>Theme</strong><small>Midnight keeps YouTube’s surroundings dark; the native player is untouched.</small></div><select value={state.preferences.theme} on:change={(event) => setTheme(event.currentTarget.value)}><option value="midnight">Midnight</option><option value="system">Follow system</option></select></div>
          <div class="setting-row"><div><strong>Home destination</strong><small>Choose what opens at youtube.com.</small></div><select value={state.preferences.home.destination} on:change={(event) => setHomeDestination(event.currentTarget.value)}><option value="dashboard">Reframe dashboard</option><option value="subscriptions">Subscriptions feed</option><option value="original">Keep native Home</option></select></div>
          <div class="setting-row"><div><strong>Density</strong><small>Comfortable or compact spacing for Reframe surfaces.</small></div><select value={state.preferences.density} on:change={(event) => setDensity(event.currentTarget.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
          <div class="setting-row"><div><strong>Focus Mode by default</strong><small>Hide related videos and comments while watching.</small></div><input type="checkbox" checked={state.preferences.watch.focusMode} on:change={(event) => setWatch('focusMode', event.currentTarget.checked)} /></div>
          <div class="setting-row"><div><strong>Collapse comments by default</strong><small>Keep the comments section in the page, but out of the way.</small></div><input type="checkbox" checked={state.preferences.watch.collapseComments} on:change={(event) => setWatch('collapseComments', event.currentTarget.checked)} /></div>
          <div class="setting-row"><div><strong>Collapse descriptions by default</strong><small>Reveal the full description with YouTube’s native controls.</small></div><input type="checkbox" checked={state.preferences.watch.collapseDescription} on:change={(event) => setWatch('collapseDescription', event.currentTarget.checked)} /></div>
          <div class="setting-row last"><div><strong>Hide Shorts shelves</strong><small>Only hides shelves on Home, Subscriptions, and Search. Direct Shorts URLs still work.</small></div><input type="checkbox" checked={state.preferences.global.hideShortsSurfaces} on:change={(event) => updatePreferences({ global: { hideShortsSurfaces: event.currentTarget.checked } })} /></div>
        </section>

        <section class="panel">
          <div class="panel-heading"><div><span class="eyebrow">DEVICE ONLY · OPTIONAL</span><h2>Privacy &amp; local data</h2></div><span class="pill local">NEVER SYNCED</span></div>
          <div class="setting-row"><div><strong>Continue Watching</strong><small>Save progress for eligible videos on this device. Ads, live streams, and clips under two minutes are excluded; completed videos are removed at 95%.</small></div><input type="checkbox" checked={state.deviceConfig.privacy.trackProgress} on:change={(event) => setPrivacy('trackProgress', event.currentTarget.checked)} /></div>
          <div class="setting-row"><div><strong>Cache visible Subscriptions cards</strong><small>Keep up to 100 video cards you have already opened on the Subscriptions page. Expires after 24 hours.</small></div><input type="checkbox" checked={state.deviceConfig.privacy.cacheFeeds} on:change={(event) => setPrivacy('cacheFeeds', event.currentTarget.checked)} /></div>
          <div class="setting-row last"><div><strong>Anonymous diagnostics</strong><small>Currently unused. Reframe does not transmit telemetry; enabling this reserves the setting for future explicit opt-in only.</small></div><input type="checkbox" checked={state.deviceConfig.privacy.diagnostics} on:change={(event) => setPrivacy('diagnostics', event.currentTarget.checked)} /></div>
          <div class="storage-summary"><span>Local extension storage</span><strong>{formatBytes(state.storageBytes)}</strong><span>{state.collections.length} collections · {state.resumeStates.length} progress items · {state.feedSnapshots.reduce((sum, feed) => sum + feed.items.length, 0)} cached feed items</span></div>
        </section>

        <section class="panel">
          <div class="panel-heading"><div><span class="eyebrow">FEATURE GUARDRAILS</span><h2>Independent switches</h2></div><span class="pill local">DEVICE ONLY</span></div>
          <p class="panel-copy">Turn off one Reframe surface without disabling the rest. Privacy opt-ins above still control whether local progress or feed data is stored.</p>
          <div class="setting-row"><div><strong>Home dashboard</strong><small>Replace the native Home feed with your Reframe shelves.</small></div><input type="checkbox" checked={!state.deviceConfig.killSwitches.homeDashboard} on:change={(event) => setKillSwitch('homeDashboard', !event.currentTarget.checked)} /></div>
          <div class="setting-row"><div><strong>Subscriptions adapter</strong><small>Capture cards that are already visible on the Subscriptions page.</small></div><input type="checkbox" checked={!state.deviceConfig.killSwitches.subscriptionsAdapter} on:change={(event) => setKillSwitch('subscriptionsAdapter', !event.currentTarget.checked)} /></div>
          <div class="setting-row"><div><strong>Progress tracker</strong><small>Apply ad-aware local progress tracking when the privacy switch is on.</small></div><input type="checkbox" checked={!state.deviceConfig.killSwitches.progressTracker} on:change={(event) => setKillSwitch('progressTracker', !event.currentTarget.checked)} /></div>
          <div class="setting-row"><div><strong>Collections workspace</strong><small>Show Reframe Collections on /feed/you and /feed/library.</small></div><input type="checkbox" checked={!state.deviceConfig.killSwitches.collections} on:change={(event) => setKillSwitch('collections', !event.currentTarget.checked)} /></div>
          <div class="setting-row last"><div><strong>Watch controls</strong><small>Show Focus Mode, collapsible sections, and quick-save controls.</small></div><input type="checkbox" checked={!state.deviceConfig.killSwitches.watchControls} on:change={(event) => setKillSwitch('watchControls', !event.currentTarget.checked)} /></div>
        </section>

        <section class="panel">
          <div class="panel-heading"><div><span class="eyebrow">YOUR COLLECTIONS</span><h2>Backup &amp; restore</h2></div><span class="pill local">DEVICE ONLY</span></div>
          <p class="panel-copy">Export a portable JSON backup, or import and merge one. Imports are limited to 2 MB and video IDs are validated before storage.</p>
          <div class="action-row">
            <button class="secondary" type="button" on:click={downloadBackup}>Export collections</button>
            <button class="secondary" type="button" disabled={busy} on:click={() => importInput?.click()}>Import &amp; merge</button>
            <input bind:this={importInput} class="file-input" type="file" accept="application/json,.json" on:change={importBackup} />
          </div>
          <p class="hint">Collections are never synced. For a durable backup, download the JSON file to a location you control.</p>
        </section>
      </div>

      <aside class="side-column">
        <section class="panel escape-panel"><span class="eyebrow">THE ESCAPE HATCH</span><h2>Original Mode</h2><p>Restore native YouTube immediately—no reload, no loss of playback. Your local collections remain saved.</p><button class="secondary full" type="button" on:click={() => toggleEnabled(false)}>Switch to Original Mode</button></section>
        <section class="panel health-panel"><span class="eyebrow">RUNTIME HEALTH</span><h2>Adapters</h2>{#if Object.keys(state.featureHealth.disabled).length}<p class="warning">A DOM adapter paused after repeated selector failures. Native YouTube is still available.</p>{:else}<p class="panel-copy">Page adapters are active only on their matching route. If YouTube changes its markup, Reframe falls back without touching playback.</p>{/if}<button class="text-button" type="button" on:click={resetAdapterHealth}>Reset session health</button></section>
        <section class="panel danger-panel"><span class="eyebrow">YOUR DATA, YOUR CHOICE</span><h2>Clear everything</h2><p>Deletes extension settings, local collections, saved progress, cached feeds, and session health from this browser profile.</p><button class="danger-button" type="button" disabled={busy} on:click={clearEverything}>Clear all Reframe data</button></section>
        <p class="fine-print">Local data is shared across YouTube accounts used in this browser profile. Reframe does not access cookies, account tokens, or private API endpoints.</p>
      </aside>
    </div>
  {:else}
    <section class="panel loading">Loading Reframe settings…</section>
  {/if}

  {#if notice}<div class="toast" role="status">{notice}</div>{/if}
  {#if error}<div class="error-toast" role="alert">{error}</div>{/if}
  <footer>RE-FRAME · PRIVATE BY DESIGN <span>Independent software. Not affiliated with YouTube or Google.</span></footer>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; background: #090b0f; }
  :global(body) { margin: 0; color: #f2f4f8; background: #090b0f; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .page { min-height: 100vh; max-width: 1280px; margin: 0 auto; padding: 0 clamp(18px, 5vw, 70px) 22px; }
  button, select, input { font: inherit; }
  button { cursor: pointer; }
  .hero-header { min-height: 76px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.07); }
  .brand { display: flex; align-items: center; gap: 10px; color: #f2f4f8; text-decoration: none; }
  .mark { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 11px; color: #170a07; background: #ff684a; font-size: 18px; font-weight: 950; }
  .brand > span:last-child { display: grid; gap: 1px; }
  .brand strong { font-size: 17px; letter-spacing: -.05em; }
  .brand small, .version { color: #919baa; font-size: 9px; }
  .version { letter-spacing: .12em; }
  .onboarding { margin: 44px auto; max-width: 900px; padding: clamp(24px,5vw,52px); background: radial-gradient(ellipse at 0 0, rgba(255,104,74,.14), transparent 42%), #11151c; }
  .eyebrow { color: #ff8066; font-size: 9px; font-weight: 850; letter-spacing: .16em; }
  h1 { margin: 7px 0 8px; font-size: clamp(30px, 5vw, 48px); letter-spacing: -.055em; }
  .lead { max-width: 680px; color: #a8b0bf; line-height: 1.7; font-size: 13px; }
  .promise-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-block: 27px; }
  .promise-grid article { padding: 15px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #141922; }
  .promise-grid article span { color: #ff8066; font-size: 9px; font-weight: 800; }
  .promise-grid strong { display: block; margin-block: 9px 4px; font-size: 12px; }
  .promise-grid p, .legal { margin: 0; color: #a8b0bf; font-size: 10px; line-height: 1.6; }
  .choice-row { display: flex; gap: 10px; }
  .primary, .secondary { border: 0; border-radius: 10px; padding: 12px 16px; font-size: 11px; font-weight: 800; }
  .primary { color: #180b08; background: #ff684a; }
  .secondary { color: #f2f4f8; border: 1px solid rgba(255,255,255,.12); background: #1b212b; }
  .primary small, .secondary small { display: inline-block; margin-block-start: 4px; font-size: 9px; font-weight: 500; opacity: .78; }
  .primary:disabled, .secondary:disabled { opacity: .55; }
  .legal { margin-block-start: 18px; }
  .page-title { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding-block: 35px 23px; }
  .page-title h1 { margin: 5px 0; font-size: 34px; }
  .page-title p { margin: 0; color: #a8b0bf; font-size: 11px; }
  .master { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; color: #bdc6d3; background: #12161d; font-size: 10px; }
  .master.active { color: #eef5f4; border-color: rgba(66,214,196,.35); }
  .master-dot { width: 7px; height: 7px; border-radius: 50%; background: #7c8795; }
  .active .master-dot { background: #42d6c4; box-shadow: 0 0 8px #42d6c477; }
  .layout { display: grid; grid-template-columns: minmax(0,1fr) 280px; align-items: start; gap: 14px; }
  .main-column, .side-column { display: grid; gap: 14px; }
  .panel { padding: 20px; border: 1px solid rgba(255,255,255,.08); border-radius: 15px; background: #11151b; }
  .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-block-end: 4px; }
  .panel h2 { margin: 3px 0; font-size: 17px; letter-spacing: -.035em; }
  .pill { padding: 5px 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 20px; color: #a8b0bf; font-size: 7px; letter-spacing: .1em; font-weight: 800; }
  .pill.local { color: #42d6c4; border-color: rgba(66,214,196,.24); }
  .setting-row { min-height: 60px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-block: 11px; border-block-end: 1px solid rgba(255,255,255,.06); }
  .setting-row > div { display: grid; gap: 3px; }
  .setting-row strong { color: #eef1f5; font-size: 11px; }
  .setting-row small { max-width: 610px; color: #9ba5b3; line-height: 1.5; font-size: 9px; }
  .setting-row select { min-width: 155px; padding: 8px 9px; color: #edf0f4; background: #0c1015; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; font-size: 9px; }
  input[type=checkbox] { flex: none; width: 17px; height: 17px; accent-color: #ff684a; cursor: pointer; }
  .setting-row.last { border: 0; }
  .storage-summary { display: grid; grid-template-columns: 1fr auto; gap: 5px 10px; margin-block-start: 14px; padding: 12px; border-radius: 9px; background: #0c1015; color: #a8b0bf; font-size: 9px; }
  .storage-summary strong { color: #f2f4f8; }
  .storage-summary span:last-child { grid-column: 1 / -1; color: #818b99; }
  .panel-copy, .hint { color: #a8b0bf; font-size: 10px; line-height: 1.6; }
  .action-row { display: flex; gap: 8px; }
  .hint { margin-block-end: 0; color: #7f8998; font-size: 9px; }
  .file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .escape-panel { background: radial-gradient(ellipse at top left, rgba(255,104,74,.13), transparent 65%), #11151b; }
  .escape-panel p, .danger-panel p, .fine-print { color: #9ba5b3; font-size: 10px; line-height: 1.6; }
  .full { width: 100%; }
  .health-panel { padding-block: 18px; }
  .health-panel .text-button { margin-block-start: 8px; }
  .warning { color: #fbbf24; font-size: 10px; line-height: 1.5; }
  .text-button { padding: 0; border: 0; color: #c1cad6; background: transparent; font-size: 9px; text-decoration: underline; text-underline-offset: 3px; }
  .danger-button { padding: 9px 10px; border: 1px solid rgba(244,63,94,.4); border-radius: 8px; color: #ff9eac; background: rgba(244,63,94,.08); font-size: 9px; font-weight: 700; }
  .danger-button:hover { background: rgba(244,63,94,.15); }
  .fine-print { margin: 0; color: #737e8d; font-size: 9px; }
  .loading { margin-block-start: 24px; color: #a8b0bf; }
  footer { display: flex; justify-content: space-between; gap: 10px; padding-block: 25px 8px; color: #7f8998; font-size: 8px; letter-spacing: .13em; }
  footer span { letter-spacing: 0; }
  .toast, .error-toast { position: fixed; z-index: 10; right: 20px; bottom: 20px; max-width: min(420px, calc(100vw - 40px)); padding: 12px 16px; border-radius: 9px; color: #08110f; background: #42d6c4; box-shadow: 0 10px 38px rgba(0,0,0,.4); font-size: 10px; font-weight: 800; }
  .error-toast { color: #fff0ed; background: #9d3c32; }
  @media(max-width: 850px) { .layout { grid-template-columns: 1fr; } .side-column { grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); } .fine-print { grid-column: 1/-1; } }
  @media(max-width: 600px) { .promise-grid { grid-template-columns: 1fr; } .choice-row, .action-row { flex-direction: column; } .page-title { align-items: flex-start; flex-direction: column; } .panel { padding: 15px; } .setting-row { gap: 10px; } .setting-row select { min-width: 120px; } footer { flex-direction: column; } .version { font-size: 7px; } }
</style>
