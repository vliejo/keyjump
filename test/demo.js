/* Demo page behaviour: log activations and build the shadow-DOM sample. */
(function () {
  const log = document.getElementById('log');
  let count = 0;

  function report(label) {
    count += 1;
    log.textContent = `${count}. activated: ${label}`;
  }

  // Deliberately listen on click, not on the element's own handler attribute, so
  // we verify the synthesized event sequence actually bubbles.
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-name], a, button');
    if (!el) return;
    report(el.dataset.name || el.textContent.trim() || el.tagName.toLowerCase());
  });

  document.addEventListener(
    'focusin',
    (event) => {
      const el = event.target;
      if (el.matches('input, textarea, select, [contenteditable]')) {
        report(`focused ${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''}`);
      }
    },
    true
  );

  document.getElementById('open-modal').addEventListener('click', () => {
    document.getElementById('modal').classList.add('open');
  });
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('modal').classList.remove('open');
  });

  const host = document.getElementById('shadow-host');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .wrap { display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
              font: inherit; }
      button, input { font: inherit; padding: 6px 10px; }
    </style>
    <div class="wrap">
      <button data-name="Shadow: button">Button inside a shadow root</button>
      <a href="#anchor-target" data-name="Shadow: link">Link inside a shadow root</a>
      <input type="text" placeholder="Shadow input" />
    </div>
  `;
  shadow.addEventListener('click', (event) => {
    const el = event.target.closest('[data-name]');
    if (el) report(el.dataset.name);
  });
})();
