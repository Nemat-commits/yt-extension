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
  .workspace {
    max-width: 1240px; margin: 26px auto; padding: clamp(18px,3vw,30px); position: relative; overflow: hidden;
    border: 1px solid rgba(255,255,255,.12); border-radius: 25px; color: var(--rf-text);
    background: radial-gradient(ellipse at 0 0,rgba(255,118,95,.09),transparent 38%),linear-gradient(145deg,rgba(24,29,42,.84),rgba(14,18,28,.77));
    box-shadow: 0 24px 65px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.1);
    -webkit-backdrop-filter: blur(22px) saturate(135%); backdrop-filter: blur(22px) saturate(135%);
  }
  .workspace::before { position: absolute; width: 260px; height: 260px; inset-inline-end: -130px; top: -160px; border-radius: 50%; content: ""; pointer-events: none; background: rgba(111,133,255,.09); filter: blur(30px); }
  .workspace-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 22px; margin-block-end: 23px; }
  .eyebrow { color: var(--rf-accent-bright,var(--rf-accent)); font-size: 9px; letter-spacing: .18em; font-weight: 850; }
  h1 { margin: 6px 0 7px; font-size: clamp(28px,4vw,42px); letter-spacing: -.06em; line-height: 1.05; }
  .workspace-head p, .empty-state p { max-width: 570px; color: var(--rf-muted); font-size: 10px; line-height: 1.65; margin: 0; }
  .backup-actions { display: flex; flex-wrap: wrap; gap: 7px; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  .quiet, .primary { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; padding: 8px 13px; font-size: 10px; font-weight: 780; transition: transform 160ms ease,border-color 160ms ease,background 160ms ease,box-shadow 160ms ease; }
  .quiet { color: #e8ebf1; border: 1px solid rgba(255,255,255,.13); background: rgba(255,255,255,.055); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
  .quiet:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.1); }
  .primary { color: #24100c; border: 1px solid rgba(255,255,255,.33); background: linear-gradient(135deg,#ffd093,#ff9572 55%,#ff725f); box-shadow: 0 7px 20px rgba(255,118,95,.18),inset 0 1px 0 rgba(255,255,255,.52); }
  .primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 25px rgba(255,118,95,.26),inset 0 1px 0 rgba(255,255,255,.58); }
  button:disabled { opacity: .46; cursor: not-allowed; }
  .create-row { display: flex; gap: 8px; margin-block-end: 14px; }
  input, select { min-width: 0; color: #f0f2f7; background: rgba(8,11,18,.54); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 10px 12px; outline: none; box-shadow: inset 0 1px 0 rgba(255,255,255,.035); transition: border-color 160ms ease,box-shadow 160ms ease,background 160ms ease; }
  input::placeholder { color: #7d8798; }
  input:focus, select:focus { border-color: rgba(255,151,124,.65); background: rgba(10,13,21,.75); box-shadow: 0 0 0 3px rgba(255,118,95,.12); }
  .create-row input { flex: 1; }
  .file-input, .sr-only { position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); overflow: hidden; white-space: nowrap; }
  .notice { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 7px; padding: 6px 10px; border: 1px solid rgba(139,228,211,.18); border-radius: 999px; color: var(--rf-mint,#8be4d3); background: rgba(139,228,211,.05); font-size: 9px; }
  .collection-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,370px),1fr)); gap: 13px; margin-block-start: 18px; }
  .collection-card { min-width: 0; padding: 16px; border: 1px solid rgba(255,255,255,.1); border-radius: 19px; background: linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025)); box-shadow: inset 0 1px 0 rgba(255,255,255,.07),0 10px 28px rgba(0,0,0,.1); transition: border-color 180ms ease,transform 180ms ease,background 180ms ease; }
  .collection-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.16); background: linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.032)); }
  .collection-head { display: flex; align-items: center; gap: 9px; margin-block-end: 13px; }
  .collection-symbol { width: 35px; height: 35px; flex: none; display: grid; place-items: center; border: 1px solid rgba(255,175,140,.21); border-radius: 12px; color: #ffc09d; background: linear-gradient(145deg,rgba(255,118,95,.16),rgba(255,118,95,.05)); box-shadow: inset 0 1px 0 rgba(255,255,255,.1); font-size: 15px; }
  .name-edit { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .name-edit input { width: 100%; padding: 1px 2px; border: 1px solid transparent; border-radius: 6px; color: var(--rf-text); background: transparent; box-shadow: none; font-weight: 760; font-size: 11px; }
  .name-edit input:focus { border-color: rgba(255,151,124,.34); background: rgba(255,255,255,.04); box-shadow: 0 0 0 2px rgba(255,118,95,.09); }
  .name-edit small, .video-list small { color: var(--rf-faint,var(--rf-muted)); font-size: 8px; }
  .move-actions { display: flex; gap: 3px; }
  .icon-button, .remove { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid transparent; border-radius: 9px; color: var(--rf-muted); background: transparent; font-size: 14px; transition: border-color 150ms ease,color 150ms ease,background 150ms ease; }
  .icon-button:hover:not(:disabled), .remove:hover { border-color: rgba(255,255,255,.1); color: #fff; background: rgba(255,255,255,.07); }
  .icon-button:disabled { opacity: .28; cursor: not-allowed; }
  .danger:hover, .remove:hover { color: #ff9b90; border-color: rgba(255,118,95,.2); background: rgba(255,118,95,.08); }
  .add-row, .recent-row { display: flex; gap: 6px; margin-block: 8px; }
  .add-row input, .recent-row select { flex: 1; width: 100%; min-height: 36px; padding: 8px 10px; font-size: 9px; }
  .add-row button, .recent-row button { min-width: 39px; border: 1px solid rgba(255,255,255,.13); border-radius: 11px; padding: 0 10px; color: #ffe0d3; background: rgba(255,118,95,.09); font-size: 9px; font-weight: 800; transition: background 150ms ease,border-color 150ms ease; }
  .add-row button:hover, .recent-row button:hover:not(:disabled) { border-color: rgba(255,151,124,.4); background: rgba(255,118,95,.16); }
  .video-list { display: grid; gap: 7px; list-style: none; margin: 13px 0 0; padding: 0; max-height: 330px; overflow: auto; scrollbar-color: rgba(183,194,213,.28) transparent; scrollbar-width: thin; }
  .video-list li { min-width: 0; display: flex; align-items: center; gap: 7px; padding: 5px; border: 1px solid transparent; border-radius: 12px; transition: border-color 150ms ease,background 150ms ease; }
  .video-list li:hover { border-color: rgba(255,255,255,.075); background: rgba(255,255,255,.035); }
  .video-list a { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; color: #e7eaf1; text-decoration: none; font-size: 9px; font-weight: 680; }
  .video-list a:hover { color: #ffd0bd; }
  .video-list img { width: 78px; flex: none; aspect-ratio: 16/9; object-fit: cover; border: 1px solid rgba(255,255,255,.11); border-radius: 9px; background: #222938; }
  .video-list span { min-width: 0; display: grid; gap: 4px; }
  .video-list span:not(small) { overflow: hidden; text-overflow: ellipsis; }
  .remove { flex: none; font-size: 15px; }
  .empty { margin: 12px 0 0; color: var(--rf-muted); font-size: 9px; line-height: 1.55; }
  .empty-state { position: relative; overflow: hidden; margin-block-start: 18px; padding: 54px 18px; border: 1px dashed rgba(255,255,255,.15); border-radius: 21px; background: radial-gradient(ellipse at 50% 0,rgba(255,118,95,.09),transparent 60%),rgba(255,255,255,.022); text-align: center; }
  .empty-state span { width: 49px; height: 49px; display: grid; place-items: center; margin: 0 auto; border: 1px solid rgba(255,210,139,.24); border-radius: 16px; color: #ffd28b; background: rgba(255,210,139,.08); box-shadow: 0 8px 28px rgba(255,161,104,.1); font-size: 20px; }
  .empty-state h2 { margin: 12px 0 6px; font-size: 18px; letter-spacing: -.04em; }
  .empty-state p { max-width: 440px; margin: 0 auto; line-height: 1.65; }
  @media (max-width: 700px) { .workspace { padding: 16px; margin: 12px; border-radius: 19px; } .workspace-head { align-items: flex-start; flex-direction: column; } .backup-actions { width: 100%; } .create-row { flex-direction: column; } .create-row .primary { min-height: 40px; } }

</style>
