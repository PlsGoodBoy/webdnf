/** Mock-only adapter. This file has NO network, credentials or game mutation APIs. */
const characters = [
  { id: 'char-001', name: '长夜未央', family: '鬼剑士', job: '剑神', level: 90, theme: 'sword', initials: '剑', tag: '主角色', combat: '近战 / 物理', hp: 168240, mp: 62580, strength: 4128, intelligence: 1862, attack: 3624, defense: 18462, fatigue: 88, fatigueMax: 156, equipment: [
    ['weapon', '武器', '旅人的长剑', '史诗', '+12', '物理攻击力 +1,284'],
    ['coat', '上衣', '破晓之誓战甲', '史诗', '+10', '力量 +168'],
    ['shoulder', '头肩', '守望者肩甲', '史诗', '+10', '物理防御力 +1,420'],
    ['pants', '下装', '永夜行者护腿', '史诗', '+10', '最大生命值 +2,400'],
    ['shoes', '鞋', '风息短靴', '史诗', '+10', '移动速度 +6%'],
    ['ring', '戒指', '星轨指环', '传说', '+8', '力量 +92'],
  ] },
  { id: 'char-002', name: '风过山岚', family: '格斗家', job: '念帝', level: 85, theme: 'fighter', initials: '气', tag: '备选角色', combat: '中距离 / 魔法', hp: 142860, mp: 98540, strength: 1924, intelligence: 3864, attack: 3180, defense: 16240, fatigue: 124, fatigueMax: 156, equipment: [
    ['weapon', '武器', '山岚之息手套', '史诗', '+11', '魔法攻击力 +1,180'],
    ['coat', '上衣', '流云轻衣', '史诗', '+10', '智力 +156'],
    ['shoulder', '头肩', '明镜护肩', '史诗', '+10', '魔法防御力 +1,360'],
    ['pants', '下装', '青峰长裤', '史诗', '+10', '最大生命值 +2,100'],
    ['shoes', '鞋', '逐风之履', '史诗', '+10', '移动速度 +5%'],
    ['ring', '戒指', '月华指环', '传说', '+8', '智力 +88'],
  ] },
  { id: 'char-003', name: '星火拾荒者', family: '神枪手', job: '机械元首', level: 80, theme: 'gunner', initials: '械', tag: '成长角色', combat: '远程 / 魔法', hp: 103640, mp: 74200, strength: 1480, intelligence: 2780, attack: 2460, defense: 12480, fatigue: 156, fatigueMax: 156, equipment: [
    ['weapon', '武器', '星火自动手枪', '传说', '+10', '魔法攻击力 +920'],
    ['coat', '上衣', '探索者外套', '传说', '+8', '智力 +112'],
    ['shoulder', '头肩', '远行护肩', '传说', '+8', '魔法防御力 +980'],
    ['pants', '下装', '灰烬工装裤', '传说', '+8', '最大生命值 +1,600'],
    ['shoes', '鞋', '行星短靴', '传说', '+8', '移动速度 +4%'],
    ['ring', '戒指', '微光指环', '传说', '+7', '智力 +68'],
  ] },
];

export const announcements = [
  { id: 'welcome', type: '门户公告', title: '欢迎来到你的阿拉德档案', date: '原型公告 01', pinned: true, summary: '一个只属于玩家自己的角色信息入口，从清晰、安全的只读体验开始。', body: '这是一份全新、独立的玩家门户演示。你可以切换三个样例角色、查看示意属性和装备，并体验公告阅读。它没有连接游戏服务器，也不能判断游戏是否在线。所有角色、装备名称与数值均为界面设计用的虚构示例，不对应任何真实账号。' },
  { id: 'safety', type: '安全说明', title: '本次演示不需要你的游戏密码', date: '原型公告 02', pinned: false, summary: '不收集凭据、不创建真实会话、不读取任何游戏数据库。', body: '输入小写 admin 并点击「登录演示」只会切换本页界面。演示状态保留在当前浏览器标签页，不代表真实身份验证。用户名仅用于校验固定演示名称；无需密码，也不会向外发送登录请求。admin 不代表管理员身份或 GM 权限。未来接入必须由服务端建立独立 Web 会话，并对每次角色读取验证所属账号；隐藏按钮或前端筛选不能代替权限验证。' },
  { id: 'roadmap', type: '开发进展', title: '下一步：确认账号体系与只读接口', date: '原型公告 03', pinned: false, summary: '先把登录边界与角色归属做对，再连接经过确认的游戏数据。', body: '计划先确认实际部署版本、账号来源和数据库映射，再实现独立 Web 登录、本人角色列表和只读详情。游戏服务器尚未运行，因此当前没有验证联机行为、协议兼容性或数据库字段。暂不做充值、交易、邮件发奖、背包修改或 GM 功能。' },
];

