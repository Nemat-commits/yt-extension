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
  :global(:host) { display: block; width: 100%; color: var(--rf-text, #f5f6fa); }
  :global(*) { box-sizing: border-box; }

  .rf-root {
    --rf-bg: #090b12;
    --rf-canvas: #0d1018;
    --rf-surface: rgba(255,255,255,.045);
    --rf-glass: rgba(21,26,39,.72);
    --rf-glass-strong: rgba(18,22,33,.92);
    --rf-line: rgba(255,255,255,.105);
    --rf-line-bright: rgba(255,255,255,.18);
    --rf-text: #f5f6fa;
    --rf-muted: #a6afc1;
    --rf-faint: #7f899d;
    --rf-accent: #ff765f;
    --rf-accent-bright: #ff9b81;
    --rf-gold: #ffd28b;
    --rf-mint: #8be4d3;
    --rf-shadow: 0 26px 70px rgba(0,0,0,.34);
    --rf-glow: 0 0 34px rgba(255,118,95,.17);
    min-width: 0;
    position: relative;
    isolation: isolate;
    overflow: visible;
    color-scheme: dark;
    color: var(--rf-text);
    background:
      radial-gradient(ellipse at 8% 0%, rgba(255,118,95,.12), transparent 34rem),
      radial-gradient(ellipse at 92% 14%, rgba(104,123,255,.105), transparent 32rem),
      linear-gradient(180deg, #0a0c13 0%, #0e1119 100%);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .rf-root::before {
    position: absolute;
    z-index: -1;
    inset: 0;
    content: "";
    pointer-events: none;
    opacity: .24;
    background-image: radial-gradient(rgba(255,255,255,.32) .6px, transparent .6px);
    background-size: 24px 24px;
    mask-image: linear-gradient(to bottom, black, transparent 72%);
  }
  button, a { font: inherit; }
  button { cursor: pointer; }

  .topbar {
    min-height: 78px;
    display: flex;
    align-items: center;
    gap: clamp(18px, 3.4vw, 48px);
    padding: 12px clamp(18px, 5.2vw, 82px);
    border-bottom: 1px solid rgba(255,255,255,.075);
    background: linear-gradient(180deg, rgba(15,18,28,.93), rgba(13,16,24,.78));
    box-shadow: 0 8px 34px rgba(0,0,0,.12);
    -webkit-backdrop-filter: blur(20px) saturate(145%);
    backdrop-filter: blur(20px) saturate(145%);
  }
  .brand { display: flex; align-items: center; gap: 11px; flex: none; color: var(--rf-text); text-decoration: none; }
  .brand-mark {
    width: 39px; height: 39px; display: grid; place-items: center; position: relative; overflow: hidden;
    border: 1px solid rgba(255,255,255,.34); border-radius: 13px; color: #1c0e0a;
    background: linear-gradient(145deg, #ffb27d, #ff715e 56%, #ee5e64);
    box-shadow: 0 8px 23px rgba(255,105,83,.25), inset 0 1px 0 rgba(255,255,255,.52);
    font-size: 19px; font-weight: 950; letter-spacing: -.09em;
  }
  .brand-mark::after { position: absolute; inset: -45% 44% 45% -20%; content: ""; transform: rotate(35deg); background: rgba(255,255,255,.34); filter: blur(5px); }
  .brand > span:last-child { display: grid; gap: 0; }
  .brand strong { font-size: 19px; letter-spacing: -.075em; line-height: 1.1; }
  .brand small { color: #aeb7c7; font-size: 10px; letter-spacing: .015em; }
  nav {
    min-width: 0; display: flex; align-items: center; gap: 3px; flex: 1;
    width: fit-content; max-width: 420px; padding: 4px;
    border: 1px solid rgba(255,255,255,.085); border-radius: 999px;
    background: rgba(255,255,255,.035); box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
  }
  nav a {
    min-height: 35px; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 8px 15px; border: 1px solid transparent; border-radius: 999px;
    color: #a8b1c2; text-decoration: none; white-space: nowrap;
    font-size: 11px; font-weight: 720; letter-spacing: .01em;
    transition: color 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  }
  nav a:hover { color: #fff; background: rgba(255,255,255,.065); }
  nav a.current {
    color: #fff; border-color: rgba(255,255,255,.12);
    background: linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.045));
    box-shadow: 0 5px 16px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.1);
  }
  .top-actions { display: flex; align-items: center; gap: 8px; flex: none; }
  .settings-link, .original {
    min-height: 37px; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 8px 13px; border: 1px solid var(--rf-line); border-radius: 999px;
    color: #e7eaf1; background: rgba(255,255,255,.045); font-size: 10px; font-weight: 750;
    transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
  }
  .settings-link:hover { transform: translateY(-1px); border-color: var(--rf-line-bright); background: rgba(255,255,255,.09); }
  .original {
    padding-inline: 16px; border-color: rgba(255,168,139,.55); color: #26100b;
    background: linear-gradient(135deg, #ffc08b, #ff866d 56%, #fa705f);
    box-shadow: 0 6px 21px rgba(255,113,94,.19), inset 0 1px 0 rgba(255,255,255,.62);
  }
  .original:hover { transform: translateY(-1px); box-shadow: 0 9px 27px rgba(255,113,94,.28), inset 0 1px 0 rgba(255,255,255,.68); }

  .dashboard { width: min(100%, 1510px); margin: 0 auto; padding: 30px clamp(18px, 5.2vw, 82px) 66px; }
  .hero {
    min-height: 355px; display: grid; grid-template-columns: minmax(0,1.05fr) minmax(300px,.9fr);
    align-items: center; gap: clamp(22px,4vw,58px); position: relative; isolation: isolate; overflow: hidden;
    padding: clamp(26px,4.5vw,58px); border: 1px solid rgba(255,255,255,.15); border-radius: 29px;
    background:
      radial-gradient(ellipse at 4% 5%, rgba(255,119,95,.22), transparent 39%),
      radial-gradient(ellipse at 74% 100%, rgba(96,123,255,.16), transparent 46%),
      linear-gradient(125deg, rgba(29,33,47,.92), rgba(17,21,33,.9) 59%, rgba(16,20,32,.96));
    box-shadow: 0 28px 90px rgba(0,0,0,.31), inset 0 1px 0 rgba(255,255,255,.15);
  }
  .hero::before {
    position: absolute; z-index: -1; inset: -40% -12% auto 33%; height: 160%; content: "";
    border-radius: 50%; background: radial-gradient(ellipse, rgba(125,143,255,.12), transparent 62%);
    filter: blur(10px); animation: hero-breathe 14s ease-in-out infinite alternate;
  }
  .hero::after {
    position: absolute; inset: 0; content: ""; pointer-events: none; border-radius: inherit;
    background: linear-gradient(115deg, rgba(255,255,255,.1), transparent 23%, transparent 70%, rgba(255,255,255,.035));
    opacity: .7;
  }
  .hero-copy { position: relative; z-index: 1; max-width: 650px; }
  .eyebrow { color: var(--rf-accent-bright); font-size: 9px; letter-spacing: .18em; font-weight: 850; text-transform: uppercase; }
  .live-dot { width: 7px; height: 7px; display: inline-block; margin-inline-end: 7px; border-radius: 50%; vertical-align: 1px; background: var(--rf-mint); box-shadow: 0 0 13px rgba(139,228,211,.8); animation: dot-breathe 2.8s ease-in-out infinite; }
  .hero h1 { max-width: 650px; margin: 15px 0 12px; font-size: clamp(37px,5.5vw,64px); letter-spacing: -.065em; line-height: .98; text-wrap: balance; }
  .hero-subtitle { max-width: 510px; margin: 0 0 22px; color: #b5bdca; font-size: 13px; line-height: 1.75; }
  .hero-source { display: inline-flex; align-items: center; gap: 6px; margin: 12px 0 9px; padding: 5px 9px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; color: #e5c59a; background: rgba(255,210,139,.08); font-size: 8px; letter-spacing: .13em; font-weight: 850; }
  .hero-source::before { width: 5px; height: 5px; border-radius: 50%; content: ""; background: var(--rf-gold); box-shadow: 0 0 9px rgba(255,210,139,.7); }
  .hero-title { max-width: 620px; margin: 0; font-size: clamp(18px,2.1vw,25px); line-height: 1.28; letter-spacing: -.035em; text-wrap: balance; }
  .hero-channel { margin: 7px 0 16px; color: #a6b0c0; font-size: 11px; }
  .hero-buttons { display: flex; flex-wrap: wrap; gap: 9px; margin-block-start: 23px; }
  .primary-button, .secondary-button {
    min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    padding: 10px 17px; border: 1px solid transparent; border-radius: 999px;
    color: #24110d; background: linear-gradient(135deg,#ffd093,#ff9572 50%,#ff725f);
    box-shadow: 0 8px 26px rgba(255,112,91,.23), inset 0 1px 0 rgba(255,255,255,.66);
    text-decoration: none; font-size: 11px; font-weight: 850;
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  }
  .primary-button:hover { transform: translateY(-2px); filter: saturate(1.08); box-shadow: 0 12px 32px rgba(255,112,91,.32), inset 0 1px 0 rgba(255,255,255,.72); }
  .primary-button > span:last-child { font-size: 14px; }
  .secondary-button {
    color: #f2f3f7; border-color: rgba(255,255,255,.16);
    background: rgba(255,255,255,.07); box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  }
  .secondary-button:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.12); }
  .hero-art {
    min-height: 245px; aspect-ratio: 16/10; position: relative; overflow: hidden; isolation: isolate;
    border: 1px solid rgba(255,255,255,.22); border-radius: 23px;
    background: linear-gradient(145deg, rgba(58,67,89,.8), rgba(17,22,35,.96));
    box-shadow: 0 25px 60px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.26);
    transform: perspective(900px) rotateY(-2deg) rotateX(1deg);
    transition: transform 420ms cubic-bezier(.2,.75,.25,1), box-shadow 420ms ease;
  }
  .hero-art:hover { transform: perspective(900px) rotateY(0) rotateX(0) translateY(-2px); box-shadow: 0 30px 74px rgba(0,0,0,.38), 0 0 35px rgba(255,118,95,.08); }
  .hero-art::before { position: absolute; z-index: 2; inset: 0; content: ""; pointer-events: none; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,.24), transparent 24%, transparent 72%, rgba(255,255,255,.09)); }
  .hero-art img { width: 100%; height: 100%; position: absolute; inset: 0; object-fit: cover; opacity: .86; filter: saturate(.88) contrast(1.05); transition: transform 600ms cubic-bezier(.2,.7,.2,1), filter 400ms ease; }
  .hero-art:hover img { transform: scale(1.045); filter: saturate(1.06) contrast(1.05); }
  .art-gradient { position: absolute; z-index: 1; inset: 0; background: linear-gradient(90deg,rgba(8,10,17,.22),transparent 70%),linear-gradient(0deg,rgba(8,10,17,.7),transparent 48%); }
  .art-play { width: 56px; height: 56px; position: absolute; z-index: 3; left: 50%; top: 50%; display: grid; place-items: center; padding-inline-start: 3px; transform: translate(-50%,-50%); border: 1px solid rgba(255,255,255,.56); border-radius: 50%; color: white; background: rgba(255,255,255,.18); box-shadow: 0 0 0 9px rgba(255,255,255,.08),0 8px 24px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.32); -webkit-backdrop-filter: blur(16px) saturate(150%); backdrop-filter: blur(16px) saturate(150%); font-size: 16px; }
  .art-label { position: absolute; z-index: 3; inset-inline-start: 16px; bottom: 15px; padding: 6px 9px; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; color: rgba(255,255,255,.86); background: rgba(9,12,20,.36); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); font-size: 7px; letter-spacing: .17em; font-weight: 850; }
  .orbit { position: absolute; left: 50%; top: 50%; border: 1px solid rgba(255,174,134,.4); border-radius: 50%; transform: translate(-50%,-50%); box-shadow: inset 0 0 28px rgba(255,118,95,.07),0 0 34px rgba(255,118,95,.08); }
  .orbit-one { width: 145px; height: 145px; }
  .orbit-two { width: 220px; height: 220px; opacity: .6; }
  .orbit-three { width: 300px; height: 300px; opacity: .3; }
  .art-star { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); color: #ffd28b; font-size: 76px; filter: drop-shadow(0 0 34px rgba(255,153,109,.75)); animation: star-float 5s ease-in-out infinite; }
  .dashboard-meta { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; margin: 18px 3px 3px; color: var(--rf-faint); font-size: 10px; }
  .dashboard-meta span:first-child { display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border: 1px solid rgba(139,228,211,.16); border-radius: 999px; color: var(--rf-mint); background: rgba(139,228,211,.055); letter-spacing: .11em; font-weight: 850; }
  .dashboard-meta span:first-child::before { width: 5px; height: 5px; border-radius: 50%; content: ""; background: currentColor; box-shadow: 0 0 9px currentColor; }
  .dashboard-meta span:last-child { padding-inline-start: 4px; }
  .content-section { margin-block-start: 20px; }
  .activation-card {
    min-height: 96px; display: flex; align-items: center; justify-content: space-between; gap: 22px;
    margin-block: 15px; padding: 21px 23px; border: 1px solid var(--rf-line); border-radius: 19px;
    color: var(--rf-text); background: linear-gradient(125deg,rgba(255,255,255,.07),rgba(255,255,255,.025));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.07),0 12px 32px rgba(0,0,0,.11);
    -webkit-backdrop-filter: blur(18px) saturate(135%); backdrop-filter: blur(18px) saturate(135%);
  }
  .activation-card > div { display: flex; align-items: center; gap: 14px; }
  .activation-icon { width: 43px; height: 43px; flex: none; display: grid; place-items: center; border: 1px solid rgba(255,118,95,.24); border-radius: 15px; color: #ffc09d; background: linear-gradient(145deg,rgba(255,118,95,.18),rgba(255,118,95,.06)); box-shadow: inset 0 1px 0 rgba(255,255,255,.11); font-size: 19px; }
  .activation-card h2 { margin: 0 0 5px; font-size: 13px; letter-spacing: -.02em; }
  .activation-card p { margin: 0; color: var(--rf-muted); font-size: 10px; line-height: 1.65; font-size: 11px; }
  .activation-card button, .activation-card a { flex: none; display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(255,153,129,.4); border-radius: 999px; padding: 9px 13px; color: #ffd2c3; background: rgba(255,118,95,.09); text-decoration: none; font-size: 10px; font-weight: 800; transition: background 160ms ease, transform 160ms ease; }
  .activation-card button:hover, .activation-card a:hover { transform: translateY(-1px); background: rgba(255,118,95,.17); }
  .capture-note { margin: 4px 0 8px; color: var(--rf-faint); font-size: 10px; }
  .capture-note a { color: #c5cedb; text-decoration-color: rgba(197,206,219,.4); text-underline-offset: 3px; }
  .collection-section, .shortcuts {
    margin-block-start: 32px; padding: clamp(18px,2.3vw,27px); border: 1px solid rgba(255,255,255,.09); border-radius: 23px;
    background: linear-gradient(140deg,rgba(255,255,255,.055),rgba(255,255,255,.02));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.065),0 18px 52px rgba(0,0,0,.13);
    -webkit-backdrop-filter: blur(20px) saturate(125%); backdrop-filter: blur(20px) saturate(125%);
  }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-block-end: 16px; }
  .section-heading h2 { margin: 5px 0 0; font-size: 21px; letter-spacing: -.045em; }
  .section-heading > a, .text-button { display: inline-flex; align-items: center; gap: 7px; border: 0; color: #c1c9d6; background: transparent; text-decoration: none; font-size: 10px; font-weight: 750; transition: color 160ms ease, transform 160ms ease; }
  .section-heading > a:hover, .text-button:hover { color: #fff; transform: translateX(2px); }
  .section-heading > a span { color: var(--rf-accent-bright); font-size: 14px; }
  .collection-tiles { display: grid; grid-template-columns: repeat(auto-fill,minmax(165px,1fr)); gap: 10px; }
  .collection-tile, .add-tile {
    min-height: 112px; position: relative; overflow: hidden; display: grid; align-content: start; justify-items: start; gap: 8px;
    padding: 15px; border: 1px solid rgba(255,255,255,.095); border-radius: 17px; color: var(--rf-text);
    background: linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.025)); text-align: start; text-decoration: none;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.075); transition: transform 200ms ease,border-color 200ms ease,background 200ms ease,box-shadow 200ms ease;
  }
  .collection-tile::after, .add-tile::after { position: absolute; width: 110px; height: 110px; inset-inline-end: -45px; bottom: -70px; border-radius: 50%; content: ""; background: rgba(255,118,95,.12); filter: blur(20px); opacity: 0; transition: opacity 200ms ease; }
  .collection-tile:hover, .add-tile:hover { transform: translateY(-3px); border-color: rgba(255,172,141,.3); background: linear-gradient(145deg,rgba(255,255,255,.105),rgba(255,255,255,.04)); box-shadow: 0 13px 28px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.11); }
  .collection-tile:hover::after, .add-tile:hover::after { opacity: 1; }
  .tile-symbol, .add-tile > span { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid rgba(255,180,143,.2); border-radius: 11px; color: #ffc09d; background: rgba(255,118,95,.1); font-size: 15px; }
  .tile-name, .add-tile strong { z-index: 1; overflow: hidden; width: 100%; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 780; }
  .collection-tile small, .add-tile small { z-index: 1; color: var(--rf-faint); font-size: 10px; }
  .add-tile { border-style: dashed; border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.018); }
  .compact-card { margin: 0; }
  .shortcuts { margin-block-start: 20px; }
  .shortcut-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 9px; }
  .shortcut-grid.collapsed { display: none; }
  .shortcut-grid a {
    min-height: 100px; display: grid; align-content: start; gap: 7px; padding: 14px;
    border: 1px solid rgba(255,255,255,.09); border-radius: 16px; color: var(--rf-text);
    background: rgba(255,255,255,.035); text-decoration: none; box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
    transition: transform 180ms ease,border-color 180ms ease,background 180ms ease;
  }
  .shortcut-grid a:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.075); }
  .shortcut-grid a > span { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 10px; color: #ffc09d; background: rgba(255,118,95,.11); font-size: 14px; }
  .shortcut-grid strong { font-size: 10px; }
  .shortcut-grid small { color: var(--rf-faint); font-size: 10px; }
  .dashboard-footer { display: flex; justify-content: space-between; gap: 12px; margin-block-start: 25px; padding-block-start: 15px; border-top: 1px solid rgba(255,255,255,.075); color: var(--rf-faint); font-size: 10px; }
  .dashboard-footer button { display: inline-flex; align-items: center; gap: 6px; border: 0; color: #c0c8d4; background: transparent; font-size: 9px; font-weight: 700; text-decoration: underline; text-decoration-color: rgba(192,200,212,.35); text-underline-offset: 3px; }
  .modal-backdrop { position: fixed; z-index: 2147483645; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(4,6,12,.68); -webkit-backdrop-filter: blur(13px) saturate(130%); backdrop-filter: blur(13px) saturate(130%); animation: fade-in 160ms ease-out; }
  .save-modal { width: min(440px,100%); max-height: 82vh; position: relative; overflow: auto; padding: 27px; border: 1px solid rgba(255,255,255,.17); border-radius: 24px; color: var(--rf-text); background: linear-gradient(145deg,rgba(33,38,53,.94),rgba(18,22,33,.96)); box-shadow: 0 35px 110px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.12); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); animation: modal-up 220ms cubic-bezier(.2,.8,.2,1); }
  .modal-close { width: 32px; height: 32px; position: absolute; inset-inline-end: 14px; top: 14px; display: grid; place-items: center; border: 1px solid var(--rf-line); border-radius: 50%; color: var(--rf-muted); background: rgba(255,255,255,.06); font-size: 20px; transition: color 160ms ease,background 160ms ease; }
  .modal-close:hover { color: #fff; background: rgba(255,255,255,.12); }
  .save-modal h2 { margin: 8px 0; font-size: 25px; letter-spacing: -.05em; }
  .save-modal > p { color: var(--rf-muted); font-size: 11px; line-height: 1.6; }
  .modal-collections { display: grid; gap: 6px; margin-block-start: 16px; }
  .modal-collections button { min-height: 47px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--rf-line); border-radius: 13px; color: var(--rf-text); background: rgba(255,255,255,.045); text-align: start; transition: border-color 160ms ease,background 160ms ease,transform 160ms ease; }
  .modal-collections button:hover { transform: translateY(-1px); border-color: rgba(255,160,131,.4); background: rgba(255,118,95,.09); }
  .modal-collections button span { color: var(--rf-accent-bright); }
  .modal-collections button strong { flex: 1; font-size: 10px; }
  .modal-collections button small, .no-collections { color: var(--rf-muted); font-size: 10px; }
  .save-modal > a { color: var(--rf-accent-bright); font-size: 10px; text-underline-offset: 3px; }
  .toast { position: fixed; z-index: 2147483647; inset-inline-end: 24px; bottom: 24px; max-width: min(420px,calc(100vw - 40px)); padding: 12px 17px; border: 1px solid rgba(139,228,211,.34); border-radius: 14px; color: #e8fff9; background: rgba(22,71,66,.88); box-shadow: 0 16px 44px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.12); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); font-size: 10px; font-weight: 780; animation: toast-in 200ms cubic-bezier(.2,.8,.2,1); }

  .rf-root[data-density="compact"] .dashboard { padding-block-start: 20px; padding-block-end: 44px; }
  .rf-root[data-density="compact"] .hero { min-height: 315px; padding: clamp(22px,3.6vw,42px); }
  .rf-root[data-density="compact"] .collection-section, .rf-root[data-density="compact"] .shortcuts { margin-block-start: 22px; padding: 19px; }
  .rf-root[data-density="compact"] .collection-tile, .rf-root[data-density="compact"] .add-tile { min-height: 96px; }

  @keyframes hero-breathe { from { transform: translate3d(-2%,0,0) scale(.95); opacity: .58; } to { transform: translate3d(3%,2%,0) scale(1.08); opacity: 1; } }
  @keyframes dot-breathe { 0%,100% { opacity: .78; box-shadow: 0 0 8px rgba(139,228,211,.54); } 50% { opacity: 1; box-shadow: 0 0 15px rgba(139,228,211,.92); } }
  @keyframes star-float { 0%,100% { transform: translate(-50%,-50%) rotate(-4deg); } 50% { transform: translate(-50%,-54%) rotate(5deg); } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modal-up { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 900px) {
    .topbar { gap: 16px; }
    .hero { grid-template-columns: minmax(0,1fr) minmax(250px,.8fr); gap: 24px; }
    .hero-art { min-height: 220px; }
  }
  @media (max-width: 760px) {
    .topbar { min-height: 68px; flex-wrap: wrap; gap: 12px; padding-inline: 18px; }
    nav { order: 3; flex-basis: 100%; max-width: none; justify-content: center; }
    .top-actions { margin-inline-start: auto; }
    .settings-link { display: none; }
    .dashboard { padding: 22px 18px 44px; }
    .hero { grid-template-columns: 1fr; gap: 24px; padding: 26px; }
    .hero-art { width: 100%; max-height: 330px; min-height: 190px; aspect-ratio: 16/9; transform: none; }
    .hero-art:hover { transform: translateY(-2px); }
    .shortcut-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }
  @media (max-width: 520px) {
    .topbar { flex-wrap: wrap; padding: 12px 14px; }
    .brand { gap: 8px; }
    .brand-mark { width: 34px; height: 34px; border-radius: 11px; font-size: 16px; }
    .brand strong { font-size: 17px; }
    .brand small { display: none; }
    .original { min-height: 34px; padding: 7px 11px; font-size: 8px; }
    nav { gap: 2px; }
    nav a { min-height: 34px; flex: 1; padding: 7px 8px; font-size: 9px; }
    .dashboard { padding: 16px 12px 34px; }
    .hero { gap: 21px; padding: 23px 19px; border-radius: 23px; }
    .hero h1 { font-size: clamp(35px,10vw,48px); }
    .hero-subtitle { font-size: 11px; }
    .hero-art { min-height: 165px; border-radius: 18px; }
    .collection-section, .shortcuts { margin-block-start: 22px; padding: 16px; border-radius: 19px; }
    .section-heading { align-items: flex-start; }
    .section-heading h2 { font-size: 18px; }
    .section-heading > a { align-self: end; font-size: 8px; }
    .collection-tiles { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
    .collection-tile, .add-tile { min-height: 98px; padding: 12px; }
    .activation-card { align-items: flex-start; flex-direction: column; gap: 14px; padding: 16px; }
    .activation-card > div { align-items: flex-start; }
    .dashboard-footer { flex-direction: column; gap: 8px; }
    .dashboard-meta { font-size: 8px; }
    .toast { inset-inline: 12px; bottom: 12px; max-width: none; text-align: center; }
  }

</style>
