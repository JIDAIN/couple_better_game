# AGENTS.md

本文件是给 AI 编程助手使用的项目规则。任何 AI 助手在修改代码前，都必须先阅读本文件，并结合 `README.md` 与 `docs/` 下的项目文档工作。

## 项目概况

本项目是「恋爱宝库 / 变美变瘦大作战」本地 Web MVP。

技术栈：

- Next.js
- React
- TypeScript
- Tailwind CSS
- Vitest

当前项目没有登录、后端、数据库或云同步。

当前数据主要存储在浏览器 `localStorage` 中，但已经通过 `AppDataStore` 做了抽象，未来可能替换为 API、数据库或云同步。

## 必读文档顺序

开始任何开发任务前，请按需阅读：

1. `README.md`
2. `docs/architecture-after-refactor.md`
3. `docs/data-management-after-refactor.md`
4. `docs/module-map-after-refactor.md`
5. `docs/development-guide-after-refactor.md`
6. `docs/testing-guide.md`

如果任务涉及热力图日期逻辑，还必须阅读：

- `docs/heatmap-date-logic.md`

如果任务涉及 UI 样式或组件盘点，还必须阅读：

- `docs/ui-inventory.md`

如果任务涉及规则确认，还必须阅读：

- `docs/rules-confirmation.md`

## 目录职责

- `app/`：Next.js 页面入口和路由挂载
- `components/home/`：首页 UI、交互、弹窗、Context 消费
- `lib/home/`：类型、规则、服务、store 抽象、日期工具、默认配置、seed 数据
- `tests/home/`：核心业务逻辑测试
- `docs/`：项目架构、数据管理、开发指南、测试指南和规则说明文档

## 核心架构原则

必须保持当前分层。

不要把已经拆出去的逻辑重新塞回 UI、组件或 Provider。

### UI 层规则

`components/home/` 只负责展示和交互。

禁止：

- 在 UI 组件中直接读写 `localStorage`
- 在 UI 组件中计算钱包、金币、热力图等级、热力图角标
- 在 UI 组件中写死结算规则
- 为了一个小需求大规模重构 UI 结构
- 在 UI 层直接拼装完整备份结构或导入结构

应该：

- 通过 `useHomeResources()` 获取状态和 action
- 让 `lib/home/` 中的 service 或 rules 负责业务计算
- 保持现有视觉风格和交互习惯
- 尽量复用已有组件和样式

### Provider 规则

`HomeResourcesProvider.tsx` 当前应该保持为状态编排器。

它可以负责：

- 创建 Context
- 暴露 `useHomeResources()`
- 初始化 store
- 调用 service
- 把 service 结果提交进 React state
- 对外暴露 action

它不应该重新负责：

- 结算规则
- 钱包重算
- 每日记录纯计算
- 历史补录纯计算
- 兑换记录纯计算
- snapshot 拼装细节
- `localStorage` 读写细节
- 热力图等级计算
- 复杂导入导出逻辑

如果需要修改 `HomeResourcesProvider.tsx` 超过约 50 行，请先说明为什么这些逻辑不能放到 `lib/home/`。

### 业务规则规则

如果要修改这些内容，优先看 `lib/home/`：

- 结算规则
- 金币规则
- 钱包重算
- 热力图等级
- 运动角标
- 恢复日奖励
- 情侣 bonus
- 历史补录
- 每日记录
- 兑换逻辑
- 数据导入导出
- snapshot 恢复
- legacy 数据兼容

常见位置：

- `lib/home/settlement-rules.ts`
- `lib/home/daily-record-service.ts`
- `lib/home/exchange-service.ts`
- `lib/home/home-stat-service.ts`
- `lib/home/home-state-service.ts`
- `lib/home/app-data-store.ts`
- `lib/home/local-storage-app-data-store.ts`
- `lib/home/export-service.ts`
- `lib/home/import-service.ts`

## 数据管理规则

当前数据分为：

- `UserRuntimeData`：用户运行时数据
- `AppConfigData`：配置数据
- `AppDataSnapshot`：持久化快照

不要把 runtime 数据和 config 数据混在一起。

### Source of Truth

核心源数据包括：

- `dailyRecords`
- `exchangeRecords`
- `exchangeCategories`
- `heatmapStartDate`
- `coinRules`
- `visualRules`

### Derived Data

以下字段属于派生数据，应优先通过服务重算，而不是手动拼：

- `wallet`
- `weekGemTotal`
- `weekCoinTotal`
- `streakDays`
- `weeklySuccessDays`
- `cumulativeSuccessDays`
- `yesterdayGemTotal`
- `todayFishGems`
- `todayCatGems`
- `todayBonusGems`
- `fishHeatmapOverrides`
- `catHeatmapOverrides`

