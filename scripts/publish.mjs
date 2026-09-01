/*
 * Push a packaged build to the Chrome Web Store.
 *
 * By default this uploads only, which leaves the item as an unsubmitted draft
 * in the developer dashboard — the store keeps the currently published version
 * live until someone explicitly submits. Submitting for review is a separate,
 * deliberate step behind `--publish`, because it is the one action here that is
 * visible to the outside world and cannot be taken back.
 *
 *   node scripts/publish.mjs                  upload as a draft
 *   node scripts/publish.mjs --publish        upload, then submit for review
 *   node scripts/publish.mjs --status         report the item's current state
 *
 * Credentials come from the environment; see docs/PUBLISHING.md for how to mint
 * them. Never put them in a file inside the repo.
 *
 *   CWS_EXTENSION_ID     the 32-character item id from the dashboard URL
 *   CWS_CLIENT_ID        OAuth client id
 *   CWS_CLIENT_SECRET    OAuth client secret
 *   CWS_REFRESH_TOKEN    OAuth refresh token
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://www.googleapis.com/chromewebstore/v1.1';
const UPLOAD_API = 'https://www.googleapis.com/upload/chromewebstore/v1.1';

const args = process.argv.slice(2);
const wantPublish = args.includes('--publish');
const statusOnly = args.includes('--status');
// trustedTesters pushes to your tester group instead of the public listing.
const target = args.includes('--trusted-testers') ? 'trustedTesters' : 'default';

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------ credentials */

const env = {};
for (const key of ['CWS_EXTENSION_ID', 'CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN']) {
  env[key] = process.env[key];
}
const missing = Object.keys(env).filter((k) => !env[k]);
if (missing.length) {
  fail(
    `missing credentials: ${missing.join(', ')}\n` +
      `  These are read from the environment, never from a file in the repo.\n` +
      `  See docs/PUBLISHING.md for how to mint them.`
  );
}

/**
 * Trade the long-lived refresh token for a short-lived access token. Refresh
 * tokens for an app still in "Testing" publishing status expire after 7 days,
 * which is the usual cause of an out-of-nowhere `invalid_grant` here.
 */
async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.CWS_CLIENT_ID,
      client_secret: env.CWS_CLIENT_SECRET,
      refresh_token: env.CWS_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      body.error === 'invalid_grant'
        ? '\n  invalid_grant usually means the refresh token expired or was revoked.\n' +
          '  If the OAuth app is still in "Testing", set it to "In production" and mint a new one.'
        : '';
    fail(`could not get an access token (${res.status}): ${body.error_description || body.error || 'unknown'}${hint}`);
  }
  return body.access_token;
}

const token = await accessToken();
const authHeaders = { authorization: `Bearer ${token}`, 'x-goog-api-version': '2' };

/* ---------------------------------------------------------------- status */

async function status() {
  const res = await fetch(`${API}/items/${env.CWS_EXTENSION_ID}?projection=DRAFT`, { headers: authHeaders });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`could not read item state (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

/*
 * uploadState describes the last upload *made through this API*, not the health
 * of the item. A draft created in the dashboard therefore reports NOT_FOUND
 * even though the item is fine and has a CRX attached — which reads alarmingly
 * if you just print the enum. Interpret it against crxVersion instead.
 */
function explainState(item) {
  switch (item.uploadState) {
    case 'SUCCESS':
      return 'last API upload succeeded';
    case 'IN_PROGRESS':
      return 'an upload is still being processed — re-check in a moment';
    case 'FAILURE':
      return 'the last API upload was rejected; see the errors below';
    case 'NOT_FOUND':
      return item.crxVersion
        ? 'no upload has been made through this API — the version below came from the dashboard'
        : 'no package uploaded yet; run `pnpm store:upload` or upload one in the dashboard';
    default:
      return 'unrecognised state';
  }
}

if (statusOnly) {
  const item = await status();
  console.log(`item        ${item.id}`);
  console.log(`state       ${item.uploadState} — ${explainState(item)}`);
  console.log(`crx version ${item.crxVersion ?? '(none uploaded yet)'}`);
  if (item.itemError?.length) {
    for (const e of item.itemError) console.log(`  ! ${e.error_detail || e.error_code}`);
  }
  // The API exposes no "is it submitted / under review / published" field, so
  // do not let this read as confirmation of any of those.
  console.log(`\n  Review and publication status are only visible in the dashboard.`);
  process.exit(0);
}

/* ---------------------------------------------------------------- upload */

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const zipArg = args.find((a) => a.startsWith('--zip='));
const zipPath = zipArg ? zipArg.slice('--zip='.length) : join(ROOT, 'dist', `keyjump-${manifest.version}.zip`);

if (!existsSync(zipPath)) fail(`no package at ${zipPath} — run \`pnpm package\` first`);
const zip = readFileSync(zipPath);

console.log(`uploading ${zipPath} (${(zip.length / 1024).toFixed(1)} KB) as version ${manifest.version}…`);

const upload = await fetch(`${UPLOAD_API}/items/${env.CWS_EXTENSION_ID}?uploadType=media`, {
  method: 'PUT',
  headers: { ...authHeaders, 'content-type': 'application/zip' },
  body: zip
});
const uploadBody = await upload.json().catch(() => ({}));

// The API answers 200 with uploadState FAILURE for the interesting errors — a
// version that does not exceed the published one, a manifest the store rejects
// — so the HTTP status alone is not enough to call this a success.
if (!upload.ok || uploadBody.uploadState === 'FAILURE') {
  const details = (uploadBody.itemError || []).map((e) => `    ${e.error_detail || e.error_code}`).join('\n');
  fail(`upload failed (${upload.status}, ${uploadBody.uploadState || 'no state'}):\n${details || JSON.stringify(uploadBody)}`);
}

console.log(`✓ uploaded — item is now a draft at version ${manifest.version}`);

if (!wantPublish) {
  console.log(`\n  Not submitted. The live listing is unchanged.`);
  console.log(`  Review it at https://chrome.google.com/webstore/devconsole/`);
  console.log(`  then click Submit for review, or re-run with --publish.`);
  process.exit(0);
}

/* --------------------------------------------------------------- publish */

console.log(`submitting for review (target: ${target})…`);

const publish = await fetch(`${API}/items/${env.CWS_EXTENSION_ID}/publish?publishTarget=${target}`, {
  method: 'POST',
  headers: { ...authHeaders, 'content-length': '0' }
});
const publishBody = await publish.json().catch(() => ({}));

if (!publish.ok) {
  const details = (publishBody.error?.message || JSON.stringify(publishBody)) ?? '';
  fail(`publish failed (${publish.status}): ${details}`);
}

console.log(`✓ submitted for review — status: ${(publishBody.status || []).join(', ') || 'unknown'}`);
for (const detail of publishBody.statusDetail || []) console.log(`  ${detail}`);
console.log(`\n  Review typically takes a few hours to a few days. Google emails the outcome.`);
