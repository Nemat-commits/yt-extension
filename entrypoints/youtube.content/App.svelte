<script lang="ts">
  import type { Readable } from 'svelte/store';
  import { VIDEO_ID_RE, type Collection, type ResumeState, type VideoMeta } from '@src/data/models';
  import { makeVideoMeta } from '@src/data/validation';
  import type { ContentActions, ContentState } from '@src/ui/types';
  import MediaRail from '@src/ui/MediaRail.svelte';
  import LibraryWorkspace from '@src/ui/LibraryWorkspace.svelte';
  import FocusControls from '@src/ui/FocusControls.svelte';
  import SubscriptionsStatus from '@src/ui/SubscriptionsStatus.svelte';

  export let appState: Readable<ContentState>;
  export let actions: ContentActions;

  let state: ContentState;
  let saveTarget: VideoMeta | null = null;
  let toast = '';
  let showShortcuts = false;
  $: state = $appState;
  $: route = state.route;
  $: enabled = state.deviceConfig.enabled && state.deviceConfig.consentVersion >= 1;
  $: snapshot = state.feedSnapshots.find((feed) => feed.id === 'subscriptions') ?? null;
  $: subscriptionItems = snapshot?.items ?? [];
  $: continueItems = state.resumeStates.map((item: ResumeState) => item.video);
  $: progress = Object.fromEntries(state.resumeStates.map((item) => [item.video.id, item.percent]));
  $: heroVideo = findHeroVideo(state.preferences.home.pinnedVideoId, state.resumeStates, subscriptionItems, state.collections);

  function findHeroVideo(pinnedId: string | undefined, resumes: ResumeState[], subscriptions: VideoMeta[], collections: Collection[]): VideoMeta | null {
    if (pinnedId) {
      const pinned = [...resumes.map((item) => item.video), ...subscriptions, ...collections.flatMap((item) => item.videos)].find((video) => video.id === pinnedId);
      if (pinned) return pinned;
      if (VIDEO_ID_RE.test(pinnedId)) return makeVideoMeta(pinnedId);
    }
    return resumes[0]?.video ?? subscriptions[0] ?? null;
  }

  function saveToCollection(collectionId: string): void {
    if (!saveTarget) return;
    void actions.addVideoToCollection(collectionId, saveTarget).then(() => {
      saveTarget = null;
      toast = 'Saved to your collection';
      setTimeout(() => toast = '', 2200);
    }).catch((error) => {
      toast = error instanceof Error ? error.message : 'Could not save video';
      setTimeout(() => toast = '', 3000);
    });
  }

  async function enableCacheAndOpen(event: MouseEvent): Promise<void> {
    event.preventDefault();
    await actions.enableFeedCache();
    actions.navigate(event, '/feed/subscriptions');
  }

  function handleModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') saveTarget = null;
  }

  function relativeTime(value: number | null): string {
    if (!value) return 'never';
    const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  }
</script>

<svelte:window on:keydown={handleModalKeydown} />

