# Chrome Web Store listing copy

Everything the dashboard asks for, written out ready to paste. Keep this in sync with the
listing — when a reviewer questions something, this file is the record of what was claimed.

Field limits are the store's, not ours. `pnpm package` enforces the two that live in the
manifest (name and summary); the rest are only checked by the dashboard.

---

## Product details

**Name** (45 max — currently 7)

```
KeyJump
```

**Summary** (132 max — currently 107; must match `manifest.json`'s `description`)

```
Press ; to label every link, button and field on the page, then type 1-3 characters to jump straight to it.
```

**Category**

`Functionality & UI`

Keyboard-only navigation is a defensible fit for `Accessibility` too, and that category is
less crowded. Pick from whatever list the dashboard actually shows — Google has reshuffled
this taxonomy more than once.

**Language**

`English`

**Detailed description** (16,000 max)

```
KeyJump lets you drive any page from the keyboard.

Press ; and every link, button, form field and clickable element on screen gets a short
label. Type the label to jump straight to it — buttons get clicked, links get followed,
text fields get focused with the caret already at the end. Most jumps are three keystrokes
or fewer.

WHY IT IS FAST

Labels are 1-3 characters and they are prefix-free: no label is ever the start of another
one. That means the moment your typing narrows things down to a single target, KeyJump can
act immediately, because there is no longer any chance you were halfway through typing a
longer label. Most jumps never need Enter at all.

Labels are handed out in reading order, so whatever is at the top-left of your screen — the
things you reach for most — gets the single-character hints.

TYPE WHAT YOU SEE

If what you type does not match any label, KeyJump searches the visible text of each target
instead. On a checkout page, typing "chec" filters down to the Checkout button without you
ever reading a hint. The status readout tells you when this kicks in.

WHY THE SEMICOLON

Almost nothing else claims it. Slash and question mark are taken nearly everywhere for
search and shortcut help. Period opens the web editor on GitHub and GitLab. Single letters
are heavily bound by Gmail, Jira and GitLab. Semicolon is quiet, and it is on the home row.

An ordinary typing character works as a trigger because KeyJump ignores it whenever your
caret is in a text field. That includes code editors — Monaco and CodeMirror are both
handled — so semicolon still types normally in a web IDE, even in vim mode.

You can change the trigger to any single character in the options.

WHAT IT FINDS

Links, buttons, inputs, selects, textareas, summary elements, contenteditable regions and
every interactive ARIA role. Optionally also anything that merely looks clickable, which
catches the div-with-a-click-handler pattern that modern web apps are full of.

It looks inside open shadow roots, checks that each target is genuinely visible rather than
hidden behind a modal or scrolled out of view, and collapses nested duplicates so a button
and the span inside it do not both get a hint.

CONFIGURABLE

- Trigger key, and the alphabet labels are built from
- Light, dark, or follow the system
- Hint size, and whether hints sit at the corner of an element or centred on it
- Whether to include elements that only look clickable
- Whether to fall back to matching visible text
- Whether a single match fires immediately or waits for Enter
- Per-site exclusions, so KeyJump stays out of the way where you do not want it

KEYS

  ;              show hints
  a-z            narrow the matches
  Enter          action the highlighted target
  Shift + Enter  open a link in a new tab
  Tab / arrows   step between matches
  Backspace      undo a character
  Esc            dismiss

PRIVACY

KeyJump makes no network requests. There is no analytics, no telemetry, and no server for
any of it to reach. The only thing it stores is your own settings, in Chrome's own settings
storage. The only permission it requests is "storage".

It is open source and MIT licensed: https://github.com/vliejo/keyjump

KNOWN LIMITS

- Frames are hinted independently; pressing ; hints whichever frame has focus.
- Closed shadow roots cannot be reached by any extension.
- Chrome itself blocks extensions on chrome:// pages and on the Web Store.
- Hints do not track DOM changes while they are open — press Esc and ; again. Scrolling and
  resizing are tracked.
```

---

## Privacy practices

**Single purpose**

```
KeyJump has one purpose: keyboard navigation of web pages. It overlays short text labels on
the links, buttons and form fields visible in the current tab so the user can activate any
of them by typing the label instead of using a mouse. Every feature exists to serve that one
interaction.
```

**Justification — `storage` permission**

```
Used solely to persist the user's own settings: the trigger key, the hint alphabet, theme,
hint size and placement, three matching toggles, the status-readout toggle, and their list of
excluded sites. It is stored in chrome.storage.sync so the settings follow the user's Chrome
profile across devices, the same way their bookmarks do. No page content, browsing activity
or personal data is written to storage, and nothing in storage is ever transmitted anywhere.
```

**Justification — host permission (`<all_urls>` content script)**

```
KeyJump's entire function is to label the interactive elements of whatever page the user is
currently looking at, which requires reading that page's DOM to find those elements and
measure their on-screen position. There is no way to know in advance which pages a user will
want to navigate by keyboard, so the content script has to be able to run on any of them.

The script runs entirely locally, in the tab. It makes no network requests of any kind — the
extension has no remote endpoint, no analytics and no dependencies. The DOM it reads is held
in memory only while hints are displayed and discarded as soon as the user jumps or presses
Escape. Nothing is stored and nothing leaves the browser.

Users who want to narrow this further can add any site to the Excluded sites list in the
options page, and the extension will not activate there.
```

**Remote code**

```
No, I am not using remote code.
```

All JavaScript ships inside the package. Nothing is fetched or evaluated at runtime.

**Data usage**

Tick **does not collect** for every category. Then all three certifications:

- [x] I do not sell or transfer user data to third parties, apart from the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**

```
https://github.com/vliejo/keyjump/blob/main/PRIVACY.md
```

---

## Assets

| Asset | Requirement | Status |
| --- | --- | --- |
| Store icon | 128×128 PNG | `icons/icon128.png` — generated, correct size |
| Screenshots | 1280×800 or 640×400, 1–5 of them | Two captured, both exactly 1280×800 — see below |
| Small promo tile | 440×280 PNG | Optional; only needed to be eligible for featuring |
| Marquee promo tile | 1400×560 PNG | Optional; editorial placement only |

### Screenshots

Upload in this order — the first is what shows on the search result card.

| File | Shows |
| --- | --- |
| `screenshots/01-hints-on-wikipedia.png` | Hint mode over a real article: 57 targets labelled, status readout in the corner |
| `screenshots/02-narrowed-to-14-matches.png` | After one keystroke — 57 down to 14, non-matches gone, the typed `S` dimmed inside its chip, focus ring on the active target |
| `screenshots/03-options-page.png` | The options page at shipped defaults, dark theme |

**How these were captured**, since getting an exact 1280×800 is fiddlier than it looks:

- The capture is **page-only** — no tab strip, toolbar or window frame appears in it. What
  matters is the *viewport*, not the window.
- Browser chrome and a collapsed side tab bar cost 56px of width and 137px of height on this
  setup, so a **1336×937 window** yields a 1280×800 viewport. Verify with
  `window.innerWidth/innerHeight` rather than trusting the window size.
- Keep `devicePixelRatio` at **1**. A retina DPR of 2 quadruples the source pixels and the
  capture gets downsampled below 1280 wide, which cannot be recovered by upscaling.
- DevTools device emulation also works and is immune to the tab bar, but a docked DevTools
  panel blocks programmatic window resizing — close it first if you resize that way.
- Cropping down to 1280×800 is lossless and fine; upscaling to reach it is not.

The options page cannot be screenshotted at its `chrome-extension://` URL — Chrome blocks
automation on those, same as `chrome://` pages. Serve it over HTTP instead:

```bash
pnpm demo    # then http://localhost:8137/src/options/options.html
```

It renders correctly there because `KJ.loadSettings()` catches a missing `chrome.storage`
and falls back to defaults — which is also what makes the shot show the shipped defaults
rather than whatever you have configured locally. Saving does not work over HTTP, but
nothing about a screenshot needs it to.

---

## Support

**Support URL**

```
https://github.com/vliejo/keyjump/issues
```

The developer account's contact email stays private — Google uses it to reach you about
reviews, and it is not shown on the public listing.
