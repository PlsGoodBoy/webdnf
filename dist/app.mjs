import { initialState, transition, mockAdapter } from './data.mjs';
import { renderApp } from './views.mjs';
import { clampFloatingPosition, exceedsDragThreshold } from './floating.mjs';

const root = document.getElementById('app');
const toast = document.getElementById('toast');
const storageKey = 'arad-admin-demo-v2';
let state = initialState();
let toastTimer;
let busy = false;
let previousDialogTrigger = null;
let floatingPosition = null;
let drag = null;
let suppressFloatingClickUntil = 0;

function layoutFloating() {
  const floating = document.getElementById('status-floating');
  if (!floating) return;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  floatingPosition = clampFloatingPosition(floatingPosition ?? { x: viewport.width - 86, y: viewport.height - 90 }, viewport);
  Object.assign(floating.style, { left: `${floatingPosition.x}px`, top: `${floatingPosition.y}px`, right: 'auto', bottom: 'auto' });
  const panel = document.getElementById('status-popover');
  if (panel) {
    const width = Math.min(330, viewport.width - 24);
    const height = panel.offsetHeight;
    const left = Math.max(12, Math.min(floatingPosition.x + 62 - width, viewport.width - width - 12));
    const above = floatingPosition.y - height - 10;
    const top = Math.max(12, Math.min(above >= 12 ? above : floatingPosition.y + 72, viewport.height - height - 12));
    Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, width: `${width}px` });
  }
}
function closePlayers() {
  dispatch({ type: 'CLOSE_PLAYERS' });
  document.getElementById('players-details-button')?.focus({ preventScroll: true });
}
async function updateLeaderboard(options, focusSelector) {
  if (busy || !state.signedIn) return;
  busy = true;
  try {
    const current = state.leaderboardSnapshot;
    const snapshot = await mockAdapter.getLeaderboard({ category: current.category, raid: current.raid, simulate: current.source === 'simulation', ...options });
    if (state.signedIn) {
      dispatch({ type: 'LEADERBOARD', snapshot });
      root.querySelector(focusSelector)?.focus({ preventScroll: true });
    }
  } catch { notify('无法切换演示榜单，请重试。真实排名仍未接入。'); }
  finally { busy = false; }
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
}
function saveDemoFlag(enabled) {
  // Convenience only, NOT authentication. No real data depends on this flag.
  try {
    sessionStorage.removeItem('arad-archive-demo-v1');
    if (enabled) sessionStorage.setItem(storageKey, 'admin'); else sessionStorage.removeItem(storageKey);
  } catch { /* Storage-disabled browsers still work. */ }
}
function render({ focusHeading = false, preserveSearch = false } = {}) {
  const previousInput = document.getElementById('character-search');
  const shouldRestoreSearch = preserveSearch && document.activeElement === previousInput;
  const cursor = shouldRestoreSearch ? previousInput.selectionStart : null;
  root.innerHTML = renderApp(state);
  layoutFloating();
  document.body.classList.toggle('modal-open', Boolean(state.activeAnnouncement || state.playersOpen));
  if (state.activeAnnouncement) {
    const dialog = document.getElementById('announcement-dialog');
    dialog.showModal();
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeAnnouncement(); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeAnnouncement();
      }
    });
  } else if (state.playersOpen) {
    const dialog = document.getElementById('players-dialog');
    dialog.showModal();
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePlayers(); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePlayers();
      }
    });
  } else if (shouldRestoreSearch) {
    const input = document.getElementById('character-search');
    input?.focus({ preventScroll: true });
    // Some browsers do not support selection ranges on type=search.
    try { if (cursor !== null) input?.setSelectionRange(cursor, cursor); } catch { /* no-op */ }
  } else if (focusHeading) {
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }
}
function dispatch(action, options) { state = transition(state, action); render(options); }
function closeAnnouncement() {
  const id = previousDialogTrigger;
  dispatch({ type: 'CLOSE_ANNOUNCEMENT' });
  if (id) root.querySelector(`[data-action="announcement"][data-id="${id}"]`)?.focus({ preventScroll: true });
}
async function enterDemo(username) {
  if (busy) return;
  busy = true;
  const button = document.getElementById('demo-login-button');
  const form = document.getElementById('demo-login-form');
  const input = document.getElementById('demo-username');
  const error = document.getElementById('demo-login-error');
  if (button) button.disabled = true;
  form?.setAttribute('aria-busy', 'true');
  input?.setAttribute('aria-invalid', 'false');
  if (error) { error.hidden = true; error.textContent = ''; }
  try {
    const account = await mockAdapter.enterDemo(username);
    const characters = await mockAdapter.getCharacters(account.id);
    dispatch({ type: 'ENTER', account, characters }, { focusHeading: true });
    saveDemoFlag(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : '演示数据加载失败，请刷新页面后重试。';
    if (error) { error.textContent = message; error.hidden = false; }
    else notify(message);
    input?.setAttribute('aria-invalid', 'true');
    input?.focus({ preventScroll: true });
  } finally {
    busy = false;
    if (button) button.disabled = false;
    form?.setAttribute('aria-busy', 'false');
  }
}
root.addEventListener('submit', async event => {
  if (event.target.id !== 'demo-login-form') return;
  event.preventDefault();
  await enterDemo(document.getElementById('demo-username')?.value ?? '');
});
root.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.preventDefault();
  const action = target.dataset.action;
  if (action === 'widget' && event.detail !== 0 && Date.now() < suppressFloatingClickUntil) return;
  if (action === 'logout') {
    floatingPosition = null;
    drag = null;
    saveDemoFlag(false);
    dispatch({ type: 'LOGOUT' });
    document.getElementById('demo-username')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    notify('已退出演示并重置。没有真实游戏会话受到影响。');
  } else if (action === 'widget' || action === 'close-widget') {
    dispatch({ type: action === 'widget' ? 'WIDGET' : 'CLOSE_WIDGET' });
    if (state.widgetOpen) root.querySelector('#status-popover [data-action="status-toggle"]')?.focus({ preventScroll: true });
    else document.getElementById('status-launcher')?.focus({ preventScroll: true });
  } else if (action === 'players') {
    dispatch({ type: 'PLAYERS' });
  } else if (action === 'close-players') {
    closePlayers();
  } else if (action === 'checkin-info') {
    dispatch({ type: 'CHECKIN_INFO' });
    root.querySelector('[data-action="checkin-info"]')?.focus({ preventScroll: true });
  } else if (action === 'leaderboard-category') {
    await updateLeaderboard({ category: target.dataset.category }, `[data-action="leaderboard-category"][data-category="${target.dataset.category}"]`);
  } else if (action === 'leaderboard-simulate') {
    await updateLeaderboard({ simulate: state.leaderboardSnapshot.source !== 'simulation' }, '[data-action="leaderboard-simulate"]');
  } else if (action === 'nav') {
    dispatch({ type: 'NAVIGATE', view: target.dataset.view }, { focusHeading: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (action === 'select') {
    const fromOverview = state.view !== 'characters';
    dispatch({ type: 'SELECT', id: target.dataset.id }, { focusHeading: fromOverview });
    if (fromOverview) window.scrollTo({ top: 0, behavior: 'instant' });
    else root.querySelector(`[data-action="select"][data-id="${state.selectedId}"]`)?.focus({ preventScroll: true });
  } else if (action === 'tab') {
    dispatch({ type: 'TAB', tab: target.dataset.tab });
    root.querySelector(`[data-action="tab"][data-tab="${state.detailTab}"]`)?.focus({ preventScroll: true });
  } else if (action === 'announcement') {
    previousDialogTrigger = target.dataset.id;
    dispatch({ type: 'ANNOUNCEMENT', id: target.dataset.id });
  } else if (action === 'close-announcement') closeAnnouncement();
  else if (action === 'menu') {
    dispatch({ type: 'MENU' });
    if (state.menuOpen) root.querySelector('.sidebar .nav-item')?.focus({ preventScroll: true });
    else root.querySelector('.mobile-menu')?.focus({ preventScroll: true });
  } else if (action === 'clear-search') {
    dispatch({ type: 'SEARCH', query: '' });
    document.getElementById('character-search')?.focus({ preventScroll: true });
  } else if (action === 'status-toggle') {
    if (busy || !state.signedIn) return;
    busy = true;
    target.disabled = true;
    const accountId = state.account.id;
    const toggleContext = state.playersOpen ? '#players-dialog ' : target.closest?.('#status-popover') ? '#status-popover ' : '.character-status-section ';
    try {
      const snapshot = await mockAdapter.getPortalStatus(accountId, { simulate: state.statusSnapshot?.source !== 'simulation' });
      if (state.signedIn && state.account.id === accountId) {
        dispatch({ type: 'STATUS', snapshot });
        root.querySelector(`${toggleContext}[data-action="status-toggle"]`)?.focus({ preventScroll: true });
        notify(snapshot.source === 'simulation' ? '已开启静态模拟状态。服务器仍未连接，示例日期不是今天。' : '已关闭模拟状态，未接入的数据恢复显示未知。');
      }
    } catch { notify('无法切换模拟状态，请重试。真实数据仍未接入。'); }
    finally { busy = false; target.disabled = false; }
  } else if (action === 'refresh') {
    if (busy) return;
    busy = true;
    target.disabled = true;
    try {
      const characters = await mockAdapter.getCharacters(state.account.id);
      dispatch({ type: 'REFRESH', characters });
      root.querySelector('[data-action="refresh"]')?.focus({ preventScroll: true });
      notify('已重新载入相同的演示快照，未连接或查询游戏服务器。');
    } catch { notify('演示快照未能载入，请刷新页面重试。'); }
    finally { busy = false; }
  }
});
root.addEventListener('input', event => {
  if (event.target.id === 'character-search') dispatch({ type: 'SEARCH', query: event.target.value }, { preserveSearch: true });
  if (event.target.id === 'demo-username') {
    event.target.setAttribute('aria-invalid', 'false');
    const error = document.getElementById('demo-login-error');
    if (error) { error.hidden = true; error.textContent = ''; }
  }
});
root.addEventListener('change', async event => {
  if (event.target.id === 'leaderboard-raid') await updateLeaderboard({ raid: event.target.value }, '#leaderboard-raid');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (state.activeAnnouncement || state.playersOpen)) return; // Native dialog cancel closes only the top layer.
  if (event.key === 'Escape' && state.widgetOpen) {
    event.preventDefault();
    dispatch({ type: 'CLOSE_WIDGET' });
    document.getElementById('status-launcher')?.focus({ preventScroll: true });
  } else if (event.key === 'Escape' && state.menuOpen) {
    dispatch({ type: 'MENU' });
    root.querySelector('.mobile-menu')?.focus({ preventScroll: true });
  }
  if (event.target?.id === 'status-launcher' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) {
    event.preventDefault();
    const step = event.shiftKey ? 40 : 16;
    if (event.key === 'Home') floatingPosition = null;
    else {
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      floatingPosition = { x: floatingPosition.x + delta[0], y: floatingPosition.y + delta[1] };
    }
    layoutFloating();
  }
});
root.addEventListener('pointerdown', event => {
  const launcher = event.target.closest('#status-launcher');
  if (!launcher || (event.button !== undefined && event.button !== 0)) return;
  drag = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { ...floatingPosition }, moved: false, launcher };
  launcher.setPointerCapture(event.pointerId);
});
root.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const point = { x: event.clientX, y: event.clientY };
  if (!drag.moved && !exceedsDragThreshold(drag.start, point)) return;
  drag.moved = true;
  floatingPosition = { x: drag.origin.x + point.x - drag.start.x, y: drag.origin.y + point.y - drag.start.y };
  layoutFloating();
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.moved) suppressFloatingClickUntil = Date.now() + 600;
  if (drag.launcher.hasPointerCapture(event.pointerId)) drag.launcher.releasePointerCapture(event.pointerId);
  drag = null;
}
root.addEventListener('pointerup', endDrag);
root.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', layoutFloating);
render();
try { if (sessionStorage.getItem(storageKey) === 'admin') await enterDemo('admin'); } catch { /* No session storage required. */ }