// Independent fictional server roster: NOT inferred from the account's characters.
const mockPlayers = [
  { id: 'sample-player-01', name: '雾海听风', job: '剑皇', level: 90, activity: '城镇休息' },
  { id: 'sample-player-02', name: '赤砂流年', job: '帝血弑天', level: 90, activity: '深渊中' },
  { id: 'sample-player-03', name: '月下旅人', job: '念皇', level: 86, activity: '副本中' },
  { id: 'sample-player-04', name: '远星来信', job: '机械之灵', level: 85, activity: '城镇休息' },
  { id: 'sample-player-05', name: '白昼守望', job: '神思者', level: 90, activity: '队伍准备中' },
  { id: 'sample-player-06', name: '落日巡游', job: '漫游枪手', level: 72, activity: '副本中' },
];

export const leaderboardCategories = Object.freeze({
  raid: { title: '团本攻坚成功', metric: '成功攻坚次数', unit: '次', scope: '累计榜样例' },
  abyss: { title: '深渊入场', metric: '成功入场次数', unit: '次', scope: '累计榜样例' },
  enhancement: { title: '最高强化', metric: '历史最高强化等级', unit: '级', scope: '历史最高等级样例' },
  amplification: { title: '最高增幅', metric: '历史最高增幅等级', unit: '级', scope: '历史最高等级样例' },
});
export function rankLeaderboardEntries(entries) {
  const sorted = entries.filter(entry => typeof entry.value === 'number' && Number.isFinite(entry.value))
    .map(entry => ({ ...entry })).sort((a, b) => b.value - a.value || a.id.localeCompare(b.id, 'en'));
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry.value !== sorted[index - 1].value) rank = index + 1;
    return { ...entry, rank };
  });
}
export function createLeaderboardSnapshot({ category = 'raid', raid = 'anton', simulate = false } = {}) {
  if (!Object.hasOwn(leaderboardCategories, category)) throw new Error('不支持的榜单类型');
  if (!['anton', 'luke'].includes(raid)) throw new Error('不支持的团本样例');
  // These are independent fictional event-history examples, never current equipment snapshots.
  const names = ['天光逐影', '霜原回声', '荒野星河', '青空驿站', '落叶知秋', '夜航信标'];
  const jobs = ['剑神', '念帝', '机械元首', '神思者', '剑皇', '帝血弑天'];
  const equipment = ['暮光长剑', '星涌手套', '曙光自动手枪', '守望十字架', '逐风光剑', '夜行巨剑'];
  const scores = category === 'raid' ? (raid === 'anton' ? [126, 118, 118, 95, 82, 73] : [42, 36, 36, 28, 24, 21])
    : category === 'abyss' ? [320, 300, 300, 246, 220, 190]
      : category === 'enhancement' ? [15, 14, 14, 13, 12, 12] : [13, 12, 12, 11, 10, 10];
  return {
    category, raid, source: simulate ? 'simulation' : 'unconnected', connected: false,
    exampleDate: simulate ? '2026-10-01' : null, observedAt: null,
    ...leaderboardCategories[category],
    entries: simulate ? rankLeaderboardEntries(names.map((name, index) => ({
      id: `ranking-sample-${index + 1}`, name, job: jobs[index], level: 90,
      value: scores[index], equipment: ['enhancement', 'amplification'].includes(category) ? equipment[index] : null,
    }))) : [],
  };
}

/** Public presentation boundary: names, jobs, levels and activities only. */
export function createServerActivitySnapshot(simulate = false) {
  return {
    source: simulate ? 'simulation' : 'unconnected',
    connected: false,
    accountApiStatus: 'unconnected',
    serverStatus: simulate ? 'sample-running' : 'unknown',
    onlinePlayers: simulate ? mockPlayers.length : null,
    publicPlayers: simulate ? structuredClone(mockPlayers) : [],
    observedAt: null,
    complete: false,
    exampleDate: simulate ? '2026-10-01' : null,
  };
}

