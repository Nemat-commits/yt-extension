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
  .focusbar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 18px 0 22px; padding: 13px 15px; color: var(--rf-text); background: linear-gradient(110deg, #171c24, #11151c); border: 1px solid var(--rf-border); border-radius: 14px; box-sizing: border-box; }
  .intro { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .spark { color: var(--rf-accent); font-size: 17px; }
  .intro div { display: grid; gap: 3px; }
  .intro strong { font-size: 12px; }
  .intro small { color: var(--rf-muted); font-size: 10px; }
  .toggles { display: flex; flex-wrap: wrap; gap: 7px; }
  button { font: inherit; cursor: pointer; }
  .toggles button { border: 1px solid var(--rf-border); border-radius: 9px; padding: 8px 10px; color: var(--rf-muted); background: #1c222b; font-size: 10px; font-weight: 700; }
  .toggles button:hover, .toggles button.active { color: var(--rf-text); border-color: rgba(255,104,74,.6); background: rgba(255,104,74,.12); }
  .toggles .save-button { color: #160b08; border-color: transparent; background: var(--rf-accent); }
  .save-panel { position: absolute; z-index: 10; inset-inline-end: 0; top: calc(100% + 8px); width: min(320px, 88vw); padding: 13px; background: #171c24; border: 1px solid #38414e; border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.42); }
  .panel-head { display: flex; justify-content: space-between; align-items: center; margin-block-end: 9px; font-size: 12px; }
  .panel-head button { border: 0; color: var(--rf-muted); background: none; font-size: 20px; }
  .collection-list { max-height: 220px; overflow: auto; display: grid; gap: 4px; }
  .collection-choice { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px; border: 0; border-radius: 8px; color: var(--rf-text); background: transparent; text-align: start; font-size: 12px; }
  .collection-choice:hover { background: #242b35; }
  .collection-choice span:nth-child(2) { flex: 1; }
  .collection-choice small, .empty { color: var(--rf-muted); }
  .collection-icon { color: var(--rf-accent); }
  .save-panel a { color: var(--rf-accent); font-size: 12px; }
  .toast { position: absolute; inset-inline-end: 8px; bottom: calc(100% + 8px); border-radius: 8px; padding: 7px 10px; color: #07110f; background: #42d6c4; font-size: 11px; font-weight: 700; }
  @media (max-width: 650px) { .focusbar { align-items: flex-start; flex-direction: column; } }
</style>
