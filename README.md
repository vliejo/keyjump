# KeyJump

A Chrome extension for driving pages from the keyboard. Press <kbd>;</kbd> and every link,
button, field and other actionable element on screen gets a short label. Type the label to
narrow the field, then <kbd>Enter</kbd> to action it — buttons get clicked, text fields get
focused with the caret at the end.

Inspired by [Vimium C](https://chromewebstore.google.com/detail/vimium-c-all-by-keyboard/hfjbmagddngcpeloejdejnfgbamkjaeg),
but scoped to one job: hint, filter, action.

## Install

The Chrome Web Store listing is not up yet — see [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for
where that stands. Until then, load it unpacked.

No build step — the extension source is loaded as-is.

```bash
pnpm install          # nothing to fetch; sets the store up for the scripts below
pnpm build            # generates icons/, then runs the checks
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this `keyjump/` directory

After editing anything under `src/`, hit the reload icon on the extension card and reload the
page you're testing on.

## Keys

| Key | Action |
| --- | --- |
| <kbd>;</kbd> | Show hints. Ignored while the caret is in a text field, so it stays typeable. |
| <kbd>a</kbd>–<kbd>z</kbd> | Narrow to labels starting with what you've typed. Non-matches disappear; the first match is highlighted with a ring on the element itself. **Narrowing to a single match actions it immediately** — most jumps never need <kbd>Enter</kbd>. |
| <kbd>Enter</kbd> | Action the highlighted target |
| <kbd>Shift</kbd>+<kbd>Enter</kbd> | Open a link in a new tab |
| <kbd>Tab</kbd> / <kbd>↓</kbd> / <kbd>→</kbd> | Next match |
| <kbd>Shift</kbd>+<kbd>Tab</kbd> / <kbd>↑</kbd> / <kbd>←</kbd> | Previous match |
| <kbd>Backspace</kbd> | Undo one character |
| <kbd>Esc</kbd> | Dismiss |

Labels are 1–3 characters over a 14-character alphabet, which covers 2954 targets before
needing a fourth. They're **prefix-free** — no label is a prefix of another — so a fully typed
label is never ambiguous. That property is what makes auto-activation safe: in hint mode,
narrowing to one match means you finished a complete label, never that you stopped halfway
through a longer one.

<kbd>Enter</kbd> is still there for the cases auto-activation doesn't cover: picking among
several remaining matches after <kbd>Tab</kbd>, or opening in a new tab with
<kbd>Shift</kbd>+<kbd>Enter</kbd>.

### Typing text instead of a label

If what you've typed matches no label, KeyJump falls back to searching the visible text of each
target. So on a page where no hint starts with `chec`, typing it filters down to the *Checkout*
button. The status readout says `text filter` when this kicks in. Turn it off in options if you'd
rather it stayed strict.

## Options

Right-click the toolbar icon → **Options**, or open `chrome://extensions` → KeyJump → *Extension
options*.

| Setting | Default | Notes |
| --- | --- | --- |
| Trigger key | `;` | Any single character — see below |
| Hint characters | `sadfjklewcmpgh` | Home-row biased; duplicates stripped, 4 minimum |
| Include elements that just look clickable | on | Adds a `cursor: pointer` sweep, which catches `div`s with click handlers |
| Fall back to searching link text | on | The behaviour described above |
| Action immediately when a keystroke narrows to one match | on | Skips the <kbd>Enter</kbd> press. Backspace never triggers it |
| Theme / hint position / hint size | auto, top-left, 12px | |
| Show the status readout | on | Corner display with the query and match count |
| Excluded sites | none | One pattern per line; `*` wildcards match the full URL, bare text is a substring match |

Settings live in `chrome.storage.sync`, so they follow your Chrome profile. Changing them takes
effect on the next page load (or the next <kbd>;</kbd> for the exclusion list).

### Why <kbd>;</kbd>

Because almost nothing else claims it. <kbd>/</kbd> and <kbd>?</kbd> are near-universally taken
for search and shortcut help (GitLab, GitHub, Gmail, Slack, Jira, YouTube, Reddit); <kbd>.</kbd>
opens the Web IDE on GitHub and GitLab; <kbd>[</kbd> and <kbd>]</kbd> step through diffs; and
single letters are heavily bound by GitLab, Gmail and Jira. Semicolon is quiet, and it's on the
home row.

An ordinary typing character works as a trigger only because the trigger is ignored whenever the
caret is in a text field. That covers code editors too — Monaco holds focus in a hidden
`<textarea>` and CodeMirror 6 uses `contenteditable`, both of which `isEditableContext` catches —
so <kbd>;</kbd> still types normally in GitLab's Web IDE, even in vim mode.

If you want something quieter still, <kbd>\\</kbd> is bound essentially nowhere, at the cost of an
awkward reach.

## How targets are found

`src/content/dom.js` does the work, in this order:

1. **Collect** — a selector pass for the obvious things (`a[href]`, `button`, `input`, `select`,
   `textarea`, `summary`, `[contenteditable]`, `[onclick]`, `[tabindex]` and the interactive ARIA
   roles), run against the document and every open shadow root.
2. **Sweep for pointer cursors** (optional) — anything else whose computed cursor is `pointer`,
   skipping elements nested inside a target we already have so a button's inner `<span>` doesn't
   get its own hint. Geometry is filtered first so `getComputedStyle` only runs on on-screen
   elements, capped at 2500 of them.
3. **Filter to what's really visible** — `checkVisibility()` for `display`/`visibility`/`opacity`,
   plus a hit test at five points across the box. The hit test is what rejects things behind a
   modal or scrolled out of an `overflow: hidden` container while still reporting an in-viewport
   rect. If it rejects *everything* — which a full-page transparent overlay will do — the
   unfiltered set is used instead, so you never get an empty screen.
4. **Dedupe and order** — targets sharing a box collapse to one hint (outermost wins), then sort
   into reading order so the top-left of the screen gets the shortest labels.

Activation replays the full pointer/mouse sequence (`pointerdown` → `mousedown` → `mouseup` →
`click`), because component libraries disagree about which one they listen for and a real mouse
fires all of them.

The overlay lives in a shadow root on a single host element, so page CSS can't reach it and the
page's own DOM is never modified.

## Development

```bash
pnpm check     # manifest references resolve, JS parses, hint labels stay unique + prefix-free
pnpm icons     # regenerate icons/ (hand-rolled PNG encoder, no image dependency)
pnpm build     # icons + check
pnpm package   # build, then validate against the store's own rules and pack dist/keyjump-<version>.zip
pnpm demo      # serve the manual test page on :8137
```

There are no dependencies — the whole toolchain is Node's standard library.

`test/demo.html` is a manual harness covering the awkward cases: shadow DOM, elements hidden
three different ways, a scroll container clipping its contents, a modal covering the page, and
targets below the fold. Activations are logged on the page so you can confirm the right thing
fired. Adding `?standalone` loads the content scripts straight into the page with
`chrome.storage` stubbed, so you can iterate with a plain reload instead of the
reload-extension / reload-tab cycle.

### Releasing

`pnpm package` is enough to produce something uploadable by hand. Beyond that, tagging `vX.Y.Z`
builds the package, attaches it to a GitHub release, and uploads it to the Web Store as a
**draft** — submitting for review stays a deliberate click. The full path, including the
one-time Google setup, is in [`docs/PUBLISHING.md`](docs/PUBLISHING.md); the listing copy lives
in [`store/listing.md`](store/listing.md).

## Limitations

- **Iframes are hinted independently.** The content script runs in every frame, so pressing
  <kbd>;</kbd> hints whichever frame has focus. There's no cross-frame coordination, so you can't
  see hints for the page and an embedded frame at once.
- **Closed shadow roots are invisible.** Nothing can reach into `attachShadow({ mode: 'closed' })`
  from a content script.
- **Some pages are off-limits to extensions** — `chrome://` pages, the Web Store, and other
  extensions' pages. Chrome blocks content scripts there.
- **A page can capture <kbd>;</kbd> first.** The keydown listener is registered in the capture
  phase, which wins on nearly everything, but a page listening on `window` in capture with its own
  `stopImmediatePropagation` can still get there first. Change the trigger key if a site you use
  does this.
- **Hints don't track DOM changes while open.** If the page re-renders underneath the overlay,
  press <kbd>Esc</kbd> and <kbd>;</kbd> again. Scrolling and resizing *are* tracked.

## Layout

```
manifest.json           MV3 manifest; the only permission is `storage`
src/common/             defaults + settings load/save/validate (shared with the options page)
src/content/
  styles.js             overlay host style and shadow-root stylesheet
  hints.js              label generation
  dom.js                target discovery, visibility, hit testing
  overlay.js            chip / ring / status rendering
  activate.js           click synthesis and focus handling
  main.js               state machine and key handling
src/options/            options page
src/popup/              toolbar popup (cheat sheet + link to options)
scripts/
  check.mjs             pre-load sanity checks
  make-icons.mjs        icon generation
  package.mjs           store-rule validation + zip
  publish.mjs           Chrome Web Store upload / submit
  cws-token.mjs         one-time OAuth refresh-token helper
  serve.mjs             demo server
test/demo.html          manual test page
docs/PUBLISHING.md      how a release actually reaches the store
store/listing.md        store listing copy and permission justifications
```

## Contributing

Issues and pull requests are welcome at
[github.com/vliejo/keyjump](https://github.com/vliejo/keyjump/issues).

Before opening a PR, run `pnpm package` — it covers everything CI checks. There are no
dependencies and no build step, so a change under `src/` is testable by reloading the
extension, or by opening `test/demo.html?standalone` with `pnpm demo` running.

Two invariants are worth knowing about because the checks enforce them and a change that
breaks either one is a correctness bug, not a style question:

- **Hint labels stay prefix-free.** Auto-activation is only safe because a fully typed label
  can never also be the start of a longer one.
- **The overlay never mutates the page.** Everything renders into a shadow root on a single
  host element, so page CSS cannot reach in and the page's own DOM is left alone.

## Privacy

KeyJump makes no network requests, has no analytics and no server, and stores nothing but your
own settings. Full detail in [`PRIVACY.md`](PRIVACY.md).

## License

[MIT](LICENSE) © vliejo
