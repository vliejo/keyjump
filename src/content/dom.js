/* Finding the things on a page that are worth jumping to. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

(function () {
  const OVERLAY_ID = 'keyjump-overlay';

  const ACTIONABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    'label[for]',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="combobox"]',
    '[role="searchbox"]',
    '[role="textbox"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="treeitem"]'
  ].join(',');

  // Never worth a hint of their own during the cursor sweep. HTML/BODY are here
  // because a page that sets `cursor: pointer` on the body would otherwise get
  // one giant hint over everything.
  const SKIP_TAGS = new Set([
    'HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'META', 'LINK'
  ]);

  // Upper bound on getComputedStyle calls during the cursor:pointer sweep, so a
  // pathologically large page can't stall the keypress.
  const POINTER_SCAN_BUDGET = 2500;

  /**
   * Visit the document and every open shadow root beneath it, outermost first.
   * Selector matching then happens natively per root, which is far cheaper than
   * calling `matches()` on every element ourselves.
   */
  function eachRoot(root, visit) {
    const all = root.querySelectorAll('*');
    visit(root, all);
    for (const el of all) {
      if (el.shadowRoot && el.id !== OVERLAY_ID) eachRoot(el.shadowRoot, visit);
    }
  }

  /** Parent element, stepping out of a shadow root to its host. */
  function parentOf(node) {
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return root && root.host ? root.host : null;
  }

  function hasAncestorIn(el, set) {
    for (let node = parentOf(el); node; node = parentOf(node)) {
      if (set.has(node)) return true;
    }
    return false;
  }

  function clipToViewport(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const right = Math.min(rect.right, vw);
    const bottom = Math.min(rect.bottom, vh);
    if (right - left < 1 || bottom - top < 1) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  /**
   * The on-screen box we should hang a hint off, or null if the element isn't
   * usefully visible. Falls back to descendant boxes so that zero-height
   * wrappers (an <a> around an absolutely positioned image, say) still qualify.
   */
  function visibleRect(el) {
    let best = null;
    const rects = el.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const clipped = clipToViewport(rects[i]);
      if (clipped && (!best || clipped.width * clipped.height > best.width * best.height)) best = clipped;
    }
    if (best) return best;

    const descendants = el.getElementsByTagName('*');
    const limit = Math.min(descendants.length, 20);
    for (let i = 0; i < limit; i++) {
      const clipped = clipToViewport(descendants[i].getBoundingClientRect());
      if (clipped) return clipped;
    }
    return null;
  }

  function isRenderable(el) {
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
        contentVisibilityAuto: true
      });
    }
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  }

  function isDisabled(el) {
    if (el.disabled) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;
    return Boolean(el.closest && el.closest('fieldset[disabled]'));
  }

  /** elementFromPoint, but descending through open shadow roots. */
  function deepElementFromPoint(root, x, y) {
    let hit = (root.elementFromPoint ? root : document).elementFromPoint(x, y);
    while (hit && hit.shadowRoot) {
      const inner = hit.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === hit) break;
      hit = inner;
    }
    return hit;
  }

  /**
   * Would a real click at this box actually land on this element? This is what
   * rejects things covered by a modal, or scrolled out of an `overflow: hidden`
   * container while still reporting an in-viewport rect.
   */
  function isHittable(el, rect) {
    const root = el.getRootNode();
    const inset = Math.min(3, rect.width / 2, rect.height / 2);
    const points = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + inset, rect.top + inset],
      [rect.right - inset, rect.top + inset],
      [rect.left + inset, rect.bottom - inset],
      [rect.right - inset, rect.bottom - inset]
    ];

    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      const hit = deepElementFromPoint(root, x, y);
      if (!hit) continue;
      if (hit === el || el.contains(hit)) return true;
      // Slotted light-DOM content reports the slot's host as the hit target.
      if (hit.contains && hit.contains(el) && hit !== document.body && hit !== document.documentElement) return true;
    }
    return false;
  }

  const NON_TEXT_INPUT_TYPES = new Set([
    'button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'color', 'range', 'hidden'
  ]);

  KJ.isTextEditable = function (el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TEXTAREA') return !el.disabled && !el.readOnly;
    if (el.tagName === 'INPUT') {
      const type = String(el.type || 'text').toLowerCase();
      return !NON_TEXT_INPUT_TYPES.has(type) && !el.disabled && !el.readOnly;
    }
    return Boolean(el.isContentEditable);
  };

  function kindOf(el) {
    if (KJ.isTextEditable(el)) return 'text';
    if (el.tagName === 'SELECT') return 'select';
    if (el.tagName === 'A' && el.hasAttribute('href')) return 'link';
    return 'click';
  }

  /** Short human-readable label, used by the text-filter fallback. */
  function describe(el) {
    const parts = [
      el.getAttribute && el.getAttribute('aria-label'),
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.placeholder : '',
      el.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.has(String(el.type).toLowerCase()) ? '' : el.value,
      el.innerText || el.textContent,
      el.getAttribute && el.getAttribute('title'),
      el.getAttribute && el.getAttribute('alt'),
      el.getAttribute && el.getAttribute('name')
    ];
    for (const part of parts) {
      if (!part) continue;
      const text = String(part).replace(/\s+/g, ' ').trim();
      if (text) return text.slice(0, 120);
    }
    return '';
  }

  /**
   * Collect everything actionable and on-screen, in reading order.
   * Returns `[{ el, rect, text, kind }]`.
   */
  KJ.collectTargets = function (settings) {
    const matched = [];
    const claimed = new Set();
    const pointerCandidates = [];

    eachRoot(document, (root, allElements) => {
      for (const el of root.querySelectorAll(ACTIONABLE_SELECTOR)) {
        if (claimed.has(el)) continue;
        claimed.add(el);
        matched.push(el);
      }
      if (!settings.detectPointerCursor) return;
      for (const el of allElements) {
        if (claimed.has(el) || SKIP_TAGS.has(el.tagName) || el.id === OVERLAY_ID) continue;
        pointerCandidates.push(el);
      }
    });

    if (pointerCandidates.length) {
      // Two passes: cheap geometry first, then the expensive style read only for
      // whatever survived and is actually on screen.
      const onScreen = [];
      for (const el of pointerCandidates) {
        if (onScreen.length >= POINTER_SCAN_BUDGET) break;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        if (rect.right <= 0 || rect.left >= window.innerWidth) continue;
        onScreen.push(el);
      }
      for (const el of onScreen) {
        if (getComputedStyle(el).cursor !== 'pointer') continue;
        // A pointer cursor is inherited, so anything nested inside a target we
        // already have would otherwise earn a redundant hint of its own —
        // every <span> inside a button, say. Walking up beats scanning the
        // whole matched list per candidate.
        if (hasAncestorIn(el, claimed)) continue;
        claimed.add(el);
        matched.push(el);
      }
    }

    const visible = [];
    const beforeOcclusion = [];

    for (const el of matched) {
      if (isDisabled(el)) continue;
      if (!isRenderable(el)) continue;
      const rect = visibleRect(el);
      if (!rect) continue;
      const target = { el, rect, kind: kindOf(el), text: '' };
      beforeOcclusion.push(target);
      if (isHittable(el, rect)) visible.push(target);
    }

    // A full-page transparent overlay (cookie walls, drag layers) can make the
    // hit test reject everything. Rather than showing nothing, fall back to the
    // unfiltered set.
    const targets = visible.length ? visible : beforeOcclusion;

    // Collapse targets that occupy the same box — a link wrapping a role=button
    // of identical size should get one hint, and the outermost wins because it
    // appears first in document order.
    const byBox = new Map();
    for (const t of targets) {
      const key = `${Math.round(t.rect.left)}:${Math.round(t.rect.top)}:${Math.round(t.rect.width)}:${Math.round(t.rect.height)}`;
      if (!byBox.has(key)) byBox.set(key, t);
    }

    const deduped = Array.from(byBox.values());
    for (const t of deduped) t.text = describe(t.el);

    // Reading order, with a tolerance band so that items on the same visual row
    // sort left-to-right even when their tops differ by a pixel or two.
    deduped.sort((a, b) => {
      const rowA = Math.round(a.rect.top / 12);
      const rowB = Math.round(b.rect.top / 12);
      if (rowA !== rowB) return rowA - rowB;
      return a.rect.left - b.rect.left;
    });

    return deduped;
  };

  /** activeElement, following through open shadow roots. */
  KJ.deepActiveElement = function () {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  };

  KJ.isEditableContext = function (el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'SELECT') return true;
    return KJ.isTextEditable(el);
  };
})();
