# Reframe privacy notice (draft for publication)

**Last updated:** 8 November 2026
**Status:** Draft. A maintainer must publish this page and add its public URL to the Chrome Web Store listing before a public release.

Reframe is an independent browser extension. It is not affiliated with YouTube or Google.

## Information Reframe handles

Reframe does not operate a Reframe server and does not transmit personal data or telemetry to its maintainers. The current diagnostics setting is reserved and unused.

Depending on the choices you enable, Reframe may store the following in your browser profile:

- **Device-local settings and consent:** whether Reframe is enabled, your privacy choices, and feature kill switches, in `chrome.storage.local`.
- **Collections:** collection names and video IDs/titles/thumbnails that you explicitly save, in `chrome.storage.local`.
- **Continue Watching:** playback time and video metadata for opted-in eligible videos, in `chrome.storage.local`. Ads, live streams, videos shorter than two minutes, and completed videos are excluded. Items expire after 90 days.
- **Visible Subscriptions snapshot:** up to 100 cards already rendered on the Subscriptions page, if you opt in, in `chrome.storage.local`. It expires after 24 hours. Reframe does not open hidden tabs, scrape in the background, or call YouTube APIs.
- **Visual preferences:** theme, layout, Home destination, and Watch defaults, in `chrome.storage.sync` after you accept the setup screen. Chrome may synchronize these settings through your signed-in Chrome profile according to your Chrome Sync settings. Collections, progress, and feed snapshots are not synchronized.
- **Anti-flash hint:** non-sensitive Boolean display flags are mirrored in YouTube origin `localStorage` so the extension can apply its last-known visual state synchronously at page start. This mirror contains no video history, collection contents, account identifiers, cookies, or authentication data.

Local data is shared by YouTube accounts used within the same browser profile. Use **Clear all Reframe data** in Settings to remove Reframe settings, collections, progress, snapshots, and session health from that profile.

## Permissions and page access

Reframe requests the Chrome `storage` permission. Its content script and static stylesheet are restricted to `https://www.youtube.com/*`. The extension does not read cookies, account tokens, or private API endpoints. The native YouTube video player and advertising behavior are left intact.

When a visible card needs a thumbnail, the browser may request an image from YouTube's image CDN (`i.ytimg.com`), as it does for ordinary YouTube thumbnails. This is an image load only; Reframe does not use it to fetch feed data or send your collection/progress data.

## Data retention and deletion

Collections remain until you delete them or clear Reframe data. Continue Watching entries expire after 90 days and are removed on completion. Subscription snapshots expire after 24 hours. Adapter health data is stored in session storage and is cleared by the browser when the session ends.

Uninstalling Reframe may not automatically remove all extension storage in every browser version. Clear Reframe data from Settings before uninstalling if you want to explicitly erase it.

## Changes and contact

Before public distribution, the maintainer should replace this draft with a published privacy-policy URL and add a monitored contact address. Any change to data handling must be reflected here before release.
