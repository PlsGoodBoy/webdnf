import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, transition, mockAdapter, announcements, filterCharacters, rankLeaderboardEntries } from '../dist/data.mjs';
import { renderApp, escapeHTML } from '../dist/views.mjs';
import { clampFloatingPosition, exceedsDragThreshold } from '../dist/floating.mjs';

const account = await mockAdapter.enterDemo('admin');
const characters = await mockAdapter.getCharacters(account.id);
const demo = transition(initialState(), { type: 'ENTER', account, characters });

test('Demo admin entry is explicitly mock-only, with no password field', () => {
  const html = renderApp(initialState());
  assert.match(html, /登录演示/);
  assert.match(html, /id="demo-login-form"/);
  assert.match(html, /演示账号：admin/);
  assert.match(html, /仅接受小写 admin/);
  assert.match(html, /尚未接入真实身份验证/);
  assert.match(html, /未连接游戏服务器/);
  assert.doesNotMatch(html, /<input[^>]*type=["']password/);
  assert.equal(initialState().signedIn, false);
});
test('Mock account, isolated copies and unknown connection status', async () => {
  assert.equal(account.id, 'demo-admin');
  assert.equal(account.username, 'admin');
  assert.equal(account.displayName, 'admin');
  assert.equal(characters.length, 3);
  const copy = await mockAdapter.getCharacters(account.id);
  copy[0].level = 1;
  assert.equal((await mockAdapter.getCharacters(account.id))[0].level, 90);
  await assert.rejects(() => mockAdapter.getCharacters('someone-else'));
  assert.deepEqual(await mockAdapter.getConnectionStatus(), { connected: false, gameOnline: null, label: '未连接游戏服务器', source: '静态演示数据' });
});
test('Admin name validation is explicit, case sensitive and whitespace tolerant', async () => {
  for (const username of ['', 'Admin', 'ADMIN', 'player', 'admin123', null, undefined]) {
    await assert.rejects(() => mockAdapter.enterDemo(username), /请输入演示账号 admin/);
  }
  assert.equal((await mockAdapter.enterDemo('  admin  ')).username, 'admin');
  assert.match(renderApp(demo), /class="account-value">admin</);
  assert.match(renderApp(demo), /<strong>admin<\/strong><small>退出演示/);
});
test('Demo navigation, selection, tabs, filtering, modal and reset', () => {
  assert.equal(demo.signedIn, true);
  let s = transition(demo, { type: 'NAVIGATE', view: 'characters' });
  s = transition(s, { type: 'SELECT', id: 'char-002' });
  assert.equal(s.selectedId, 'char-002');
  s = transition(s, { type: 'TAB', tab: 'equipment' });
  assert.equal(s.detailTab, 'equipment');
  assert.match(renderApp(s), /山岚之息手套/);
  assert.equal(filterCharacters(characters, '鬼剑士').length, 1);
  assert.equal(filterCharacters(characters, 'nothing-found').length, 0);
  assert.equal(transition(s, { type: 'SELECT', id: 'foreign-character' }), s);
  assert.equal(transition(s, { type: 'NAVIGATE', view: 'gm' }), s);
  s = transition(s, { type: 'ANNOUNCEMENT', id: announcements[0].id });
  assert.match(renderApp(s), /<dialog id="announcement-dialog"/);
  s = transition(s, { type: 'CLOSE_ANNOUNCEMENT' });
  assert.equal(s.activeAnnouncement, null);
  s = transition(s, { type: 'MENU' });
  assert.equal(s.menuOpen, true);
  s = transition(s, { type: 'NAVIGATE', view: 'overview' });
  assert.equal(s.menuOpen, false);
  s = transition(s, { type: 'REFRESH', characters });
  assert.equal(s.refreshed, true);
  assert.deepEqual(transition(s, { type: 'LOGOUT' }), initialState());
});
test('All views label the mock data and expose their main heading', () => {
  for (const view of ['overview', 'characters', 'leaderboard', 'announcements', 'connection']) {
    const html = renderApp(transition(demo, { type: 'NAVIGATE', view }));
    assert.match(html, /未连接游戏服务器/);
    assert.match(html, /id="main-content"/);
    assert.match(html, /id="page-title"/);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate HTML IDs in ${view}`);
  }
});
test('Server and own-character status default to unknown, never fabricated zeroes', async () => {
  const status = await mockAdapter.getPortalStatus(account.id);
  assert.equal(status.source, 'unconnected');
  assert.equal(status.connected, false);
  assert.equal(status.serverStatus, 'unknown');
  assert.equal(status.onlinePlayers, null);
  assert.equal(status.observedAt, null);
  assert.equal(status.businessDate, null);
  assert.equal(status.abyssCountingRule, 'successful_entry');
  assert.equal(status.complete, false);
  assert.equal(status.characters.length, 3);
  assert.ok(status.characters.every(c => c.accountId === account.id && c.location === null && c.abyssRuns === null));
  await assert.rejects(() => mockAdapter.getPortalStatus('another-account'));
  const html = renderApp(transition(transition(demo, { type: 'NAVIGATE', view: 'characters' }), { type: 'WIDGET' }));
  assert.match(html, /服务器状态/);
  assert.doesNotMatch(html, /data-view="server"/);
  assert.match(html, /在线人数/);
  assert.match(html, /角色所在位置/);
  assert.match(html, /今日深渊/);
  assert.match(html, /按成功入场计次/);
  assert.match(html, /未打完或退出也计，失败入场不计/);
  assert.match(html, /同局重复通知或重连不重复计次/);
  assert.doesNotMatch(html, /口径待接入确认|计次规则需在接入时确认/);
  assert.match(html, /aria-checked="false"/);
  assert.doesNotMatch(html, /赫顿玛尔|2026-10-01|<strong>128 <em>人/);
});
test('Opt-in status simulation follows own-character selection and resets on logout/re-entry', async () => {
  const snapshot = await mockAdapter.getPortalStatus(account.id, { simulate: true });
  assert.equal(snapshot.source, 'simulation');
  assert.equal(snapshot.connected, false);
  assert.equal(snapshot.onlinePlayers, 6);
  assert.equal(snapshot.exampleDate, '2026-10-01');
  assert.equal(snapshot.businessDate, null);
  assert.equal(snapshot.abyssCountingRule, 'successful_entry');
  let s = transition(transition(demo, { type: 'WIDGET' }), { type: 'STATUS', snapshot });
  assert.match(renderApp(s), /aria-checked="true"/);
  assert.match(renderApp(s), /静态虚构样例/);
  assert.match(renderApp(s), /示例日期 2026-10-01/);
  s = transition(s, { type: 'SELECT', id: 'char-002' });
  let html = renderApp(s);
  assert.match(html, /中央公园 · 城镇/);
  assert.match(html, /<strong>6 次<\/strong>/);
  assert.doesNotMatch(html, /赫顿玛尔/);
  s = transition(s, { type: 'STATUS', snapshot: await mockAdapter.getPortalStatus(account.id) });
  html = renderApp(s);
  assert.match(html, /aria-checked="false"/);
  assert.doesNotMatch(html, /中央公园/);
  s = transition(s, { type: 'LOGOUT' });
  assert.equal(s.statusSnapshot, null);
  s = transition(s, { type: 'ENTER', account, characters });
  assert.equal(s.statusSnapshot.source, 'unconnected');
});
test('Input escapes markup and no network adapter or password input is present', async () => {
  assert.equal(escapeHTML('<script>"x"&</script>'), '&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;');
  const s = transition(transition(demo, { type: 'NAVIGATE', view: 'characters' }), { type: 'SEARCH', query: '"><img src=x onerror=alert(1)>' });
  assert.doesNotMatch(renderApp(s), /<img src=x/);
  for (const name of ['data.mjs', 'app.mjs', 'views.mjs', 'floating.mjs']) {
    const source = await readFile(new URL(`../dist/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|type=["']password/);
  }
  const css = await readFile(new URL('../dist/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /@import/);
});
test('Floating server details use an independent public mock roster without private fields', async () => {
  const unconnected = await mockAdapter.getServerActivity();
  assert.deepEqual(unconnected.publicPlayers, []);
  assert.equal(unconnected.onlinePlayers, null);
  const status = await mockAdapter.getServerActivity({ simulate: true });
  assert.equal(status.publicPlayers.length, status.onlinePlayers);
  assert.equal(status.publicPlayers.length, 6);
  assert.ok(status.publicPlayers.every(player => !characters.some(character => character.name === player.name)));
  for (const player of status.publicPlayers) assert.deepEqual(Object.keys(player).sort(), ['activity', 'id', 'job', 'level', 'name']);
  assert.equal('characters' in status, false);
  assert.equal('abyssCountingRule' in status, false);
  let state = transition(demo, { type: 'PLAYERS' });
  assert.match(renderApp(state), /尚无可用的玩家动态/);
  assert.doesNotMatch(renderApp(state), /雾海听风/);
  state = transition(state, { type: 'STATUS', snapshot: await mockAdapter.getPortalStatus(account.id, { simulate: true }) });
  const html = renderApp(state);
  assert.match(html, /id="players-dialog"/);
  assert.match(html, /雾海听风/);
  assert.match(html, /城镇休息|深渊中|副本中/);
  assert.match(html, /演示全服名单 · 非真实/);
  const dialogHTML = html.slice(html.indexOf('<dialog id="players-dialog"'));
  assert.doesNotMatch(dialogHTML, /赫顿玛尔|今日深渊|金币|余额/);
  state = transition(state, { type: 'CLOSE_PLAYERS' });
  assert.equal(state.widgetOpen, true);
  assert.equal(state.playersOpen, false);
  state = transition(state, { type: 'ANNOUNCEMENT', id: announcements[0].id });
  assert.equal(state.widgetOpen, false);
  assert.equal(state.playersOpen, false);
  assert.equal(transition(demo, { type: 'NAVIGATE', view: 'server' }), demo);
});
test('Floating geometry is bounded, drag threshold separates clicks, check-in is informational', () => {
  assert.deepEqual(clampFloatingPosition({ x: -10, y: 1000 }, { width: 390, height: 844 }), { x: 12, y: 770 });
  assert.deepEqual(clampFloatingPosition({ x: 1000, y: -10 }, { width: 390, height: 844 }), { x: 316, y: 12 });
  assert.equal(exceedsDragThreshold({ x: 0, y: 0 }, { x: 2, y: 2 }), false);
  assert.equal(exceedsDragThreshold({ x: 0, y: 0 }, { x: 6, y: 0 }), true);
  const state = transition(demo, { type: 'CHECKIN_INFO' });
  assert.equal(state.checkinOpen, true);
  const accountCard = renderApp(state).match(/<article class="metric-card">[\s\S]+?<\/article>/)[0];
  assert.match(accountCard, /data-action="checkin-info"/);
  assert.match(accountCard, /签到尚未接入，奖励与重置时间待配置/);
  assert.doesNotMatch(accountCard, /领取成功|签到成功/);
  assert.equal(transition(state, { type: 'LOGOUT' }).checkinOpen, false);
});
test('Leaderboard is unknown by default, with independent opt-in cumulative and peak-level examples', async () => {
  const empty = await mockAdapter.getLeaderboard();
  assert.equal(empty.connected, false);
  assert.equal(empty.source, 'unconnected');
  assert.deepEqual(empty.entries, []);
  assert.equal(empty.observedAt, null);
  let state = transition(demo, { type: 'NAVIGATE', view: 'leaderboard' });
  assert.match(renderApp(state), /榜单暂未接入/);
  assert.doesNotMatch(renderApp(state), /天光逐影/);
  for (const category of ['raid', 'abyss', 'enhancement', 'amplification']) {
    const snapshot = await mockAdapter.getLeaderboard({ category, simulate: true });
    assert.equal(snapshot.connected, false);
    assert.equal(snapshot.entries.length, 6);
    assert.ok(snapshot.entries.every(entry => !characters.some(character => character.name === entry.name)));
    assert.ok(snapshot.entries.every((entry, index, list) => index === 0 || entry.value <= list[index - 1].value));
    assert.deepEqual(snapshot.entries.slice(0, 4).map(entry => entry.rank), [1, 2, 2, 4]);
    state = transition(state, { type: 'LEADERBOARD', snapshot });
    const html = renderApp(state);
    assert.match(html, /演示榜单 · 全部为独立虚构角色与数值/);
    assert.match(html, /天光逐影/);
    if (['enhancement', 'amplification'].includes(category)) {
      assert.match(html, /历史最高等级/);
      assert.match(html, /不是强化或增幅的操作次数/);
      assert.match(html, new RegExp(`<strong>\\+${snapshot.entries[0].value}<`));
      assert.match(html, /非当前装备快照/);
    } else {
      assert.match(html, /累计次数 · 示例/);
      assert.equal(snapshot.unit, '次');
      assert.ok(snapshot.entries.every(entry => entry.equipment === null));
    }
  }
  const anton = await mockAdapter.getLeaderboard({ category: 'raid', raid: 'anton', simulate: true });
  const luke = await mockAdapter.getLeaderboard({ category: 'raid', raid: 'luke', simulate: true });
  assert.notEqual(anton.entries[0].value, luke.entries[0].value);
  state = transition(state, { type: 'LEADERBOARD', snapshot: luke });
  assert.match(renderApp(state), /卢克 · 成功攻坚次数/);
  assert.equal(state.statusSnapshot.source, 'unconnected', 'leaderboard simulation does not enable server simulation');
  state = transition(state, { type: 'LEADERBOARD', snapshot: empty });
  assert.match(renderApp(state), /榜单暂未接入/);
  assert.equal(transition(state, { type: 'LOGOUT' }).leaderboardSnapshot, null);
  await assert.rejects(() => mockAdapter.getLeaderboard({ category: 'gm' }));
});
test('Leaderboard ranks ties equally and sorts them stably without mutating input', () => {
  const entries = [{ id: 'b', value: 12 }, { id: 'c', value: 8 }, { id: 'a', value: 12 }, { id: 'd', value: null }];
  const ranked = rankLeaderboardEntries(entries);
  assert.deepEqual(ranked.map(entry => [entry.id, entry.rank]), [['a', 1], ['b', 1], ['c', 3]]);
  assert.deepEqual(entries.map(entry => entry.id), ['b', 'c', 'a', 'd']);
});
