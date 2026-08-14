/* Rendering the hint chips, the active-element ring and the status readout.
 *
 * Everything lives in a shadow root attached to a single host element, so the
 * page's stylesheets can't reach in and we never mutate the page's own DOM. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

KJ.createOverlay = function () {
  /* How far a top-left chip pokes above the top edge of its target, in px. */
  const RISE = 3;

  let host = null;
  let layer = null;
  let ring = null;
  let status = null;
  let statusQuery = null;
  let statusMeta = null;
  let chips = [];
  let toastTimer = 0;

  function resolveTheme(theme) {
    if (theme === 'dark' || theme === 'light') return theme;
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'dark';
    }
  }

  function ensure(settings) {
    if (!host || !host.isConnected) {
      host = document.createElement('div');
      host.id = 'keyjump-overlay';
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = KJ.HOST_STYLE;

      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = KJ.OVERLAY_CSS;

      layer = document.createElement('div');
      layer.className = 'kj-layer';

      ring = document.createElement('div');
      ring.className = 'kj-ring';
      ring.hidden = true;

      status = document.createElement('div');
      status.className = 'kj-status';
      status.hidden = true;
      statusQuery = document.createElement('span');
      statusQuery.className = 'kj-status-query';
      statusMeta = document.createElement('span');
      statusMeta.className = 'kj-status-meta';
      status.append(statusQuery, statusMeta);

      layer.append(ring, status);
      shadow.append(style, layer);
      (document.documentElement || document.body).appendChild(host);
      chips = [];
    }
    applyTheme(settings);
  }

  function applyTheme(settings) {
    layer.className = `kj-layer kj-theme-${resolveTheme(settings.theme)}`;
    layer.style.setProperty('--kj-font-size', `${settings.fontSize}px`);
  }

  function clearChips() {
    for (const chip of chips) chip.remove();
    chips = [];
  }

  /**
   * Position every chip. Sizes are read in one pass and written in the next so
   * we pay for a single layout instead of one per chip.
   */
  function place(state) {
    const centered = state.settings.hintPlacement === 'center';
    const sizes = chips.map((chip) => [chip.offsetWidth, chip.offsetHeight]);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (let i = 0; i < chips.length; i++) {
      const target = state.hints[i];
      if (!target) continue;
      const [cw, ch] = sizes[i];
      const rect = target.rect;

      let x;
      let y;
      if (centered) {
        x = rect.left + rect.width / 2 - cw / 2;
        y = rect.top + rect.height / 2 - ch / 2;
      } else {
        x = rect.left - 4;
        // Overlap the target rather than float above it: only the chip's top
        // RISE pixels clear the element's top edge. A chip that sits fully
        // above its target reads as belonging to whatever is above it, which
        // is ambiguous in dense layouts like table rows.
        y = rect.top - RISE;
      }

      x = Math.max(1, Math.min(x, vw - cw - 1));
      y = Math.max(1, Math.min(y, vh - ch - 1));
      chips[i].style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  function update(state) {
    const matched = new Set(state.matches);
    const active = state.matches[state.activeIndex];
    const query = state.query;

    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const target = state.hints[i];
      if (!target) continue;

      const visible = matched.has(target) && !target.offscreen;
      chip.hidden = !visible;
      // Toggled before the early return, otherwise a chip that was active when
      // it got filtered out keeps the class and shows up highlighted the next
      // time it becomes visible.
      chip.classList.toggle('kj-active', target === active);
      if (!visible) continue;

      // Only dim a prefix when the query is genuinely a hint prefix; in text
      // mode the query has nothing to do with the label.
      const prefixLength = state.mode === 'hint' ? Math.min(query.length, target.label.length) : 0;
      chip.firstChild.textContent = target.label.slice(0, prefixLength);
      chip.lastChild.textContent = target.label.slice(prefixLength);
    }

    if (active) {
      const r = active.rect;
      ring.hidden = false;
      ring.style.transform = `translate(${Math.round(r.left - 2)}px, ${Math.round(r.top - 2)}px)`;
      ring.style.width = `${Math.round(r.width + 4)}px`;
      ring.style.height = `${Math.round(r.height + 4)}px`;
    } else {
      ring.hidden = true;
    }

    if (!state.settings.showStatusBar) {
      status.hidden = true;
      return;
    }

    status.hidden = false;
    statusQuery.textContent = query;
    if (!state.matches.length) {
      statusMeta.textContent = 'no matches · backspace to undo · esc to cancel';
    } else {
      const count = `${state.matches.length} ${state.matches.length === 1 ? 'match' : 'matches'}`;
      const mode = state.mode === 'text' ? ' · text filter' : '';
      statusMeta.textContent = `${count}${mode} · enter to action · esc to cancel`;
    }
  }

  return {
    show(state) {
      clearTimeout(toastTimer);
      ensure(state.settings);
      clearChips();

      const fragment = document.createDocumentFragment();
      chips = state.hints.map((target) => {
        const chip = document.createElement('div');
        chip.className = 'kj-hint';
        const typed = document.createElement('span');
        typed.className = 'kj-typed';
        const rest = document.createElement('span');
        rest.className = 'kj-rest';
        rest.textContent = target.label;
        chip.append(typed, rest);
        fragment.appendChild(chip);
        return chip;
      });
      // After the ring so chips paint on top of it, before the status bar.
      layer.insertBefore(fragment, status);

      place(state);
      update(state);
    },

    update,

    /** Re-read geometry after a scroll or resize. */
    reposition(state) {
      if (!host || !host.isConnected) return false;
      let anyOnScreen = false;
      for (const target of state.hints) {
        const r = target.el.getBoundingClientRect();
        target.rect = {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height
        };
        target.offscreen =
          (r.width === 0 && r.height === 0) ||
          r.bottom <= 0 ||
          r.top >= window.innerHeight ||
          r.right <= 0 ||
          r.left >= window.innerWidth;
        if (!target.offscreen) anyOnScreen = true;
      }
      place(state);
      return anyOnScreen;
    },

    /** Brief message with no hints — used when a page has nothing to jump to. */
    toast(settings, message) {
      ensure(settings);
      clearChips();
      ring.hidden = true;
      status.hidden = false;
      statusQuery.textContent = '';
      statusMeta.textContent = message;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => this.hide(), 1400);
    },

    hide() {
      clearTimeout(toastTimer);
      clearChips();
      if (host) {
        host.remove();
        host = null;
        layer = null;
        ring = null;
        status = null;
        statusQuery = null;
        statusMeta = null;
      }
    }
  };
};
