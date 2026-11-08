<script lang="ts">
  import type { VideoMeta } from '@src/data/models';
  import VideoCard from './VideoCard.svelte';

  export let title: string;
  export let items: VideoMeta[] = [];
  export let progress: Record<string, number> = {};
  export let badge = '';
  export let onNavigate: (event: MouseEvent, url: string) => void;
  export let onSave: (video: VideoMeta) => void;

  function moveFocus(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const section = (event.currentTarget as HTMLElement).closest('.rail');
    if (!section) return;
    const anchors = Array.from(section.querySelectorAll<HTMLAnchorElement>('[data-rf-card-link]'));
    if (!anchors.length) return;
    const active = (section.getRootNode() as ShadowRoot).activeElement;
    const current = anchors.indexOf(active as HTMLAnchorElement);
    const isRtl = getComputedStyle(section).direction === 'rtl';
    let next = current < 0 ? 0 : current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = anchors.length - 1;
    else if (event.key === 'ArrowRight') next = Math.min(anchors.length - 1, current + (isRtl ? -1 : 1));
    else if (event.key === 'ArrowLeft') next = Math.max(0, current + (isRtl ? 1 : -1));
    event.preventDefault();
    anchors.forEach((anchor, index) => anchor.setAttribute('tabindex', String(index === next ? 0 : -1)));
    anchors[next]?.focus();
  }
</script>

<section class="rail" aria-label={title}>
  <div class="rail-heading"><h2>{title}</h2><span>{items.length ? `${items.length} videos` : ''}</span></div>
  {#if items.length}
    <div class="cards" role="list">
      {#each items as item, index (item.id)}
        <VideoCard
          {item}
          progress={progress[item.id] ?? 0}
          {badge}
          tabindex={index === 0 ? 0 : -1}
          {onNavigate}
          {onSave}
          onKeydown={moveFocus}
        />
      {/each}
    </div>
  {:else}
    <p class="empty">Nothing here yet. Videos will appear after you save or capture them.</p>
  {/if}
</section>

<style>
  .rail { padding-block: 22px 8px; }
  .rail-heading { display: flex; align-items: baseline; gap: 12px; margin-block-end: 13px; }
  h2 { margin: 0; color: var(--rf-text); font-size: 17px; letter-spacing: -.025em; }
  .rail-heading span, .empty { color: var(--rf-muted); font-size: 11px; }
  .cards { display: flex; gap: 15px; overflow-x: auto; padding: 2px 2px 15px; scroll-snap-type: x proximity; scrollbar-color: #424b59 transparent; scrollbar-width: thin; }
  .cards :global(.card) { scroll-snap-align: start; }
  .empty { margin: 0; padding: 12px 0; }
</style>
