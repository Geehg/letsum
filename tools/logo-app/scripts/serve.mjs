import http from 'node:http';
import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { PROJECT_ROOT, isMain, argsOf, reportFailure } from './lib.mjs';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
function inside(root, file) { const rel = path.relative(root, file); return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)); }
export async function startServer({ directory = path.join(PROJECT_ROOT, 'dist'), port = 4173, host = '127.0.0.1' } = {}) {
  if (host !== '127.0.0.1') throw new Error('The development server is restricted to 127.0.0.1');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer from 0 to 65535');
  const root = await realpath(directory);
  const server = http.createServer(async (request, response) => {
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache', 'Referrer-Policy': 'no-referrer' };
    const fail = (status, message) => { response.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }); response.end(request.method === 'HEAD' ? undefined : message); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); fail(405, 'Method not allowed'); return; }
    try {
      const raw = (request.url ?? '/').split('?')[0];
      let pathname;
      try { pathname = decodeURIComponent(raw); } catch { fail(400, 'Invalid URL encoding'); return; }
      if (!pathname.startsWith('/') || /[\u0000-\u001F\u007F\\]/u.test(pathname) || pathname.split('/').includes('..')) { fail(403, 'Forbidden path'); return; }
      let candidate = path.resolve(root, `.${pathname}`);
      if (!inside(root, candidate)) { fail(403, 'Forbidden path'); return; }
      let metadata = await stat(candidate);
      if (metadata.isDirectory()) { candidate = path.join(candidate, 'index.html'); metadata = await stat(candidate); }
      if (!metadata.isFile()) { fail(404, 'Not found'); return; }
      const resolved = await realpath(candidate);
      if (!inside(root, resolved)) { fail(403, 'Forbidden path'); return; }
      const bytes = await readFile(resolved);
      response.writeHead(200, { ...headers, 'Content-Type': MIME[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) { fail(error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 500, error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 'Not found' : 'Server error'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const address = server.address();
  return { server, url: `http://${host}:${address.port}`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
if (isMain(import.meta.url)) {
  try {
    const args = argsOf(process.argv.slice(2), { '--port': 'value' });
    startServer({ port: args['--port'] ? Number(args['--port']) : 4173 }).then(({ url }) => console.log(`LETSUM local preview: ${url}\nRead-only static files; bound to 127.0.0.1. Press Ctrl+C to stop.`)).catch(reportFailure);
  } catch (error) { reportFailure(error); }
}
