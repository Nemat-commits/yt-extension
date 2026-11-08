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
  .card { min-width: 205px; max-width: 245px; flex: 0 0 22%; display: grid; gap: 9px; color: var(--rf-text); }
  .media-link { display: grid; gap: 10px; color: inherit; text-decoration: none; border-radius: 13px; }
  .media-link:focus-visible { outline: 2px solid var(--rf-accent); outline-offset: 4px; }
  .thumbnail-wrap { aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--rf-border); border-radius: 13px; position: relative; background: #202631; }
  img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform 180ms ease; }
  .media-link:hover img { transform: scale(1.035); }
  .duration { position: absolute; inset-inline-end: 8px; bottom: 8px; border-radius: 5px; padding: 3px 6px; color: white; background: rgba(0, 0, 0, .82); font-size: 11px; font-weight: 700; }
  .progress-track { position: absolute; inset-inline: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.32); }
  .progress-track span { height: 100%; display: block; background: var(--rf-accent); }
  .copy { display: grid; gap: 4px; min-height: 56px; }
  .copy strong { font-size: 13px; line-height: 1.42; font-weight: 650; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .channel { color: var(--rf-muted); font-size: 11px; }
  .badge { justify-self: start; color: var(--rf-accent); font-size: 9px; text-transform: uppercase; letter-spacing: .1em; font-weight: 800; }
  .save { border: 0; padding: 5px 0; color: var(--rf-muted); background: transparent; text-align: start; font-size: 11px; cursor: pointer; }
  .save:hover { color: var(--rf-text); }
  .save span { color: var(--rf-accent); font-size: 15px; vertical-align: -1px; }
  @media (max-width: 850px) { .card { flex-basis: 32%; min-width: 175px; } }
  @media (max-width: 520px) { .card { flex-basis: 70%; min-width: 220px; } }
  @media (prefers-reduced-motion: reduce) { img { transition: none; } }
</style>
