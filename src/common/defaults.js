/* Default settings, shared by the content script and the options page. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

KJ.DEFAULTS = {
  // Key that opens hint mode. Compared against KeyboardEvent.key, so shifted
  // characters like "?" work too; ignored while the caret is inside a text
  // field, which is what keeps an ordinary typing character usable as a trigger.
  //
  // ";" because it is one of the few keys major web apps leave alone. "/" and
  // "?" are near-universally taken (search, shortcut help), "." is the Web IDE
  // on GitHub and GitLab, "[" and "]" step through diffs, and single letters are
  // heavily used by GitLab, Gmail and Jira.
  triggerKey: ';',

  // Alphabet used to build hint labels. More characters => shorter labels but a
  // wider visual scan. 14 characters covers 2744 targets in 3 keystrokes.
  hintChars: 'sadfjklewcmpgh',

  // Hint chip font size in px.
  fontSize: 12,

  // 'auto' follows prefers-color-scheme; 'dark' / 'light' pin the chip style.
  theme: 'auto',

  // Also treat elements whose computed cursor is `pointer` as targets. Catches
  // the div-with-an-onClick pattern common in React/Vue apps, at the cost of a
  // getComputedStyle pass over on-screen elements.
  detectPointerCursor: true,

  // When the typed query matches no hint label, fall back to searching the
  // visible text / aria-label of each target.
  textFallback: true,

  // Fire immediately once a keystroke narrows the set to a single target,
  // instead of waiting for Enter. Only applies to keystrokes that added a
  // character — see setQuery() in content/main.js.
  autoActivateSingle: true,

  // Small readout in the corner showing the query, match count and key hints.
  showStatusBar: true,

  // 'topleft' hangs the chip off the element's top-left corner, 'center' puts it
  // in the middle of the element.
  hintPlacement: 'topleft',

  // Glob patterns ("*" matches any run of characters) checked against the page
  // URL. Matching pages never load hint mode.
  excludedSites: []
};
