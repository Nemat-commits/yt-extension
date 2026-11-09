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
  .rail { min-width: 0; padding-block: 10px 3px; }
  .rail-heading { display: flex; align-items: center; gap: 10px; margin-block-end: 13px; }
  h2 { display: inline-flex; align-items: center; gap: 9px; margin: 0; color: var(--rf-text); font-size: 18px; letter-spacing: -.04em; }
  h2::before { width: 4px; height: 21px; border-radius: 99px; content: ""; background: linear-gradient(180deg,var(--rf-accent-bright,var(--rf-accent)),rgba(255,118,95,.35)); box-shadow: 0 0 15px rgba(255,118,95,.26); }
  .rail-heading span { display: inline-flex; align-items: center; min-height: 22px; padding: 3px 8px; border: 1px solid rgba(255,255,255,.09); border-radius: 999px; color: var(--rf-faint); background: rgba(255,255,255,.035); font-size: 8px; font-weight: 700; }
  .cards { display: flex; gap: 12px; overflow-x: auto; padding: 3px 2px 17px; scroll-snap-type: x proximity; scrollbar-color: rgba(183,194,213,.32) transparent; scrollbar-width: thin; }
  .cards::-webkit-scrollbar { height: 5px; }
  .cards::-webkit-scrollbar-track { background: transparent; }
  .cards::-webkit-scrollbar-thumb { border-radius: 99px; background: rgba(183,194,213,.28); }
  .cards::-webkit-scrollbar-thumb:hover { background: rgba(183,194,213,.48); }
  .cards :global(.card) { scroll-snap-align: start; }
  .empty { margin: 0; padding: 17px 19px; border: 1px dashed rgba(255,255,255,.14); border-radius: 15px; color: var(--rf-muted); background: rgba(255,255,255,.025); font-size: 10px; }

</style>