{#if enabled && (route.kind === 'home' || route.kind === 'library' || route.kind === 'watch' || route.kind === 'subscriptions')}
  <div class="rf-root" data-density={state.preferences.density} data-theme={state.preferences.theme} dir="auto">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Reframe home" on:click={(event) => actions.navigate(event, '/')}>
        <span class="brand-mark" aria-hidden="true">R</span>
        <span><strong>reframe</strong><small>your YouTube, intentionally</small></span>
      </a>
      <nav aria-label="Reframe navigation">
        <a class:current={route.kind === 'home'} href="/" on:click={(event) => actions.navigate(event, '/')}>Home</a>
        <a class:current={route.kind === 'subscriptions'} href="/feed/subscriptions" on:click={(event) => actions.navigate(event, '/feed/subscriptions')}>Subscriptions</a>
        <a class:current={route.kind === 'library'} href="/feed/you" on:click={(event) => actions.navigate(event, '/feed/you')}>Library</a>
      </nav>
      <div class="top-actions">
        <button class="settings-link" type="button" on:click={actions.openSettings}>Settings</button>
        <button class="original" type="button" on:click={() => actions.setEnabled(false)} title="Immediately restore native YouTube">Original Mode</button>
      </div>
    </header>

    {#if route.kind === 'home' && state.preferences.home.destination === 'dashboard' && !state.deviceConfig.killSwitches.homeDashboard}
      <main class="dashboard" aria-label="Reframe streaming dashboard">
        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow"><span class="live-dot"></span> A quieter place to start</span>
            {#if heroVideo}
              <h1>Your next good watch.</h1>
              <p class="hero-subtitle">A hand-picked starting point from your local viewing shelf — never a disguised recommendation feed.</p>
              <p class="hero-source">{state.preferences.home.pinnedVideoId === heroVideo.id ? 'PINNED BY YOU' : state.resumeStates.some((item) => item.video.id === heroVideo.id) ? 'CONTINUE WATCHING' : 'FROM YOUR SUBSCRIPTIONS'}</p>
              <h2 class="hero-title">{heroVideo.title}</h2>
              {#if heroVideo.channelTitle}<p class="hero-channel">{heroVideo.channelTitle}</p>{/if}
              <div class="hero-buttons">
                <a class="primary-button" href={heroVideo.url} on:click={(event) => actions.navigate(event, heroVideo.url)}>▶ <span>Watch now</span></a>
                <button class="secondary-button" type="button" on:click={() => saveTarget = heroVideo}>＋ <span>Save</span></button>
              </div>
            {:else}
              <h1>Make room for what you follow.</h1>
              <p class="hero-subtitle">A personal streaming shelf built only from the channels you chose and videos you saved.</p>
              {#if state.deviceConfig.privacy.cacheFeeds}
                <a class="primary-button" href="/feed/subscriptions" on:click={(event) => actions.navigate(event, '/feed/subscriptions')}>Explore subscriptions <span>→</span></a>
              {:else}
                <a class="primary-button" href="/feed/subscriptions" on:click={enableCacheAndOpen}>Capture subscriptions <span>→</span></a>
              {/if}
            {/if}
          </div>
          <div class="hero-art" aria-hidden="true">
            {#if heroVideo}
              <img src={heroVideo.thumbnailUrl} alt="" />
              <div class="art-gradient"></div>
              <span class="art-play">▶</span>
            {:else}
              <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div>
              <span class="art-star">✦</span>
            {/if}
            <span class="art-label">YOUR SPACE. YOUR PACE.</span>
          </div>
        </section>

        <div class="dashboard-meta"><span>LOCAL BY DESIGN</span><span>Nothing here is sent to Reframe or synced</span></div>

        {#if state.preferences.home.sections.includes('continue')}
          <section class="content-section">
            {#if state.deviceConfig.privacy.trackProgress}
              <MediaRail title="Continue watching" items={continueItems} {progress} onNavigate={actions.navigate} onSave={(video) => saveTarget = video} />
            {:else}
              <div class="activation-card">
                <div><span class="activation-icon" aria-hidden="true">◷</span><div><h2>Continue Watching</h2><p>Keep playback position on this device only. Ads and live streams are excluded.</p></div></div>
                <button type="button" on:click={actions.enableProgress}>Enable local progress</button>
              </div>
            {/if}
          </section>
        {/if}

        {#if state.preferences.home.sections.includes('subscriptions')}
          <section class="content-section">
            {#if state.deviceConfig.privacy.cacheFeeds && subscriptionItems.length}
              <MediaRail title="Latest from your subscriptions" items={subscriptionItems.slice(0, 12)} badge="SUBSCRIPTIONS" onNavigate={actions.navigate} onSave={(video) => saveTarget = video} />
              <p class="capture-note">Captured {relativeTime(snapshot?.updatedAt ?? null)} from the visible Subscriptions page · <a href="/feed/subscriptions" on:click={(event) => actions.navigate(event, '/feed/subscriptions')}>Refresh from YouTube</a></p>
            {:else}
              <div class="activation-card">
                <div><span class="activation-icon" aria-hidden="true">▤</span><div><h2>Latest from Subscriptions</h2><p>Capture up to 100 visible videos when you visit Subscriptions. No background requests.</p></div></div>
                {#if state.deviceConfig.privacy.cacheFeeds}
                  <a href="/feed/subscriptions" on:click={(event) => actions.navigate(event, '/feed/subscriptions')}>Open subscriptions →</a>
                {:else}
                  <a href="/feed/subscriptions" on:click={enableCacheAndOpen}>Enable &amp; open →</a>
                {/if}
              </div>
            {/if}
          </section>
        {/if}

        {#if state.preferences.home.sections.includes('collections')}
          <section class="collection-section">
            <div class="section-heading"><div><span class="eyebrow">MADE BY YOU</span><h2>Your collections</h2></div><a href="/feed/you" on:click={(event) => actions.navigate(event, '/feed/you')}>Manage library <span>→</span></a></div>
            {#if state.collections.length}
              <div class="collection-tiles">
                {#each state.collections.slice(0, 6) as collection (collection.id)}
                  <button type="button" class="collection-tile" on:click={(event) => actions.navigate(event, '/feed/you')}>
                    <span class="tile-symbol" aria-hidden="true">▤</span><span class="tile-name">{collection.name}</span><small>{collection.videos.length} saved</small>
                  </button>
                {/each}
                <a class="add-tile" href="/feed/you" on:click={(event) => actions.navigate(event, '/feed/you')}><span>＋</span><strong>New collection</strong><small>Build a shelf for later</small></a>
              </div>
            {:else}
              <div class="activation-card compact-card"><div><div><h2>Your next watchlist, your rules.</h2><p>Create local collections and save videos without changing your YouTube account.</p></div></div><a href="/feed/you" on:click={(event) => actions.navigate(event, '/feed/you')}>Create a collection →</a></div>
            {/if}
          </section>
        {/if}

        {#if state.preferences.home.sections.includes('shortcuts')}
          <section class="shortcuts">
            <div class="section-heading"><div><span class="eyebrow">YOUR YOUTUBE</span><h2>Library shortcuts</h2></div><button type="button" class="text-button" aria-expanded={showShortcuts} on:click={() => showShortcuts = !showShortcuts}>{showShortcuts ? 'Hide' : 'Show'}</button></div>
            <div class="shortcut-grid" class:collapsed={!showShortcuts}>
              <a href="/playlist?list=WL" on:click={(event) => actions.navigate(event, '/playlist?list=WL')}><span>◷</span><strong>Watch Later</strong><small>Native YouTube list</small></a>
              <a href="/feed/history" on:click={(event) => actions.navigate(event, '/feed/history')}><span>↶</span><strong>History</strong><small>Your native history</small></a>
              <a href="/playlist?list=LL" on:click={(event) => actions.navigate(event, '/playlist?list=LL')}><span>♡</span><strong>Liked videos</strong><small>Your native likes</small></a>
              <a href="/feed/subscriptions" on:click={(event) => actions.navigate(event, '/feed/subscriptions')}><span>▤</span><strong>Subscriptions</strong><small>Channels you follow</small></a>
            </div>
          </section>
        {/if}
        <footer class="dashboard-footer"><span>Reframe is independent and not affiliated with YouTube or Google.</span><button type="button" on:click={actions.openSettings}>Privacy &amp; settings</button></footer>
      </main>
    {:else if route.kind === 'library' && !state.deviceConfig.killSwitches.collections}
      <LibraryWorkspace
        collections={state.collections}
        resumeStates={state.resumeStates}
        onCreate={actions.createCollection}
        onRename={actions.renameCollection}
        onDelete={actions.deleteCollection}
        onAddVideo={actions.addVideoToCollection}
        onRemoveVideo={actions.removeVideoFromCollection}
        onMove={actions.reorderCollection}
        onImport={actions.importCollections}
        onNavigate={actions.navigate}
      />
    {:else if route.kind === 'watch' && !state.deviceConfig.killSwitches.watchControls}
      <FocusControls
        video={state.currentVideo}
        collections={state.collections}
        preferences={state.preferences}
        pinnedVideoId={state.preferences.home.pinnedVideoId}
        onToggle={actions.toggleWatchPreference}
        onSave={actions.addVideoToCollection}
        onPin={actions.pinVideo}
        onNavigate={actions.navigate}
      />
    {:else if route.kind === 'subscriptions' && state.deviceConfig.privacy.cacheFeeds && !state.deviceConfig.killSwitches.subscriptionsAdapter}
      <SubscriptionsStatus itemCount={subscriptionItems.length} updatedAt={snapshot?.updatedAt ?? null} circuitOpen={state.featureHealth.disabled.subscriptionsAdapter === true} hideShorts={state.preferences.global.hideShortsSurfaces} onRefresh={actions.refreshSubscriptions} onSettings={actions.openSettings} onToggleShorts={actions.setHideShorts} />
    {/if}

    {#if saveTarget}
      <div class="modal-backdrop" role="presentation" on:click={(event) => event.target === event.currentTarget && (saveTarget = null)}>
        <dialog open class="save-modal" aria-modal="true" aria-labelledby="save-title">
          <button class="modal-close" aria-label="Close" type="button" on:click={() => saveTarget = null}>×</button>
          <span class="eyebrow">KEEP IT CLOSE</span><h2 id="save-title">Save to a collection</h2><p>{saveTarget.title}</p>
          {#if state.collections.length}
            <div class="modal-collections">
              {#each state.collections as collection (collection.id)}
                <button type="button" on:click={() => saveToCollection(collection.id)}><span>▤</span><strong>{collection.name}</strong><small>{collection.videos.length}</small></button>
              {/each}
            </div>
          {:else}
            <p class="no-collections">You don’t have any collections yet. Start one in your Reframe Library.</p>
            <a href="/feed/you" on:click={(event) => { actions.navigate(event, '/feed/you'); saveTarget = null; }}>Open Library →</a>
          {/if}
        </dialog>
      </div>
    {/if}
    {#if toast}<div class="toast" role="status">{toast}</div>{/if}
  </div>
{/if}

<style>
  :global(:host) { display: block; width: 100%; color: var(--rf-text, #f2f4f8); }
  .rf-root { --rf-accent: #ff684a; --rf-text: #f2f4f8; --rf-muted: #a8b0bf; --rf-surface: #12161d; --rf-border: rgba(255,255,255,.09); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--rf-text); background: #0a0c10; font-size: 14px; }
  .topbar { min-height: 72px; display: flex; align-items: center; gap: 34px; padding: 12px clamp(20px, 5vw, 76px); background: rgba(10,12,16,.96); border-bottom: 1px solid rgba(255,255,255,.06); box-sizing: border-box; }
  .brand { display: flex; align-items: center; gap: 10px; color: var(--rf-text); text-decoration: none; }
  .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; color: #1a0b08; background: var(--rf-accent); font-weight: 950; font-size: 18px; }
  .brand > span:last-child { display: grid; gap: 1px; }
  .brand strong { font-size: 17px; letter-spacing: -.055em; }
  .brand small { color: var(--rf-muted); font-size: 9px; }
  nav { display: flex; align-items: center; gap: 8px; flex: 1; }
  nav a { padding: 9px 12px; border-radius: 9px; color: #aeb7c6; text-decoration: none; font-size: 11px; font-weight: 650; }
  nav a:hover, nav a.current { color: var(--rf-text); background: rgba(255,255,255,.07); }
  .top-actions { display: flex; gap: 8px; align-items: center; }
  button, a { font-family: inherit; }
  button { cursor: pointer; }
  .settings-link, .original { border: 1px solid var(--rf-border); border-radius: 9px; padding: 9px 12px; color: var(--rf-text); background: transparent; font-size: 10px; font-weight: 700; }
  .original { color: #160b08; border-color: transparent; background: var(--rf-accent); }
  .dashboard { max-width: 1300px; margin: 0 auto; padding: 22px clamp(20px, 5vw, 76px) 50px; }
  .hero { min-height: 310px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .78fr); align-items: center; gap: 35px; position: relative; overflow: hidden; padding: clamp(26px, 5vw, 52px); border: 1px solid rgba(255,255,255,.08); border-radius: 22px; background: radial-gradient(ellipse at 10% 0%, rgba(255,104,74,.18), transparent 42%), linear-gradient(128deg, #181d26 10%, #10141b 62%, #0f1218); box-sizing: border-box; }
  .hero-copy { position: relative; z-index: 1; max-width: 600px; }
  .eyebrow { color: var(--rf-accent); font-size: 9px; letter-spacing: .15em; font-weight: 850; text-transform: uppercase; }
  .live-dot { width: 6px; height: 6px; display: inline-block; border-radius: 50%; margin-inline-end: 6px; background: #42d6c4; box-shadow: 0 0 11px rgba(66,214,196,.8); }
  .hero h1 { margin: 12px 0 10px; max-width: 600px; font-size: clamp(32px, 5vw, 53px); letter-spacing: -.055em; line-height: .98; }
  .hero-subtitle { max-width: 480px; margin: 0 0 20px; color: #a8b0bf; font-size: 12px; line-height: 1.65; }
  .hero-source { margin: 16px 0 5px; color: #aab4c2; font-size: 8px; letter-spacing: .16em; font-weight: 800; }
  .hero-title { margin: 0; max-width: 550px; font-size: 19px; line-height: 1.3; letter-spacing: -.025em; }
  .hero-channel { margin: 4px 0 16px; color: var(--rf-muted); font-size: 11px; }
  .hero-buttons { display: flex; gap: 8px; margin-block-start: 18px; }
  .primary-button, .secondary-button { display: inline-flex; align-items: center; gap: 9px; border: 0; border-radius: 9px; padding: 11px 14px; color: #160b08; background: var(--rf-accent); text-decoration: none; font-size: 11px; font-weight: 800; }
  .secondary-button { color: var(--rf-text); border: 1px solid var(--rf-border); background: rgba(255,255,255,.06); }
  .hero-art { min-height: 200px; height: 100%; position: relative; overflow: hidden; border-radius: 17px; background: linear-gradient(140deg, #2a323f, #151a22 70%); }
  .hero-art img { width: 100%; height: 100%; position: absolute; inset: 0; object-fit: cover; opacity: .56; }
  .art-gradient { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(12,14,18,.3), transparent 65%), linear-gradient(0deg, rgba(12,14,18,.75), transparent 45%); }
  .art-play { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 48px; height: 48px; padding-inline-start: 3px; transform: translate(-50%,-50%); border-radius: 50%; color: #170c09; background: var(--rf-accent); font-size: 15px; }
  .art-label { position: absolute; inset-inline-start: 16px; bottom: 15px; color: rgba(255,255,255,.78); font-size: 8px; letter-spacing: .17em; font-weight: 800; }
  .orbit { position: absolute; border: 1px solid rgba(255,104,74,.35); border-radius: 50%; }
  .orbit-one { width: 160px; height: 160px; left: 50%; top: 50%; transform: translate(-50%,-50%); }
  .orbit-two { width: 230px; height: 230px; left: 50%; top: 50%; transform: translate(-50%,-50%); opacity: .6; }
  .orbit-three { width: 300px; height: 300px; left: 50%; top: 50%; transform: translate(-50%,-50%); opacity: .32; }
  .art-star { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); color: #ffb06c; font-size: 70px; filter: drop-shadow(0 0 30px rgba(255,104,74,.7)); }
  .dashboard-meta { display: flex; gap: 13px; align-items: center; margin: 17px 3px 0; color: #788493; font-size: 9px; }
  .dashboard-meta span:first-child { color: #42d6c4; letter-spacing: .12em; font-weight: 800; }
  .content-section { margin-block-start: 12px; }
  .activation-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-block: 16px; padding: 18px 20px; color: var(--rf-text); border: 1px solid var(--rf-border); border-radius: 14px; background: linear-gradient(110deg, #151a22, #10141a); }
  .activation-card > div { display: flex; align-items: center; gap: 13px; }
  .activation-icon { width: 37px; height: 37px; flex: none; display: grid; place-items: center; color: var(--rf-accent); border-radius: 12px; background: rgba(255,104,74,.12); font-size: 19px; }
  .activation-card h2 { margin: 0 0 4px; font-size: 13px; }
  .activation-card p { margin: 0; color: var(--rf-muted); font-size: 10px; line-height: 1.5; }
  .activation-card button, .activation-card a { flex: none; border: 1px solid rgba(255,104,74,.55); border-radius: 9px; padding: 9px 12px; color: var(--rf-text); background: transparent; text-decoration: none; font-size: 10px; font-weight: 750; }
  .activation-card button:hover, .activation-card a:hover { background: rgba(255,104,74,.12); }
  .capture-note { margin: -3px 0 6px; color: #788493; font-size: 9px; }
  .capture-note a { color: #bdc6d3; }
  .collection-section, .shortcuts { margin-block-start: 28px; }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin-block-end: 13px; }
  .section-heading h2 { margin: 4px 0 0; font-size: 18px; letter-spacing: -.035em; }
  .section-heading > a, .text-button { border: 0; color: #bac3d0; background: transparent; text-decoration: none; font-size: 10px; }
  .section-heading > a span { color: var(--rf-accent); }
  .collection-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
  .collection-tile, .add-tile { min-height: 100px; display: grid; align-content: start; justify-items: start; gap: 8px; padding: 13px; border: 1px solid var(--rf-border); border-radius: 12px; color: var(--rf-text); background: #11151c; text-align: start; text-decoration: none; }
  .collection-tile:hover, .add-tile:hover { border-color: rgba(255,104,74,.5); background: #171c24; }
  .tile-symbol, .add-tile > span { color: var(--rf-accent); font-size: 17px; }
  .tile-name, .add-tile strong { overflow: hidden; width: 100%; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 750; }
  .collection-tile small, .add-tile small { color: var(--rf-muted); font-size: 9px; }
  .add-tile { border-style: dashed; }
  .compact-card { margin: 0; }
  .shortcut-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; }
  .shortcut-grid.collapsed { display: none; }
  .shortcut-grid a { display: grid; gap: 6px; padding: 13px; border: 1px solid var(--rf-border); border-radius: 11px; color: var(--rf-text); background: #11151c; text-decoration: none; }
  .shortcut-grid a:hover { border-color: rgba(255,104,74,.42); }
  .shortcut-grid a > span { color: var(--rf-accent); font-size: 17px; }
  .shortcut-grid strong { font-size: 10px; }
  .shortcut-grid small { color: var(--rf-muted); font-size: 9px; }
  .dashboard-footer { display: flex; justify-content: space-between; gap: 12px; margin-block-start: 30px; padding-block-start: 13px; border-top: 1px solid var(--rf-border); color: #798493; font-size: 9px; }
  .dashboard-footer button { border: 0; color: #bdc6d3; background: transparent; font-size: 9px; }
  .modal-backdrop { position: fixed; z-index: 2147483645; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(0,0,0,.7); backdrop-filter: blur(8px); }
  .save-modal { position: relative; width: min(420px, 100%); max-height: 80vh; overflow: auto; padding: 25px; border: 1px solid #38414e; border-radius: 18px; color: var(--rf-text); background: #151a22; box-shadow: 0 28px 100px rgba(0,0,0,.6); box-sizing: border-box; }
  .modal-close { position: absolute; inset-inline-end: 15px; top: 10px; border: 0; color: var(--rf-muted); background: none; font-size: 23px; }
  .save-modal h2 { margin: 6px 0; font-size: 21px; }
  .save-modal > p { color: var(--rf-muted); font-size: 11px; line-height: 1.5; }
  .modal-collections { display: grid; gap: 5px; margin-block-start: 14px; }
  .modal-collections button { display: flex; align-items: center; gap: 9px; padding: 11px; border: 1px solid var(--rf-border); border-radius: 9px; color: var(--rf-text); background: #1b212a; text-align: start; }
  .modal-collections button:hover { border-color: var(--rf-accent); }
  .modal-collections button span { color: var(--rf-accent); }
  .modal-collections button strong { flex: 1; font-size: 11px; }
  .modal-collections button small, .no-collections { color: var(--rf-muted); font-size: 10px; }
  .save-modal > a { color: var(--rf-accent); font-size: 11px; }
  .toast { position: fixed; z-index: 2147483647; right: 22px; bottom: 22px; padding: 11px 15px; border-radius: 9px; color: #07110f; background: #42d6c4; box-shadow: 0 8px 35px rgba(0,0,0,.35); font-size: 11px; font-weight: 800; }
  @media (max-width: 760px) { .topbar { gap: 12px; padding-inline: 14px; } nav { gap: 0; } nav a { padding-inline: 8px; } .settings-link { display: none; } .hero { grid-template-columns: 1fr; } .hero-art { min-height: 170px; } .shortcut-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 520px) { .brand small { display: none; } .brand { gap: 5px; } .brand strong { font-size: 14px; } nav a { font-size: 9px; } .original { padding: 8px; font-size: 9px; } .topbar { flex-wrap: wrap; } nav { order: 3; flex-basis: 100%; } .dashboard { padding-inline: 12px; } .hero { padding: 22px; } .dashboard-footer { flex-direction: column; } }
  @media (prefers-reduced-motion: reduce) { :global(*) { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }
</style>
