import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.argv[2] || 47911);

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/test.html') {
    const viewer = readFileSync(join(root, 'src', 'main', 'resources', 'fbxdiff', 'viewer.html'), 'utf8');
    const harness = readFileSync(join(root, 'web', 'test', 'harness.js'), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(viewer.replace('</body>', () => '<script>' + harness + '</script></body>'));
    return;
  }
  const file = normalize(join(root, url.pathname));
  if (!file.startsWith(join(root, 'testdata')) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log('ready http://127.0.0.1:' + port + '/'));