## 新增用户数据字段规则

如果新增用户操作产生的数据字段，处理顺序是：

1. 更新 `lib/home/types.ts`
2. 更新 `AppDataSnapshot` 相关转换
3. 更新 `home-state-service.ts` 恢复逻辑
4. 补充或更新测试
5. 最后让 UI 使用新字段

不要只改 UI，不改 snapshot 和恢复逻辑。

## 新增配置项规则

如果新增配置项，处理顺序是：

1. 更新 `AppConfigData`
2. 更新默认配置
3. 更新 snapshot 恢复逻辑
4. 更新相关文档
5. 最后让 UI 使用配置

配置项应该和运行时数据分开，不要混在一起。

## localStorage 规则

禁止 UI 直接读写 `localStorage`。

`localStorage` 只应该通过 `AppDataStore` 接口访问。

当前本地存储实现集中在：

- `lib/home/local-storage-app-data-store.ts`

状态恢复、fallback、legacy 兼容和重算逻辑集中在：

- `lib/home/home-state-service.ts`

## 导入导出规则

涉及数据备份、导入、CSV 导出时，优先扩展：

- `lib/home/export-service.ts`
- `lib/home/import-service.ts`

不要在 UI 组件中拼装备份结构。

导入逻辑必须注意：

- 失败时不应该提交部分状态
- 覆盖导入需要保护数据一致性
- 需要兼容当前 snapshot 结构
- 必要时补充测试

## 热力图规则

修改热力图日期逻辑时，需要同步关注：

- `components/home/mockHeatmapData.ts`
- `tests/home/heatmap-grid.test.ts`
- `docs/heatmap-date-logic.md`

不要只改展示，不改测试。

## 测试规则

如果修改以下内容，必须补充或更新 `tests/home/` 下的测试：

- 结算规则
- 金币规则
- 钱包计算
- 热力图等级
- 热力图日期逻辑
- `DailyRecord` 结构
- `ExchangeRecord` 结构
- snapshot 恢复逻辑
- store 逻辑
- 导入导出逻辑
- legacy 数据兼容逻辑

常用命令：

```bash
npm run test
npm run lint
npm run build
```

提交前建议至少运行：

```bash
npm run test
npm run lint
npm run build
```

如果只改文档，可以不运行 build，但需要说明没有运行的原因。

## AI 修改代码规则

AI 助手必须遵守：

1. 修改前先阅读相关文件，不要凭空猜测。
2. 优先做最小修改。
3. 不要为了一个小 bug 大重构。
4. 不要擅自安装依赖。
5. 不要擅自修改 `package.json`，除非任务明确需要。
6. 不要擅自删除用户数据、seed 数据或历史兼容逻辑。
7. 不要擅自执行 `git commit`。
8. 不要擅自执行 `git push`。
9. 不要擅自改 README 或 docs，除非任务涉及文档同步。
10. 改完必须说明修改了哪些文件、为什么改、如何测试。
11. 如果不确定，请明确说明不确定，不要假装确定。
12. 如果改动会超过 3 个文件，先给方案再修改，除非用户明确要求直接改。

## Bug 修复流程

遇到 bug 时，按这个流程：

1. 阅读 `AGENTS.md`、相关文档和相关代码
2. 复现或根据现象推断复现路径
3. 找到可能根因
4. 给出最小修复方案
5. 修改代码
6. 补充或更新测试
7. 运行相关检查
8. 输出变更总结和验证步骤

## 新功能开发流程

开发新功能时，按这个流程：

1. 明确功能属于 UI、业务规则、数据结构、导入导出、热力图还是兑换系统
2. 阅读相关文档和代码
3. 先给实现方案和影响范围
4. 小步实现
5. 必要时补测试
6. 最后同步文档

## 输出格式要求

每次完成任务后，请用中文输出：

1. 修改摘要
2. 修改文件
3. 验证方式
4. 是否已运行测试、lint、build
5. 风险或未完成事项

## Markdown 和公式规则

如果生成 Markdown 内容或项目文档：

- 数学公式必须使用 LaTeX
- 行内公式使用 `$...$`
- 块级公式使用 `$$...$$`
- 不要使用普通文本伪公式
- 面向 Obsidian 的内容应尽量使用标准 Markdown

## 禁止事项

禁止执行或建议执行危险命令，例如：

```bash
rm -rf
git reset --hard
git clean -fd
```

除非用户明确知道后果并要求执行。

禁止在没有说明原因的情况下：

- 安装新依赖
- 删除文件
- 大规模重构
- 改变数据结构
- 改变持久化格式
- 清空本地数据
- 删除 legacy 兼容逻辑