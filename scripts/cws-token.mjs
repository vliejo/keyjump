/*
 * Mint a Chrome Web Store refresh token.
 *
 * Google retired the copy-a-code-from-the-browser flow
 * (`urn:ietf:wg:oauth:2.0:oob`) in 2022, so the only route left for a Desktop
 * app OAuth client is a loopback redirect. This starts a throwaway server on
 * localhost, hands you the consent URL, catches the redirect and trades the
 * code for a refresh token. Desktop clients are allowed to redirect to
 * http://127.0.0.1 on any port without registering it, which is what makes
 * this work with no extra dashboard configuration.
 *
 *   CWS_CLIENT_ID=… CWS_CLIENT_SECRET=… node scripts/cws-token.mjs
 *
 * You run this once. The token it prints is what goes into the
 * CWS_REFRESH_TOKEN GitHub secret. Treat it like a password.
 */
import { createServer } from 'node:http';

const CLIENT_ID = process.env.CWS_CLIENT_ID;
const CLIENT_SECRET = process.env.CWS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n✗ set CWS_CLIENT_ID and CWS_CLIENT_SECRET first.');
  console.error('  Both come from the OAuth "Desktop app" client you created in Google Cloud.');
  console.error('  See docs/PUBLISHING.md.\n');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 8138;
const REDIRECT = `http://127.0.0.1:${PORT}`;

const authUrl =
  'https://accounts.google.com/o/oauth2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    // Without both of these Google returns an access token but no refresh
    // token on repeat authorisations, which is the classic silent failure here.
    access_type: 'offline',
    prompt: 'consent'
  });

console.log('\n  1. Open this URL and approve access:\n');
console.log(`     ${authUrl}\n`);
console.log(`  2. You will be redirected back to ${REDIRECT} — leave this running until then.\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/') {
    res.writeHead(404).end();
    return;
  }

  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');

  if (error || !code) {
    res.writeHead(400, { 'content-type': 'text/plain' }).end(`Authorisation failed: ${error || 'no code returned'}`);
    console.error(`\n✗ authorisation failed: ${error || 'no code returned'}\n`);
    server.close();
    process.exitCode = 1;
    return;
  }

  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT
    })
  });
  const body = await token.json().catch(() => ({}));

  if (!token.ok || !body.refresh_token) {
    const why = body.error_description || body.error || 'no refresh_token in the response';
    res.writeHead(500, { 'content-type': 'text/plain' }).end(`Token exchange failed: ${why}`);
    console.error(`\n✗ token exchange failed: ${why}\n`);
    server.close();
    process.exitCode = 1;
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
    '<h1>Done</h1><p>Refresh token printed in the terminal. You can close this tab.</p>'
  );

  console.log('  ✓ refresh token (store this as the CWS_REFRESH_TOKEN secret):\n');
  console.log(`     ${body.refresh_token}\n`);
  console.log('  Do not commit it. If the OAuth consent screen is still in "Testing",');
  console.log('  this token expires in 7 days — set the app to "In production" and re-run.\n');

  server.close();
});

server.listen(PORT, '127.0.0.1');
