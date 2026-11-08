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
  .status {
    max-width: 1120px; min-height: 74px; display: flex; align-items: center; gap: 13px;
    margin: 18px auto; padding: 13px 15px; border: 1px solid rgba(139,228,211,.15); border-radius: 18px;
    color: var(--rf-text); background: linear-gradient(120deg,rgba(18,43,44,.58),rgba(20,26,39,.76));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.09),0 15px 38px rgba(0,0,0,.17);
    -webkit-backdrop-filter: blur(20px) saturate(135%); backdrop-filter: blur(20px) saturate(135%);
  }
  .mark { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border: 1px solid rgba(139,228,211,.22); border-radius: 13px; color: var(--rf-mint,#8be4d3); background: linear-gradient(145deg,rgba(139,228,211,.15),rgba(139,228,211,.045)); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); font-weight: 900; }
  .copy { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .copy strong { font-size: 11px; letter-spacing: -.01em; }
  .copy span { color: var(--rf-muted); font-size: 10px; line-height: 1.5; }
  button { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 7px 11px; color: #e9edf3; background: rgba(255,255,255,.06); font: inherit; font-size: 9px; font-weight: 760; cursor: pointer; transition: transform 160ms ease,border-color 160ms ease,background 160ms ease; }
  button:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.1); }
  button.active { color: #ffe5db; border-color: rgba(255,153,129,.35); background: rgba(255,118,95,.11); }
  .warning { border-color: rgba(255,194,111,.32); background: linear-gradient(120deg,rgba(67,48,26,.48),rgba(20,26,39,.78)); }
  .warning .mark { color: #ffd28b; border-color: rgba(255,210,139,.24); background: rgba(255,210,139,.1); }
  @media (max-width: 620px) { .status { flex-wrap: wrap; align-items: flex-start; } .copy { flex-basis: calc(100% - 54px); } .status button { margin-inline-start: 51px; } }

</style>
