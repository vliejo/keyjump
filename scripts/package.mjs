/*
 * Build the Chrome Web Store upload.
 *
 * `check.mjs` proves the extension is internally consistent; this proves it is
 * *acceptable to the store*, which is a different set of rules — name and
 * description lengths, the version number grammar, and icons that are actually
 * the pixel dimensions the manifest claims. Getting any of those wrong costs a
 * round trip through review, so they are cheaper to catch here.
 *
 * Run with `pnpm package`. Output: dist/keyjump-<version>.zip
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/*
 * Exactly what the browser needs at runtime. scripts/, test/, node_modules and
 * the repo's own documentation are development-only — shipping them would grow
 * the package and hand the review team code that has nothing to do with the
 * extension's behaviour.
 */
const SHIPPED = ['manifest.json', 'icons', 'src'];

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

/* ------------------------------------------------------- manifest, store rules */

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

check(manifest.manifest_version === 3, 'the store only accepts Manifest V3');

// Up to four dot-separated integers, each 0-65535, no leading zeroes.
const version = String(manifest.version || '');
const parts = version.split('.');
check(
  /^\d+(\.\d+){0,3}$/.test(version) &&
    parts.every((p) => (p === '0' || !p.startsWith('0')) && Number(p) <= 65535),
  `version "${version}" is not a valid store version (1-4 integers, each 0-65535, no leading zeroes)`
);

// Store field limits. Exceeding them is rejected at upload, not at review.
check(
  manifest.name && manifest.name.length <= 45,
  `name is ${manifest.name?.length ?? 0} characters; the store allows 45`
);
check(
  manifest.description && manifest.description.length <= 132,
  `description is ${manifest.description?.length ?? 0} characters; the store allows 132`
);

/*
 * The manifest's description is the store's summary line, and the same sentence
 * is also the package description, the repo description on GitHub, and the
 * Summary field in store/listing.md. The manifest is the source of truth for
 * all of them; drift here means shipping two different pitches for one
 * extension, which is the kind of thing nobody notices for a year.
 */
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
check(
  pkg.description === manifest.description,
  `package.json description does not match manifest.json:\n` +
    `      manifest: ${manifest.description}\n` +
    `      package:  ${pkg.description}`
);
check(
  pkg.version === manifest.version,
  `package.json version (${pkg.version}) does not match manifest.json (${manifest.version})`
);

const listingDoc = readFileSync(join(ROOT, 'store', 'listing.md'), 'utf8');
check(
  listingDoc.includes(manifest.description),
  'store/listing.md no longer quotes the manifest description as the store Summary'
);

/* ------------------------------------------------------------- icon dimensions */

/** Width and height straight out of a PNG's IHDR chunk, which is always first. */
function pngSize(file) {
  const buf = readFileSync(file);
  const isPng = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47;
  if (!isPng || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

for (const [declared, path] of Object.entries(manifest.icons || {})) {
  const file = join(ROOT, path);
  if (!existsSync(file)) {
    problems.push(`icon missing: ${path} (run \`pnpm icons\`)`);
    continue;
  }
  const size = pngSize(file);
  if (!size) {
    problems.push(`${path} is not a valid PNG`);
  } else if (size.width !== Number(declared) || size.height !== Number(declared)) {
    problems.push(`${path} is ${size.width}x${size.height} but the manifest declares ${declared}x${declared}`);
  }
}

// The store's own listing icon is the 128px one; without it the item cannot publish.
check(manifest.icons?.['128'], 'the store requires a 128x128 icon');

/* ------------------------------------------------- everything shipped must exist */

for (const entry of SHIPPED) {
  check(existsSync(join(ROOT, entry)), `missing from the package: ${entry}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) that would fail a store upload:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

/* ----------------------------------------------------------------------- pack */

mkdirSync(DIST, { recursive: true });
const zipPath = join(DIST, `keyjump-${version}.zip`);
rmSync(zipPath, { force: true });

// -X drops the platform extra-attribute blocks, so the same tree packs to the
// same bytes on macOS and on the Linux runner.
execFileSync('zip', ['-qrX', zipPath, ...SHIPPED, '-x', '*.DS_Store', '-x', '__MACOSX/*'], {
  cwd: ROOT,
  stdio: 'inherit'
});

const listing = execFileSync('zip', ['-sf', zipPath], { cwd: ROOT, encoding: 'utf8' });
const entries = listing
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('Archive contains:') && !l.startsWith('Total '));

const stray = entries.filter((e) => e.includes('node_modules/') || e.endsWith('.DS_Store'));
if (stray.length) {
  console.error(`\nrefusing to ship; the archive picked up files it should not have:\n`);
  for (const s of stray) console.error(`  ✗ ${s}`);
  process.exit(1);
}

const bytes = statSync(zipPath).size;
console.log(`\n✓ packed ${entries.length} files into dist/keyjump-${version}.zip (${(bytes / 1024).toFixed(1)} KB)`);
console.log(`  upload it at https://chrome.google.com/webstore/devconsole`);
