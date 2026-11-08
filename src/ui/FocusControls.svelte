<script lang="ts">
  import type { Collection, UserPreferences, VideoMeta } from '@src/data/models';

  export let video: VideoMeta | null = null;
  export let collections: Collection[] = [];
  export let preferences: UserPreferences;
  export let pinnedVideoId: string | undefined;
  export let onToggle: (key: 'focusMode' | 'collapseComments' | 'collapseDescription', value: boolean) => void;
  export let onSave: (collectionId: string, video: VideoMeta) => Promise<void>;
  export let onPin: (videoId: string | undefined) => Promise<void>;
  export let onNavigate: (event: MouseEvent, path: string) => void;

  let showSave = false;
  let message = '';
  let busy = false;

  async function saveTo(collectionId: string): Promise<void> {
    if (!video || busy) return;
    busy = true;
    try {
      await onSave(collectionId, video);
      showSave = false;
      message = 'Saved to your collection';
    } catch (error) {
      message = error instanceof Error ? error.message : 'Could not save this video';
    } finally {
      busy = false;
      setTimeout(() => message = '', 2600);
    }
  }

  async function togglePin(): Promise<void> {
    if (!video) return;
    const pinned = pinnedVideoId === video.id;
    try {
      await onPin(pinned ? undefined : video.id);
      message = pinned ? 'Removed from your Home hero' : 'Pinned to your Home hero';
    } catch (error) {
      message = error instanceof Error ? error.message : 'Could not update your Home hero';
    }
    setTimeout(() => message = '', 2200);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') showSave = false;
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<section class="focusbar" aria-label="Reframe watch controls">
  <div class="intro"><span class="spark">✦</span><div><strong>Watch, your way</strong><small>Native player and ad playback remain untouched.</small></div></div>
  <div class="toggles">
    <button class:active={preferences.watch.focusMode} type="button" aria-pressed={preferences.watch.focusMode} on:click={() => onToggle('focusMode', !preferences.watch.focusMode)}><span aria-hidden="true">◉</span> Focus</button>
    <button class:active={preferences.watch.collapseComments} type="button" aria-pressed={preferences.watch.collapseComments} on:click={() => onToggle('collapseComments', !preferences.watch.collapseComments)}><span aria-hidden="true">☷</span> Comments</button>
    <button class:active={preferences.watch.collapseDescription} type="button" aria-pressed={preferences.watch.collapseDescription} on:click={() => onToggle('collapseDescription', !preferences.watch.collapseDescription)}><span aria-hidden="true">⌄</span> Description</button>
      {#if video}
        <button class="save-button" type="button" on:click={() => showSave = !showSave}><span aria-hidden="true">＋</span> Save</button>
        <button class:active={pinnedVideoId === video.id} type="button" aria-pressed={pinnedVideoId === video.id} on:click={togglePin}>{pinnedVideoId === video.id ? 'Unpin from Home' : 'Pin to Home'}</button>
      {/if}
  </div>

  {#if showSave && video}
    <div class="save-panel" role="dialog" aria-modal="true" aria-label="Save video to a collection">
      <div class="panel-head"><strong>Save to a collection</strong><button type="button" aria-label="Close" on:click={() => showSave = false}>×</button></div>
      {#if collections.length}
        <div class="collection-list">
          {#each collections as collection (collection.id)}
            <button type="button" class="collection-choice" on:click={() => saveTo(collection.id)}>
              <span class="collection-icon" aria-hidden="true">▤</span><span>{collection.name}</span><small>{collection.videos.length}</small>
            </button>
          {/each}
        </div>
      {:else}
        <p class="empty">Create a collection first in your Reframe Library.</p>
        <a href="/feed/you" on:click={(event) => { onNavigate(event, '/feed/you'); showSave = false; }}>Open Reframe Library</a>
      {/if}
    </div>
  {/if}
  {#if message}<span class="toast" role="status">{message}</span>{/if}
</section>

<style>
  .focusbar {
    min-height: 76px; position: relative; display: flex; align-items: center; justify-content: space-between; gap: 20px;
    margin: 16px 0 20px; padding: 13px 17px; border: 1px solid rgba(255,255,255,.14); border-radius: 20px;
    color: var(--rf-text); background: linear-gradient(120deg,rgba(24,29,43,.82),rgba(16,20,31,.7));
    box-shadow: 0 18px 45px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.12);
    -webkit-backdrop-filter: blur(22px) saturate(140%); backdrop-filter: blur(22px) saturate(140%);
  }
  .focusbar::before { position: absolute; inset: 0 auto 0 0; width: 3px; border-radius: 20px 0 0 20px; content: ""; background: linear-gradient(180deg,#ffc087,#ff765f,rgba(255,118,95,.22)); box-shadow: 0 0 16px rgba(255,118,95,.34); }
  .intro { min-width: 0; display: flex; align-items: center; gap: 12px; }
  .spark { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border: 1px solid rgba(255,202,143,.22); border-radius: 13px; color: #ffd28b; background: linear-gradient(145deg,rgba(255,210,139,.14),rgba(255,118,95,.07)); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); font-size: 16px; }
  .intro div { display: grid; gap: 4px; }
  .intro strong { font-size: 12px; letter-spacing: -.015em; }
  .intro small { color: var(--rf-muted); font-size: 10px; line-height: 1.45; }
  .toggles { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  button { font: inherit; cursor: pointer; }
  .toggles button { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 999px; color: #b5becd; background: rgba(255,255,255,.045); font-size: 10px; font-weight: 740; transition: border-color 160ms ease,color 160ms ease,background 160ms ease,transform 160ms ease,box-shadow 160ms ease; }
  .toggles button > span { color: #8f9aaf; font-size: 12px; }
  .toggles button:hover { transform: translateY(-1px); color: #fff; border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.09); }
  .toggles button.active { color: #ffe3d9; border-color: rgba(255,151,124,.38); background: linear-gradient(135deg,rgba(255,118,95,.18),rgba(255,118,95,.075)); box-shadow: inset 0 1px 0 rgba(255,255,255,.075),0 4px 13px rgba(255,118,95,.08); }
  .toggles button.active > span { color: var(--rf-accent-bright,var(--rf-accent)); }
  .toggles .save-button { color: #25100c; border-color: rgba(255,255,255,.32); background: linear-gradient(135deg,#ffd093,#ff9273 55%,#ff725f); box-shadow: 0 6px 17px rgba(255,118,95,.18),inset 0 1px 0 rgba(255,255,255,.55); }
  .toggles .save-button > span { color: #31140e; }
  .toggles .save-button:hover { color: #1d0a07; border-color: rgba(255,255,255,.55); background: linear-gradient(135deg,#ffdcaa,#ffa080 55%,#ff806b); }
  .save-panel { width: min(330px,calc(100vw - 28px)); position: absolute; z-index: 10; inset-inline-end: 8px; top: calc(100% + 9px); padding: 15px; border: 1px solid rgba(255,255,255,.17); border-radius: 18px; color: var(--rf-text); background: linear-gradient(145deg,rgba(32,38,53,.96),rgba(17,21,32,.97)); box-shadow: 0 24px 70px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.1); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); animation: focus-panel-in 170ms ease-out; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-block-end: 11px; font-size: 11px; }
  .panel-head button { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.1); border-radius: 50%; color: var(--rf-muted); background: rgba(255,255,255,.06); font-size: 18px; }
  .panel-head button:hover { color: #fff; background: rgba(255,255,255,.12); }
  .collection-list { max-height: 230px; display: grid; gap: 5px; overflow: auto; }
  .collection-choice { width: 100%; min-height: 42px; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 1px solid transparent; border-radius: 11px; color: var(--rf-text); background: rgba(255,255,255,.045); text-align: start; font-size: 10px; transition: background 150ms ease,border-color 150ms ease; }
  .collection-choice:hover { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.085); }
  .collection-choice span:nth-child(2) { flex: 1; }
  .collection-choice small, .empty { color: var(--rf-muted); }
  .collection-icon { color: var(--rf-accent-bright,var(--rf-accent)); }
  .empty { margin: 10px 0; font-size: 10px; }
  .save-panel a { color: var(--rf-accent-bright,var(--rf-accent)); font-size: 10px; text-underline-offset: 3px; }
  .toast { position: absolute; z-index: 11; inset-inline-end: 10px; bottom: calc(100% + 8px); padding: 8px 12px; border: 1px solid rgba(139,228,211,.3); border-radius: 11px; color: #eafffa; background: rgba(22,71,66,.91); box-shadow: 0 10px 30px rgba(0,0,0,.25); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); font-size: 9px; font-weight: 760; }
  @keyframes focus-panel-in { from { opacity: 0; transform: translateY(-4px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @media (max-width: 760px) { .focusbar { align-items: flex-start; flex-direction: column; gap: 12px; } .toggles { justify-content: flex-start; } }
  @media (max-width: 520px) { .focusbar { padding: 12px; border-radius: 16px; } .intro small { max-width: 220px; } .toggles { gap: 5px; } .toggles button { min-height: 32px; padding-inline: 9px; font-size: 8px; } }

</style>
