/* Popup: reflect the configured trigger key. */
(function () {
  KJ.loadSettings().then((settings) => {
    document.getElementById('trigger').textContent = settings.triggerKey;
  });
})();
