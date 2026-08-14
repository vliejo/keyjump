/* Hint-mode state machine and key handling. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

(function () {
  // Content scripts share one isolated world per frame, so this also guards
  // against a double injection after an extension reload.
  if (globalThis.__keyJumpLoaded) return;
  globalThis.__keyJumpLoaded = true;

  if (!document.documentElement) return;

  const state = {
    settings: null,
    active: false,
    hints: [],
    matches: [],
    activeIndex: 0,
    query: '',
    mode: 'hint'
  };

  const overlay = KJ.createOverlay();
  let repositionScheduled = false;

  /* ---------------------------------------------------------------- matching */

  function recomputeMatches() {
    const onScreen = state.hints.filter((h) => !h.offscreen);

    if (!state.query) {
      state.matches = onScreen;
      state.mode = 'hint';
      state.activeIndex = 0;
      return;
    }

    const query = state.query;
    let matches = onScreen.filter((h) => h.label.startsWith(query));
    let mode = 'hint';

    // Nothing starts with what was typed, so the user probably meant the text on
    // the control rather than its label.
    if (!matches.length && state.settings.textFallback) {
      const needle = query.toLowerCase();
      const byText = onScreen.filter((h) => h.text.toLowerCase().includes(needle));
      if (byText.length) {
        matches = byText;
        mode = 'text';
      }
    }

    state.matches = matches;
    state.mode = mode;
    state.activeIndex = 0;
  }

  /**
   * @param {string} query
   * @param {{ narrowing?: boolean }} [options] `narrowing` marks a keystroke that
   *   added a character. Backspace widens the set, and auto-activating on a
   *   correction would fire something the user was in the middle of undoing.
   */
  function setQuery(query, options) {
    state.query = query;
    recomputeMatches();

    const narrowedToOne = Boolean(options && options.narrowing) && query && state.matches.length === 1;
    if (state.settings.autoActivateSingle && narrowedToOne) {
      activateMatch(0, {});
      return;
    }
    overlay.update(state);
  }

  function moveActive(delta) {
    if (!state.matches.length) return;
    const count = state.matches.length;
    state.activeIndex = (state.activeIndex + delta + count) % count;
    overlay.update(state);
  }

  /* -------------------------------------------------------------- lifecycle */

  function enterHintMode() {
    let targets;
    try {
      targets = KJ.collectTargets(state.settings);
    } catch (err) {
      console.warn('[KeyJump] could not scan the page', err);
      return;
    }

    if (!targets.length) {
      overlay.toast(state.settings, 'nothing to jump to on screen');
      return;
    }

    const labels = KJ.hintStrings(targets.length, state.settings.hintChars);
    if (!labels.length) return;

    state.hints = targets.map((target, i) => Object.assign(target, { label: labels[i], offscreen: false }));
    state.query = '';
    state.mode = 'hint';
    state.activeIndex = 0;
    state.matches = state.hints.slice();
    state.active = true;

    overlay.show(state);
    addActiveListeners();
  }

  function exitHintMode() {
    if (!state.active) return;
    state.active = false;
    state.hints = [];
    state.matches = [];
    state.query = '';
    removeActiveListeners();
    overlay.hide();
  }

  function activateMatch(index, options) {
    const target = state.matches[index];
    // Tear the overlay down first: focusing a field while our capture-phase key
    // handlers are still installed would swallow the user's next keystroke.
    exitHintMode();
    if (target) KJ.activateElement(target.el, options);
  }

  /* ------------------------------------------------------------------- keys */

  function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function onKeyDownIdle(event) {
    if (!state.settings || state.active) return;
    if (event.defaultPrevented) return;
    if (event.isComposing || event.keyCode === 229) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== state.settings.triggerKey) return;
    if (KJ.isEditableContext(KJ.deepActiveElement())) return;
    // Re-checked here as well as at load, so an exclusion added in options takes
    // effect without a page reload.
    if (KJ.isExcluded(location.href, state.settings.excludedSites)) return;

    swallow(event);
    enterHintMode();
  }

  function onKeyDownActive(event) {
    if (!state.active) return;
    if (event.isComposing || event.keyCode === 229) return;

    const key = event.key;

    // Let real browser shortcuts through, but drop out of hint mode so the user
    // isn't left with a stale overlay.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      if (key === 'Enter') {
        swallow(event);
        activateMatch(state.activeIndex, { newTab: true });
        return;
      }
      exitHintMode();
      return;
    }

    switch (key) {
      case 'Escape':
        swallow(event);
        exitHintMode();
        return;
      case 'Enter':
        swallow(event);
        activateMatch(state.activeIndex, { newTab: event.shiftKey, shiftKey: event.shiftKey });
        return;
      case 'Backspace':
        swallow(event);
        setQuery(state.query.slice(0, -1));
        return;
      case 'Tab':
        swallow(event);
        moveActive(event.shiftKey ? -1 : 1);
        return;
      case 'ArrowDown':
      case 'ArrowRight':
        swallow(event);
        moveActive(1);
        return;
      case 'ArrowUp':
      case 'ArrowLeft':
        swallow(event);
        moveActive(-1);
        return;
      default:
        break;
    }

    if (key.length === 1) {
      swallow(event);
      setQuery(state.query + key.toLowerCase(), { narrowing: true });
      return;
    }

    // Anything else (F-keys, Home, PageDown…) is swallowed rather than passed on,
    // so the page doesn't scroll out from under the hints.
    swallow(event);
  }

  function swallowWhileActive(event) {
    if (state.active) swallow(event);
  }

  function onScrollOrResize() {
    if (!state.active || repositionScheduled) return;
    repositionScheduled = true;
    requestAnimationFrame(() => {
      repositionScheduled = false;
      if (!state.active) return;
      const anyOnScreen = overlay.reposition(state);
      if (!anyOnScreen) {
        exitHintMode();
        return;
      }
      recomputeMatches();
      overlay.update(state);
    });
  }

  function onWindowBlur(event) {
    // `blur` doesn't bubble but it does capture, so a capture listener on window
    // also sees every element blur. Only the window losing focus should dismiss.
    if (event.target && event.target !== window) return;
    exitHintMode();
  }

  function onVisibilityChange() {
    if (document.hidden) exitHintMode();
  }

  function onPointerDown() {
    exitHintMode();
  }

  function addActiveListeners() {
    window.addEventListener('keypress', swallowWhileActive, true);
    window.addEventListener('keyup', swallowWhileActive, true);
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', onScrollOrResize, true);
    window.addEventListener('blur', onWindowBlur, true);
    window.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('visibilitychange', onVisibilityChange, true);
  }

  function removeActiveListeners() {
    window.removeEventListener('keypress', swallowWhileActive, true);
    window.removeEventListener('keyup', swallowWhileActive, true);
    window.removeEventListener('scroll', onScrollOrResize, { capture: true });
    window.removeEventListener('resize', onScrollOrResize, true);
    window.removeEventListener('blur', onWindowBlur, true);
    window.removeEventListener('mousedown', onPointerDown, true);
    document.removeEventListener('visibilitychange', onVisibilityChange, true);
  }

  function onKeyDown(event) {
    if (state.active) onKeyDownActive(event);
    else onKeyDownIdle(event);
  }

  /* ------------------------------------------------------------------ start */

  KJ.loadSettings().then((settings) => {
    if (KJ.isExcluded(location.href, settings.excludedSites)) return;
    state.settings = settings;
    window.addEventListener('keydown', onKeyDown, true);
  });

  KJ.onSettingsChanged(() => {
    KJ.loadSettings().then((settings) => {
      state.settings = settings;
      if (state.active) exitHintMode();
    });
  });
})();
