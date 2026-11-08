<script lang="ts">
  export let itemCount = 0;
  export let updatedAt: number | null = null;
  export let circuitOpen = false;
  export let hideShorts = false;
  export let onRefresh: () => void;
  export let onSettings: () => void;
  export let onToggleShorts: (value: boolean) => void;

  function relativeTime(value: number | null): string {
    if (!value) return 'not captured yet';
    const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  }
</script>

<aside class:warning={circuitOpen} class="status" aria-live="polite">
  <div class="mark" aria-hidden="true">R</div>
  <div class="copy">
    <strong>{circuitOpen ? 'Reframe paused its feed adapter' : 'Subscriptions snapshot'}</strong>
    <span>{circuitOpen ? 'The native YouTube page is unchanged. Reset the extension or try again later.' : `${itemCount} visible videos saved locally · Updated ${relativeTime(updatedAt)}`}</span>
  </div>
  {#if circuitOpen}
    <button type="button" on:click={onSettings}>Open settings</button>
  {:else}
    <button type="button" on:click={onRefresh}>Refresh snapshot</button>
    <button class:active={hideShorts} class="filter-toggle" type="button" aria-pressed={hideShorts} on:click={() => onToggleShorts(!hideShorts)}>{hideShorts ? 'Shorts hidden' : 'Hide Shorts'}</button>
  {/if}
</aside>

<style>
  .status { display: flex; align-items: center; gap: 13px; margin: 20px auto; padding: 14px 17px; max-width: 1100px; border: 1px solid var(--rf-border); border-radius: 14px; background: var(--rf-surface); color: var(--rf-text); box-sizing: border-box; }
  .mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; background: rgba(255,104,74,.16); color: var(--rf-accent); font-weight: 900; }
  .copy { flex: 1; min-width: 0; display: grid; gap: 3px; }
  .copy strong { font-size: 13px; }
  .copy span { color: var(--rf-muted); font-size: 11px; }
  button { border: 1px solid rgba(255,104,74,.5); border-radius: 9px; padding: 8px 11px; color: var(--rf-text); background: transparent; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
  button:hover, button.active { background: rgba(255,104,74,.12); }
  .warning { border-color: rgba(245,158,11,.45); }
  @media (max-width: 560px) { .status { flex-wrap: wrap; } .copy { flex-basis: calc(100% - 52px); } button { margin-inline-start: 47px; } }
</style>
