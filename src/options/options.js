/* Options page wiring. */
(function () {
  const form = document.getElementById('settings-form');
  const statusEl = document.getElementById('status');
  const capacityEl = document.getElementById('capacity');
  const fontSizeInput = document.getElementById('fontSize');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const hintCharsInput = document.getElementById('hintChars');
  let statusTimer = 0;

  const CHECKBOXES = ['detectPointerCursor', 'textFallback', 'autoActivateSingle', 'showStatusBar'];
  const TEXT_FIELDS = ['triggerKey', 'hintChars'];
  const SELECTS = ['theme', 'hintPlacement'];

  function render(settings) {
    for (const name of TEXT_FIELDS) form.elements[name].value = settings[name];
    for (const name of SELECTS) form.elements[name].value = settings[name];
    for (const name of CHECKBOXES) form.elements[name].checked = settings[name];
    fontSizeInput.value = String(settings.fontSize);
    form.elements.excludedSites.value = settings.excludedSites.join('\n');
    updateFontSizeLabel();
    updateCapacity();
  }

  function collect() {
    const settings = {};
    for (const name of TEXT_FIELDS) settings[name] = form.elements[name].value;
    for (const name of SELECTS) settings[name] = form.elements[name].value;
    for (const name of CHECKBOXES) settings[name] = form.elements[name].checked;
    settings.fontSize = Number(fontSizeInput.value);
    settings.excludedSites = form.elements.excludedSites.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return settings;
  }

  function updateFontSizeLabel() {
    fontSizeValue.textContent = `${fontSizeInput.value}px`;
  }

  /** Show how many targets the current alphabet covers at 1, 2 and 3 keystrokes. */
  function updateCapacity() {
    const unique = new Set(hintCharsInput.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const n = unique.size;
    if (n < 4) {
      capacityEl.textContent = 'Needs at least 4 characters.';
      capacityEl.style.color = '#dc2626';
      return;
    }
    capacityEl.style.color = '';
    capacityEl.textContent = `${n} characters covers up to ${n ** 3} targets in 3 keystrokes.`;
  }

  function flash(message, tone) {
    statusEl.textContent = message;
    if (tone) statusEl.dataset.tone = tone;
    else delete statusEl.dataset.tone;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.textContent = '';
      delete statusEl.dataset.tone;
    }, 2600);
  }

  fontSizeInput.addEventListener('input', updateFontSizeLabel);
  hintCharsInput.addEventListener('input', updateCapacity);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = collect();
    const normalized = KJ.normalizeSettings(raw);
    KJ.saveSettings(normalized)
      .then(() => {
        // Re-render so the user sees exactly what got stored when a value was
        // coerced (deduped hint characters, a clamped font size).
        render(normalized);
        flash('Saved. Reload open tabs to pick up the change.');
      })
      .catch((err) => flash(`Could not save: ${err.message}`, 'error'));
  });

  document.getElementById('reset').addEventListener('click', () => {
    const defaults = KJ.normalizeSettings(null);
    render(defaults);
    KJ.saveSettings(defaults)
      .then(() => flash('Defaults restored.'))
      .catch((err) => flash(`Could not save: ${err.message}`, 'error'));
  });

  KJ.loadSettings().then(render);
})();