/** Private account presentation contract. No live source exists in this prototype. */
export function createStatusSnapshot(accountId, simulate = false) {
  if (accountId !== 'demo-admin') throw new Error('仅可查看当前演示账号的角色状态');
  const sampleLocations = ['赫顿玛尔 · 城镇', '中央公园 · 城镇', '魔界营地 · 城镇'];
  const sampleRuns = [12, 6, 3];
  return {
    ...createServerActivitySnapshot(simulate),
    businessDate: null,
    businessTimezone: null,
    // Selected product rule only; no server event collection is implemented.
    abyssCountingRule: 'successful_entry',
    characters: characters.map((character, index) => ({
      characterId: character.id,
      accountId,
      location: simulate ? sampleLocations[index] : null,
      abyssRuns: simulate ? sampleRuns[index] : null,
    })),
  };
}

export const mockAdapter = Object.freeze({
  kind: 'mock',
  async enterDemo(username) {
    if (typeof username !== 'string' || username.trim() !== 'admin') {
      throw new Error('请输入演示账号 admin（仅接受小写，忽略首尾空格）。');
    }
    return { id: 'demo-admin', username: 'admin', displayName: 'admin', label: '演示账号 · 无管理权限', serverLabel: '演示大区 · 不代表真实区服' };
  },
  async getCharacters(accountId) {
    if (accountId !== 'demo-admin') throw new Error('仅支持固定演示账号');
    return structuredClone(characters);
  },
  async getConnectionStatus() { return { connected: false, gameOnline: null, label: '未连接游戏服务器', source: '静态演示数据' }; },
  async getPortalStatus(accountId, { simulate = false } = {}) { return createStatusSnapshot(accountId, simulate === true); },
  async getServerActivity({ simulate = false } = {}) { return createServerActivitySnapshot(simulate === true); },
  async getLeaderboard(options = {}) { return createLeaderboardSnapshot({ ...options, simulate: options.simulate === true }); },
});

export function initialState() { return { signedIn: false, account: null, characters: [], selectedId: 'char-001', view: 'overview', detailTab: 'stats', query: '', activeAnnouncement: null, menuOpen: false, refreshed: false, statusSnapshot: null, widgetOpen: false, playersOpen: false, checkinOpen: false, leaderboardSnapshot: null }; }
export function transition(state, action) {
  switch (action.type) {
    case 'ENTER': return { ...initialState(), signedIn: true, account: action.account, characters: action.characters, statusSnapshot: createStatusSnapshot(action.account.id), leaderboardSnapshot: createLeaderboardSnapshot() };
    case 'NAVIGATE': return ['overview', 'characters', 'leaderboard', 'announcements', 'connection'].includes(action.view) ? { ...state, view: action.view, menuOpen: false, query: '', widgetOpen: false, playersOpen: false } : state;
    case 'LEADERBOARD': return state.signedIn ? { ...state, leaderboardSnapshot: action.snapshot } : state;
    case 'CHECKIN_INFO': return { ...state, checkinOpen: !state.checkinOpen };
    case 'WIDGET': return { ...state, widgetOpen: !state.widgetOpen, playersOpen: false };
    case 'CLOSE_WIDGET': return { ...state, widgetOpen: false, playersOpen: false };
    case 'PLAYERS': return { ...state, widgetOpen: true, playersOpen: true, activeAnnouncement: null };
    case 'CLOSE_PLAYERS': return { ...state, widgetOpen: true, playersOpen: false };
    case 'STATUS': return state.signedIn ? { ...state, statusSnapshot: action.snapshot } : state;
    case 'SELECT': return state.characters.some(c => c.id === action.id) ? { ...state, selectedId: action.id, view: 'characters', query: '', detailTab: 'stats' } : state;
    case 'TAB': return ['stats', 'equipment'].includes(action.tab) ? { ...state, detailTab: action.tab } : state;
    case 'SEARCH': return { ...state, query: String(action.query).slice(0, 60) };
    case 'ANNOUNCEMENT': return announcements.some(a => a.id === action.id) ? { ...state, activeAnnouncement: action.id, playersOpen: false, widgetOpen: false } : state;
    case 'CLOSE_ANNOUNCEMENT': return { ...state, activeAnnouncement: null };
    case 'MENU': return { ...state, menuOpen: !state.menuOpen };
    case 'REFRESH': return { ...state, characters: action.characters, refreshed: true };
    case 'LOGOUT': return initialState();
    default: return state;
  }
}
export const formatNumber = value => new Intl.NumberFormat('zh-CN').format(value);
export const filterCharacters = (list, query) => list.filter(c => `${c.name} ${c.job} ${c.family}`.toLowerCase().includes(query.trim().toLowerCase()));
