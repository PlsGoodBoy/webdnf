import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function isInside(root, filename) {
  const path = relative(root, filename);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function hasHiddenSegment(path) {
  return path.split(/[\\/]/).some(segment => segment.startsWith('.'));
}

function respond(request, response, status, body, type = 'text/plain; charset=utf-8') {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(request.method === 'HEAD' ? undefined : bytes);
}

/** Local static preview only. No backend, proxy, login or game connection. */
export async function createPreviewServer({ root = defaultRoot } = {}) {
  const publicRoot = await realpath(root);
  if (!(await stat(publicRoot)).isDirectory()) throw new Error('Static root must be a directory.');

  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      respond(request, response, 405, 'Method Not Allowed\n');
      return;
    }
    try {
      // Inspect the raw target BEFORE URL normalization can erase dot segments.
      const target = (request.url ?? '').split(/[?#]/, 1)[0];
      if (!target.startsWith('/') || target.startsWith('//')) {
        respond(request, response, 400, 'Bad Request\n');
        return;
      }
      let pathname;
      try { pathname = decodeURIComponent(target); }
      catch {
        respond(request, response, 400, 'Bad Request\n');
        return;
      }
      if (/[\\\u0000-\u001f\u007f]/.test(pathname)) {
        respond(request, response, 400, 'Bad Request\n');
        return;
      }
      if (hasHiddenSegment(pathname)) {
        respond(request, response, 403, 'Forbidden\n');
        return;
      }
      const filename = resolve(publicRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!isInside(publicRoot, filename)) {
        respond(request, response, 403, 'Forbidden\n');
        return;
      }
      // A link in the public tree may not expose files outside dist/ or hidden files.
      const canonical = await realpath(filename);
      if (!isInside(publicRoot, canonical) || hasHiddenSegment(relative(publicRoot, canonical))) {
        respond(request, response, 403, 'Forbidden\n');
        return;
      }
      if (!(await stat(canonical)).isFile()) {
        respond(request, response, 404, 'Not Found\n');
        return;
      }
      const body = await readFile(canonical);
      respond(request, response, 200, body, contentTypes[extname(canonical).toLowerCase()] ?? 'application/octet-stream');
    } catch (error) {
      const status = ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : ['EACCES', 'EPERM'].includes(error.code) ? 403 : 500;
      respond(request, response, status, status === 404 ? 'Not Found\n' : status === 403 ? 'Forbidden\n' : 'Internal Server Error\n');
    }
  });
}

export function parsePort(value = '4173') {
  if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
  return Number(value);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--port')) {
    throw new Error('Usage: node scripts/preview.mjs [--port 4173]');
  }
  const port = parsePort(args[1] ?? process.env.PORT ?? '4173');
  const server = await createPreviewServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  console.log(`webdnf demo: http://127.0.0.1:${server.address().port}`);
  console.log('Local static preview only. Press Ctrl+C to stop.');
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.closeAllConnections();
      server.close(() => process.exit(0));
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`Preview failed: ${error.message}`);
    process.exitCode = 1;
  });
}
