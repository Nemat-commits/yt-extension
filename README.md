# Reframe — YouTube, intentionally

Reframe is a privacy-first Chrome Manifest V3 extension that makes YouTube feel more like a calm, subscription-first streaming library while keeping YouTube's native player and account experience intact.

> **Independent project:** Reframe is not affiliated with YouTube or Google. The working name is a placeholder pending trademark and Chrome Web Store review.

## What is implemented

- **Reframe Home dashboard** with a local Continue Watching shelf, a snapshot from the visible Subscriptions feed, personal collections, and links to native YouTube Library destinations.
- **Midnight theme** and scoped restyling. Home-feed replacement is route-specific; cached YouTube views are not globally hidden.
- **Watch-page controls** for Focus Mode, collapsing comments/descriptions in place, and saving the current video into a local collection.
- **Ad-aware local progress:** no writes during ad playback, SPA transitions, live streams, unknown durations, or clips under two minutes. In-progress items are removed at 95% completion. Data expires after 90 days.
- **Visible Subscriptions snapshotter:** reads only cards currently rendered by YouTube, derives lazy thumbnail URLs from validated video IDs, and stores at most 100 cards for 24 hours. It performs no API calls, background scraping, or hidden network requests.
- **Local collections** with create/rename/delete, add by URL, add from recent progress, remove videos, and validated JSON import/export (2 MB maximum).
- **Popup and onboarding/options pages** with Original Mode, privacy toggles, feature kill switches, storage status, and a one-click data wipe.
- **MV3 background lifecycle** that unlocks `storage.session` for content scripts and prunes expired local data.
- **Test and release checks** for routes, URL/schema validation, progress guards, DOM card extraction, feature lifecycle, manifest permissions, and bundle budgets.

## Safety and privacy boundaries

- Playback remains in YouTube's native `#movie_player`. Reframe never replaces player controls, extracts media, blocks or skips ads, reads cookies/tokens, or invokes undocumented InnerTube endpoints.
- The extension requests only the `storage` permission and runs on `https://www.youtube.com/*`.
- Collections, progress, and feed snapshots are stored in `storage.local` and do not sync. Only visual preferences are stored in `storage.sync` after the user chooses a privacy mode; Chrome Sync may synchronize those preferences under the user's Chrome settings.
- Visible video thumbnails may load normally from YouTube's image CDN (`i.ytimg.com`); Reframe makes no background feed/API requests and does not send user data to its maintainers.
- Content captured from YouTube is untrusted text rendered as text, never HTML. Imported IDs and URLs are validated.
- Original Mode is available from the popup and in-page shell. You can also disable any adapter independently.
- Local data is shared across YouTube accounts in the same browser profile. Clear it from Settings at any time.

## Install locally (Chrome / Edge)

1. Download or clone this repository and install Node.js 22 or later.
2. From the repository root, run:
   ```sh
   npm ci
   npm run build
   ```
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3`.
4. Open the Reframe extension popup or the Options page, choose a privacy mode, then visit YouTube.

The extension is not published to a store yet. A production store release still needs legal/trademark review, publication of [`docs/privacy-policy.md`](docs/privacy-policy.md) at a stable public URL, live browser QA, accessibility review, and store approval. The current privacy notice is a publication draft, not a published policy.

## Development

```sh
npm run dev              # WXT extension dev mode
npm run typecheck        # Svelte + TypeScript strict checks
npm test                 # Unit and adapter contract tests
npm run build            # Chrome MV3 production build
npm run audit:manifest   # Permission / local-asset audit
npm run check:size       # Gzip budgets for content bundles
npm run check            # Run the complete local verification sequence
```

To create a Chrome-compatible install package, run `npm run zip` after a successful build. The unpacked production extension is written to `.output/chrome-mv3/` (generated output is intentionally ignored by Git).

## Storage schema

| Area | Key | Purpose |
| --- | --- | --- |
| `storage.local` | `deviceConfig` | Consent, master enable, privacy toggles, per-feature kill switches |
| `storage.sync` | `preferences` | Theme, layout, Home destination, Watch defaults (after consent) |
| `storage.local` | `collections` | User-created collections and video references |
| `storage.local` | `resumeStates` | Opt-in playback progress; 200-item cap / 90-day TTL |
| `storage.local` | `feedSnapshots` | Visible Subscriptions cards; 100-item cap / 24-hour TTL |
| `storage.session` | `featureHealth` | Adapter failure counts and session circuit breakers |

See [`docs/architecture-roadmap.md`](docs/architecture-roadmap.md) for the full product, architecture, QA, and delivery baseline.

## Current release status

This repository contains a functional MVP implementation and local build/test pipeline. It has **not** been validated against every live YouTube account state, ad/premiere/live scenario, Edge version, or Chrome Web Store review requirement. YouTube can change its DOM without notice; adapters have kill switches and fail open to native UI. Use the manual QA checklist in the roadmap before a public release.
