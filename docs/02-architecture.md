# 当前架构

## 1. 一句话架构

项目是一个 **Next.js 一体化 Web 应用**：浏览器负责游戏 UI、饮食 UI 和本地游戏运行状态，Vercel API 负责安全边界，Supabase 负责云端持久化。

```text
Browser
  ├─ UI + React state
  ├─ localStorage game cache
  └─ HTTPS
       ↓
Next.js / Vercel
  ├─ API auth
  ├─ input validation
  └─ Supabase RPC client
       ↓
Supabase PostgreSQL
```

## 2. 目录职责

### `app/`

- 页面入口
- API Route
- `layout.tsx` 全局引入 animal-island-ui style

当前 API：

```text
app/api/cloud-session/route.ts
app/api/home-data/route.ts
app/api/save-data/route.ts
app/api/meals/route.ts
app/api/meals/[id]/route.ts
```

### `components/home/`

游戏业务 UI 和 `HomeResourcesProvider`。

当前 Provider 仍承担两类编排：

1. 游戏 state/service/AppDataStore 编排；
2. legacy-compatible 云端同步编排。

### `components/nutrition/`

饮食业务 UI。

当前包含：

```text
DailyMealsPanel.tsx    今日公告板中的按日/角色饮食列表
MealEditorModal.tsx    手动新增 / 编辑餐食弹窗
```

它只调用浏览器 meal client，不持有 Supabase secret，也不通过 `HomeResourcesProvider` 写游戏状态。

### `components/ui/`

项目 UI adapter/wrapper 层，包装 `animal-island-ui` 并承载少量业务专有视觉组件。

新增业务 UI 应优先组合这里的 `App*` wrapper，不创建第二套 Button/Card/Modal 视觉系统。

### `lib/home/`

旧游戏领域的稳定核心：

```text
types              领域类型
settlement-rules   纯规则
daily-record       每日记录状态变更
exchange-service   兑换逻辑
home-stat-service  钱包/周统计/回算
home-state-service 初始化与恢复
app-data-store     snapshot 接口
local-storage-*    浏览器缓存实现
import/export      备份、CSV、兼容迁移
sync-state-service 同步 guard / retry decision
```

### `lib/nutrition/`

营养领域：

```text
meal-service.ts    类型、写入 payload 校验、查询参数校验
meal-client.ts     浏览器到同源 `/api/meals` 的轻量 client
```

`meal-client.ts` 只走 Next.js API 和 HttpOnly cloud session，不直接访问 Supabase。

### `lib/server/`

只在服务端使用：

- `cloud-request-auth.ts`：cloud session / password 请求鉴权。
- `supabase-home-sync.ts`：游戏兼容快照 RPC。
- `supabase-nutrition.ts`：饮食 RPC。

## 3. 游戏本地数据流

```text
Home UI
-> useHomeResources()
-> HomeResourcesProvider action
-> lib/home service
-> lib/home rules/stat
-> new HomeResourcesState
-> AppDataStore.save(snapshot)
-> localStorage
```

UI 不应该重新实现规则。

## 4. 游戏云端同步流

### 写入

```text
本地 HomeResourcesState
-> serialize / backup shape
-> POST /api/save-data
-> password + cloud-session guard
-> importHomeBackupJson normalize
-> buildHomeSyncData canonical snapshot
-> replace_home_sync_snapshot RPC
-> Supabase normalized tables + wallet rebuild
```

这里有一个重要现实：**当前服务端验证和规范化 snapshot，但没有独立重新执行整套游戏奖励规则。** 因此游戏结算的业务权威仍主要在 `lib/home`。未来如果扩展为真正多用户产品，应把最终结算下沉到服务端。

### 读取

用户显式云端加载时：

```text
DataManagement
-> （需要时）POST /api/cloud-session
-> Provider reloadFromGitHub() [legacy internal name]
-> fetch /data/couple-data.json [legacy compatibility URL]
-> proxy.ts detects valid cloud session
-> rewrite /api/home-data
-> export_home_sync_snapshot RPC
-> normalized Supabase -> schemaVersion 1 compatible snapshot
-> importHomeBackupJson
-> React state + localStorage
```

