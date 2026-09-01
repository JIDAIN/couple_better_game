# CLAUDE.md

## 自动执行约定

每次用户使用 `.claude/commands` 中的命令，或提出开发、修 bug、review、测试、重构、构建、文档修改相关任务时，你都必须自动执行以下步骤：

1. 先阅读 `AGENTS.md`
2. 再阅读本文件 `CLAUDE.md`
3. 根据任务类型阅读相关 `docs/` 文档
4. 按项目规则做最小修改
5. 修改后说明修改文件、验证方式和风险

用户使用 `/fix`、`/feature`、`/review`、`/plan`、`/explain`、`/error`、`/test` 时，默认都包含：

```text
请先阅读 AGENTS.md 和 CLAUDE.md，并遵守项目规则。
```

除非用户明确说“这次不要读取规则”。


# CLAUDE.md

请先阅读 `AGENTS.md`。

本文件是给 Claude Code / VSCode AI 插件使用的简要入口规则。如果本文件和 `AGENTS.md` 冲突，以 `AGENTS.md` 为准。

## 项目概况

本项目是「恋爱宝库 / 变美变瘦大作战」本地 Web MVP。

技术栈：

- Next.js
- React
- TypeScript
- Tailwind CSS
- Vitest

当前没有登录、后端、数据库或云同步。

当前数据通过 `AppDataStore` 抽象后存入浏览器 `localStorage`。

## 开始任务前必须阅读

请优先阅读：

1. `AGENTS.md`
2. `README.md`
3. `package.json`
4. `docs/architecture-after-refactor.md`
5. `docs/data-management-after-refactor.md`
6. `docs/development-guide-after-refactor.md`
7. `docs/testing-guide.md`

如果任务涉及热力图，请额外阅读：

- `docs/heatmap-date-logic.md`

如果任务涉及 UI，请额外阅读：

- `docs/ui-inventory.md`

## 核心规则

开发时必须遵守：

1. 不要在 UI 组件中直接读写 `localStorage`。
2. 不要在 UI 组件中计算钱包、金币、热力图等级或结算规则。
3. 业务逻辑优先放在 `lib/home/`。
4. UI 展示和交互放在 `components/home/`。
5. `HomeResourcesProvider.tsx` 应保持为状态编排器，不要重新塞入复杂业务规则。
6. 修改结算、钱包、store、snapshot、热力图、导入导出时必须补测试。
7. 不要擅自安装依赖。
8. 不要擅自修改 `package.json`。
9. 不要擅自执行 `git commit`。
10. 不要擅自执行 `git push`。
11. 不要为了小问题做大规模重构。
12. 不确定时先说明不确定，并给出需要查看的文件。

## 常用命令

```bash
npm run dev
npm run test
npm run lint
npm run build
```

提交前建议运行：

```bash
npm run test
npm run lint
npm run build
```

## Bug 修复流程

修 bug 时请按顺序：

1. 阅读 `AGENTS.md` 和相关代码
2. 说明可能涉及的文件
3. 判断根因
4. 给出最小修复方案
5. 修改代码
6. 补充或更新测试
7. 说明验证方式

## 新功能流程

做新功能时请按顺序：

1. 判断功能属于 UI、业务规则、数据结构、导入导出、热力图还是兑换系统
2. 阅读相关文档
3. 给出实现方案
4. 小步修改
5. 补测试
6. 说明验证方式

## 完成任务后的输出格式

每次修改完成后，请用中文输出：

1. 修改摘要
2. 修改文件
3. 验证方式
4. 是否已运行测试、lint、build
5. 风险或未完成事项

## 特别提醒

如果你想在 `components/home/` 中写 `localStorage.getItem()` 或 `localStorage.setItem()`，请停止并重新检查架构。

如果你想把结算规则写进 UI 组件，请停止并改到 `lib/home/`。

如果你想大幅修改 `HomeResourcesProvider.tsx`，请先说明为什么这些逻辑不能下沉到 service。