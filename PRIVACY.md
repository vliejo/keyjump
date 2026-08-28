# KeyJump privacy policy

_Last updated: 28 August 2026. Applies to KeyJump for Chrome, version 1.0.0 and later._

## The short version

KeyJump collects nothing, transmits nothing, and has no server. It cannot, because it
holds no permission that would let it.

## What the extension stores

Your settings — trigger key, hint alphabet, theme, hint size and placement, the three
matching toggles, the status-readout toggle, and your excluded-site patterns. That is the
complete list; it is the `KJ.DEFAULTS` object in
[`src/common/defaults.js`](src/common/defaults.js).

These live in `chrome.storage.sync`, which is Chrome's own settings store. Chrome
replicates it across the browsers you are signed into, under your Google account, exactly
as it does your bookmarks. KeyJump never reads it from anywhere else and never sends it
anywhere.

## What the extension does not do

- **No data leaves your browser.** KeyJump makes no network requests of any kind. There is
  no analytics, no telemetry, no crash reporting, no remote configuration, and no server
  for any of it to reach.
- **No page content is collected.** The content script reads the page's DOM to find links,
  buttons and fields and to measure where they are on screen. That reading happens in
  memory, in the tab, only while hints are showing, and is discarded when you press
  <kbd>Esc</kbd> or make a jump. Nothing is written to storage and nothing is transmitted.
- **No browsing history.** KeyJump does not hold the `history`, `tabs`, `bookmarks`,
  `cookies` or `webRequest` permissions, so it has no way to observe or record where you go.
- **No remote code.** All code ships inside the extension package. Nothing is fetched or
  evaluated at runtime, as Manifest V3 requires.

## Permissions, and why each one exists

| Permission | Why |
| --- | --- |
| `storage` | Save your settings so they survive a browser restart and follow your Chrome profile. This is the extension's only API permission. |
| Content script on `<all_urls>` | Hints have to be available on whatever page you are looking at, and there is no way to know in advance which pages those are. The script runs entirely locally; the `<all_urls>` match is what lets it run at all, not a grant to send anything anywhere. |

If you would rather KeyJump not run on particular sites, add them under **Excluded sites**
in the options page. Matching pages never load hint mode.

## Third parties

There are none. No SDKs, no libraries, no CDNs, no dependencies at all — the extension is
plain JavaScript with an empty dependency tree.

## Data sale and transfer

KeyJump does not sell, transfer, or otherwise disclose user data, because it does not
collect any.

## Children

KeyJump is a keyboard utility that handles no personal data, so it carries no age-specific
processing of any kind.

## Changes to this policy

Any change ships as a commit to this file in the public repository, so the full history is
auditable. Material changes will also be noted in the release notes for the version that
introduces them.

## Contact

Questions or concerns: open an issue at
<https://github.com/vliejo/keyjump/issues>.
