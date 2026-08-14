/* Settings persistence + validation. Used by the content script and options page. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

/**
 * Coerce a stored settings blob into something the rest of the code can trust.
 * Anything invalid silently falls back to its default rather than breaking the
 * page the content script is running on.
 */
KJ.normalizeSettings = function (raw) {
  const out = Object.assign({}, KJ.DEFAULTS, raw || {});

  const trigger = String(out.triggerKey || '');
  out.triggerKey = trigger.length === 1 ? trigger : KJ.DEFAULTS.triggerKey;

  const chars = Array.from(
    new Set(String(out.hintChars || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  ).join('');
  out.hintChars = chars.length >= 4 ? chars : KJ.DEFAULTS.hintChars;

  const size = Number(out.fontSize);
  out.fontSize = Number.isFinite(size) ? Math.min(28, Math.max(8, Math.round(size))) : KJ.DEFAULTS.fontSize;

  if (!['auto', 'dark', 'light'].includes(out.theme)) out.theme = KJ.DEFAULTS.theme;
  if (!['topleft', 'center'].includes(out.hintPlacement)) out.hintPlacement = KJ.DEFAULTS.hintPlacement;

  for (const flag of ['detectPointerCursor', 'textFallback', 'autoActivateSingle', 'showStatusBar']) {
    out[flag] = Boolean(out[flag]);
  }

  out.excludedSites = Array.isArray(out.excludedSites)
    ? out.excludedSites.map((s) => String(s).trim()).filter(Boolean)
    : [];

  return out;
};

KJ.loadSettings = function () {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(KJ.DEFAULTS, (stored) => {
        if (chrome.runtime.lastError) resolve(KJ.normalizeSettings(null));
        else resolve(KJ.normalizeSettings(stored));
      });
    } catch (_) {
      resolve(KJ.normalizeSettings(null));
    }
  });
};

KJ.saveSettings = function (settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(KJ.normalizeSettings(settings), () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
};

KJ.onSettingsChanged = function (callback) {
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') callback(changes);
    });
  } catch (_) {
    /* storage unavailable in this context; settings simply stay static */
  }
};

/** Glob match where "*" stands for any run of characters. */
KJ.globMatches = function (pattern, value) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
};

KJ.isExcluded = function (url, patterns) {
  if (!patterns || !patterns.length) return false;
  return patterns.some((p) => {
    // A bare pattern with no wildcard is treated as a substring match on the
    // host+path, which is what people usually mean when they type "example.com".
    if (!p.includes('*')) return url.toLowerCase().includes(p.toLowerCase());
    return KJ.globMatches(p, url);
  });
};
