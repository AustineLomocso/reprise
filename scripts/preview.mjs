// Local preview of the dashboard: builds the site with the real CLI, then serves it.
//
//   npm run preview                              sample records, http://localhost:4173/
//   node scripts/preview.mjs --data DIR [--data-source live|sample] [--port N]
//
// A small static server on node:http; no dependencies.

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const data = arg('data', 'test/fixtures/sample-records');
const dataSource = arg('data-source', 'sample');
const port = Number(arg('port', process.env.PORT ?? '4173'));
const out = resolve('.preview', String(port)); // one folder per port, so two previews never overwrite each other

const build = spawnSync(process.execPath, ['dist/reprise.mjs', 'build-site', '--data', data, '--out', out, '--data-source', dataSource], {
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(out, path));
    if (file !== out && !file.startsWith(out + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500).end('Server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview of ${data} (data source: ${dataSource}) at http://localhost:${port}/`);
});
