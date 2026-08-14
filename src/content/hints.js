/* Hint label generation. */
var KJ = globalThis.KJ || (globalThis.KJ = {});

/**
 * Build `count` unique labels over `chars`, keeping them as short as possible.
 *
 * Breadth-first expansion of the label tree: keep expanding the shortest unused
 * label until enough leaves remain, then take that many. The leaves of a partly
 * expanded tree are prefix-free — a leaf can't be a prefix of another leaf, or
 * it would have had to be expanded to produce it — which is what lets the
 * content script treat a fully typed label as unambiguous.
 *
 * Sorted by length first so the shortest labels land on whatever the caller
 * passes in first (targets arrive in reading order, so the top-left of the
 * screen gets the one-character hints).
 */
KJ.hintStrings = function (count, chars) {
  const alphabet = Array.from(chars);
  if (count <= 0 || alphabet.length < 2) return [];

  const queue = [''];
  let offset = 0;

  // `queue.length - offset` is the number of unexpanded leaves. Each expansion
  // consumes one and produces `alphabet.length`.
  while (queue.length - offset < count || queue.length === 1) {
    const prefix = queue[offset++];
    for (const c of alphabet) queue.push(prefix + c);
  }

  return queue.slice(offset, offset + count).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
};
