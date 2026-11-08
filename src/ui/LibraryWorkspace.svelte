<script lang="ts">
  import type { Collection, ResumeState, VideoMeta } from '@src/data/models';
  import { exportCollections, makeVideoMeta, parseVideoId, MAX_IMPORT_BYTES } from '@src/data/validation';

  export let collections: Collection[] = [];
  export let resumeStates: ResumeState[] = [];
  export let onCreate: (name: string) => Promise<void>;
  export let onRename: (id: string, name: string) => Promise<void>;
  export let onDelete: (id: string) => Promise<void>;
  export let onAddVideo: (id: string, video: VideoMeta) => Promise<void>;
  export let onRemoveVideo: (id: string, videoId: string) => Promise<void>;
  export let onMove: (id: string, direction: -1 | 1) => Promise<void>;
  export let onImport: (json: string) => Promise<number>;
  export let onNavigate: (event: MouseEvent, path: string) => void;

  let newName = '';
  let addUrl: Record<string, string> = {};
  let renameDraft: Record<string, string> = {};
  let recentChoice: Record<string, string> = {};
  let importInput: HTMLInputElement;
  let notice = '';
  let busy = false;

  async function create(): Promise<void> {
    const value = newName.trim();
    if (!value) return;
    busy = true;
    try {
      await onCreate(value);
      newName = '';
      notice = 'Collection created';
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Could not create collection';
    } finally {
      busy = false;
    }
  }

  async function addFromUrl(collectionId: string): Promise<void> {
    const raw = addUrl[collectionId] ?? '';
    const videoId = parseVideoId(raw);
    if (!videoId) { notice = 'Enter a valid YouTube video URL or 11-character ID.'; return; }
    try {
      await onAddVideo(collectionId, makeVideoMeta(videoId));
      addUrl[collectionId] = '';
      notice = 'Video added';
    } catch (error) { notice = error instanceof Error ? error.message : 'Could not add video'; }
  }

  async function addRecent(collectionId: string): Promise<void> {
    const found = resumeStates.find((state) => state.video.id === recentChoice[collectionId]);
    if (!found) return;
    await onAddVideo(collectionId, found.video);
    notice = 'Added from Continue Watching';
  }

  async function downloadBackup(): Promise<void> {
    const blob = new Blob([exportCollections(collections)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reframe-collections-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { notice = 'Import files must be 2 MB or smaller.'; input.value = ''; return; }
    try {
      const count = await onImport(await file.text());
      notice = `Imported ${count} collection${count === 1 ? '' : 's'}; existing lists were merged.`;
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Import failed';
    } finally {
      input.value = '';
    }
  }

  async function removeCollection(collection: Collection): Promise<void> {
    if (!window.confirm(`Delete “${collection.name}” and its saved videos?`)) return;
    await onDelete(collection.id);
  }

  function updateName(id: string, currentName: string): void {
    const name = (renameDraft[id] ?? currentName).trim();
    if (name && name !== currentName) void onRename(id, name).then(() => notice = 'Collection renamed').catch((error) => notice = error instanceof Error ? error.message : 'Rename failed');
  }
</script>

<section class="workspace" aria-labelledby="library-title">
  <div class="workspace-head">
    <div><span class="eyebrow">YOUR PRIVATE LIBRARY</span><h1 id="library-title">Collections</h1><p>Save videos locally and bring your own order to what you watch.</p></div>
    <div class="backup-actions">
      <button class="quiet" type="button" on:click={downloadBackup}>Export JSON</button>
      <button class="quiet" type="button" on:click={() => importInput?.click()}>Import JSON</button>
      <input bind:this={importInput} class="file-input" type="file" accept="application/json,.json" on:change={importBackup} />
    </div>
  </div>

  <form class="create-row" on:submit|preventDefault={create}>
    <label class="sr-only" for="rf-new-collection">New collection name</label>
    <input id="rf-new-collection" bind:value={newName} maxlength="80" placeholder="e.g. Watch this weekend" />
    <button class="primary" type="submit" disabled={busy || !newName.trim()}>＋ New collection</button>
  </form>

  {#if notice}<p class="notice" role="status">{notice}</p>{/if}

  {#if collections.length}
    <div class="collection-grid">
      {#each collections as collection, index (collection.id)}
        <article class="collection-card">
          <div class="collection-head">
            <span class="collection-symbol" aria-hidden="true">▤</span>
            <div class="name-edit">
              <label class="sr-only" for={`rename-${collection.id}`}>Collection name</label>
              <input id={`rename-${collection.id}`} value={renameDraft[collection.id] ?? collection.name} on:input={(event) => renameDraft[collection.id] = event.currentTarget.value} on:change={() => updateName(collection.id, collection.name)} on:keydown={(event) => event.key === 'Enter' && updateName(collection.id, collection.name)} />
              <small>{collection.videos.length} saved video{collection.videos.length === 1 ? '' : 's'}</small>
            </div>
            <div class="move-actions" aria-label="Reorder collection">
              <button class="icon-button" type="button" aria-label={`Move ${collection.name} up`} disabled={index === 0} on:click={() => onMove(collection.id, -1)}>↑</button>
              <button class="icon-button" type="button" aria-label={`Move ${collection.name} down`} disabled={index === collections.length - 1} on:click={() => onMove(collection.id, 1)}>↓</button>
            </div>
            <button class="icon-button danger" type="button" aria-label={`Delete ${collection.name}`} on:click={() => removeCollection(collection)}>×</button>
          </div>

          <form class="add-row" on:submit|preventDefault={() => addFromUrl(collection.id)}>
            <input bind:value={addUrl[collection.id]} aria-label={`Video URL for ${collection.name}`} placeholder="Paste a YouTube video URL" />
            <button type="submit" aria-label="Add video">Add</button>
          </form>

          {#if resumeStates.length}
            <div class="recent-row">
              <select bind:value={recentChoice[collection.id]} aria-label="Choose a recent video">
                <option value="">Add from Continue Watching…</option>
                {#each resumeStates as state (state.video.id)}<option value={state.video.id}>{state.video.title}</option>{/each}
              </select>
              <button type="button" disabled={!recentChoice[collection.id]} on:click={() => addRecent(collection.id)}>＋</button>
            </div>
          {/if}

          {#if collection.videos.length}
            <ul class="video-list">
              {#each collection.videos as video (video.id)}
                <li>
                  <a href={video.url} on:click={(event) => onNavigate(event, video.url)}><img src={video.thumbnailUrl} alt="" loading="lazy" /><span>{video.title}<small>{video.channelTitle || 'YouTube video'}</small></span></a>
                  <button class="remove" type="button" aria-label={`Remove ${video.title}`} on:click={() => onRemoveVideo(collection.id, video.id)}>×</button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty">Paste a link above, or save something from a watch page.</p>
          {/if}
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-state"><span aria-hidden="true">✦</span><h2>Your library starts here</h2><p>Create a collection to gather videos for a project, a quiet evening, or a topic you want to learn.</p></div>
  {/if}
</section>

<style>
  .workspace { max-width: 1120px; margin: 28px auto; padding: 24px; color: var(--rf-text); background: var(--rf-surface); border: 1px solid var(--rf-border); border-radius: 20px; box-sizing: border-box; }
  .workspace-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 22px; margin-block-end: 22px; }
  .eyebrow { color: var(--rf-accent); font-size: 9px; letter-spacing: .15em; font-weight: 800; }
  h1 { margin: 5px 0; font-size: clamp(24px, 3vw, 34px); letter-spacing: -.04em; }
  .workspace-head p, .empty-state p { color: var(--rf-muted); font-size: 12px; margin: 0; }
  .backup-actions { display: flex; gap: 8px; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  .quiet, .primary { border-radius: 9px; padding: 9px 12px; font-size: 11px; font-weight: 700; }
  .quiet { color: var(--rf-text); border: 1px solid var(--rf-border); background: transparent; }
  .primary { color: #180b08; border: 0; background: var(--rf-accent); }
  button:disabled { opacity: .45; cursor: not-allowed; }
  .create-row { display: flex; gap: 8px; margin-block-end: 14px; }
  input, select { min-width: 0; color: var(--rf-text); background: #0e1218; border: 1px solid var(--rf-border); border-radius: 9px; padding: 10px 11px; outline: none; }
  input:focus, select:focus { border-color: var(--rf-accent); }
  .create-row input { flex: 1; }
  .file-input, .sr-only { position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); overflow: hidden; }
  .notice { color: #42d6c4; font-size: 11px; }
  .collection-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr)); gap: 14px; margin-block-start: 18px; }
  .collection-card { min-width: 0; padding: 16px; border: 1px solid var(--rf-border); border-radius: 15px; background: #10141a; }
  .collection-head { display: flex; align-items: center; gap: 10px; margin-block-end: 13px; }
  .collection-symbol { color: var(--rf-accent); font-size: 19px; }
  .name-edit { flex: 1; display: grid; gap: 3px; }
  .name-edit input { width: 100%; padding: 2px 0; color: var(--rf-text); background: none; border: 0; font-weight: 750; font-size: 14px; }
  .name-edit small, .video-list small { color: var(--rf-muted); font-size: 10px; }
  .move-actions { display: flex; gap: 1px; }
  .icon-button, .remove { border: 0; color: var(--rf-muted); background: transparent; font-size: 17px; }
  .icon-button:disabled { opacity: .3; cursor: not-allowed; }
  .danger:hover, .remove:hover { color: #ff8066; }
  .add-row, .recent-row { display: flex; gap: 6px; margin-block: 8px; }
  .add-row input, .recent-row select { flex: 1; width: 100%; padding: 8px 9px; font-size: 10px; }
  .add-row button, .recent-row button { border: 1px solid var(--rf-border); border-radius: 8px; padding: 0 10px; color: var(--rf-text); background: #202732; font-size: 10px; }
  .video-list { display: grid; gap: 9px; list-style: none; margin: 14px 0 0; padding: 0; max-height: 320px; overflow: auto; }
  .video-list li { display: flex; align-items: center; gap: 8px; }
  .video-list a { min-width: 0; flex: 1; display: flex; align-items: center; gap: 9px; color: var(--rf-text); text-decoration: none; font-size: 11px; font-weight: 650; }
  .video-list a:hover { color: var(--rf-accent); }
  .video-list img { width: 76px; aspect-ratio: 16/9; object-fit: cover; border-radius: 7px; background: #222; }
  .video-list span { min-width: 0; display: grid; gap: 4px; }
  .video-list span:not(small) { overflow: hidden; text-overflow: ellipsis; }
  .remove { font-size: 17px; }
  .empty { color: var(--rf-muted); font-size: 11px; margin: 12px 0 0; }
  .empty-state { padding: 48px 16px; text-align: center; }
  .empty-state span { color: var(--rf-accent); font-size: 26px; }
  .empty-state h2 { margin: 8px 0; }
  .empty-state p { max-width: 400px; margin: 0 auto; line-height: 1.6; }
  @media (max-width: 650px) { .workspace { padding: 16px; margin: 12px; } .workspace-head { align-items: flex-start; flex-direction: column; } .create-row { flex-direction: column; } }
</style>
