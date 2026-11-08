<script lang="ts">
  import type { VideoMeta } from '@src/data/models';

  export let item: VideoMeta;
  export let progress = 0;
  export let badge = '';
  export let tabindex = -1;
  export let onNavigate: (event: MouseEvent, url: string) => void;
  export let onSave: (video: VideoMeta) => void;
  export let onKeydown: (event: KeyboardEvent) => void = () => undefined;

  $: safeProgress = Math.max(0, Math.min(100, progress));
</script>

<article class="card">
  <a
    class="media-link"
    href={item.url}
    data-rf-card-link
    {tabindex}
    aria-label={`Watch ${item.title}${item.channelTitle ? ` by ${item.channelTitle}` : ''}`}
    on:click={(event) => onNavigate(event, item.url)}
    on:keydown={onKeydown}
  >
    <div class="thumbnail-wrap">
      <img src={item.thumbnailUrl} alt="" loading="lazy" />
      {#if item.durationText}<span class="duration">{item.durationText}</span>{/if}
      {#if safeProgress > 0}<span class="progress-track" aria-label={`${Math.round(safeProgress)} percent watched`}><span style={`width:${safeProgress}%`}></span></span>{/if}
    </div>
    <span class="copy">
      {#if badge}<span class="badge">{badge}</span>{/if}
      <strong>{item.title}</strong>
      {#if item.channelTitle}<span class="channel">{item.channelTitle}</span>{/if}
    </span>
  </a>
  <button class="save" type="button" aria-label={`Save ${item.title} to a collection`} on:click={() => onSave(item)}>
    <span aria-hidden="true">＋</span> Save
  </button>
</article>

<style>
  .card {
    min-width: 215px; max-width: 285px; flex: 0 0 24%; display: grid; align-content: start; gap: 8px;
    color: var(--rf-text); border: 1px solid rgba(255,255,255,.085); border-radius: 19px; padding: 7px;
    background: linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.022));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.075),0 10px 27px rgba(0,0,0,.13);
    transition: transform 210ms ease,border-color 210ms ease,background 210ms ease,box-shadow 210ms ease;
  }
  .card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.17); background: linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.035)); box-shadow: 0 17px 36px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.11); }
  .media-link { min-width: 0; display: grid; gap: 10px; overflow: hidden; border-radius: 14px; color: inherit; text-decoration: none; }
  .media-link:focus-visible { outline: 2px solid var(--rf-accent-bright,var(--rf-accent)); outline-offset: 3px; }
  .thumbnail-wrap { aspect-ratio: 16/9; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,.13); border-radius: 13px; background: linear-gradient(135deg,#2b3242,#141923); }
  img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform 450ms cubic-bezier(.2,.75,.25,1),filter 350ms ease; }
  .media-link:hover img { transform: scale(1.045); filter: saturate(1.08); }
  .thumbnail-wrap::after { position: absolute; inset: 0; content: ""; pointer-events: none; background: linear-gradient(180deg,rgba(0,0,0,.03),transparent 53%,rgba(0,0,0,.19)); }
  .duration { position: absolute; z-index: 1; inset-inline-end: 8px; bottom: 8px; padding: 4px 7px; border: 1px solid rgba(255,255,255,.18); border-radius: 7px; color: #fff; background: rgba(8,10,14,.76); box-shadow: 0 3px 9px rgba(0,0,0,.2); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); font-size: 10px; font-weight: 760; letter-spacing: .02em; }
  .progress-track { height: 4px; position: absolute; z-index: 2; inset-inline: 0; bottom: 0; overflow: hidden; background: rgba(255,255,255,.29); }
  .progress-track span { height: 100%; display: block; border-radius: 0 99px 99px 0; background: linear-gradient(90deg,#ff685b,#ffc17d); box-shadow: 0 0 10px rgba(255,118,95,.8); }
  .copy { min-width: 0; display: grid; gap: 5px; min-height: 62px; padding: 0 5px 2px; }
  .copy strong { overflow: hidden; display: -webkit-box; color: #f4f5f8; font-size: 12px; line-height: 1.45; font-weight: 680; letter-spacing: -.005em; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .channel { overflow: hidden; color: var(--rf-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .badge { justify-self: start; padding: 3px 7px; border: 1px solid rgba(139,228,211,.17); border-radius: 999px; color: var(--rf-mint,#8be4d3); background: rgba(139,228,211,.055); font-size: 8px; text-transform: uppercase; letter-spacing: .12em; font-weight: 850; }
  .save { justify-self: start; min-height: 29px; display: inline-flex; align-items: center; gap: 6px; margin: 0 4px 3px; padding: 5px 9px; border: 1px solid transparent; border-radius: 999px; color: var(--rf-muted); background: rgba(255,255,255,.035); text-align: start; font-size: 10px; font-weight: 720; cursor: pointer; transition: color 160ms ease,border-color 160ms ease,background 160ms ease; }
  .save:hover { color: #fff; border-color: rgba(255,255,255,.11); background: rgba(255,255,255,.075); }
  .save span { color: var(--rf-accent-bright,var(--rf-accent)); font-size: 14px; line-height: 1; }
  @media (max-width: 850px) { .card { flex-basis: 34%; min-width: 195px; } }
  @media (max-width: 520px) { .card { flex-basis: 72%; min-width: 220px; } }

</style>
