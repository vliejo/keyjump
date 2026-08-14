/* Overlay chrome: host element styling and the shadow-root stylesheet. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

/*
 * Applied inline to the overlay host. `all: initial` first wipes anything the
 * page's CSS would otherwise inherit into our subtree; the rest is marked
 * !important because inline !important is the only author-level declaration a
 * page's own !important rules cannot beat.
 */
KJ.HOST_STYLE = [
  'all: initial !important',
  'position: fixed !important',
  'top: 0 !important',
  'left: 0 !important',
  'width: 100% !important',
  'height: 100% !important',
  'margin: 0 !important',
  'padding: 0 !important',
  'border: 0 !important',
  'display: block !important',
  'visibility: visible !important',
  'opacity: 1 !important',
  'transform: none !important',
  'filter: none !important',
  'clip-path: none !important',
  'pointer-events: none !important',
  'z-index: 2147483647 !important',
  'color-scheme: normal !important'
].join(';');

KJ.OVERLAY_CSS = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }

.kj-layer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  font-size: 12px;
}

.kj-layer.kj-theme-dark {
  --kj-bg: #111827;
  --kj-fg: #f8fafc;
  --kj-border: rgba(255, 255, 255, 0.24);
  --kj-dim: rgba(248, 250, 252, 0.42);
  --kj-accent: #6366f1;
  --kj-accent-border: #a5b4fc;
  --kj-accent-glow: rgba(99, 102, 241, 0.30);
  --kj-status-bg: rgba(17, 24, 39, 0.95);
  --kj-status-fg: #e5e7eb;
  --kj-status-dim: rgba(229, 231, 235, 0.55);
  --kj-status-border: rgba(255, 255, 255, 0.14);
}

.kj-layer.kj-theme-light {
  --kj-bg: #fde68a;
  --kj-fg: #422006;
  --kj-border: rgba(120, 53, 15, 0.45);
  --kj-dim: rgba(66, 32, 6, 0.42);
  --kj-accent: #4f46e5;
  --kj-accent-border: #4338ca;
  --kj-accent-glow: rgba(79, 70, 229, 0.22);
  --kj-status-bg: rgba(255, 255, 255, 0.97);
  --kj-status-fg: #1f2937;
  --kj-status-dim: rgba(31, 41, 55, 0.55);
  --kj-status-border: rgba(15, 23, 42, 0.14);
}

.kj-hint {
  position: absolute;
  top: 0; left: 0;
  display: inline-block;
  padding: 3px 5px 2px;
  border: 1px solid var(--kj-border);
  border-radius: 4px;
  background: var(--kj-bg);
  color: var(--kj-fg);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: var(--kj-font-size, 12px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.32);
  will-change: transform;
}

.kj-hint[hidden] { display: none; }

.kj-hint.kj-active {
  background: var(--kj-accent);
  color: #ffffff;
  border-color: var(--kj-accent-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.38);
}

.kj-typed { color: var(--kj-dim); }
.kj-hint.kj-active .kj-typed { color: rgba(255, 255, 255, 0.55); }
.kj-typed:empty, .kj-rest:empty { display: none; }

.kj-ring {
  position: absolute;
  top: 0; left: 0;
  border: 2px solid var(--kj-accent);
  border-radius: 5px;
  box-shadow: 0 0 0 4px var(--kj-accent-glow);
  will-change: transform;
}

.kj-ring[hidden] { display: none; }

.kj-status {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 6px 10px;
  border: 1px solid var(--kj-status-border);
  border-radius: 6px;
  background: var(--kj-status-bg);
  color: var(--kj-status-fg);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 12px;
  line-height: 1.3;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}

.kj-status[hidden] { display: none; }

.kj-status-query {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: pre;
}

.kj-status-query:empty::before {
  content: "type a hint";
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--kj-status-dim);
}

.kj-status-meta {
  color: var(--kj-status-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: no-preference) {
  .kj-hint, .kj-ring { transition: opacity 60ms linear; }
}
`;