`reloadFromGitHub`、`syncToGitHub` 和 `/data/couple-data.json` 是**内部兼容名称/路径**，不是当前数据源。当前真实数据源是 Supabase。

这个 shim 在完成调用方迁移前不能随便删。

## 5. 新设备保护

`POST /api/save-data` 在设备没有有效 cloud session 时：

1. 验证同步密码；
2. 建立 cloud session；
3. 返回 `409 CLOUD_SESSION_REQUIRED`；
4. **不写任何本地数据到云端**。

用户必须先执行“连接云端并下载数据”。这是防止新设备空状态覆盖生产数据的关键保护。

## 6. reload guard

`lib/home/sync-state-service.ts` 会阻止高风险远端覆盖：

- 本地有未同步修改；
- 本地已有数据但没有 last-sync metadata。

只有用户明确确认覆盖，才能继续。

## 7. 饮食数据流

### Web 手动记录

```text
Today notice-board / DailyMealsPanel
-> lib/nutrition/meal-client
-> /api/meals 或 /api/meals/[id]
-> cloud request auth
-> lib/nutrition/meal-service validation
-> lib/server/supabase-nutrition
-> transaction RPC
-> meals + meal_items
```

读取和写入都直接以 Supabase 饮食数据为准，不复制进游戏 `HomeResourcesState`。

写入使用 RPC 的原因是保证“餐 + 多个明细”原子提交。

### ChatGPT（P2）

未来 ChatGPT “记上”也复用同一 meal domain / RPC，不创建第二套餐食结构：

```text
用户明确确认“记上”
-> source=chatgpt canonical payload
-> meal API / server path
-> meals + meal_items
```

讨论和估算本身不写数据库。

## 8. UI 场景边界

当前底部仍只有四个主 Tab：

```text
今日 notice-board
地图 growth-map
兑换 shop
小窝 nook-phone
```

P1 饮食功能作为“今日”公告板中的独立 `AppSectionPanel` 扩展，不新增第五个底部 Tab，也不新建独立视觉体系。

新增/编辑餐食沿用当前 `AppModal + Title + AppInput + AppCard + AppButton` 模式。

## 9. 数据库访问边界

当前模式是 server-only：

```text
Browser                  不持有 Supabase secret
Next.js server           持有 secret key
Supabase base tables     RLS enabled
anon/authenticated       无当前业务 policy
service role             经 API/RPC 使用
```

这不是 Supabase Auth 架构。未来如果加入真实账号，需要重新设计 auth_user_id、RLS policy 和 membership。

## 10. Supabase migration 版本管理

production 已执行的 12 条历史 migration 已按原 version / name / SQL 回填到：

```text
supabase/migrations/
```

规则：

- 已执行历史 migration 不回头改写；
- 新 DDL / function / view / grant / RLS 变化新增 migration；
- migration 管结构和规则，不代替真实 production 数据备份。

详细规则见 `supabase/README.md`。

## 11. AppDataStore 的现实定位

最初设计中 `AppDataStore` 被设想为将来直接替换成 remote store。

当前实际演进不是“remote store 替换 local store”，而是：

- local AppDataStore 继续作为游戏运行缓存；
- 游戏云端同步通过独立 Provider/API 流程完成；
- 饮食 UI 直接经 meal API 使用 Supabase，不进入游戏 AppDataStore。

因此以后不要再写“替换 AppDataStore 就完成云同步”这种过时描述。

## 12. 当前技术债

- Provider 内部仍有 GitHub 命名和兼容 URL。
- cloud-session token 生成逻辑在部分旧 route / proxy 中仍有重复，可后续统一。
- 同步 metadata/password 仍有组件/Provider 直接 localStorage 访问。
- 游戏最终结算仍不是 server-authoritative。
- 当前共享 password/session 不是完整用户身份和 membership 模型。

这些是明确的 roadmap 项，不应在无关功能中顺手重构。
