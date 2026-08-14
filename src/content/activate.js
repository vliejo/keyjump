/* Doing the thing the user picked. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

(function () {
  /**
   * Replay the full pointer/mouse sequence a real click produces. Frameworks
   * differ in what they listen for — Radix-style menus act on `pointerdown`,
   * older widgets on `mousedown`, most on `click` — and a genuine mouse fires
   * all of them, so sending the whole sequence is the faithful thing to do.
   */
  function simulateClick(el, modifiers) {
    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + Math.min(rect.width / 2, 24));
    const y = Math.round(rect.top + Math.min(rect.height / 2, 12));

    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      ctrlKey: Boolean(modifiers.ctrlKey),
      shiftKey: Boolean(modifiers.shiftKey),
      altKey: Boolean(modifiers.altKey),
      metaKey: Boolean(modifiers.metaKey)
    };
    const pointerBase = Object.assign({}, base, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: 0
    });

    const send = (event) => {
      try {
        el.dispatchEvent(event);
      } catch (_) {
        /* a handler threw; keep going so the click still lands */
      }
    };

    send(new PointerEvent('pointerover', Object.assign({}, pointerBase, { buttons: 0 })));
    send(new MouseEvent('mouseover', Object.assign({}, base, { buttons: 0 })));
    send(new PointerEvent('pointermove', Object.assign({}, pointerBase, { buttons: 0 })));
    send(new MouseEvent('mousemove', Object.assign({}, base, { buttons: 0 })));
    send(new PointerEvent('pointerdown', Object.assign({}, pointerBase, { button: 0, buttons: 1, pressure: 0.5 })));
    send(new MouseEvent('mousedown', Object.assign({}, base, { button: 0, buttons: 1, detail: 1 })));

    try {
      if (typeof el.focus === 'function') el.focus({ preventScroll: true });
    } catch (_) {
      /* not focusable */
    }

    send(new PointerEvent('pointerup', Object.assign({}, pointerBase, { button: 0, buttons: 0 })));
    send(new MouseEvent('mouseup', Object.assign({}, base, { button: 0, buttons: 0, detail: 1 })));
    send(new MouseEvent('click', Object.assign({}, base, { button: 0, buttons: 0, detail: 1 })));
  }

  function placeCaretAtEnd(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      try {
        // Throws for input types that don't expose a selection (email, number).
        const end = el.value ? el.value.length : 0;
        el.setSelectionRange(end, end);
      } catch (_) {
        /* nothing to place */
      }
      return;
    }
    if (!el.isContentEditable) return;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_) {
      /* selection unavailable */
    }
  }

  /**
   * @param {Element} el
   * @param {{ newTab?: boolean, shiftKey?: boolean, ctrlKey?: boolean,
   *           altKey?: boolean, metaKey?: boolean }} options
   */
  KJ.activateElement = function (el, options) {
    const opts = options || {};
    try {
      if (!el || !el.isConnected) return;

      if (opts.newTab && el.tagName === 'A' && el.href) {
        const raw = el.getAttribute('href') || '';
        if (!raw.startsWith('#') && !raw.toLowerCase().startsWith('javascript:')) {
          window.open(el.href, '_blank', 'noopener');
          return;
        }
      }

      if (KJ.isTextEditable(el)) {
        el.focus({ preventScroll: false });
        placeCaretAtEnd(el);
        return;
      }

      if (el.tagName === 'SELECT') {
        el.focus({ preventScroll: false });
        try {
          // Chrome 121+. The keydown that got us here counts as user activation.
          if (typeof el.showPicker === 'function') el.showPicker();
        } catch (_) {
          /* picker refused; the field is at least focused */
        }
        return;
      }

      simulateClick(el, opts);
    } catch (err) {
      console.warn('[KeyJump] could not activate element', err);
    }
  };
})();
