import test from 'node:test';
import assert from 'node:assert/strict';

// Lightweight application-event harness, not a replacement for browser QA.
test('Admin form handles wrong names, repeated submit, refresh restoration and logout', async () => {
  const previous = Object.fromEntries(['document', 'window', 'sessionStorage', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]));
  const listeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const storage = new Map([['arad-archive-demo-v1', '1']]);
  let html = '';
  let renders = 0;
  let elements = new Map();
  const makeElement = id => ({
    id, value: '', hidden: true, textContent: '', disabled: false, attributes: {}, style: {}, offsetHeight: 300, events: new Map(),
    addEventListener(name, fn) { this.events.set(name, fn); },
    showModal() { this.open = true; },
    setPointerCapture(id) { this.capture = id; },
    hasPointerCapture(id) { return this.capture === id; },
    releasePointerCapture() { this.capture = null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { document.activeElement = this; },
    classList: { add() {}, remove() {}, toggle() {} },
  });
  const root = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value; renders += 1;
      elements = new Map([...value.matchAll(/\sid="([^"]+)"/g)].map(match => [match[1], makeElement(match[1])]));
    },
    addEventListener(name, fn) { listeners.set(name, fn); },
    querySelector() { return null; },
  };
  const toast = makeElement('toast');
  try {
    globalThis.document = { activeElement: null, body: makeElement('body'), addEventListener(name, fn) { documentListeners.set(name, fn); }, getElementById(id) { return id === 'app' ? root : id === 'toast' ? toast : elements.get(id) ?? null; } };
    globalThis.window = { scrollTo() {}, innerWidth: 1024, innerHeight: 768, addEventListener(name, fn) { windowListeners.set(name, fn); } };
    globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    globalThis.setTimeout = () => 1;
    globalThis.clearTimeout = () => {};
    await import('../dist/app.mjs?admin-event-test');
    assert.match(html, /id="demo-login-form"/);
    assert.doesNotMatch(html, /class="account-value"/);

    const submit = username => {
      document.getElementById('demo-username').value = username;
      return listeners.get('submit')({ target: document.getElementById('demo-login-form'), preventDefault() {} });
    };
    await submit('Admin');
    assert.equal(document.getElementById('demo-login-error').hidden, false);
    assert.match(document.getElementById('demo-login-error').textContent, /仅接受小写/);
    assert.equal(document.getElementById('demo-username').attributes['aria-invalid'], 'true');
    assert.equal(document.getElementById('demo-login-button').disabled, false);
    assert.equal(storage.has('arad-admin-demo-v2'), false);

    const before = renders;
    const first = submit('admin');
    assert.equal(document.getElementById('demo-login-button').disabled, true);
    const repeated = submit('admin');
    await Promise.all([first, repeated]);
    assert.equal(renders - before, 1, 'rapid repeated submissions produce one dashboard transition');
    assert.match(html, /class="account-value">admin</);
    assert.equal(storage.get('arad-admin-demo-v2'), 'admin');
    assert.equal(storage.has('arad-archive-demo-v1'), false);

    const launcher = document.getElementById('status-launcher');
    listeners.get('pointerdown')({ target: { closest: () => launcher }, button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    listeners.get('pointermove')({ pointerId: 1, clientX: 5000, clientY: 5000 });
    listeners.get('pointerup')({ pointerId: 1 });
    assert.equal(document.getElementById('status-floating').style.left, '950px');
    assert.equal(document.getElementById('status-floating').style.top, '694px');
    await listeners.get('click')({ detail: 1, target: { closest: () => ({ dataset: { action: 'widget' } }) }, preventDefault() {} });
    assert.doesNotMatch(html, /id="status-popover"/, 'drag release must not accidentally open the panel');
    await listeners.get('click')({ detail: 0, target: { closest: () => ({ dataset: { action: 'widget' } }) }, preventDefault() {} });
    assert.match(html, /id="status-popover"/);
    assert.match(html, /aria-checked="false"/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'status-toggle' } }) }, preventDefault() {} });
    assert.match(html, /aria-checked="true"/);
    assert.match(html, /静态虚构样例/);
    assert.match(html, /2026-10-01/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'status-toggle' } }) }, preventDefault() {} });
    assert.match(html, /aria-checked="false"/);
    assert.doesNotMatch(html, /2026-10-01/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'status-toggle' } }) }, preventDefault() {} });

    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'players' } }) }, preventDefault() {} });
    assert.match(html, /id="players-dialog"/);
    assert.match(html, /雾海听风/);
    document.getElementById('players-dialog').events.get('cancel')({ preventDefault() {} });
    assert.doesNotMatch(html, /id="players-dialog"/);
    assert.match(html, /id="status-popover"/);
    documentListeners.get('keydown')({ key: 'Escape', preventDefault() {} });
    assert.doesNotMatch(html, /id="status-popover"/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'checkin-info' } }) }, preventDefault() {} });
    assert.match(html, /签到尚未接入，奖励与重置时间待配置/);
    assert.doesNotMatch(html, /签到成功|领取成功/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'nav', view: 'leaderboard' } }) }, preventDefault() {} });
    assert.match(html, /榜单暂未接入/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'leaderboard-simulate' } }) }, preventDefault() {} });
    assert.match(html, /天光逐影/);
    await listeners.get('change')({ target: { id: 'leaderboard-raid', value: 'luke' } });
    assert.match(html, /卢克 · 成功攻坚次数/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'leaderboard-category', category: 'enhancement' } }) }, preventDefault() {} });
    assert.match(html, /<strong>\+15<\/strong>/);
    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'leaderboard-simulate' } }) }, preventDefault() {} });
    assert.match(html, /榜单暂未接入/);
    assert.match(html, /id="status-launcher"/, 'floating server control remains available on rankings');
    await import('../dist/app.mjs?admin-event-test-refresh');
    assert.match(html, /class="account-value">admin</, 'same-tab reload restores only the demo marker');
    assert.doesNotMatch(html, /id="status-popover"|id="players-dialog"/, 'reload closes floating windows');
    await listeners.get('click')({ detail: 0, target: { closest: () => ({ dataset: { action: 'widget' } }) }, preventDefault() {} });
    assert.match(html, /aria-checked="false"/, 'reload does not restore simulated server status');

    await listeners.get('click')({ target: { closest: () => ({ dataset: { action: 'logout' } }) }, preventDefault() {} });
    assert.match(html, /id="demo-login-form"/);
    assert.equal(storage.has('arad-admin-demo-v2'), false);
    assert.equal(document.getElementById('demo-username').value, '');
    assert.equal(document.activeElement.id, 'demo-username');
    assert.doesNotMatch(html, /class="account-value"/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
