# Reframe — YouTube Streaming Experience Extension (v2.0 Revised Architecture & Delivery Roadmap)

**Document status:** Production-audited v2.0 engineering baseline (incorporating SPA, MV3, and WXT runtime fixes)
**Prepared:** 2026-11-08
**Product direction:** Cinematic, subscription-first streaming interface over YouTube
**Working name:** Reframe (placeholder; trademark and store-listing clearance required)
**Primary target:** Desktop Chrome, [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
**Secondary targets:** Microsoft Edge after Chrome stabilization; Mozilla Firefox as a fast-follow
**Playback strategy:** Keep YouTube’s native `#movie_player` and authentication intact; redesign the experience around it

## 0. How to Use This Document

This document serves as the single engineering, design, QA, and release baseline for the **Reframe** browser extension. It defines:

- What the product is and is not
- The corrected technical architecture for [WXT](https://wxt.dev/guide/introduction), [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), and YouTube’s Polymer Single-Page Application (SPA)
- Split storage schemas (`storage.local` vs. `storage.sync` vs. `storage.session`), data models, and privacy boundaries
- Feature specifications, edge-case guards, and acceptance criteria
- A 12-week phased delivery roadmap with release gates
- Testing, performance, security, and maintenance runbooks

**Normative language:** "Must" is required for the MVP baseline. "Should" is strongly recommended. "May" is optional or deferred.

**Policy & platform notice:** Platform policies, [YouTube Terms of Service](https://www.youtube.com/static?template=terms), [YouTube Data API quotas](https://developers.google.com/youtube/data/getting-started), and [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) evolve over time. Re-verify all external constraints before implementation and prior to each public release. This document provides engineering architecture guidance, not legal advice.

## 1. Executive Summary

### 1.1 Product Thesis preserves Native Playback while Redesigning Discovery

Reframe transforms YouTube into a calmer, intentional, subscription-first streaming application:

- A subscription-first Home dashboard with one-click feature activation
- Local, ad-aware Continue Watching progress tracking
- Personal video collections and a cleaner library view
- A theater-like Watch page with an instant Focus Mode
- A cohesive visual token system and guaranteed reversible controls ("Original Mode")

It does **not** replace YouTube’s video player, extract media streams, block or skip advertisements, call undocumented internal APIs, or claim to be an official YouTube client.

### 1.2 Recommended Architecture in One Paragraph

Build a [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) browser extension using [WXT](https://wxt.dev/guide/introduction) + TypeScript + Svelte 5. Use a synchronous `document_start` bootstrap with a cached `localStorage` mirror attribute (`data-rf-boot`) on `<html>` to eliminate Flash of Unstyled Content (FOUC) while asynchronous [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) reads resolve. Scope all page-level CSS overrides strictly to route-specific Polymer host elements (`html[data-rf-enabled="true"][data-rf-route="..."] ytd-browse[page-subtype="..."]`), mount custom surfaces inside isolated Shadow DOM containers via WXT’s [`createShadowRootUi`](https://wxt.dev/guide/essentials/content-scripts), and bridge Shadow DOM link clicks into YouTube’s native Polymer SPA router so active Miniplayer streams never suffer hard page reloads. Separate storage into `local:deviceConfig` (consent, kill switches, privacy toggles), `sync:preferences` (theme, layout), `local:userData` (collections, watch progress, feed snapshots), and `session:featureHealth` (explicitly unlocked for content scripts via [`chrome.storage.session.setAccessLevel`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel)).

### 1.3 Key Architectural Decisions

| Decision Area | Selected Approach | Engineering Rationale |
| :--- | :--- | :--- |
| **Extension Platform** | [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) | Required for Chrome Web Store submissions; enforces bundled code and service-worker background lifecycles. |
| **Build Framework** | [WXT](https://wxt.dev/guide/introduction) + TypeScript | Provides file-based [entrypoints](https://wxt.dev/guide/essentials/entrypoints.html), typed [WXT Storage](https://wxt.dev/storage), and cross-browser MV3 builds. |
| **UI Framework** | Svelte 5 | Compiles to minimal, zero-virtual-DOM JavaScript bundles suited for injected Shadow DOM UIs. |
| **Anti-FOUC Bootstrap** | Sync `localStorage` hint + `document_start` CSS | Eliminates the 15–50 ms asynchronous `chrome.storage` race window that otherwise flashes native YouTube on load. |
| **Page Modification** | Route-scoped CSS + non-destructive DOM adapters | Preserves Polymer data bindings, infinite scroll continuations, and cached `ytd-browse` instances across SPA navigations. |
| **Custom UI Isolation** | Shadow DOM ([`createShadowRootUi`](https://wxt.dev/guide/essentials/content-scripts)) | Prevents YouTube global `--yt-spec-*` variables and Polymer styles from colliding with Reframe components. |
| **SPA Link Navigation** | Intercepted `<a href>` with Light-DOM SPA handoff | Preserves native right-click/middle-click URL behavior while preventing hard reloads that kill the Miniplayer. |
| **Player Strategy** | Native `#movie_player` (untouched) | Preserves DRM, codecs, captions, quality switching, live streams, ads, and authentication. |
| **Storage Topology** | Split `local` / `sync` / `session` keys ([Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)) | Prevents unconsented syncing of device-local state and properly unlocks `storage.session` for content scripts. |
| **Official YouTube API** | Deferred post-MVP ([YouTube Data API v3](https://developers.google.com/youtube/data/getting-started)) | Avoids OAuth verification, API key friction, and [daily quota limits](https://developers.google.com/youtube/data/determine_quota_cost) for the initial release. |

### 1.4 Critical Engineering Corrections Built Into v2.0

1. **Unblocking `chrome.storage.session` in Content Scripts:** Unlike `storage.local` and `storage.sync`, [`chrome.storage.session`](https://developer.chrome.com/docs/extensions/reference/api/storage) is **blocked in content scripts by default**. The background service worker must call `chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })` ([MDN `setAccessLevel`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel)) during `runtime.onInstalled` and `runtime.onStartup` before any content script reads or writes `session:featureHealth`.
2. **Preventing Flash of Unstyled Content (FOUC) at `document_start`:** Because `await storage.getItem()` is asynchronous, waiting for it before applying `html[data-rf-enabled="true"]` allows YouTube to paint its native interface first. Reframe v2.0 mirrors a non-sensitive boolean hint (`rf_boot_enabled`, `rf_boot_theme`) in origin `localStorage` to apply root attributes synchronously at `document_start`, then reconciles with `chrome.storage` once resolved.
3. **Preserving SPA Navigation & Miniplayer from Shadow DOM Links:** Clicking a standard `<a href="/watch?v=...">` inside a Shadow DOM bypasses YouTube’s Polymer click listener (`ytd-app`), causing a full browser reload that destroys active Miniplayer playback. Reframe v2.0 keeps real `href` attributes for accessibility and context menus, but intercepts unmodified primary clicks (`button === 0`, no modifier keys) and delegates navigation through a light-DOM `a.yt-simple-endpoint` bridge or YouTube’s navigation dispatcher.
4. **Ad-Aware & SPA-Safe `Continue Watching` Tracking:** YouTube plays pre-roll and mid-roll video ads inside the **exact same `<video class="video-stream html5-main-video">` element** used for the main video, and reuses that `<video>` element across SPA transitions. The v2.0 tracker halts immediately on `yt-navigate-start`, checks `#movie_player` for `.ad-showing` / `.ad-interrupting` before recording timestamps, and automatically removes or marks videos completed when progress reaches `>= 95%` or fires `ended`.
5. **Handling Polymer’s Cached `ytd-browse` Views & Lazy Thumbnails:** YouTube keeps previously visited `ytd-browse` nodes (`page-subtype="home"`, `page-subtype="subscriptions"`, `page-subtype="channels"`) alive in the DOM simultaneously and toggles their `[hidden]` attribute. Additionally, `yt-navigate-finish` fires **before** feed cards finish stamping and before off-screen `<img>` tags receive `src` attributes ([DEV Community](https://dev.to/superlede/what-youtubes-single-page-app-did-to-my-chrome-extension-h7a)). Reframe v2.0 scopes CSS rules by both `html[data-rf-route]` and `ytd-browse[page-subtype]`, awaits card population via a bounded `MutationObserver`, and derives fallback thumbnails deterministically (`https://i.ytimg.com/vi/<videoId>/hqdefault.jpg`).
6. **Splitting Synced Preferences from Local Consent & Privacy State:** Instead of a single monolithic `settings` object that contradicts `storage.sync` vs. `storage.local` boundaries, v2.0 splits state into `local:deviceConfig` (consent version, master enable, privacy toggles, feature kill switches) and `sync:preferences` (theme, density, layout).

## 2. Product Definition

### 2.1 Vision

> Open YouTube and feel like you stepped into a calm, personal streaming cinema: your subscriptions, your collections, your watch progress, and a distraction-free theater.

### 2.2 Target Users

- Viewers who use YouTube primarily for subscriptions, long-form essays, documentaries, courses, and creators they intentionally follow
- Users who want a calmer, distraction-free interface without losing their YouTube account, Premium benefits, playlists, or native player controls
- Desktop users who value dark cinema themes, Focus Mode, and keyboard-accessible navigation

### 2.3 Product Principles

1. **Never break playback:** Native video playback, captions, quality selection, fullscreen, Miniplayer, Picture-in-Picture (PiP), live streams, and authentication must always work.
2. **Everything is reversible:** "Original Mode" must restore native YouTube cleanly at any time without requiring an uninstall.
3. **Be honest about data:** Clearly badge local watch progress, cached subscription feeds (with capture timestamps), and native YouTube surfaces.
4. **Local-first by default:** Zero developer-operated servers, zero analytics SDKs, zero remote code execution, and zero credential harvesting.
5. **Graceful degradation:** If a DOM selector or adapter fails after a YouTube update, trip the per-feature circuit breaker and fall back to the native YouTube surface.
6. **Cohesive visual identity:** Cinematic, restrained, high-contrast dark UI with clear creator attribution and zero impersonation of YouTube or Netflix trademarks.
7. **Least privilege:** Request only `"storage"` and `https://www.youtube.com/*` host matches in the MVP [manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts).

### 2.4 MVP Scope

**In Scope for MVP**

- Anti-FOUC global dark theme (`Midnight`) and route-scoped native restyling
- Reframe navigation shell with SPA-safe link routing and persistent Original Mode toggle
- Subscription-first Home dashboard with one-click inline opt-in cards for local caching and progress tracking
- Enhanced Subscriptions page (`/feed/subscriptions`) using non-destructive CSS grid/rail restyling and visible-feed snapshot capture
- Ad-aware, SPA-safe local Continue Watching rail
- Redesigned Watch page surroundings with collapsible metadata/comments and Focus Mode
- Local Collections library with validated JSON import/export
- Quick-toggle Popup and comprehensive Options / Onboarding page
- Per-feature circuit breakers and manual kill switches
- Desktop Chrome MV3 release and Microsoft Edge compatibility validation

**Out of Scope for MVP**

- Replacing, reparenting, or overlaying custom HTML controls inside `#movie_player`
- Blocking, skipping, muting, or tampering with YouTube advertisements
- Background tab opening, hidden `fetch()` scraping, or undocumented InnerTube API calls
- Cloud or cross-device syncing of watch progress or large collection payloads
- Automated YouTube playlist write-back (deferred to post-MVP OAuth phase)
- Mobile browsers, YouTube TV, YouTube Music, YouTube Kids, YouTube Studio, or third-party embedded players

### 2.5 Success Metrics

| Metric Category | MVP Target |
| :--- | :--- |
| **Playback Regressions** | Zero regressions across standard, live, premiere, age-restricted, and ad-supported videos |
| **Miniplayer Continuity** | 100% of navigations initiated from Reframe UI preserve active Miniplayer playback without hard reload |
| **Original-Mode Recovery** | 100% of surfaces restore native YouTube immediately upon toggling Original Mode |
| **Anti-FOUC Reliability** | Zero visible flashes of unstyled native YouTube on initial tab load when Reframe is enabled |
| **Main-Thread Overhead** | `< 50 ms` added main-thread work at p75 during initial boot and `< 50 ms` per SPA route transition |
| **Home Dashboard Render** | `< 100 ms` to render 100 cached video cards on reference desktop hardware |
| **Adapter Resilience** | 3 consecutive selector failures automatically trip the feature circuit breaker and reveal native UI |
| **Accessibility** | Full keyboard operability, WCAG 2.2 AA contrast (`>= 4.5:1` text, `>= 3:1` UI), and `prefers-reduced-motion` support |

## 3. User Experience Architecture

### 3.1 Information Architecture & SPA Navigation Contract

```text
Reframe Experience Layer
├── Home Dashboard      # /                         Shadow DOM dashboard over hidden native home
├── Subscriptions       # /feed/subscriptions       Non-destructive CSS rail/grid + visible-feed snapshotter
├── Library & Saved     # /feed/library (/feed/you) Shadow DOM Collections panel + native library links
├── Search Results      # /results?search_query=... Scoped CSS restyling of native search results
├── Watch Theater       # /watch?v=...              Native player intact; redesigned surroundings + Focus Mode
└── Settings & Consent  # Extension Options / Popup Onboarding, privacy controls, export/import, kill switches
```

**SPA Navigation Rule (Critical Fix):** Every link inside Reframe’s Shadow DOM must render a semantic `<a href="https://www.youtube.com/...">` element so native browser behaviors (middle-click to open in new tab, right-click to copy link, hover status bar preview) work out of the box. However, for unmodified primary clicks (`event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey`), Reframe intercepts `click`, calls `event.preventDefault()`, and dispatches navigation through a persistent, hidden light-DOM `<a class="yt-simple-endpoint">` helper attached to `ytd-app` (falling back to `window.location.assign(url)` only if `ytd-app` is absent). This keeps navigation inside YouTube’s SPA router and keeps the Miniplayer alive.

### 3.2 Home Dashboard (`https://www.youtube.com/`)

**Purpose:** Replace the algorithmic rabbit hole on `/` with a calm, personal streaming dashboard.

**Dashboard Sections**

1. **Featured Hero Banner:**
   - Priority order: User-pinned video/collection item -> Newest unwatched item from cached Subscriptions -> Guided onboarding hero ("Capture your Subscriptions feed in 1 click").
   - Never disguises algorithmic home recommendations as subscription uploads.
2. **Continue Watching Rail:**
   - Displays in-progress videos (`5% <= percent < 95%`) sorted by `updatedAt` descending.
   - If `trackProgress` is currently off, displays an inline card with a single **"Enable Local Progress Tracking"** button so users do not have to hunt through the Options page.
3. **Latest from Subscriptions Rail:**
   - Displays up to 100 normalized items captured from `/feed/subscriptions`, badged with `"Captured [relative time]"` and a **"Refresh from Subscriptions"** CTA that soft-navigates to `/feed/subscriptions`.
   - If `cacheFeeds` is off or no snapshot exists yet, displays a 1-click **"Enable & Open Subscriptions"** action card.
4. **Your Collections Rail:**
   - Displays user-created local collections (e.g., "Watch This Weekend", "Cinematography Study", "Rust Tutorials") with quick-add and modal management.
5. **Native Library Shortcuts:**
   - Direct SPA-bridged shortcuts to Watch Later (`/playlist?list=WL`), History (`/feed/history`), Liked Videos (`/playlist?list=LL`), and Subscriptions (`/feed/subscriptions`).
6. **Optional: Picked by YouTube (Default Off):**
   - Disabled by default. When explicitly enabled by the user, reads visible cards already rendered in `ytd-browse[page-subtype="home"]` and labels them clearly with a `"YouTube Algorithmic Feed"` badge.

### 3.3 Subscriptions Page (`https://www.youtube.com/feed/subscriptions`)

**Purpose:** Deliver a clean, high-signal browsing view of the channels the user follows while refreshing the local snapshot for the Home dashboard.

**Behavior**

- Applies non-destructive CSS grid/card restyling directly to `ytd-browse[page-subtype="subscriptions"]` so native infinite scroll (`ytd-continuation-item-renderer`) continues working without interruption.
- Attaches a scoped, debounced `MutationObserver` to `ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer #contents` that waits for cards to stamp after `yt-navigate-finish`.
- Extracts visible card metadata into `FeedSnapshot` (`id: "subscriptions"`, bounded to 100 items) when `privacy.cacheFeeds` is enabled.
- Derives missing thumbnail URLs deterministically from the 11-character `videoId` (`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`) whenever below-the-fold `<img>` elements have not lazy-loaded their `src` attribute yet.
- Injects a lightweight top filter bar (All Videos | Hide Shorts | Channels A–Z filter) using CSS attribute filtering rather than detaching DOM nodes.

### 3.4 Watch Page (`https://www.youtube.com/watch?v=...`)

**Untouched Native Core**

- `#movie_player` and all child elements (`.html5-video-container`, `<video>`, `.ytp-chrome-bottom`, captions, settings cog, theater/fullscreen toggles, ad overlays)
- Native keyboard shortcuts (`k`, `j`, `l`, `f`, `t`, `i`, `m`, `c`)
- Live stream chat iframe (`ytd-live-chat-frame`) functionality

**Redesigned Surroundings**

- **Theater Spacing & Ambient Backdrop:** Clean dark framing around `#player-container-outer` without applying `transform`, `filter`, `perspective`, or `contain: paint` on player ancestors (which would break fixed fullscreen positioning in Chromium).
- **Streamlined Metadata Bar:** High-contrast typography for video title, channel attribution, and action buttons (`#above-the-fold`).
- **Quick Save to Collection Button:** Injected cleanly via a Shadow DOM inline mount next to native action buttons so users can save the current video to any Reframe Collection in one click.
- **In-Place Collapsible Description & Comments:** Uses CSS state attributes (`data-rf-comments="collapsed"`, `data-rf-description="collapsed"`) on `<html>` with a lightweight toggle bar above `#comments`—never detaching or reparenting `#comments` or `ytd-Watch-metadata`.
- **Focus Mode:** Hides `#secondary` (related videos sidebar), `#comments`, and merchandise/ticket shelves via CSS (`display: none !important` on non-player containers only) while centering the primary video column.

### 3.5 Library & Collections (`/feed/library` and `/feed/you`)

**Note on YouTube Route Changes:** Modern YouTube serves the user library at both `/feed/you` and legacy `/feed/library`. The Reframe router must treat both `/feed/you` and `/feed/library` as the `"library"` route.

**MVP Capabilities**

- Renders a dedicated **Reframe Collections** Shadow DOM workspace at the top of `/feed/you` (or `/feed/library`), allowing users to create, rename, reorder, and delete local collections, and add/remove videos by URL or from recent watch history.
- Preserves native YouTube library sections below the Reframe Collections workspace.
- Supports full JSON export and schema-validated JSON import (`schemaVersion: 1`).

### 3.6 Search, Channels, Playlists, and Shorts

- **Search (`/results`):** Applies clean dark typography, uniform 16:9 card spacing, and optional hiding of promotional/Shorts shelves (`ytd-reel-shelf-renderer`) via CSS when `hideShortsSurfaces` is enabled.
- **Channels (`/@*`, `/channel/*`) & Playlists (`/playlist`):** Passive `Midnight` theme tokens only; native tabs and continuation loaders remain untouched.
- **Shorts (`/shorts/*`):** When `hideShortsSurfaces` is enabled, hides Shorts entry points in the sidebar and shelves on Home/Subscriptions/Search, while keeping direct `/shorts/:id` URLs functional if navigated to directly.

### 3.7 First-Run Onboarding & Consent Flow

1. On installation (`runtime.onInstalled` with `reason === "install"`), the background service worker initializes default storage and opens `options.html?onboarding=1`.
2. The onboarding screen presents a single, clear **Setup Card** explaining what Reframe changes, how Original Mode works, and that all data stays 100% local in the browser profile.
3. Instead of burying `trackProgress` and `cacheFeeds` in secondary menus (which would leave the Home dashboard completely empty after onboarding), the Setup Card offers two clear activation buttons:
   - **"Enable Reframe (Recommended — Includes Local Progress & Subscription Caching)"**: Sets `enabled = true`, `trackProgress = true`, `cacheFeeds = true`, `consentVersion = 1`.
   - **"Enable Theme & Focus Mode Only (Zero Local History/Cache)"**: Sets `enabled = true`, `trackProgress = false`, `cacheFeeds = false`, `consentVersion = 1`.
4. Users can toggle any setting or wipe local data in one click from the Popup or Options page at any time.

## 4. Visual and Interaction System

### 4.1 Design Direction

- **Cinematic Dark Palette (`Midnight`):** Deep obsidian canvas (`#0a0c10`) with layered slate surfaces (`#12151b`, `#1a1f27`) and warm alabaster typography (`#f2f4f8`).
- **True 16:9 Media Framing:** Consistent `16px` card radius, subtle `1px solid rgba(255, 255, 255, 0.07)` borders, and readable duration/progress overlays.
- **Distinct Brand Identity:** Uses warm amber-coral (`#ff5a3c`) and geometric badges so the UI never impersonates YouTube’s `#ff0000` red or Netflix’s brand assets.

### 4.2 CSS Design Tokens (`tokens.css`)

```css
:host,
html[data-rf-enabled="true"] {
  --rf-bg: #0a0c10;
  --rf-surface-1: #12151b;
  --rf-surface-2: #1a1f27;
  --rf-surface-3: #232a35;
  --rf-border-subtle: rgba(255, 255, 255, 0.08);
  --rf-text: #f2f4f8;
  --rf-text-muted: #9aa3b2;
  --rf-accent: #ff5a3c;
  --rf-accent-hover: #ff745b;
  --rf-success: #2dd4bf;
  --rf-warning: #f59e0b;
  --rf-danger: #f43f5e;
  --rf-radius-card: 16px;
  --rf-radius-control: 10px;
  --rf-space-1: 4px;
  --rf-space-2: 8px;
  --rf-space-3: 12px;
  --rf-space-4: 16px;
  --rf-space-6: 24px;
  --rf-space-8: 32px;
  --rf-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --rf-motion-fast: 120ms cubic-bezier(0.2, 0, 0, 1);
  --rf-motion-normal: 200ms cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  :host,
  html[data-rf-enabled="true"] {
    --rf-motion-fast: 0ms;
    --rf-motion-normal: 0ms;
  }
}
```

### 4.3 Core UI Component Inventory

- `ReframeShell.svelte` — Collapsible left navigation rail / top bar with route indicator and Original Mode switch
- `HeroSpotlight.svelte` — Featured video banner with source badge, creator chip, and Watch / Save CTAs
- `MediaRail.svelte` — Keyboard-navigable horizontal scroller with roving `tabindex` and arrow-key support
- `VideoCard.svelte` — 16:9 thumbnail card with deterministic fallback image, progress bar, source badge, and "Add to Collection" menu
- `CollectionModal.svelte` — Accessible `<dialog>` for creating/editing collections and importing/exporting JSON
- `FocusBar.svelte` — Watch-page control strip for Focus Mode, Comments toggle, Description toggle, and Collection quick-save
- `StatusBanner.svelte` — Non-intrusive fallback banner when an adapter degrades or cached data is stale

### 4.4 Accessibility & Responsive Requirements

- Full keyboard navigation across rails (`ArrowLeft`, `ArrowRight`, `Home`, `End`) using roving `tabindex`
- High-visibility `:focus-visible` outlines (`2px solid var(--rf-accent)`, `outline-offset: 2px`)
- WCAG 2.2 AA contrast ratios verified across all custom surfaces (`#f2f4f8` on `#0a0c10` = `17.4:1`; `#9aa3b2` on `#12151b` = `6.8:1`)
- Logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline-start`) for full RTL language compatibility
- **Responsive breakpoint guard:** For viewports `< 768px`, Reframe automatically disables desktop shell overrides (`data-rf-viewport="compact"`) so split-screen browser windows fall back cleanly to YouTube’s responsive native layout.

## 5. System Architecture

### 5.1 Runtime Context Topology

```text
+-----------------------------------------------------------------------------------+
| Browser Context (https://www.youtube.com/*)                                       |
|                                                                                   |
|  +-----------------------------+       +---------------------------------------+  |
|  | YouTube Page DOM (MAIN)     |       | Content Script (ISOLATED World)       |  |
|  | - ytd-app / #page-manager   | <---> | - Sync localStorage anti-FOUC boot    |  |
|  | - #movie_player (<video>)   |       | - SPA Router & Light-DOM Link Bridge  |  |
|  | - ytd-browse[page-subtype]  |       | - Scoped Page CSS + Feature Registry  |  |
|  +-----------------------------+       | - Ad-aware Progress & Feed Adapters   |  |
|                                        +-------------------+-------------------+  |
|                                                            |                      |
|                                                            v                      |
|                                        +---------------------------------------+  |
|                                        | Shadow DOM UI (createShadowRootUi)    |  |
|                                        | - Home Dashboard / Collections UI     |  |
|                                        | - Watch Focus Bar & Quick-Save Modal  |  |
|                                        +---------------------------------------+  |
+------------------------------------------------------------^----------------------+
                                                             |
                                                             v
+-----------------------------------------------------------------------------------+
| Extension Storage & Background Contexts (chrome.storage.*)                        |
|                                                                                   |
|  - local:deviceConfig  (enabled, consentVersion, privacy flags, kill switches)    |
|  - sync:preferences    (theme, density, home sections, watch defaults)            |
|  - local:userData      (collections, resumeStates, feedSnapshots, diagnostics)    |
|  - session:health      (unlocked via setAccessLevel in background.ts)             |
|                                                                                   |
|  [Background Service Worker]          [Popup UI]              [Options Page]      |
|  - Sets session storage access        - Master switch         - First-run consent |
|  - Opens onboarding on install        - Focus & Shorts toggle - JSON Import/Export|
|  - Prunes expired cache/progress      - Original Mode button  - Data wipe & health|
+-----------------------------------------------------------------------------------+
```

### 5.2 Runtime Responsibilities & Guardrails

| Runtime Context | Core Responsibilities | Prohibited Actions |
| :--- | :--- | :--- |
| **Content Script (`youtube.content`)** | Synchronous anti-FOUC attribute bootstrap, SPA route detection, DOM adapter reads, ad-aware progress tracking, Shadow DOM lifecycle ([Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)). | Must not execute in `MAIN` world, read cookies/tokens, or reparent `#movie_player`. |
| **Shadow DOM UI (`createShadowRootUi`)** | Renders isolated Svelte 5 components for Home, Collections, and Watch controls ([WXT Content Script UI](https://wxt.dev/guide/essentials/content-scripts)). | Must not leak global CSS resets or trigger hard browser reloads on link clicks. |
| **Background Service Worker (`background.ts`)** | Unlocks `storage.session` via `setAccessLevel`, opens first-run onboarding on install, runs periodic cache TTL cleanup via `alarms` or startup hooks ([MV3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)). | Must not hold durable in-memory state or poll YouTube endpoints. |
| **Popup (`popup/`)** | Provides instant toggles for Enabled/Original Mode, Focus Mode, Hide Shorts, and quick link to Options. | Must not maintain separate state outside `chrome.storage`. |
| **Options Page (`options/`)** | Hosts first-run onboarding, granular feature toggles, collection JSON import/export, and 1-click data deletion. | Must not request external API keys or transmit telemetry. |

### 5.3 Consolidated Repository Structure (Single Content Entrypoint)

Instead of splitting content scripts into two separate entrypoints (`youtube-theme.content` and `youtube.content`)—which injects duplicate runtime bundles and causes CSS/JS synchronization races—Reframe v2.0 uses **one unified content script entrypoint** (`entrypoints/youtube.content/`) with `cssInjectionMode: "ui"` for Shadow DOM components, plus a dedicated static `public/youtube-page.css` declared in `manifest.content_scripts` so the browser injects page-level CSS natively at `document_start` with zero JS overhead:

```text
reframe/
├── wxt.config.ts
├── package.json
├── tsconfig.json
├── public/
│   ├── youtube-page.css                 # Static document_start page overrides (scoped to html[data-rf-enabled="true"])
│   └── icon/
├── entrypoints/
│   ├── youtube.content/                 # Unified content script controller + Shadow DOM UI
│   │   ├── index.ts                     # runAt: "document_start", cssInjectionMode: "ui"
│   │   ├── ui.css                       # Isolated Shadow DOM styles & tokens
│   │   └── App.svelte                   # Root Shadow DOM router view
│   ├── background.ts                    # Sets storage.session access level, install hooks, TTL cleanup
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── Popup.svelte
│   └── options/
│       ├── index.html
│       ├── main.ts
│       └── Options.svelte
├── src/
│   ├── core/
│   │   ├── bootstrap.ts                 # Sync localStorage anti-FOUC mirror + storage reconciliation
│   │   ├── router.ts                    # Route parser + yt-navigate-* listeners + SPA link helper
│   │   ├── feature-registry.ts          # Idempotent mount/unmount + circuit breakers
│   │   └── kill-switch.ts
│   ├── features/
│   │   ├── shell/
│   │   ├── home/
│   │   ├── subscriptions/
│   │   ├── watch/
│   │   ├── focus/
│   │   └── library/
│   ├── adapters/
│   │   ├── contracts.ts
│   │   ├── selector-registry.ts
│   │   ├── subscriptions-dom.ts
│   │   ├── watch-dom.ts
│   │   └── health.ts
│   ├── data/
│   │   ├── models.ts
│   │   ├── storage.ts                   # WXT storage.defineItem definitions & migrations
│   │   ├── cache.ts
│   │   ├── progress.ts                  # Ad-aware, SPA-safe Continue Watching tracker
│   │   └── collections.ts
│   └── ui/
│       ├── components/
│       ├── tokens.css
│       └── a11y.ts
└── tests/
    ├── unit/
    ├── adapters/
    ├── integration/
    ├── e2e/
    └── fixtures/
```

### 5.4 Anti-FOUC Bootstrap & Background Session Unlock

**1. Background Service Worker (`entrypoints/background.ts`):**

```ts
import { browser } from "wxt/browser";
import { pruneExpiredSnapshotsAndProgress } from "@/data/cache";

export default defineBackground(() => {
  // CRITICAL FIX: Unlock chrome.storage.session for content scripts
  const unlockSessionStorage = async () => {
    if (browser.storage.session?.setAccessLevel) {
      await browser.storage.session.setAccessLevel({
        accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
      });
    }
  };

  void unlockSessionStorage();

  browser.runtime.onStartup.addListener(() => {
    void unlockSessionStorage();
    void pruneExpiredSnapshotsAndProgress();
  });

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await unlockSessionStorage();
    if (reason === "install") {
      await browser.runtime.openOptionsPage();
    }
  });
});
```

**2. Synchronous Anti-FOUC Content Script Bootstrap (`entrypoints/youtube.content/index.ts`):**

```ts
import "./ui.css";
import { createShadowRootUi } from "wxt/client";
import { applySyncBootAttributes, syncBootMirror, loadMergedConfig, watchConfig } from "@/core/bootstrap";
import { createRouter } from "@/core/router";
import { createFeatureRegistry } from "@/core/feature-registry";

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  allFrames: false,
  runAt: "document_start",
  cssInjectionMode: "ui",
  async main(ctx) {
    // Step 1: Synchronously apply last-known boot attributes from origin localStorage (<1ms, zero FOUC)
    applySyncBootAttributes();

    // Step 2: Resolve authoritative config from chrome.storage.local + chrome.storage.sync
    const initialConfig = await loadMergedConfig();
    syncBootMirror(initialConfig);

    // Step 3: Wait for ytd-app mount before attaching route & feature controllers
    const router = createRouter(ctx);
    const registry = await createFeatureRegistry(ctx, router);

    registry.reconcile(router.current(), initialConfig);

    router.subscribe((route) => {
      document.documentElement.dataset.rfRoute = route.kind;
      registry.reconcile(route, registry.currentConfig());
    });

    watchConfig(ctx, (nextConfig) => {
      syncBootMirror(nextConfig);
      registry.reconcile(router.current(), nextConfig);
    });

    ctx.onInvalidated(() => {
      registry.dispose();
      router.dispose();
      delete document.documentElement.dataset.rfEnabled;
      delete document.documentElement.dataset.rfRoute;
    });
  },
});
```

### 5.5 Route-Scoped CSS Isolation Strategy (`public/youtube-page.css`)

Because YouTube caches multiple `ytd-browse` elements inside `#page-manager` simultaneously, **page CSS must never hide `ytd-browse` without scoping to both `[data-rf-route]` and `[page-subtype]`**:

```css
@layer rf.tokens, rf.native, rf.features;

/* Hide native Home feed ONLY when Reframe is active AND current route is Home */
@layer rf.features {
  html[data-rf-enabled="true"][data-rf-route="home"][data-rf-home-mode="dashboard"]
    ytd-browse[page-subtype="home"] {
    display: none !important;
  }

  /* Focus Mode on Watch route only — never touches #movie_player */
  html[data-rf-enabled="true"][data-rf-route="watch"][data-rf-focus="true"]
    #secondary,
  html[data-rf-enabled="true"][data-rf-route="watch"][data-rf-focus="true"]
    ytd-watch-flexy #comments {
    display: none !important;
  }

  /* Never apply transform, filter, or contain:paint to player ancestors */
  html[data-rf-enabled="true"] #player-container-outer,
  html[data-rf-enabled="true"] #movie_player {
    transform: none !important;
    contain: none !important;
  }
}
```

### 5.6 SPA Router & Light-DOM Link Handoff (`src/core/router.ts`)

To prevent Shadow DOM link clicks from triggering full browser reloads (which kill the Miniplayer):

1. **Route Classification:**
   - `/` -> `{ kind: "home" }`
   - `/feed/subscriptions` -> `{ kind: "subscriptions" }`
   - `/feed/you` or `/feed/library` -> `{ kind: "library" }`
   - `/watch` (with `?v=`) -> `{ kind: "watch", videoId }`
   - `/results` (with `?search_query=`) -> `{ kind: "search", query }`
   - `/shorts/*` -> `{ kind: "shorts", videoId }`
   - `/@*`, `/channel/*`, `/c/*` -> `{ kind: "channel", handleOrId }`
2. **Event Hooks:** Listens to `yt-navigate-start` (to pause active video progress writers immediately), `yt-navigate-finish`, `yt-page-data-updated`, and `popstate` ([DEV Community](https://dev.to/superlede/what-youtubes-single-page-app-did-to-my-chrome-extension-h7a)).
3. **Soft-Navigation Helper (`navigateSpa(url: string)`):**
   - Validates that `url` is a same-origin `https://www.youtube.com` URL.
   - Reuses or creates a hidden light-DOM anchor `<a id="rf-spa-bridge" class="yt-simple-endpoint" hidden>` inside `ytd-app`, sets its `href`, and dispatches a bubbling click event so YouTube’s Polymer router performs a native soft transition while preserving any active Miniplayer instance.

## 6. Data Architecture

### 6.1 Split Storage Schema (Fixing the `sync` vs. `local` Contradiction)

Using [WXT Storage (`storage.defineItem`)](https://wxt.dev/storage) over the [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage), state is partitioned into four explicit storage items so device-local consent and privacy flags are never written to `chrome.storage.sync`:

| Storage Item Key | Storage Area | Quota / Cap | Contents | Retention |
| :--- | :--- | :--- | :--- | :--- |
| `local:deviceConfig` | `storage.local` | `< 4 KB` | `consentVersion`, `enabled`, `privacy` flags (`trackProgress`, `cacheFeeds`, `diagnostics`), per-feature `killSwitches` | Until reset or uninstalled |
| `sync:preferences` | `storage.sync` | `< 8 KB` | `theme`, `density`, `home.destination`, `home.sections`, `watch` UI defaults, `hideShortsSurfaces` | Synced only after `consentVersion >= 1` |
| `local:collections` | `storage.local` | Max 100 collections (`< 500 KB`) | User-created collection metadata and `VideoRef[]` items | Until deleted by user |
| `local:resumeStates` | `storage.local` | Max 200 videos (`< 150 KB`) | Opt-in local watch progress (`5% <= percent < 95%`) | 90 days rolling TTL |
| `local:feedSnapshots` | `storage.local` | Max 100 subs / 50 WL (`< 250 KB`) | Normalized `VideoMeta[]` from visible native pages | 24h TTL (`subscriptions`); 6h TTL (`recommendations`) |
| `session:featureHealth` | `storage.session` | `< 16 KB` | Runtime adapter failure counts and circuit-breaker states | Current browser session only |

### 6.2 TypeScript Data & Configuration Contracts (`src/data/models.ts`)

```ts
export interface DeviceConfig {
  schemaVersion: 1;
  consentVersion: number; // 0 = unconsented, 1 = consented to v1 onboarding
  enabled: boolean;
  privacy: {
    trackProgress: boolean;
    cacheFeeds: boolean;
    diagnostics: boolean;
  };
  killSwitches: Record<string, boolean>;
}

export interface UserPreferences {
  schemaVersion: 1;
  theme: "midnight" | "system";
  density: "comfortable" | "compact";
  home: {
    destination: "dashboard" | "subscriptions" | "original";
    sections: Array<"hero" | "continue" | "subscriptions" | "collections" | "shortcuts" | "recommendations">;
    showRecommendations: boolean;
    pinnedVideoId?: string;
  };
  watch: {
    focusMode: boolean;
    collapseComments: boolean;
    collapseDescription: boolean;
  };
  global: {
    hideShortsSurfaces: boolean;
  };
}
```

### 6.3 Ad-Aware, SPA-Safe `Continue Watching` Engine (`src/data/progress.ts`)

To prevent pre-roll/mid-roll ads or SPA `<video>` element reuse from corrupting saved watch progress:

1. **Strict Route & Consent Gate:** Runs only when `deviceConfig.enabled && deviceConfig.privacy.trackProgress && route.kind === "watch"`.
2. **Navigation Lock (`isNavigating`):** Immediately sets `lockedVideoId = null` when `yt-navigate-start` fires, ignoring any trailing `timeupdate` or `pause` events from the previous video until `yt-navigate-finish` confirms the new `videoId`.
3. **Ad-Playback Guard:** Before recording any sample, inspects `#movie_player`:
   ```ts
   const playerEl = document.getElementById("movie_player");
   if (!playerEl || playerEl.classList.contains("ad-showing") || playerEl.classList.contains("ad-interrupting")) {
     return; // Never record ad duration or ad currentTime!
   }
   ```
4. **Live & Short-Clip Filter:** Ignores streams where `!Number.isFinite(video.duration)`, `video.duration < 120` seconds (2 minutes), or `.ytp-live` is present inside `#movie_player`.
5. **Completion Auto-Cleanup:**
   - Saves progress only when `percent >= 5 && percent < 95`.
   - When `percent >= 95` or the `ended` event fires (while not in an ad), **removes `videoId` from `local:resumeStates`** so finished videos automatically leave the "Continue Watching" rail.
6. **Write Throttling:** Flushes to `local:resumeStates` at most once every 5 seconds during playback and immediately on `pause` or `visibilitychange` (`hidden`).

### 6.4 Visible-Feed Adapter & Deterministic Thumbnail Fallback (`src/adapters/subscriptions-dom.ts`)

1. **Waiting for Polymer Stamp:** After `yt-navigate-finish` on `/feed/subscriptions`, attaches a scoped `MutationObserver` to `ytd-browse[page-subtype="subscriptions"]` (with a 5-second timeout and 250 ms debounce) until `ytd-rich-item-renderer` nodes are present.
2. **Extracting Canonical Video IDs:** Parses `a#thumbnail[href*="/watch?v="]` or `a#video-title-link[href*="/watch?v="]` using `new URL(href, location.origin).searchParams.get("v")` and validates against `/^[a-zA-Z0-9_-]{11}$/`.
3. **Deterministic Thumbnail URL:** Because YouTube lazy-loads `<img>` `src` attributes for cards below the fold, if `img.src` is empty or a `data:` placeholder, the adapter sets:
   ```ts
   const thumbnailUrl = rawImgSrc?.startsWith("https://i.ytimg.com/")
     ? rawImgSrc
     : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
   ```
4. **Circuit Breaker:** If `ytd-browse[page-subtype="subscriptions"]` contains elements but `readVisible()` extracts `0` valid `VideoMeta` items across 3 consecutive attempts, increments `failureCount` in `session:featureHealth` and trips `RF_ADAPTER_UNAVAILABLE`, displaying the native Subscriptions page untouched.

## 7. Feature Specifications

### F1 — Anti-FOUC Theme Engine (`Midnight`)

- **Mechanism:** Static `public/youtube-page.css` injected by the browser at `document_start`, activated synchronously by `bootstrap.ts` setting `html[data-rf-enabled="true"]` from the `localStorage` boot mirror.
- **Guardrails:** Never styles `#movie_player` internals or applies layout containment to player ancestors.
- **Acceptance Criteria:** Zero white/native flash on reload; toggling Original Mode restores native YouTube styling within `< 16 ms` without reloading the video player.

### F2 — Reframe App Shell & SPA Link Bridge

- **Mechanism:** Mounted via `createShadowRootUi` with `position: "inline"` or fixed rail reservation; routes clicks through `navigateSpa(url)`.
- **Acceptance Criteria:** Clicking Home, Subscriptions, or Library while a video is minimized in the YouTube Miniplayer transitions smoothly without interrupting audio/video playback.

### F3 — Subscription-First Home Dashboard

- **Mechanism:** Mounted inside `ytd-browse[page-subtype="home"]` parent container when `route.kind === "home"`.
- **Inline Activation UX:** If `cacheFeeds` or `trackProgress` is disabled, renders 1-click inline activation cards directly inside the respective rail slots.
- **Acceptance Criteria:** Renders 100 cached cards in `< 100 ms`; displays accurate capture timestamps (`"Updated 14m ago"`); hides cleanly the instant the user navigates to `/watch` or `/feed/subscriptions`.

### F4 — Subscriptions Feed Enhancer & Snapshotter

- **Mechanism:** Non-destructive CSS grid/card polish on `ytd-browse[page-subtype="subscriptions"]` plus background-free visible DOM snapshot capture.
- **Acceptance Criteria:** Native infinite scroll (`ytd-continuation-item-renderer`) loads subsequent batches seamlessly; newly scrolled cards append to the cached snapshot up to the 100-item cap.

### F5 — Watch Page Theater & In-Place Collapsibles

- **Mechanism:** Scoped CSS rules on `ytd-watch-flexy` plus a lightweight Shadow DOM `FocusBar` mounted above `#above-the-fold`.
- **Acceptance Criteria:** Collapsing/expanding comments or description never unmounts Polymer nodes; live chat, premieres, captions, and fullscreen work identically to native YouTube.

### F6 — Focus Mode

- **Mechanism:** Toggles `html[data-rf-focus="true"]` on the Watch page, hiding `#secondary` and `#comments` via CSS.
- **Acceptance Criteria:** Toggling Focus Mode during active playback causes zero frame drops, zero player remounts, and zero timestamp drift.

### F7 — Local Collections Library (`/feed/you` & `/feed/library`)

- **Mechanism:** CRUD manager stored in `local:collections` with a quick-save button on Watch pages and video cards, plus a full management view on `/feed/you` and `/feed/library`.
- **Import/Export Validation:** Validates JSON schema version, rejects payloads `> 2 MB`, sanitizes strings, and verifies all `videoId` entries match `/^[a-zA-Z0-9_-]{11}$/`.
- **Acceptance Criteria:** Collections survive extension updates and browser restarts; JSON export/import round-trips losslessly.

### F8 — Popup, Options, and Original Mode Escape Hatch

- **Mechanism:** Svelte 5 interfaces bound reactively to `local:deviceConfig`, `sync:preferences`, and `session:featureHealth`.
- **Acceptance Criteria:** Disabling a single feature kill switch or enabling Original Mode reconciles all open YouTube tabs immediately via `chrome.storage.onChanged`.

## 8. Official YouTube API Strategy (Post-MVP Only)

### 8.1 Why MVP Uses Zero YouTube Data API Calls

The MVP requires **no API keys and no OAuth prompts**. Relying on the [YouTube Data API v3](https://developers.google.com/youtube/data/getting-started) for a client-side browser extension introduces severe UX and quota bottlenecks:

- [`subscriptions.list`](https://developers.google.com/youtube/data/reference/rest/v3/subscriptions/list) returns only the channels a user subscribes to (`mine=true`), **not** a chronological feed of their recent uploads. Fetching recent uploads for 200 subscribed channels requires querying each channel’s uploads playlist via `playlistItems.list`, quickly exhausting project quotas.
- The official API does not expose a user’s private watch-progress timestamps or personalized home recommendations.

### 8.2 Verified Quota Model (Current Google Developers Baseline)

Per the official [YouTube Data API Overview](https://developers.google.com/youtube/data/getting-started), [Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost), and [`search.list` Reference](https://developers.google.com/youtube/data/reference/rest/v3/search/list), Google Cloud projects enabling the YouTube Data API v3 receive three separate default daily quota buckets:

- **100 `search.list` calls per day** (each call costs 1 unit within the dedicated Search Queries bucket)
- **100 `videos.insert` calls per day**
- **10,000 units per day** combined for all other API methods

### 8.3 Gate Criteria for Any Post-MVP Official API Feature

If optional public metadata enrichment or OAuth playlist write-back is pursued in v1.2+:

- Require explicit user-initiated OAuth consent with minimum scopes
- Comply with [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service), [Developer Policies](https://developers.google.com/youtube/terms/developer-policies), and [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- Pass Google’s [Quota and Compliance Audit](https://developers.google.com/youtube/data/guides/quota_and_compliance_audits) before public rollout

## 9. Security, Privacy, and Compliance

### 9.1 Security Controls

- **Zero Remote Code:** All JavaScript, CSS, SVG icons, and Svelte components are bundled at build time in compliance with [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3).
- **Strict DOM Sanitization:** Treat all DOM-scraped strings (`title`, `channelTitle`) as untrusted input. Render strictly via Svelte text interpolations (`{video.title}`); never pass DOM strings into `innerHTML`, `outerHTML`, or `insertAdjacentHTML`.
- **Strict URL Validation:** Validate every `videoId` (`/^[a-zA-Z0-9_-]{11}$/`) and ensure all navigation URLs parse to `https://www.youtube.com` before assigning to `href`.
- **Minimal Permissions:** Request only `"permissions": ["storage"]` and `"host_permissions": ["https://www.youtube.com/*"]` (via `content_scripts.matches`), adhering to [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

### 9.2 Privacy Controls

- **100% Local Personal Data:** Watch progress (`local:resumeStates`), feed snapshots (`local:feedSnapshots`), and collections (`local:collections`) never leave the user’s device and are never written to `chrome.storage.sync`.
- **Browser Profile Disclosure:** Clearly inform users on the Options page that local storage is shared across YouTube accounts used within the same browser profile, and provide a one-click **"Clear All Reframe Data"** button.

### 9.3 YouTube Terms of Service & Adapter Release Gate

Because the [YouTube Terms of Service](https://www.youtube.com/static?template=terms) restrict unauthorized automated access or modification of the service:

- Reframe never makes automated background HTTP requests, never calls internal InnerTube endpoints, and never tampers with advertisements or player monetization.
- All visible-DOM adapters (`subscriptions-dom`, `watch-dom`) are gated behind independent feature flags (`killSwitches.subscriptionsAdapter`, `killSwitches.homeDashboard`) so the extension can ship or operate in pure CSS/Theme + Local Collections mode if required by legal or store review.

## 10. Performance and Reliability Budgets

### 10.1 Quantitative Budgets

| Metric | Target Budget | Verification Method |
| :--- | :--- | :--- |
| **Content Script JS Bundle** | `< 150 KB` gzipped | CI Rollup/Vite bundle size check |
| **Static Page CSS (`youtube-page.css`)** | `< 35 KB` gzipped | CI asset size check |
| **Anti-FOUC Bootstrap Overhead** | `< 2 ms` synchronous, `< 35 ms` total boot p75 | Chrome DevTools Performance trace |
| **SPA Route Reconciliation** | `< 30 ms` p75 main-thread time | Automated Playwright performance mark |
| **Home Dashboard Render (100 cards)** | `< 80 ms` initial mount | Vitest + Playwright benchmark |
| **MutationObserver Callback Cost** | `< 1.5 ms` per batch; max 4 executions/sec (debounced) | Local diagnostics performance counter |
| **Extension Storage Footprint** | `< 1.5 MB` typical (`< 2.5 MB` hard ceiling) | `chrome.storage.local.getBytesInUse()` check |

### 10.2 Circuit Breaker & Error Taxonomy

| Error Code | Trigger Condition | Automated Recovery Behavior |
| :--- | :--- | :--- |
| `RF_ADAPTER_UNAVAILABLE` | 3 consecutive empty/failed selector reads on a populated route | Disables the specific adapter for the session in `session:featureHealth` and reveals native YouTube UI |
| `RF_PLAYER_ANCESTOR_DIRTY` | Computed style check detects `transform` or `contain` on `#movie_player` ancestor | Strips offending Reframe attribute immediately and logs `RF_PLAYBACK_GUARD` |
| `RF_STORAGE_QUOTA_NEAR` | `getBytesInUse()` exceeds `2.5 MB` | Prunes oldest `feedSnapshots` and `resumeStates` entries automatically |
| `RF_IMPORT_INVALID` | Imported JSON fails schema or regex validation | Aborts import cleanly and displays field-level error in Options UI |

## 11. Testing and QA Strategy

### 11.1 Automated Test Pyramid

| Test Layer | Tooling | Key Scenarios Covered |
| :--- | :--- | :--- |
| **Unit Tests** | Vitest + [WXT Fake Browser](https://wxt.dev/guide/essentials/unit-testing) | Storage migrations, `videoId` regex validation, ad-guard state machine, JSON import validator |
| **Adapter Contract Tests** | Vitest + Sanitized HTML Fixtures | Subscriptions card extraction, missing lazy-thumbnail fallback (`i.ytimg.com`), degraded selector fallback |
| **Integration Tests** | Vitest + Happy-DOM | Feature registry mount/unmount idempotency, route transitions between cached `ytd-browse` nodes |
| **End-to-End (E2E)** | Playwright Chromium Persistent Context | Anti-FOUC boot check, SPA link click preserving Miniplayer, Focus Mode toggle, Original Mode recovery |
| **Accessibility Audits** | `@axe-core/playwright` | WCAG 2.2 AA contrast, dialog focus trapping, keyboard arrow navigation on `MediaRail` |

### 11.2 Mandatory Watch & SPA QA Matrix

Before any release candidate advances:

- **Ad-Stream Resilience:** Verify pre-roll and mid-roll ads do not corrupt `local:resumeStates` duration or mark videos finished.
- **Miniplayer Survival:** Start a video on `/watch`, click Miniplayer (`i`), click Home / Subscriptions / Library inside Reframe’s Shadow DOM, and confirm the Miniplayer keeps playing without reloading the page.
- **Cached `ytd-browse` Isolation:** Navigate Home -> Subscriptions -> Channel -> Home -> Watch -> Back button, verifying neither Subscriptions nor Channel grids are hidden by Home CSS rules.
- **Special Video Types:** Verify Live streams (with live chat), Premieres, Age-restricted videos, and Fullscreen (`f`) + Theater (`t`) modes.

## 12. Delivery Roadmap (12-Week Team Baseline / 18–22 Week Solo)

| Phase | Timeline | Core Milestones | Exit Gate |
| :--- | :---: | :--- | :--- |
| **Phase 0: Foundation & Spike** | Week 1 | WXT + Svelte 5 scaffold, split storage schema, `setAccessLevel` unlock, anti-FOUC prototype, compliance review | Unpacked build loads with zero FOUC; `session:featureHealth` accessible from content script |
| **Phase 1: Runtime, Router & Theme** | Weeks 2–3 | Unified `youtube.content` entrypoint, `public/youtube-page.css`, SPA link bridge (`navigateSpa`), Popup & Onboarding UI | Miniplayer survives Shadow DOM navigation; Original Mode restores native UI instantly |
| **Phase 2: Watch Page & Focus Mode** | Weeks 4–5 | Watch surroundings restyle, `FocusBar`, in-place collapsible comments/description, ad-aware `Continue Watching` engine | Full Watch QA matrix passes (including pre-roll ads, live streams, fullscreen) |
| **Phase 3: Subscriptions & Home** | Weeks 6–7 | `subscriptions-dom` adapter with deterministic thumbnails, Home dashboard, inline 1-click activation cards | Home renders `< 80 ms`; cached `ytd-browse` nodes never leak or hide other routes |
| **Phase 4: Collections & Library** | Weeks 8–9 | Local Collections CRUD on `/feed/you` and `/feed/library`, Watch quick-save modal, JSON import/export, a11y audit | Lossless JSON round-trip; WCAG 2.2 AA & keyboard navigation pass |
| **Phase 5: Hardening & Beta** | Weeks 10–11 | Circuit-breaker chaos testing, performance trace verification, Edge validation, 30-user closed beta | All performance budgets met; zero P0/P1 playback or navigation bugs |
| **Phase 6: Store Launch** | Week 12 | Privacy policy publication, Chrome Web Store submission, staged rollout (`5% -> 25% -> 100%`) | Store approval granted; staged rollout metrics healthy |

## 13. Epics and Backlog Baseline

| ID | Epic Name | Priority | Estimate | Dependencies | Key Deliverable |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **E01** | WXT + Svelte 5 Scaffold & CI | P0 | 3–4 d | None | Monorepo-ready WXT config, Vitest, Playwright harness |
| **E02** | Split Storage & Session Unlock | P0 | 3–4 d | E01 | `local:deviceConfig`, `sync:preferences`, `setAccessLevel` in `background.ts` |
| **E03** | Anti-FOUC Bootstrap & Static CSS | P0 | 4–5 d | E01, E02 | Sync `localStorage` boot mirror + route-scoped `public/youtube-page.css` |
| **E04** | SPA Router & Light-DOM Link Bridge | P0 | 5–6 d | E03 | `router.ts` + `navigateSpa()` preserving Miniplayer across routes |
| **E05** | Reframe Shell, Popup & Onboarding | P0 | 5–7 d | E02, E04 | 1-card onboarding flow, Popup quick toggles, Options page |
| **E06** | Watch Theater, Focus Mode & Collapsibles | P0 | 7–10 d | E03, E04 | `FocusBar.svelte`, in-place comment/description collapse, player ancestor guard |
| **E07** | Ad-Aware Continue Watching Tracker | P0 | 5–6 d | E02, E06 | `progress.ts` with `.ad-showing` guard, `yt-navigate-start` lock, 95% auto-clear |
| **E08** | Subscriptions Adapter & Snapshotter | P0 | 6–8 d | E04 | `subscriptions-dom.ts` with debounced observer & deterministic `i.ytimg.com` fallback |
| **E09** | Home Streaming Dashboard | P0 | 7–10 d | E05, E07, E08 | Hero, Continue Watching, Subscriptions rail, inline 1-click opt-in cards |
| **E10** | Collections Library (`/feed/you`) | P0 | 6–8 d | E02, E05 | Collections CRUD, Watch page quick-save button, validated JSON import/export |
| **E11** | Accessibility, RTL & Responsive Guard | P0 | 4–6 d | E05–E10 | Roving `tabindex`, axe-core CI checks, `< 768px` native layout fallback |
| **E12** | Hardening, Store Listing & Release | P0 | 5–7 d | E11 | Privacy policy, store assets, circuit-breaker verification, staged release |

## 14. CI/CD and Release Engineering

1. **Automated Pipeline Gates (`.github/workflows/ci.yml`):**
   - `pnpm install --frozen-lockfile`
   - `pnpm lint` & `pnpm typecheck` (`tsc --noEmit` with `strict: true`)
   - `pnpm test:unit` & `pnpm test:adapters` (Vitest against sanitized YouTube DOM fixtures)
   - `pnpm build` (Chrome MV3 & Edge targets) + automated bundle size assertion (`< 150 KB` gzipped JS)
   - Manifest permission audit script (asserts `permissions` equals `["storage"]` and zero remote script URLs exist)
   - `pnpm test:e2e` (Playwright verifying anti-FOUC boot, Miniplayer link bridge, and Original Mode)
2. **Staged Rollout & Rollback:**
   - Publish to Chrome Web Store with staged rollout (`5% -> 25% -> 100%`).
   - Keep previous production `.zip` artifact archived for immediate re-upload if YouTube ships a breaking Polymer change.

## 15. Operations and Maintenance Runbook

- **Weekly Automated Fixture Canary:** Run a scheduled GitHub Action or local maintainer script that captures sanitized DOM structure snapshots of `/`, `/feed/subscriptions`, `/watch`, and `/feed/you` to detect Polymer tag/attribute changes early.
- **Selector Registry Hotfix Protocol:** Keep all YouTube DOM selectors isolated inside `src/adapters/selector-registry.ts` with ordered fallback arrays (e.g., `["ytd-rich-item-renderer", "ytd-grid-video-renderer"]`) so selector updates require changing a single file.

## 16. Risk Register

| Risk Event | Likelihood | Impact | Concrete Technical Mitigation |
| :--- | :---: | :---: | :--- |
| **YouTube renames Polymer feed selectors** | High | High | Ordered fallback arrays in `selector-registry.ts` + 3-strike circuit breaker falling back to native UI |
| **Shadow DOM links cause hard page reloads** | High (if unmitigated) | High | Mandatory `navigateSpa()` light-DOM `a.yt-simple-endpoint` bridge for all unmodified left-clicks |
| **Video ads corrupt saved watch progress** | High (if unmitigated) | Medium | Check `#movie_player` for `.ad-showing` / `.ad-interrupting` and lock on `yt-navigate-start` |
| **FOUC flashes native YouTube on page load** | High (if unmitigated) | Medium | Sync `localStorage` boot mirror sets `html[data-rf-enabled="true"]` at `document_start` before async storage resolves |
| **`storage.session` throws in content script** | Certain (if unmitigated) | High | Call `chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })` in `background.ts` |
| **Home CSS hides Subscriptions or Channel feeds** | High (if unmitigated) | High | Scope all page-hiding CSS rules strictly to `html[data-rf-route="home"] ytd-browse[page-subtype="home"]` |

## 17. Architecture Decision Records (ADRs)

- **ADR-001 (WXT + TypeScript + Svelte 5):** Selected [WXT](https://wxt.dev/guide/introduction) and Svelte 5 for minimal bundle overhead and native Shadow DOM lifecycle management via [`createShadowRootUi`](https://wxt.dev/guide/essentials/content-scripts).
- **ADR-002 (Single Content Script Entrypoint + Static Manifest CSS):** Replaced the dual-entrypoint content script proposal with one unified `youtube.content` controller plus static `public/youtube-page.css` to eliminate duplicate JS bundles and race conditions.
- **ADR-003 (Synchronous `localStorage` Anti-FOUC Mirror):** Mirrors non-sensitive boot flags (`rf_boot_enabled`, `rf_boot_theme`) in `window.localStorage` so `document_start` sets root attributes synchronously in `< 1 ms`.
- **ADR-004 (Light-DOM SPA Link Bridge):** Routes primary clicks inside Shadow DOM through a hidden `a.yt-simple-endpoint` in `ytd-app` so YouTube’s SPA router transitions smoothly and preserves active Miniplayer playback.
- **ADR-005 (Split `local` / `sync` / `session` Storage Topology):** Separates device-local consent and privacy flags (`local:deviceConfig`) from synced visual preferences (`sync:preferences`) and explicitly unlocks `storage.session` for content scripts ([Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)).
- **ADR-006 (Ad-Aware Progress Tracking):** Blocks progress writes whenever `#movie_player` has `.ad-showing` / `.ad-interrupting` or when an SPA navigation is in flight, and auto-removes items at `>= 95%` completion.

## 18. Open Decisions to Close in Phase 0

| Decision Item | Recommended Default | Owner | Target Resolution |
| :--- | :--- | :--- | :--- |
| **Final Store Brand Name** | Verify trademark clearance for "Reframe" or select a distinctive compound name (e.g., "Reframe Studio for YouTube") | Product / Legal | Week 1 |
| **Minimum Chromium Version** | Pin `minimum_chrome_version: "116"` (ensures modern CSS `@layer`, `:has()`, and `storage.session` support) | Engineering | Week 1 |
| **Onboarding Default CTA** | Highlight "Enable Reframe (Recommended)" on the first-run card so Home rails work immediately after consent | Product / UX | Week 1 |

## 19. Launch Checklist

- [ ] `background.ts` calls `chrome.storage.session.setAccessLevel` on install and startup
- [ ] Zero FOUC verified on cold tab load and hard refresh (`Cmd/Ctrl + Shift + R`)
- [ ] Clicking any link in Reframe Shadow DOM preserves active Miniplayer playback
- [ ] Pre-roll and mid-roll video ads never overwrite `local:resumeStates` duration or progress
- [ ] Navigating Home -> Subscriptions -> Channel -> Watch never leaves `ytd-browse` blank
- [ ] Both `/feed/you` and `/feed/library` mount the Collections workspace properly
- [ ] All external text rendered via Svelte text bindings (zero raw `innerHTML`)
- [ ] Original Mode and per-feature kill switches verified across all routes
- [ ] Privacy policy published and linked in Chrome Web Store developer dashboard

## 20. Verified References

- [WXT Introduction & Guide](https://wxt.dev/guide/introduction)
- [WXT Content Scripts & `createShadowRootUi`](https://wxt.dev/guide/essentials/content-scripts)
- [WXT Entrypoints Configuration](https://wxt.dev/guide/essentials/entrypoints.html)
- [WXT Storage (`@wxt-dev/storage`)](https://wxt.dev/storage)
- [WXT Unit Testing & Fake Browser](https://wxt.dev/guide/essentials/unit-testing)
- [Chrome Extensions: Content Scripts & Isolated Worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Extensions: Manifest Content Scripts Reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Chrome Extensions: Migrating to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Extensions: `chrome.storage` API & Quotas](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [MDN Web Docs: `StorageArea.setAccessLevel()`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [YouTube Terms of Service](https://www.youtube.com/static?template=terms)
- [YouTube Data API v3 Overview & Quotas](https://developers.google.com/youtube/data/getting-started)
- [YouTube Data API v3 Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost)
- [YouTube Data API v3 `search.list` Reference](https://developers.google.com/youtube/data/reference/rest/v3/search/list)
- [YouTube Data API v3 `subscriptions.list` Reference](https://developers.google.com/youtube/data/reference/rest/v3/subscriptions/list)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
- [YouTube API Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [What YouTube's Single-Page App Did to My Chrome Extension (DEV Community)](https://dev.to/superlede/what-youtubes-single-page-app-did-to-my-chrome-extension-h7a)
