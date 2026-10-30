# 数据适配器与 HTTP 契约草案

> 只有第一节的浏览器内存适配器已实现。后面的 URL、响应模型与错误码都是后端设计草案；当前没有这些接口，静态预览请求它们会得到 404。不要把本文当作已接入或兼容承诺。

## 1. 当前 `mockAdapter`

位置：`dist/data.mjs`。方法返回 Promise，但不发网络请求。

| 方法 | 现有行为 |
| --- | --- |
| `enterDemo(username)` | 只接受去首尾空格后的小写 `admin`，返回固定演示账号；不是登录协议 |
| `getCharacters(accountId)` | 仅 `demo-admin` 可取本人 3 个虚构角色的独立拷贝 |
| `getConnectionStatus()` | `connected: false`、`gameOnline: null` |
| `getPortalStatus(accountId, { simulate })` | 本人位置/深渊展示快照；未接入默认 `null` |
| `getServerActivity({ simulate })` | 公共玩家动态展示快照；默认空名单、未知人数 |
| `getLeaderboard({ category, raid, simulate })` | 默认空榜；类别为 `raid/abyss/enhancement/amplification`；团本样例为 `anton/luke` |

当前模型注意事项：

- 所有快照 `connected` 始终为 `false`。`source` 为 `unconnected` 或 `simulation`。
- 开启模拟也不填写真实 `observedAt`、`businessDate`、`businessTimezone`；只有单独的 `exampleDate: "2026-10-01"`。
- `createStatusSnapshot` 复用服务器样例形状，但未来必须拆分公共响应和本人响应，不能直接把混合对象当作公开接口。
- 强化/增幅样例来自独立虚构历史记录，不以当前装备快照求历史最高。

## 2. 拟定的 HTTP 边界（待实现）

建议前缀 `/api/v1`，JSON、同源 HTTPS、独立 Web 会话。真实认证/账号绑定方案未确认，因此**此处不定义登录密码格式，不实现游戏登录替代接口**。以下路径是讨论起点，接入前可调整。

| 方法/路径 | 作用与权限 |
| --- | --- |
| `GET /api/v1/session` | 返回当前独立 Web 会话的最小用户信息；未登录 401 |
| `DELETE /api/v1/session` | 注销 Web 会话；需 CSRF 防护；不得注销游戏连接 |
| `GET /api/v1/me/characters` | 仅当前账号角色摘要，不接收任意账号 ID |
| `GET /api/v1/me/characters/{characterId}` | 属性/装备详情，服务端验证角色归属 |
| `GET /api/v1/me/portal-status` | 本人位置/业务日深渊成功入场计数，未知字段保持 null |
| `GET /api/v1/server/activity` | 服务端允许公开的最小状态/人数/玩家名单；不含私人角色明细 |
| `GET /api/v1/leaderboards?category=raid&raid={raidId}` | 公开策略许可的榜单，校验类别、团本及分页参数 |

不设签到写接口、发奖、GM、交易或修改装备接口。签到按钮保持未配置说明，直到产品规则、授权和幂等方案另行确认。

## 3. 响应语义草案

建议真实接口采用统一外层，前端网络适配器再映射为界面状态，而不是假装 `mockAdapter` 已经接入。以下是**不可用数据的示例，不是真实响应**：

```json
{
  "data": {
    "accountApiStatus": "unknown",
    "gameServiceStatus": "unknown",
    "onlinePlayers": null,
    "publicPlayers": []
  },
  "meta": {
    "source": "unavailable",
    "observedAt": null,
    "complete": false,
    "businessDate": null,
    "businessTimezone": null
  }
}
```

- `observedAt` 是服务端来源的观测时间，不是前端点击刷新时间；可用时用带时区的 RFC 3339 时间。
- 在线人数仅能从可信、完整、去重的全服快照得到。未接入、连接失败、不完整快照都显示未知，不能用空数组长度伪造 `0`。
- 账号 API 就绪不等于游戏服务健康；两者分开表达。公开名单可以因隐私/分页只包含部分公开角色，不能用名单长度代替总在线人数。
- 位置/活动的数据源需单独验证；不从在线标记猜测。业务日时区、换日时间仍未确定，不能用过去 24 小时代替今日。
- 角色摘要拟用不透明 `characterId`、`name`、`job`、`level`；属性与装备各字段在验证数据来源后再定，不把前端样例数字当成已证实的游戏协议。
- 公共名单仅允许公开角色标识、名字、职业、等级、允许公开的活动字段；不得传出账号 ID、数据库键、余额、装备或个人深渊记录。服务端负责字段白名单。

建议错误结构：`{"error":{"code":"UNAUTHENTICATED","message":"请先登录"}}`。不返回内部堆栈、数据库地址或服务凭据。草案状态码：参数错误 400、未认证 401、无权限 403、资源不存在/按策略隐藏归属 404、限流 429、来源不可用 503。前端必须区分权限拒绝、数据未知、空榜和来源故障；任何失败都不能暗中切成演示数据。

## 4. 统计与排名契约

| 类别 | 已选语义 | 必须另行确认 |
| --- | --- | --- |
| 团本攻坚 | 每个具体团本的成功攻坚次数，服务端成功记录去重 | 团本 ID/版本映射、回执覆盖范围、累计/周期范围 |
| 深渊 | 服务端确认成功入场计 1 次；未完成/退出也计，失败入场不计 | 成功入场事件、局次 ID、业务时区/换日、历史起点 |
| 强化 | 历史最高成功强化等级 `+N`，不是操作次数 | 可信成功事件/历史纪录、历史覆盖与初始化 |
| 增幅 | 历史最高成功增幅等级 `+N`，不是操作次数 | 同上；不得用当前装备或 GM 修改回执冒充历史纪录 |

后台必须依据事件/局次标识幂等去重，重复通知、重连、重试不增加计数。深渊不能用普通通关、Boss 结算或疲劳消耗替代。没有历史记录的时期不能补造，也不要把未知写成 `0`。

榜单条目建议只包含公开角色资料、非负整数 `value`、`rank`，强化/增幅可附允许公开的装备名称和历史记录时间。数值降序，同值同名次并跳号（1、2、2、4），再以稳定公开标识确定同分顺序。当前演示只有明确标注的累计样例/历史最高样例，不擅自规定日榜、周榜或奖励。
