/*
 * Pre-load sanity check: the manifest parses, everything it points at exists,
 * and every JS file is syntactically valid. Run with `pnpm check`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function check(condition, message) {
  if (!condition) problems.push(message);
}

/* ------------------------------------------------------------- manifest */

const manifestPath = join(ROOT, 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`manifest.json does not parse: ${err.message}`);
  process.exit(1);
}

check(manifest.manifest_version === 3, 'manifest_version should be 3');
check(Boolean(manifest.name && manifest.version), 'manifest needs a name and version');

const referenced = new Set();
for (const path of Object.values(manifest.icons || {})) referenced.add(path);
for (const path of Object.values((manifest.action || {}).default_icon || {})) referenced.add(path);
if (manifest.action?.default_popup) referenced.add(manifest.action.default_popup);
if (manifest.options_ui?.page) referenced.add(manifest.options_ui.page);
for (const entry of manifest.content_scripts || []) {
  for (const file of [...(entry.js || []), ...(entry.css || [])]) referenced.add(file);
}

for (const path of referenced) {
  check(existsSync(join(ROOT, path)), `manifest references a missing file: ${path}`);
}

/* --------------------------------------------------------- js + html refs */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const jsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    problems.push(`syntax error in ${relative(ROOT, file)}:\n${err.stderr?.toString().trim()}`);
  }
}

// Extension pages may not use inline scripts under the MV3 CSP.
for (const file of files.filter((f) => f.endsWith('.html') && !f.includes('test'))) {
  const html = readFileSync(file, 'utf8');
  const inline = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html);
  check(!inline, `${relative(ROOT, file)} has an inline <script>, which MV3's CSP blocks`);

  for (const match of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
    const target = join(dirname(file), match[1]);
    check(existsSync(target), `${relative(ROOT, file)} references a missing file: ${match[1]}`);
  }
}

/* ------------------------------------------------------ hint label sanity */

// hints.js is a plain content script rather than a module, so evaluate it in a
// throwaway realm and pull the function back out.
const hintsContext = createContext({});
runInContext(readFileSync(join(ROOT, 'src/content/hints.js'), 'utf8'), hintsContext);
const hintStrings = hintsContext.KJ.hintStrings;

const ALPHABET = 'sadfjklewcmpgh';

for (const count of [1, 2, 5, 13, 14, 15, 200, 2000, 3000]) {
  const labels = hintStrings(count, ALPHABET);
  check(labels.length === count, `hintStrings(${count}) returned ${labels.length} labels`);
  check(new Set(labels).size === count, `hintStrings(${count}) produced duplicate labels`);

  // Prefix-freedom: no label may be a prefix of another, or a fully typed label
  // would still be ambiguous.
  const set = new Set(labels);
  for (const label of labels) {
    for (let i = 1; i < label.length; i++) {
      check(!set.has(label.slice(0, i)), `hintStrings(${count}): "${label.slice(0, i)}" is a prefix of "${label}"`);
    }
  }

  // Shortest labels first, so reading-order-early targets get the cheap hints.
  const lengths = labels.map((l) => l.length);
  check(
    lengths.every((len, i) => i === 0 || lengths[i - 1] <= len),
    `hintStrings(${count}) did not order labels shortest-first`
  );

  // 14 characters addresses 14 + 14² + 14³ = 2954 targets within 3 keystrokes.
  if (count <= 2000) {
    check(labels.every((l) => l.length <= 3), `hintStrings(${count}) produced a label longer than 3 characters`);
  }
}

check(hintStrings(0, ALPHABET).length === 0, 'hintStrings(0) should return nothing');
check(hintStrings(5, 'a').length === 0, 'a single-character alphabet cannot produce labels');

/* -------------------------------------------------------------------- out */

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log(`✓ manifest, ${jsFiles.length} JS files and hint generation all check out`);
