# 重构后的模块地图

本文档按文件说明当前首页相关模块的职责，方便后续继续小步拆分。

## 核心文件地图

| 文件 | 类型 | 当前职责 | 依赖 | 后续注意事项 |
|---|---|---|---|---|
| `components/home/HomeResourcesProvider.tsx` | React 组件 | 提供 Context、state 编排、action 包装、store 读写入口 | `home-state-service.ts`、`daily-record-service.ts`、`exchange-service.ts`、`home-stat-service.ts` | 继续保持“薄 Provider”，避免把规则重新塞回去 |
| `lib/home/types.ts` | 类型定义 | 统一定义运行时数据、配置数据、snapshot、记录、规则等类型 | 无运行时依赖 | 新增字段先改这里，再同步 snapshot 与 service |
| `lib/home/settlement-rules.ts` | 纯规则 | 热量宝石、运动宝石、恢复日、情侣 bonus、金币规则、热力图等级与角标 | `types.ts` | 改规则必须补测试，避免 UI 里写死阈值 |
| `lib/home/app-data-store.ts` | 存储抽象 | 定义 `AppDataStore` 和 snapshot 转换函数 | `types.ts` | 后续接后端优先替换实现层，不动 UI |
| `lib/home/local-storage-app-data-store.ts` | 本地存储实现 | 当前浏览器 `localStorage` 读写实现 | `app-data-store.ts`、`types.ts` | 只做存取，不要混入业务重算 |
| `lib/home/memory-app-data-store.ts` | 内存 store | 测试、Storybook、未来替换用 | `app-data-store.ts` | 不持久化，不要作为生产最终方案 |
| `lib/home/home-state-service.ts` | 状态服务 | 默认 state 创建、snapshot 恢复、legacy 兼容、fallback、写回 | `app-data-store.ts`、`home-stat-service.ts`、`exchange-service.ts`、`daily-record-utils.ts` | 这里是“状态恢复入口”，改动要看测试 |
| `lib/home/home-stat-service.ts` | 统计服务 | 钱包重算、周统计、seed 导入、成功打卡统计 | `settlement-rules.ts`、`daily-record-utils.ts` | 这里是派生数据重算的核心 |
| `lib/home/daily-record-service.ts` | 每日记录服务 | 今日记录、历史补录、历史删除 | `settlement-rules.ts`、`home-stat-service.ts`、`daily-record-utils.ts` | 以后继续拆 action 时优先考虑这里 |
| `lib/home/exchange-service.ts` | 兑换服务 | 兑换分类归一化、增删改、兑换记录创建与排序 | `date-utils.ts`、`home-default-config.ts`、`types.ts` | 兑换相关 UI 只消费 action 结果，不写规则 |
| `lib/home/date-utils.ts` | 日期工具 | ISO 日期、展示文案、兑换时间归一化 | `settlement-rules.ts` | 日期格式不要在 UI 里重复实现 |
| `lib/home/daily-record-utils.ts` | 记录工具 | `DailyRecord` 归一化、查找、排序、热力图 override 构建 | `date-utils.ts`、`types.ts` | 纯工具尽量保持无副作用 |
| `lib/home/home-default-config.ts` | 默认配置 | 默认兑换分类、默认配置常量 | `types.ts` | 默认值变更要确认是否影响现有数据 |
| `lib/home/home-seed-data.ts` | Seed 数据 | 内置 5 月历史记录导入数据 | `types.ts` | seed 数据改动会影响初始状态和测试 |

## 测试文件地图

| 文件 | 类型 | 当前职责 | 依赖 | 后续注意事项 |
|---|---|---|---|---|
| `tests/home/settlement-rules.test.ts` | 单元测试 | 保护结算规则、金币规则、热力图等级、角标 | `settlement-rules.ts` | 改规则前先看这里 |
| `tests/home/app-data-store.test.ts` | 单元测试 | 保护 snapshot 转换与 legacy 兼容 | `app-data-store.ts` | 改 snapshot 结构必须更新 |
| `tests/home/memory-app-data-store.test.ts` | 单元测试 | 保护内存 store 的读写和隔离行为 | `memory-app-data-store.ts` | 新 store 实现可沿用这类测试 |
| `tests/home/home-stat-service.test.ts` | 单元测试 | 保护钱包重算、周统计、seed 导入 | `home-stat-service.ts` | 改派生统计必须更新 |
| `tests/home/exchange-service.test.ts` | 单元测试 | 保护兑换分类、兑换记录、兑换钱包影响 | `exchange-service.ts`、`home-stat-service.ts` | 改兑换流程要先跑这里 |
| `tests/home/daily-record-service.test.ts` | 单元测试 | 保护今日记录、历史补录、删除流程 | `daily-record-service.ts` | 改每日记录 action 前必须看 |
| `tests/home/home-state-service.test.ts` | 单元测试 | 保护默认 state、snapshot 恢复、fallback、legacy 兼容 | `home-state-service.ts`、`app-data-store.ts` | 改初始化和恢复逻辑必须补 |

## 继续拆分的方向

当前 `HomeResourcesProvider.tsx` 已经明显变薄，但它仍然是首页 state 的入口。后续如果继续拆分，建议按职责继续往 `lib/home` 挪：

1. 先把 action 编排再进一步服务化
2. 再考虑把 Provider 变成更纯的状态容器
3. 最后如果需要，再考虑 reducer / event bus 之类的结构

当前最重要的原则仍然是：**UI 只消费 Context，不直接接触核心业务逻辑。**  
# 当前实现同步说明（2026-05）

新增或更新的关键模块：

- `lib/home/export-service.ts`：完整备份 JSON 和每周复盘 CSV 导出。
- `lib/home/import-service.ts`：完整备份 JSON 覆盖导入和旧兑换记录兼容。
- `components/home/DataManagement.tsx`：首页数据管理入口。
- `components/home/mockHeatmapData.ts`：动态生成完整周月度热力图网格，支持跨月日期。
- `tests/home/heatmap-grid.test.ts`：保护跨月热力图网格行为。
