/*
 * Standalone mode for the demo page: load demo.html?standalone to run the
 * content scripts directly in the page, with chrome.storage stubbed out.
 *
 * Lets you iterate on the hint logic with a plain page reload instead of the
 * reload-extension / reload-tab cycle. Without the query parameter this file
 * does nothing, so the same page also tests the real installed extension.
 */
(function () {
  if (!new URLSearchParams(location.search).has('standalone')) return;

  const store = {};
  globalThis.chrome = globalThis.chrome || {};
  chrome.runtime = chrome.runtime || { lastError: null };
  chrome.storage = {
    sync: {
      get(defaults, callback) {
        callback(Object.assign({}, defaults, store));
      },
      set(values, callback) {
        Object.assign(store, values);
        if (callback) callback();
      }
    },
    onChanged: { addListener() {} }
  };

  const files = [
    '../src/common/defaults.js',
    '../src/common/settings.js',
    '../src/content/styles.js',
    '../src/content/hints.js',
    '../src/content/dom.js',
    '../src/content/overlay.js',
    '../src/content/activate.js',
    '../src/content/main.js'
  ];

  // Sequential, because the content scripts assume manifest load order.
  (function loadNext(i) {
    if (i >= files.length) {
      const banner = document.createElement('p');
      banner.textContent = 'standalone mode: content scripts loaded into the page';
      banner.style.cssText = 'color:#b45309;font-size:13px;font-weight:600';
      document.body.prepend(banner);
      return;
    }
    const script = document.createElement('script');
    script.src = files[i];
    script.onload = () => loadNext(i + 1);
    script.onerror = () => console.error(`[KeyJump demo] failed to load ${files[i]}`);
    document.head.appendChild(script);
  })(0);
})();
