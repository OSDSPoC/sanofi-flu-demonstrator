// Serves dist/ from a nested project sub-path (as GitHub Pages does) and checks every referenced asset resolves.
// Usage: npm run build && node scripts/verify-subpath.mjs [--serve]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BASE = '/org-site/sanofi-flu-demonstrator/';
const PORT = 4180;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!url.startsWith(BASE)) {
    res.writeHead(404).end('outside base');
    return;
  }
  let rel = url.slice(BASE.length) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(PORT, r));
const origin = `http://localhost:${PORT}`;
const html = await (await fetch(origin + BASE)).text();
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
let failed = 0;
for (const ref of refs) {
  const abs = new URL(ref, origin + BASE).pathname;
  const r = await fetch(origin + abs);
  const ok = r.status === 200 && abs.startsWith(BASE);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${ref} -> ${abs} (${r.status})`);
  if (!ok) failed++;
}
const js = refs.find((r) => r.endsWith('.js'));
const jsText = await (await fetch(origin + new URL(js, origin + BASE).pathname)).text();
const absolute = jsText.match(/["'`]\/(?:assets|data)\//g);
console.log(absolute ? 'FAIL root-absolute asset paths in bundle' : 'OK   no root-absolute asset paths in bundle');
if (absolute) failed++;
if (process.argv.includes('--serve')) {
  console.log(`Serving ${origin}${BASE} (Ctrl+C to stop)`);
} else {
  server.close();
  process.exitCode = failed ? 1 : 0;
}
