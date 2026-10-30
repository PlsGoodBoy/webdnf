import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createPreviewServer, parsePort } from '../scripts/preview.mjs';

function get(port, path, method = 'GET') {
  // Use raw HTTP paths: fetch/URL would normalize ../ before sending it.
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function start(t, options) {
  const server = await createPreviewServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  return server.address().port;
}

test('Preview serves every authored asset with browser-compatible MIME and no cache', async t => {
  const port = await start(t);
  const assets = {
    '/': 'text/html; charset=utf-8',
    '/index.html': 'text/html; charset=utf-8',
    '/app.mjs': 'text/javascript; charset=utf-8',
    '/data.mjs': 'text/javascript; charset=utf-8',
    '/views.mjs': 'text/javascript; charset=utf-8',
    '/floating.mjs': 'text/javascript; charset=utf-8',
    '/styles.css': 'text/css; charset=utf-8',
    '/mark.svg': 'image/svg+xml',
  };
  for (const [path, contentType] of Object.entries(assets)) {
    const response = await get(port, path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers['content-type'], contentType, path);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['cache-control'], 'no-store');
    const expected = await readFile(new URL(`../dist${path === '/' ? '/index.html' : path}`, import.meta.url), 'utf8');
    assert.equal(response.body, expected);
  }
  assert.equal((await get(port, '/app.mjs?version=demo')).status, 200);
});

test('Preview HEAD is bodyless, missing paths are 404, and writes are rejected', async t => {
  const port = await start(t);
  const full = await get(port, '/');
  const head = await get(port, '/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], full.headers['content-length']);
  for (const path of ['/missing.mjs', '/characters', '/api/v1/session', '/package.json', '/README.md', '/docs/']) {
    const response = await get(port, path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body, 'Not Found\n');
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await get(port, '/', method);
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
});

test('Preview rejects raw and encoded traversal, hidden files, bad encodings and backslashes', async t => {
  const port = await start(t);
  for (const path of ['/../README.md', '/x/../../README.md', '/%2e%2e/README.md', '/%2E%2E%2FREADME.md', '/.%2e/README.md', '/.env', '/.git/config', '/%2eopenai/hosting.json', '/./index.html']) {
    const response = await get(port, path);
    assert.equal(response.status, 403, path);
    assert.equal(response.body, 'Forbidden\n');
  }
  for (const path of ['/%', '/%zz', '/%00', '/%0a', '/..%5cREADME.md', '//outside.example/file']) {
    assert.equal((await get(port, path)).status, 400, path);
  }
  assert.equal((await get(port, '/%252e%252e/README.md')).status, 404, 'no recursive URL decoding');
});

test('Preview prevents symlink escapes and directory listings', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'webdnf-preview-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const root = join(fixture, 'public');
  await mkdir(root);
  await mkdir(join(root, 'folder'));
  await writeFile(join(root, 'index.html'), 'public fixture');
  await writeFile(join(fixture, 'private.txt'), 'not-public');
  await writeFile(join(root, '.hidden'), 'also-not-public');
  const port = await start(t, { root });
  assert.equal((await get(port, '/')).body, 'public fixture');
  assert.equal((await get(port, '/folder/')).status, 404);
  try {
    await symlink(join(fixture, 'private.txt'), join(root, 'escape.txt'));
    await symlink(join(root, '.hidden'), join(root, 'hidden.txt'));
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      t.diagnostic('Symlink assertions unavailable without Windows symlink permission.');
      return;
    }
    throw error;
  }
  for (const path of ['/escape.txt', '/hidden.txt']) {
    const response = await get(port, path);
    assert.equal(response.status, 403);
    assert.equal(response.body, 'Forbidden\n');
  }
});

test('Preview validates port configuration', () => {
  assert.equal(parsePort(), 4173);
  assert.equal(parsePort('0'), 0);
  assert.equal(parsePort('65535'), 65535);
  for (const value of ['', '-1', '1.5', '65536', 'not-a-port', ' 4173 ', 'Infinity']) assert.throws(() => parsePort(value));
});

test('Preview CLI starts from any working directory, binds localhost and stops cleanly', { timeout: 10000 }, async t => {
  const script = fileURLToPath(new URL('../scripts/preview.mjs', import.meta.url));
  const child = spawn(process.execPath, [script, '--port', '0'], { cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
  });
  let output = '';
  let errors = '';
  child.stderr.setEncoding('utf8').on('data', text => { errors += text; });
  const port = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.once('exit', code => reject(new Error(`Preview exited before readiness (${code}): ${errors}`)));
    child.stdout.setEncoding('utf8').on('data', text => {
      output += text;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
  });
  assert.equal((await get(port, '/')).status, 200);
  assert.equal((await get(port, '/app.mjs')).headers['content-type'], 'text/javascript; charset=utf-8');
  child.kill('SIGTERM');
  const [code] = await exited;
  assert.equal(code, 0, errors);
});
