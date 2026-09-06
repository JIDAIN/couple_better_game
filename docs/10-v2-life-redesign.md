# V2 生活系统重构设计

**状态：2026-09-07，当前产品关系已确定**

## 0. 当前产品关系

旧版“变瘦变美大作战”已经不再代表整个应用。

现在的正式关系是：

```text
Couple Better Game（当前主程序 / Island Life）
├─ 今日
├─ 饮食
├─ 日历
├─ 小窝
└─ 游戏
   └─ 变瘦变美大作战（Legacy Game）
```

也就是说，**旧程序现在是新程序「游戏」中的一个独立子项目**。旧游戏的历史数据、金币、宝石、钱包、兑换和旧版每日打卡继续保留，但它们只属于这个游戏子项目，不属于当前生活系统的数据字段。

具体数据隔离见 [`48-life-legacy-game-data-boundary.md`](48-life-legacy-game-data-boundary.md)。

## 1. 产品方向

V2 将产品主入口从“变美变瘦大作战”调整为双人生活记录系统。

核心原则：

```text
生活记录负责保存事实；
旧游戏继续作为明确、可进入、可退出的独立游戏子项目；
生活数据默认不参与旧游戏评分、奖励或排名。
```

旧游戏不删除，原 deficit / 运动 / 金币 / 宝石 / 成长地图 / 兑换规则和历史继续保留。

## 2. 目标信息架构

```text
生活系统
├─ 今日
│  ├─ 心情
│  ├─ 睡眠
│  └─ 活动
├─ 饮食
├─ 日历
└─ 小窝
   ├─ 体重
   ├─ 日记 / 小信箱
   ├─ 家庭药箱
   ├─ 心情月度回顾（Later）
   ├─ 游戏机
   │  ├─ 变美变瘦大作战（Legacy Game 子项目）
   │  └─ Future Mini Games
   └─ 数据管理

/game
└─ 现有完整变美变瘦游戏
```

第一版首页只暴露心情、睡眠、活动三个高频记录入口。饮食、体重、日记/留言、药箱分别维护自己的页面或低频入口，不重新塞回首页。

## 3. V2-P0 的工程目标

V2-P0 只建立新旧边界，不改生产数据库，不改旧游戏规则：

1. 从稳定生产 HEAD 建立 `v2/life-foundation` 分支；
2. 新增 `/game`，让现有 `HomeScreen` 可以作为完整旧游戏独立运行；
3. 根 `/` 暂时继续保持当前生产行为，直到新生活 App Shell 具备最小可用能力；
4. 建立 `components/life/` 代码边界；
5. 将 CI Node 版本与 Vercel production 的 Node 24 对齐；
6. 后续在本阶段继续把 Nutrition 对 `HomeResourcesProvider` 的直接依赖移出纯饮食组件。

## 4. 领域边界

目标代码归属：

```text
components/home        旧游戏业务 UI / Provider
components/life        新生活系统 UI
components/nutrition   饮食 UI
components/weight      真实体重 UI（后续）
components/medicine    家庭药箱 UI（后续）
components/ui          公共 App* / animal-island-ui wrapper

lib/home               旧游戏规则、状态、同步
lib/life               心情 / 睡眠 / 活动领域（后续）
lib/nutrition          饮食领域
lib/weight             真实体重领域（后续）
lib/medicine           家庭药箱领域（后续）
```

`HomeResourcesProvider` 继续只属于旧游戏，不作为 V2 整个应用的全局 Provider。

## 5. 后续数据方向

V2-P1 预计新增：

```text
mood_entries
sleep_records
activity_entries
```

UI 首版保持轻量，但表和 API 需要预留 `source` / `idempotency_key` 等字段，方便未来 Web、ChatGPT 和导入流程共用同一领域服务。

饮食继续复用现有 `meals / meal_items`；后续单独 migration 把 kcal 改为可选，不能用 0 表示“未估算”。

真实体重继续以 `weight_measurements` 为真相源。

家庭药箱等收到实际 Excel 后再最终确定字段，真实药品库存不得写入 Git migration。

## 6. AI 接入原则

未来所有 AI 写入都复用正式领域服务 / 受限 RPC：

```text
Web UI ───────┐
              ├─ Domain API / service ─> Supabase
ChatGPT ──────┤
Excel import ─┘
```

AI 不获得通用 SQL 写权限。修改类动作继续遵循明确保存意图、幂等、必要时读回确认和审计边界。

## 7. 当前不做

V2-P0 不做：

- 不新增 mood / sleep / activity 表；
- 不修改 meal kcal nullable；
- 不重做旧游戏 UI；
- 不改金币、宝石、兑换规则；
- 不切换根 `/` 到新首页；
- 不创建家庭药箱表；
- 不开发动物岛记录可视化或新小游戏框架。

这些都在新旧代码边界验证通过后分阶段实施。
