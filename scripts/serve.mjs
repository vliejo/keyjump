/*
 * Dev server for the demo page. Chrome only runs content scripts on file:// URLs
 * if you tick "Allow access to file URLs", so serving over http keeps testing
 * the installed extension friction-free. Run with `pnpm demo`.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8137;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === '/' ? '/test/demo.html' : decodeURIComponent(url.pathname);

  // normalize() collapses any ../ so a request can't escape the project.
  const path = join(ROOT, normalize(requested));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error('not a file');
  } catch (_) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(path)] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  createReadStream(path).pipe(res);
});

server.listen(PORT, () => {
  console.log(`  demo page      http://localhost:${PORT}/test/demo.html`);
  console.log(`  standalone     http://localhost:${PORT}/test/demo.html?standalone`);
  console.log('\n  ctrl-c to stop');
});
