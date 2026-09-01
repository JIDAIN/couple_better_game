---
name: animal-island-ui-full-migration
description: >
  Full-project UI migration skill for couple_better_game. It migrates the app
  to an animal-island-ui backed visual and component system, creates project
  wrappers, replaces all audited safe UI elements in batches, performs residual
  scans, verifies with build/lint/test, smoke tests, and visual screenshots,
  rolls back failed batches using allowlist-based rollback, and generates design,
  implementation, contract, migration, and rollback documentation.
version: 1.1.2
---

# Animal Island UI Full Migration Skill v1.1.2

## Mission

把 `couple_better_game` 当前 UI 全量迁移到以 `animal-island-ui` 为设计来源和组件支撑的 UI 体系。

本 Skill 不是 CSS 主题适配，也不是“看起来有点像”的视觉补丁。它的目标是：

```text
所有页面 UI 风格统一
所有语义按钮统一迁移到 AppButton
所有 <a> 标签按钮统一迁移到 AppButtonLink
所有可安全迁移的卡片统一迁移到 AppCard
所有可安全迁移的输入框统一迁移到 AppInput
所有可安全迁移的 textarea 统一迁移到 AppTextarea
所有可安全迁移的 select 统一迁移到 AppSelect
所有可安全迁移的弹窗结构统一迁移到 AppModal / AppDialog structure wrappers
toast 通知与 dialog 弹窗正确区分，toast 统一迁移到 AppToast
wrapper 优先封装 animal-island-ui 官方组件
无法封装官方组件的地方必须登记 fallback 和 exception
业务页面不得残留未登记的原生 button / 旧按钮 class / 可迁移 UI 裸用法
全流程可验证、可回退、可文档化
```

最终结果必须能回答：

```text
迁移了哪些页面？
哪些按钮已统一？
哪些 <a> 链接按钮已统一？
哪些卡片/输入框/textarea/select/弹窗已统一？
哪些 toast / dialog 已正确归类？
哪些地方无法迁移，为什么？
是否还有未登记残留？
如何回退？
如何继续下一轮迁移？
```

## Execution Priority Summary

当规则之间发生冲突时，按以下优先级执行：

```text
1. 不修改业务逻辑
2. 不修改 forbidden files
3. 保留数据结构、storage key、测试语义、热力图语义
4. 完成全量 UI 迁移目标
5. 优先使用 animal-island-ui backed wrapper
6. 所有业务页面 UI 统一进入项目 wrapper
7. 不安全的迁移必须登记 exception，不得强改
8. Full Success 必须零未登记残留
9. 执行过程中不反复询问用户
10. 不自动 commit，不自动 push
```

## Project Boundary Rules

必须遵守当前项目架构。

禁止修改：

```text
lib/home/**
app/api/**
tests/**
package.json
package-lock.json
```

禁止修改：

```text
数据结构
storage key
seed 数据
结算规则
金币规则
钱包规则
热力图日期逻辑
热力图等级语义
导入导出数据格式
测试断言
```

UI 迁移可以改变展示组件结构，但不得改变：

```text
onClick / onChange / onSubmit 的业务语义
disabled 条件
表单 submit 行为
controlled / uncontrolled input 模式
key
aria-*
data-*
条件渲染
数据 map/filter/sort 顺序
store/service/rules 调用
API 调用
href / download / target / rel 的语义
```

禁止自动执行：

```bash
git commit
git push
npm install
npm uninstall
npm update
```

除非用户另行明确授权。

## Branch Safety Rule

执行前必须检查当前本地分支：

```bash
git branch --show-current
git status --short
```

本 Skill 只修改当前本地工作区。

本 Skill 不得：

```text
自动创建 commit
自动 push 到 GitHub
自动创建 PR
修改上游 animal-island-ui 仓库
```

如果当前分支是 `main` 或 `master`：

```text
可以继续做本地 working-tree 修改
不得 commit
不得 push
必须在 docs/ui-migration-report.md 中写入 warning：
  当前迁移运行在 main/master，建议后续切换到独立分支再提交。
```

推荐用户在执行前创建分支：

```bash
git switch -c ui/animal-island-full-migration
```

但如果用户没有创建分支，本 Skill 仍可继续本地修改，只要不 commit / push。

## animal-island-ui Rules

执行前必须阅读：

```text
node_modules/animal-island-ui/AI_USAGE.md
node_modules/animal-island-ui/dist/types/index.d.ts
```

如果文件不存在：

```text
不要安装依赖
不要联网补装
只在报告中记录 not found
```

使用 `animal-island-ui` 时必须遵守：

```text
只从 package root 导入组件和类型
只在 app entry 导入一次 animal-island-ui/style
不从 deep path 导入
不臆造 props
组件 API 以当前安装包 node_modules/animal-island-ui/dist/types/index.d.ts 为准
AI_USAGE.md 作为设计和使用参考，但不能覆盖类型定义
```

关键 API 注意：

```text
Button type: primary | default | dashed | text | link
Button htmlType: submit | reset | button
Input size: small | middle | large
Input 支持 prefix / suffix / allowClear / status
Card type: default | title | dashed
Modal 必须有 open，并且必须可关闭
Modal typewriter 可能默认为 true，业务弹窗通常需要 typewriter={false}
Select 是 controlled-only：options / value / onChange 全部必传
Checkbox 是 options-based 多选组件，不适合单个 boolean checkbox
Switch 适合单个 boolean 开关，但替换 checkbox 需要单独评估交互差异
```

如果当前安装包类型定义与 `AI_USAGE.md` 不一致：

```text
以 dist/types/index.d.ts 为准
在 docs/ui-migration-report.md 中记录差异
不要臆造不存在的 props
```

## Missing animal-island-ui Package Rule

如果 `node_modules/animal-island-ui/dist/types/index.d.ts` 缺失：

```text
不要臆造官方组件 props
不要创建 animal-island-ui backed wrappers
不要宣称 Full Success
```

处理方式：

```text
如果 animal-island-ui/style 已经导入且 build 通过：
  Phase 1 可以继续作为视觉/token 迁移。

Phase 2 / Phase 3 必须二选一：
  1. Docs-only Exit；
  2. 创建 native temporary wrappers，但必须标记为 temporary blocking fallback，并阻止 Full Success。
```

如果 `AI_USAGE.md` 缺失但 `dist/types/index.d.ts` 存在：

```text
可以继续 wrapper 迁移
所有官方组件 API 以 dist/types/index.d.ts 为准
在报告中记录 AI_USAGE.md not found
```

## Execution Mode

用户明确说“开始执行”或“按本 Skill 执行”后，业务层面只需要一次确认。

确认后自动推进，不在阶段之间反复询问用户。

只有以下情况必须停止并请求用户确认：

```text
需要 commit
需要 push
需要安装 / 卸载 / 更新依赖
需要删除非本次新增文件
需要修改 forbidden files
需要修改业务逻辑
当前 diff 中存在用户已有改动且无法安全区分
工具系统强制要求权限确认
```

如果底层工具系统强制要求权限确认，按工具系统要求申请最小权限，这不视为 Skill 主动打断用户。

## Upfront Message

执行前只发送一次：

```text
我会按 Animal Island UI Full Migration Skill v1.1.2 执行全量 UI 迁移。

本次会自动推进：
- Phase -1：执行环境校验
- Phase 0：基线检查与 UI 审计
- Phase 1：视觉 token / CSS 迁移
- Phase 2：建立 animal-island-ui backed 项目 wrapper
- Phase 3：逐批迁移所有审计到且可安全迁移的按钮、链接按钮、卡片、输入框、textarea、select、弹窗结构、toast
- Phase 4：残留扫描、build/lint/test、冒烟测试、桌面和移动端视觉截图验证
- Phase 5：文档沉淀与失败批次回退记录

不会修改业务逻辑、数据结构、store/service/rules、测试断言、package 文件。
不会 commit，不会 push。
本 Skill 不会默认使用 git stash push；将使用 diff checkpoint + allowlist rollback。
如果某一批次失败，会回退该批次并继续处理安全范围，最终报告 exceptions 和 remaining gaps。
```

## Checkpoint and Rollback Mechanism

默认不要使用 `git stash push` 作为 checkpoint 机制。

原因：

```text
git stash push 会改变当前工作区
可能隐藏前一个已成功 Phase 的修改
可能误 stash 用户已有未提交改动
默认不包含 untracked 文件，加 -u 又会提高误操作风险
```

默认 checkpoint 机制：

### Phase 开始前

记录当前状态：

```bash
git status --short
git diff --name-only
git diff --stat
```

保存 patch：

```bash
node -e "require('fs').mkdirSync('docs/.ui-migration-checkpoints',{recursive:true})"
git diff --binary > docs/.ui-migration-checkpoints/phase-<N>-before.patch
git status --short > docs/.ui-migration-checkpoints/phase-<N>-status-before.txt
```

如果 `docs/.ui-migration-checkpoints` 不适合写入，可以只记录到 `docs/ui-migration-report.md`。

### Phase 执行中

只修改当前 Phase allowlist 中的文件。

### Phase 失败时

回退规则：

```text
只回退当前 Phase 或当前 batch 的 allowlist 文件
不使用 git restore .
不使用 git reset --hard
不回退之前已验证通过的 Phase
不回退用户已有改动
```

对于当前 Phase 新增的文件：

```text
只删除当前 Phase allowlist 中、且确认由本 Phase 新增的文件
```

对于当前 Phase 修改的文件：

```text
如果文件在 Phase 开始前没有用户已有改动：
  可以按 allowlist 精确回退该文件到 Phase 开始前状态

如果文件在 Phase 开始前已有用户改动：
  不自动回退该文件
  标记 rollback unsafe
  停止代码修改
  在 docs/ui-migration-report.md 写明风险
```

可选高级 checkpoint：

```text
可以使用 git stash create 作为只读快照机制
不要使用 git stash push，除非用户明确授权
```

## Phase Ladder

必须按以下顺序执行：

```text
Phase -1: Preflight Environment Check
Phase 0: Preflight + UI Audit
Phase 1: Theme and CSS Migration
Phase 2: UI Wrapper Foundation
Phase 3: Full Page Migration to Wrappers
Phase 4: Residual Scan + Verification
Phase 5: Documentation + Rollback Report
```

每个 Phase 结束后都必须建立稳定 checkpoint。

失败时只回退当前 Phase 或当前批次，不回退之前已验证通过的阶段。

## Stable Checkpoint Rules

每个 Phase 开始前：

```text
记录 phase name
记录 dirty files before phase
记录 planned allowlist
记录 baseline verification state
保存 diff checkpoint
```

每个 Phase 结束后验证：

```text
changed files are inside allowlist
build/lint/test not regressed
forbidden files untouched
business logic untouched
heatmap protected
```

如果失败：

```text
按 allowlist rollback 当前 Phase 或当前 batch
不回退更早的 Phase
不使用 git restore .
不使用 git reset --hard
```

---

## Phase -1: Preflight Environment Check

### 目标

在实际修改任何代码前，验证所有关键假设，确保执行环境可预期。

### Phase -1 Allowlist

Phase -1 只允许新增或修改：

```text
docs/ui-migration-audit.md（仅 preflight 节）
docs/ui-migration-report.md（仅 preflight 节，如已存在）
docs/.ui-migration-checkpoints/**
```

不得修改代码文件。

### Required Checks

#### Check 1: animal-island-ui Package State

使用跨平台 Node 命令，不使用 `ls` / `grep` 作为必要命令。

```bash
node -e "const fs=require('fs'); console.log(fs.existsSync('node_modules/animal-island-ui/package.json') ? 'INSTALLED' : 'NOT INSTALLED')"
node -e "const fs=require('fs'); const p='node_modules/animal-island-ui/package.json'; console.log(fs.existsSync(p) ? require('./'+p).version : 'VERSION UNKNOWN')"
node -e "const fs=require('fs'); console.log(fs.existsSync('node_modules/animal-island-ui/AI_USAGE.md') ? 'AI_USAGE OK' : 'AI_USAGE MISSING')"
node -e "const fs=require('fs'); console.log(fs.existsSync('node_modules/animal-island-ui/dist/types/index.d.ts') ? 'TYPES OK' : 'TYPES MISSING')"
```

#### Check 2: Style Import Verification

```bash
node -e "const fs=require('fs'); const p='app/layout.tsx'; const s=fs.existsSync(p)?fs.readFileSync(p,'utf8'):''; console.log(s.includes('animal-island-ui/style') ? 'STYLE IMPORT OK' : 'STYLE IMPORT MISSING')"
```

规则：

```text
如果 animal-island-ui package 未安装：
  Phase -1 FAIL，因为本 Skill 禁止 npm install。

如果 package 已安装，但 style import 缺失：
  Phase -1 记录 warning，不直接失败。
  Phase 1 自动补入 import "animal-island-ui/style"。
```

#### Check 3: AI_USAGE.md vs dist/types/index.d.ts Consistency

逐项对比以下内容，记录差异：

```text
AI_USAGE.md 列出的组件 vs dist/types/index.d.ts 实际导出的组件
AI_USAGE.md 列出的 props vs dist/types/index.d.ts 的类型定义
AI_USAGE.md 列出的枚举值 vs dist/types/index.d.ts 中的字面量类型
```

差异记录格式：

```md
### API Consistency Diff

| Component | AI_USAGE.md | dist/types/index.d.ts | Status |
|---|---|---|---|
| Button | type: primary/default/dashed/text/link | (一致/差异) | OK / DIFF |

差异说明：
- 如果 types 中有但 AI_USAGE.md 中未列出的 prop，以 types 为准。
- 如果 AI_USAGE.md 中有但 types 中没有的 prop，标记为 INVALID。
```

差异不阻止执行，但必须在报告中记录。

#### Check 4: Existing components/ui Audit

```bash
node -e "const fs=require('fs'); const p='components/ui'; console.log(fs.existsSync(p) ? 'components/ui EXISTS' : 'components/ui NOT EXISTS')"
```

记录：

```text
components/ui exists: yes/no
existing files:
existing barrel export:
```

#### Check 5: Font Conflict Precheck

animal-island-ui 通过 `import "animal-island-ui/style"` 可能导入：

```text
Nunito
Noto Sans SC
Zen Maru Gothic
```

当前项目可能在 `app/globals.css` 中设置了系统字体栈。

默认字体策略：

```text
策略 A：接受 animal-island-ui 字体体系（默认）
  - 不额外覆盖 font-family
  - 中文渲染使用 Noto Sans SC
  - 与当前系统字体效果不同，但符合 animal-island-ui 风格
```

可选策略：

```text
策略 B：保留项目字体
  - 仅当用户在开始前已经明确要求保留项目原字体时使用
  - 在 globals.css 中显式设置 body font-family
  - 在 docs/ui-theme-adapter.md 中记录原因
```

执行过程中不要为了字体策略再次询问用户。

#### Check 6: Platform Detection

```bash
node -e "console.log(process.platform)"
```

记录：

```text
platform: win32 / darwin / linux
command style: use npm run directly
```

默认命令使用：

```bash
npm run build
npm run lint
npm run test
npm run dev
```

不要写死 `cmd /c`。

### Phase -1 Verification Output

写入 `docs/ui-migration-audit.md` 或 `docs/ui-migration-report.md`：

```md
## Preflight Check Report

- animal-island-ui version:
- AI_USAGE.md: found / not found
- dist/types/index.d.ts: found / not found
- API consistency: OK / N diff(s) found
- style import in layout.tsx: OK / MISSING, will fix in Phase 1
- components/ui exists: yes / no
- font strategy: A / B
- platform:
- branch:
```

### Phase -1 Failure Handling

如果 package 未安装：

```text
Preflight FAILED: animal-island-ui is not installed.
需要用户操作：npm install animal-island-ui。
本 Skill 不会自动安装依赖。
```

如果 package 已安装但 style import 缺失：

```text
Preflight WARNING: style import missing.
Phase 1 will add import "animal-island-ui/style".
```

---

## Phase 0: Preflight + UI Audit

### Phase 0 Allowlist

Phase 0 只允许新增或修改：

```text
docs/ui-migration-audit.md
docs/ui-migration-report.md（仅 baseline 节）
docs/.ui-migration-checkpoints/**
```

不得修改代码文件。

### Required Commands

编辑任何代码文件前执行：

```bash
git branch --show-current
git status --short
git diff --name-only
git diff --stat
npm run build
npm run lint
npm run test
```

记录 baseline：

```text
branch:
build: pass/fail
lint: pass/fail
test: pass/fail
failed tests:
warnings:
dirty files before migration:
```

如果 baseline 本身失败，迁移后不得新增失败、不得改变失败测试名称、不得增加错误数量。

### Required Reading

执行前阅读存在的文件：

```text
AGENTS.md
README.md
docs/architecture-after-refactor.md
docs/data-management-after-refactor.md
docs/module-map-after-refactor.md
docs/development-guide-after-refactor.md
docs/testing-guide.md
docs/ui-inventory.md
docs/heatmap-date-logic.md
app/layout.tsx
app/globals.css
app/**/*.tsx
components/home/**/*.tsx
components/ui/**
node_modules/animal-island-ui/AI_USAGE.md
node_modules/animal-island-ui/dist/types/index.d.ts
```

如果某个文件不存在，只在报告中记录：

```text
not found
```

不要因为缺少文档而创建空文档替代。

### UI Inventory Scope

扫描范围：

```text
app/**/*.tsx
components/**/*.tsx
app/globals.css
```

排除：

```text
node_modules/**
.next/**
dist/**
coverage/**
```

统计并分类：

```text
<button
<a> with ui-button-* class
<input (区分 type: text/date/datetime-local/file/checkbox/password)
<textarea
<select
form
modal/dialog/sheet
toast (role="status" 的元素)
ui-button-*
ui-card*
ui-input*
ui-sheet
ui-dialog
app-nav-item
nest-subpage-back
heatmap / heat-cell / heat-legend
compact-field / compact-field-input
animate-* animation classes
```

生成：

```text
docs/ui-migration-audit.md
```

必须包含：

```md
# UI Migration Audit

## Preflight Summary
## Baseline Verification

## Summary

- Total native buttons:
- Total <a> link buttons:
- Total native inputs:
  - type="text":
  - type="date":
  - type="datetime-local":
  - type="file":
  - type="checkbox":
  - type="password":
- Total native textareas:
- Total native selects:
- Total card-like containers:
- Total dialog/sheet/modal structures:
- Total toast elements:
- Compound input patterns:
- Existing semantic UI classes:
- Current animal-island-ui imports:
- Existing components/ui wrappers:
- Animation classes in use:
- Heatmap-related files:
- Recommended migration batches:

## Button Inventory

| File | Current Element/Class | Role | Target | Batch | Risk |
|---|---|---|---|---|---|

## Link Button Inventory

| File | Current Element/Class | Role | Target | Batch | Risk |
|---|---|---|---|---|---|

## Card Inventory

| File | Current Element/Class | Role | Target | Batch | Risk |
|---|---|---|---|---|---|

## Input Inventory

| File | Current Element/Class | Type | Role | Target | Batch | Risk |
|---|---|---|---|---|---|---|

## Textarea Inventory

| File | Current Element/Class | Role | Target | Batch | Risk |
|---|---|---|---|---|---|

## Select Inventory

| File | Current Element/Class | Role | Target | Batch | Risk |
|---|---|---|---|---|---|

## Dialog Inventory

| File | Current Element/Class | Role | Target | Batch | Risk |
|---|---|---|---|---|---|

## Toast Inventory

| File | Current Element/Class | Role | Keep as Toast / Migrate | Batch | Risk |
|---|---|---|---|---|---|

## Compound Input Patterns

| File | Pattern Name | Structure | Migration Strategy | Risk |
|---|---|---|---|---|

## Existing Wrapper Inventory

| File | Export | Current Implementation | Keep / Refactor / Replace |
|---|---|---|---|

## Animation Classes Inventory

| File | Animation Class | Preserve / Migrate | Notes |
|---|---|---|---|

## Exception Candidates

| File | Element | Reason | Blocks Full Success |
|---|---|---|---|

## Optional Enhancement Candidates

| Component | Potential Use | Priority | Recommended |
|---|---|---|---|
| Divider | 规则说明页分区 | Low | Optional |
| Footer | 页面底部装饰 | Low | Optional |
| Icon | 替换 emoji 图标 | Medium | Optional |
| Collapse | 规则说明展开/折叠 | Low | Optional |
| Switch | 单个 boolean 开关 | Medium | Optional |
| Tabs | 宝石/金币切换 | Low | Optional |
| Typewriter | 弹窗文字动画 | Low | Optional |
| Cursor | 全局游戏光标 | Low | Optional |
| Time | 时钟装饰 | Low | Optional |
| Loading | 加载状态 | Low | Optional |

## Heatmap Protection

Confirm no heatmap data, date, grid, level, or color semantic changes are planned.
```

---

## Phase 1: Theme and CSS Migration

目标：把现有视觉 token 和语义样式迁移到 animal-island-ui 视觉语言，同时不破坏热力图与业务布局。

### Phase 1 Allowlist

允许修改：

```text
app/globals.css
app/layout.tsx
app/animal-island-theme.css
docs/ui-theme-adapter.md
docs/ui-rollback-guide.md
docs/ui-migration-report.md
docs/.ui-migration-checkpoints/**
```

### Style Import Rule

如果 Phase -1 发现 `app/layout.tsx` 缺少：

```ts
import "animal-island-ui/style";
```

Phase 1 必须添加它。

导入顺序建议：

```ts
import "animal-island-ui/style";
import "./globals.css";
```

如使用独立主题文件：

```ts
import "animal-island-ui/style";
import "./globals.css";
import "./animal-island-theme.css";
```

### Font Strategy

默认采用策略 A：

```text
接受 animal-island-ui 字体体系
不额外覆盖 body font-family
```

如果用户在开始前明确要求保留项目原字体，采用策略 B：

```text
在 app/globals.css 中显式保留项目 font-family
在 docs/ui-theme-adapter.md 中记录原因
```

执行过程中不要再次询问字体策略。

### CSS Token Coordination Strategy

当前 `app/globals.css` 可能已有 token 系统，例如：

```text
--bg
--primary
--card-bg
--text-main
```

迁移策略：

```text
Step 1: 不删除现有 token
Step 2: 在现有 :root 中追加 animal-island-ui 风格 token（--cbg-theme-*）
Step 3: 将现有 ui-* 语义 class 中的硬编码颜色替换为 token 引用
Step 4: 保持现有 token 名不变，确保不破坏已有引用
Step 5: 新增 wrapper 内部使用 --cbg-theme-* token
```

两套 token 共存规则：

```text
--bg / --primary / --card-bg 等旧 token：保持兼容，逐步替换
--cbg-theme-* 新 token：wrapper 与新 UI 系统使用
```

优先策略：

```text
如果 app/globals.css 已有高覆盖率 ui-* 语义系统：
  直接重构 app/globals.css 中现有 token 和 ui-* 规则。

如果 app/globals.css 无法安全 patch：
  新增 app/animal-island-theme.css 隔离覆盖层，并在 body 添加 cbg-animal-theme。
```

禁止：

```text
新增裸 button/input/select/textarea/main 全局规则
新增 [class*="..."] 穿透规则
修改 .heat-cell-* 颜色、尺寸、display、grid、gap、width、height
修改 .heat-legend-* 颜色、尺寸
修改弹窗 position/z-index/display/overflow
使用 --animal-* 假装官方 token
使用过宽泛 --theme-*
删除现有 --bg / --primary 等旧 token
覆盖 body font-family，除非用户开始前明确要求保留原字体
```

推荐 token（追加到现有 :root）：

```css
:root {
  /* === animal-island-ui aligned tokens === */
  --cbg-theme-bg: #f8f3df;
  --cbg-theme-bg-soft: #fff8e8;
  --cbg-theme-card: #fffaf0;
  --cbg-theme-card-strong: #fff1cf;

  --cbg-theme-text: #6f4f2a;
  --cbg-theme-text-body: #725d42;
  --cbg-theme-text-muted: #a58b63;

  --cbg-theme-primary: #ff8aa8;
  --cbg-theme-primary-hover: #ff9eb7;
  --cbg-theme-primary-active: #ff6b93;
  --cbg-theme-primary-dark: #d94e73;

  --cbg-theme-secondary: #fff8e8;
  --cbg-theme-border: #ead5a8;
  --cbg-theme-border-strong: #d7b879;
  --cbg-theme-focus: #f5c31c;

  --cbg-theme-shadow-soft: rgba(121, 79, 39, 0.1);
  --cbg-theme-shadow: rgba(121, 79, 39, 0.18);

  --cbg-theme-radius-md: 18px;
  --cbg-theme-radius-lg: 24px;
  --cbg-theme-radius-xl: 32px;
  --cbg-theme-radius-pill: 999px;
}
```

### Animation Class Preservation

动画 class 不参与迁移：

```text
animate-card-breathe 等 animate-* 属于视觉增强，不是语义 UI class
不映射到 wrapper variant
业务页面迁移后，动画 class 作为 className 透传保留
wrapper 不吞掉动画 class
```

示例：

```tsx
// before
<section className="ui-card ui-card-main animate-card-breathe sm:p-5">

// after
<AppCard variant="main" className="animate-card-breathe sm:p-5">
```

### CSS Safety Checks

只检查本次 CSS diff。

旧的 `app/globals.css` 里已经存在的 `.heat-cell-*`、`.heat-legend-*` 不算违规。

本次新增 CSS 不得新增：

```text
heat-cell
heat-legend
[class*="heat"]
PlayerHeatmap
HeatmapCell
HeatmapLegend
```

本次修改 CSS 不得改变已有 heatmap 相关规则的：

```text
颜色
尺寸
display
grid
grid-template
gap
width
height
cell size
level color
```

如果 diff 中出现 heatmap 相关 CSS：

```text
除非只是文档审计或明确的外层容器视觉说明，否则回退当前 Phase。
```

### Phase 1 Verification

运行：

```bash
git diff --name-only
git diff --stat
npm run build
npm run lint
npm run test
```

失败则按 allowlist rollback Phase 1。

---

## Phase 2: UI Wrapper Foundation

目标：建立项目统一 UI 入口。

Wrapper 必须优先封装 `animal-island-ui` 官方组件。只有官方组件无法安全承载当前行为时，才允许 fallback 原生 DOM，并必须记录例外。

### Phase 2 Allowlist

允许新增或修改：

```text
components/ui/AppButton.tsx
components/ui/AppButtonLink.tsx
components/ui/AppCard.tsx
components/ui/AppInput.tsx
components/ui/AppTextarea.tsx
components/ui/AppSelect.tsx
components/ui/AppDialog.tsx
components/ui/AppToast.tsx
components/ui/index.ts
docs/ui-component-contract.md
docs/ui-wrapper-migration-plan.md
docs/ui-migration-report.md
docs/.ui-migration-checkpoints/**
```

如果 `components/ui/**` 已存在：

```text
先审计已有实现
不要盲目覆盖
优先兼容已有导出
如已有 wrapper 质量可用，改造它们而不是重复创建
```

## Phase 2 Wrapper Strategy

```text
AppButton:     优先封装 animal-island-ui Button
AppButtonLink: 渲染 <a> 标签，应用与 AppButton 一致的视觉样式
AppCard:       优先封装 animal-island-ui Card
AppInput:      优先封装 animal-island-ui Input，支持 suffix/prefix
AppTextarea:   如果官方没有 Textarea，使用原生 textarea 作为 non-blocking structural fallback
AppSelect:     如果当前 select 可安全映射 controlled Select，则优先封装 official Select，否则 fallback 原生 select 并登记
AppDialog:     优先封装 animal-island-ui Modal
AppToast:      使用原生 div 结构，不映射到 Modal/Dialog
```

如果 fallback 原生 DOM，必须在：

```text
docs/ui-wrapper-migration-plan.md
```

记录：

```text
component:
reason:
official component limitation:
fallback classification: blocking / non-blocking structural
future removal plan:
does it block Full Success:
```

## Fallback Classification

Fallback to native DOM inside wrappers is classified as either blocking or non-blocking.

### Non-blocking Structural Fallback

满足全部条件时，不阻止 Full Success：

```text
业务页面已经使用 AppButton / AppButtonLink / AppCard / AppInput / AppTextarea / AppSelect / AppDialog / AppToast
fallback 只发生在 components/ui/**
fallback 存在的原因是官方 animal-island-ui 组件无法安全保留语义 HTML、布局、ref、或当前弹窗行为
wrapper 仍然使用项目 theme contract 和 animal-island-ui 视觉语言
fallback 已经记录在 docs/ui-wrapper-migration-plan.md
```

例子：

```text
官方 Modal 不适合 bottom sheet → AppDialogShell
官方 Button 不适合导航壳，但 AppButton 仍统一对外 API
官方 Input 不适合 file input → 登记 exception
官方没有 Textarea → AppTextarea 使用原生 textarea
原生 select 依赖 uncontrolled 行为 → AppSelect fallback
官方 Checkbox 是 options-based → 单个 boolean checkbox 保留原生 DOM
官方 Select 不接受 className → 外层包裹 div 实现样式
```

### Blocking Fallback

以下情况阻止 Full Success：

```text
业务页面保留原生 button/input/textarea/select/card/dialog 用法
业务页面保留旧视觉 class 且未迁移 wrapper
wrapper 没有提供一致视觉或 API 行为
fallback 未登记
```

## Wrapper Ref Rules

`AppButton`、`AppButtonLink`、`AppInput`、`AppTextarea`、`AppSelect`、`AppCard` 必须使用 `React.forwardRef`。

Required refs：

```text
AppButton:     HTMLButtonElement
AppButtonLink: HTMLAnchorElement
AppInput:      HTMLInputElement
AppTextarea:   HTMLTextAreaElement
AppSelect:     HTMLSelectElement unless backed by official Select without DOM ref support
AppCard v1:    HTMLDivElement
```

`AppCard v1` 默认只渲染 `div`，以避免 polymorphic `as` 与 `forwardRef<HTMLDivElement>` 类型不匹配。

如果需要 `section` / `article` 语义：

```text
优先登记为 non-blocking structural fallback
不要在 v1 中实现复杂 polymorphic ref
后续可单独升级 AppCard polymorphic API
```

如果官方 animal-island-ui 组件不支持 ref 或 ref 类型不匹配：

```text
优先在 wrapper 内安全适配
无法适配时记录为 fallback reason
不要让业务页面直接依赖官方组件 ref
```

## Next.js Client Boundary Rule

迁移文件到 wrapper 前，必须判断目标文件是否已经是 client component。

如果目标文件满足任一条件：

```text
已有 "use client"
使用 event handlers
使用 state
使用 effects
使用 browser APIs
```

则允许迁移到可能需要 client 行为的 wrapper。

如果目标文件是 Server Component：

```text
不要为了 UI 迁移给 broad root/layout/page 文件添加 "use client"
不要引入会强制 client-only 的 wrapper，除非边界行为明确安全
优先使用 className-only 迁移或登记例外
```

Wrapper 文件如果使用 animal-island-ui 交互组件，可以添加：

```tsx
"use client";
```

但不要把 `"use client"` 向上扩散到大范围页面根组件，除非项目本来就是 client 组件。

## AppButton Contract

`AppButton` 必须支持：

```ts
type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "nav";
type AppButtonSize = "sm" | "md" | "lg";

type AppButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  htmlType?: "button" | "submit" | "reset";
  loading?: boolean;
  fullWidth?: boolean;
};
```

实现要求：

```text
必须使用 React.forwardRef<HTMLButtonElement, AppButtonProps>
默认 htmlType="button"
原生 <button type="submit"> 必须变成 htmlType="submit"
没写 type 的按钮默认 htmlType="button"
保留 onClick
保留 disabled
loading 时 disabled
保留 aria-*
保留 data-*
不改变 children
合并 className
不吞掉 ref
```

官方 Button 映射：

```text
primary   -> <Button type="primary">
secondary -> <Button type="default">
ghost     -> <Button type="text">
danger    -> <Button type="primary" danger>
nav       -> 若官方 Button 可承载则 Button type="default"，否则 fallback 原生 DOM 并登记
```

如果 fallback 到原生 DOM：

```tsx
<button type={htmlType} />
```

不得使用：

```tsx
<button type={variant} />
```

`AppButton` 内部可以保留项目视觉 class，但业务页面迁移后不得继续裸用旧按钮 class。

## AppButtonLink Contract

`AppButtonLink` 处理 `<a>` 标签按钮场景。

```ts
type AppButtonLinkVariant = "primary" | "secondary" | "ghost";
type AppButtonSize = "sm" | "md" | "lg";

type AppButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: AppButtonLinkVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
};
```

实现要求：

```text
必须使用 React.forwardRef<HTMLAnchorElement, AppButtonLinkProps>
渲染 <a> 标签，不是 <button>
保留 href / download / target / rel 等原生 a 属性
应用与 AppButton 一致的视觉 class
不吞掉 ref
```

设计理由：

```text
<a download> 触发浏览器下载，<button> 无法替代
<a target="_blank"> 在新标签页打开，<button> 可以模拟但语义不准确
```

映射：

```text
<a className="ui-button-primary ...">   -> <AppButtonLink variant="primary">
<a className="ui-button-secondary ..."> -> <AppButtonLink variant="secondary">
```

## AppCard Contract

`AppCard v1` 必须支持：

```ts
type AppCardVariant =
  | "default"
  | "soft"
  | "hero"
  | "main"
  | "compact"
  | "item"
  | "panel";

type AppCardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AppCardVariant;
};
```

实现要求：

```text
必须使用 React.forwardRef<HTMLDivElement, AppCardProps>
默认渲染 div
优先封装官方 Card
保留 children
保留 className，特别是 animate-* class
保留 aria-*
保留 data-*
不吞掉 ref
```

### AppCard Official Mapping

AppCard variant 到 animal-island-ui Card 的映射：

```text
default -> <Card type="default">
soft    -> <Card type="default" className="app-card-soft">
main    -> <Card type="default" className="app-card-main">
compact -> <Card type="default" className="app-card-compact">
item    -> <Card type="default" className="app-card-item">
panel   -> <Card type="default" className="app-card-panel">
hero    -> <Card type="title" className="app-card-hero"> if visually appropriate, otherwise default + className
```

不得把 AppCard variant 直接传给官方 Card type。

错误示例：

```tsx
<Card type="soft" />
<Card type="hero" />
<Card type="main" />
```

如果语义必须是 `section` / `article`：

```text
不要在 v1 中强行 polymorphic as
登记为 non-blocking structural fallback 或后续 AppCard v2 工作
```

如果官方 Card 无法承载布局语义：

```text
可以 fallback 原生 div
必须登记 fallback classification
如果 fallback 只在 wrapper 内且页面已迁移到 AppCard，可判定为 non-blocking structural fallback
```

## AppInput Contract

`AppInput` 必须支持：

```ts
type AppInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  inputSize?: "sm" | "md" | "lg";
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  allowClear?: boolean;
  status?: "error" | "warning";
};
```

实现要求：

```text
必须使用 React.forwardRef<HTMLInputElement, AppInputProps>
优先封装官方 Input
保留 value
保留 defaultValue
保留 onChange
保留 type
保留 name
保留 placeholder
保留 disabled
保留 required
保留 min/max/step
保留 inputMode
保留 pattern
保留 aria-*
保留 data-*
保留 controlled / uncontrolled 模式
不吞掉 ref
prefix / suffix 透传给官方 Input
```

官方 Input size 映射：

```text
sm -> small
md -> middle
lg -> large
```

### Special Input Type Exceptions

以下 type 必须登记例外，不强制迁移到 AppInput：

```text
type="file"     -> 隐藏文件选择输入，AppInput 无法替代
type="checkbox" -> 官方 Checkbox 是 options-based 多选组件，不适合单个 boolean checkbox
type="date"     -> 依赖浏览器原生日期选择器
type="datetime-local" -> 依赖浏览器原生日期时间选择器
```

`type="password"` 可安全迁移到：

```tsx
<AppInput type="password" />
```

### Compound Input Pattern

CompactField 模式：

```tsx
<div className="compact-field-input">
  <input ... />
  {unit ? <span>{unit}</span> : null}
</div>
```

优先迁移为：

```tsx
<AppInput inputSize="sm" suffix={<span>{unit}</span>} className="compact-field-input" />
```

如果 suffix 无法满足样式：

```text
保留外层 div 结构
内部 input 替换为 AppInput
登记为 compound pattern preserved
```

## AppTextarea Contract

如果 animal-island-ui 当前安装包没有明确 Textarea 组件，`AppTextarea` 可以使用原生 `textarea` 作为 non-blocking structural fallback。

`AppTextarea` 必须支持：

```ts
type AppTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  inputSize?: "sm" | "md" | "lg";
};
```

实现要求：

```text
必须使用 React.forwardRef<HTMLTextAreaElement, AppTextareaProps>
保留 value/defaultValue/onChange/name/placeholder/disabled/required/rows/maxLength/aria-*/data-*
保留 controlled / uncontrolled 模式
使用项目统一输入视觉 class
业务页面迁移到 AppTextarea 后，不算原生 textarea 残留
记录为 non-blocking structural fallback
```

## AppSelect Contract

如果当前 select 是 controlled 且可安全映射到 animal-island-ui Select：

```text
优先封装官方 Select
API 以 dist/types/index.d.ts 为准
不得臆造 props
注意：官方 Select 可能不接受 className / style，以当前 types 为准
```

如果当前 select 依赖原生行为、uncontrolled、或 option 结构复杂：

```text
AppSelect 可以 fallback 原生 select
必须使用 React.forwardRef<HTMLSelectElement>
保留 value/defaultValue/onChange/name/disabled/required/aria-*/data-*
保留 children / option 结构
记录 fallback classification
```

`AppSelect` 必须支持：

```ts
type AppSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  inputSize?: "sm" | "md" | "lg";
};
```

业务页面迁移到 AppSelect 后，不算原生 select 残留。

## AppDialog Contract

优先封装官方 `Modal`，但不得破坏现有弹窗行为。

允许两类 wrapper：

```text
AppModal: 封装 animal-island-ui Modal，用于普通确认弹窗
AppDialogShell/Header/Body/Footer: 结构 wrapper，用于 bottom sheet、复杂自定义弹层
```

## AppToast Contract

`AppToast` 处理所有 toast / snackbar 通知。Toast 不是 dialog，不得映射到 AppModal 或 AppDialog。

```ts
type AppToastProps = {
  open: boolean;
  children: React.ReactNode;
  variant?: "default" | "error";
  className?: string;
};
```

实现要求：

```text
使用原生 div + role="status"
建议使用 aria-live="polite"
不映射到 Modal / Dialog
不接管业务状态
不接管计时逻辑
不改变 toast 出现/消失行为
保留当前 toast 的 fixed bottom 定位
保留当前 toast 的动画/过渡
记录为 non-blocking structural fallback
```

### Toast vs Dialog Rule

```text
role="status"     -> Toast，使用 AppToast
role="dialog"     -> Dialog，使用 AppModal 或 AppDialogShell
aria-modal="true" -> Modal Dialog
没有 role 的弹层：
  可交互且有确认/取消 -> Dialog
  只展示消息 -> Toast
```

当前若 toast 使用 `ui-dialog` class：

```text
迁移时改为 AppToast + 正确 toast class
不算 ui-dialog 残留，而是正确重新分类
```

## AppModal Contract

`AppModal` 必须支持：

```ts
type AppModalProps = {
  open: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode | null;
  onClose: () => void;
  onOk?: () => void;
  width?: number | string;
  className?: string;
};
```

实现要求：

```text
优先封装 animal-island-ui Modal
必须传入 open
必须保留 onClose
不自动新增 onOk 行为
不改变确认按钮原有 onClick / disabled / loading 逻辑
如果原弹窗没有 typewriter 效果，默认传 typewriter={false}
复杂弹窗不要强行迁移到 AppModal，改用 AppDialogShell/Header/Body/Footer
```

禁止 wrapper 接管：

```text
open/close 状态
portal
focus trap
z-index
backdrop click
Esc close
overflow 策略
```

对于复杂弹层：

```text
只迁移内部结构和视觉入口
不替换弹窗行为控制
fallback 可作为 non-blocking structural fallback，但必须登记
```

## components/ui/index.ts

如果项目风格允许 barrel export，可新增：

```ts
export { AppButton } from "./AppButton";
export { AppButtonLink } from "./AppButtonLink";
export { AppCard } from "./AppCard";
export { AppInput } from "./AppInput";
export { AppTextarea } from "./AppTextarea";
export { AppSelect } from "./AppSelect";
export {
  AppModal,
  AppDialogShell,
  AppDialogHeader,
  AppDialogBody,
  AppDialogFooter,
} from "./AppDialog";
export { AppToast } from "./AppToast";
```

如果项目不使用 barrel export，则不要强制新增。

## Phase 2 Verification

运行：

```bash
npm run build
npm run lint
npm run test
```

验证：

```text
build 不比 baseline 更差
lint 不比 baseline 更差
test 不比 baseline 更差
components/ui/** 不含业务逻辑
components/ui/** 不引用 store/service/rules
不修改业务页面
wrapper props 类型合理
不臆造 animal-island-ui props
forwardRef 存在
fallback 已登记
```

失败则按 allowlist rollback Phase 2，保留 Phase 1 稳定成果。

---

## Phase 3: Full Page Migration to Wrappers

目标：迁移所有页面、所有按钮、所有链接按钮、所有可安全迁移的卡片、输入框、textarea、select、弹窗结构、toast。

### Phase 3 Allowlist

允许修改：

```text
components/home/**/*.tsx
app/**/*.tsx
docs/ui-wrapper-migration-plan.md
docs/ui-migration-report.md
docs/.ui-migration-checkpoints/**
```

`app/**/*.tsx` 限制：

```text
仅限 Phase 0 审计确认存在真实 UI 元素的文件
不得修改 metadata
不得修改 provider 挂载结构
不得修改 layout/html/body 结构，除非 Phase 1 已明确允许
不得为了迁移扩大 "use client" 边界
```

`app/layout.tsx` 规则：

```text
app/layout.tsx only belongs to Phase 1, not Phase 3,
unless residual scan proves it contains migratable UI and the change does not affect html/body/provider structure.
```

禁止修改：

```text
lib/home/**
app/api/**
tests/**
package.json
package-lock.json
```

## Phase 3 Batch Order

必须按批次迁移，每个批次失败只回退该批次。

```text
Batch 1:  静态卡片与展示容器 -> AppCard
Batch 2:  低风险普通按钮 -> AppButton
Batch 3:  <a> 链接按钮 -> AppButtonLink
Batch 4:  表单、弹窗、确认、兑换、导入导出按钮 -> AppButton
Batch 5:  低风险 input -> AppInput（排除 file/checkbox/date/datetime-local）
Batch 6:  textarea -> AppTextarea
Batch 7:  select -> AppSelect
Batch 8:  普通确认弹窗 -> AppModal
Batch 9:  toast 重新分类 -> AppToast
Batch 10: bottom sheet / 复杂弹层内部结构 -> AppDialogShell/Header/Body/Footer
Batch 11: 底部导航、子页返回、模块入口 -> AppButton 或登记例外
```

## Batch Verification Strategy

为避免积压大量错误，每迁移 3 个文件后执行：

```bash
npm run lint
npm run build
```

如果 lint 或 build 失败：

```text
只回退本次 3 个文件的改动
继续处理该批次中剩余文件
将失败文件标记为 skipped 并记录原因
```

每个批次结束后运行完整测试：

```bash
npm run test
```

## Button Migration Hard Gate

所有语义按钮必须迁移到 `AppButton`。

包括：

```text
ui-button-primary
ui-button-secondary
ui-button-ghost
ui-button-danger
ui-nav-button
app-nav-item
nest-subpage-back
```

layout-sensitive 只能保留外部布局 class，不得保留原生 `<button>`。

不能迁移时必须写入 exception list，并导致最终结果不能是 Full Success，除非证明该元素不是语义 button。

## Link Button Migration

所有带 `ui-button-*` class 的 `<a>` 标签必须迁移到 `AppButtonLink`。

```text
<a className="ui-button-primary ...">   -> <AppButtonLink variant="primary">
<a className="ui-button-secondary ..."> -> <AppButtonLink variant="secondary">
```

不能迁移时必须写入 exception list。

## app-nav-item Migration Guide

底部导航按钮使用 `app-nav-item` class，active 状态由父组件状态控制。

迁移方案：

```tsx
<AppButton
  variant="nav"
  onClick={() => setActiveTab("today")}
  className={`app-nav-item flex-1 py-2.5 text-sm font-semibold transition ${
    activeTab === "today"
      ? "app-nav-item--active ui-text-primary"
      : "ui-text-muted"
  }`}
>
  <span className="flex flex-col items-center gap-0.5">
    <span className="text-base" aria-hidden>📅</span>
    <span className="text-[11px]">今日</span>
  </span>
</AppButton>
```

关键点：

```text
保留 app-nav-item class
保留 app-nav-item--active class
保留动态 className 切换逻辑
保留 onClick 行为
保留 children 结构
```

## nest-subpage-back Exception

`nest-subpage-back` 按钮具有独特视觉：

```css
background: none;
border: none;
padding: 0;
```

处理方案：

```text
优先尝试 AppButton variant="ghost"
如果视觉差异过大，登记为 non-blocking structural fallback exception
原因：纯文字返回按钮需要零背景/零边框
```

## Business Page ClassName Rules After Button Migration

迁移业务页面元素到 `AppButton` / `AppButtonLink` 后：

```text
业务页面不得继续保留旧视觉语义 class：
- ui-button-primary
- ui-button-secondary
- ui-button-ghost
- ui-button-danger
```

布局类和动画类可以保留，例如：

```text
flex
w-full
grid
gap-*
px-*
py-*
text-*
animate-card-breathe
其他 animate-*
自定义 layout-only class
app-nav-item
app-nav-item--active
```

如果必须保留旧视觉 class：

```text
必须写入 exception list
未登记旧视觉 class 残留会阻止 Full Success
```

`components/ui/**` wrapper 内部可以使用旧视觉 class 或新主题 class，不算业务页面残留，但必须在 wrapper contract 中说明。

## Business Page ClassName Rules After Card/Input/Dialog Migration

迁移业务页面元素到 `AppCard` / `AppInput` / `AppTextarea` / `AppSelect` / `AppModal` / `AppDialog` / `AppToast` 后：

业务页面不得继续保留旧视觉语义 class：

```text
ui-card
ui-card-soft
ui-card-hero
ui-card-main
ui-card-compact
ui-card-item
ui-soft-panel
ui-input
compact-field-input
ui-sheet
ui-dialog
ui-modal-header
ui-modal-body
ui-modal-footer
```

如果必须保留旧视觉 class：

```text
必须写入 exception list
未登记残留阻止 Full Success
```

例外：

```text
toast 元素当前若使用 ui-dialog class，迁移到 AppToast 后移除 ui-dialog。
这不视为 ui-dialog 残留，而是正确重新分类。
```

## Mapping

按钮：

```text
ui-button-primary   -> <AppButton variant="primary">
ui-button-secondary -> <AppButton variant="secondary">
ui-button-ghost     -> <AppButton variant="ghost">
ui-button-danger    -> <AppButton variant="danger">
ui-nav-button       -> <AppButton variant="nav">
app-nav-item        -> <AppButton variant="nav">
nest-subpage-back   -> <AppButton variant="ghost"> or exception
```

链接按钮：

```text
<a> + ui-button-primary   -> <AppButtonLink variant="primary">
<a> + ui-button-secondary -> <AppButtonLink variant="secondary">
```

卡片：

```text
ui-card          -> <AppCard variant="default">
ui-card-soft     -> <AppCard variant="soft">
ui-card-hero     -> <AppCard variant="hero">
ui-card-main     -> <AppCard variant="main">
ui-card-compact  -> <AppCard variant="compact">
ui-card-item     -> <AppCard variant="item">
ui-soft-panel    -> <AppCard variant="panel">
```

输入：

```text
ui-input            -> <AppInput>
compact-field-input -> <AppInput inputSize="sm"> + suffix prop or compound pattern
textarea            -> <AppTextarea>
select              -> <AppSelect>
```

弹窗 / toast：

```text
simple confirm dialog -> <AppModal>
ui-sheet complex panel -> AppDialogShell structure wrapper
role="status" toast   -> <AppToast>
ui-dialog toast-like  -> <AppToast>
```

## Per-file Checks

每个文件迁移后检查 diff。

如果出现以下变化，立即回退该文件：

```text
onClick body changed
onChange body changed
onSubmit body changed
useState changed
useEffect changed
business condition changed
data mapping changed
key changed
disabled condition changed
input controlled/uncontrolled mode changed
store/service/rules import changed
heatmap component changed
test changed
metadata changed
provider structure changed
href changed
download attribute changed
target/rel changed
```

每 3 个文件后运行：

```bash
npm run lint
npm run build
```

每个批次后运行：

```bash
npm run test
```

如果失败：

```text
回退当前文件或当前批次
保留之前已通过批次
记录未迁移原因
继续后续安全批次
```

---

## Phase 4: Residual Scan + Verification

### Phase 4 Allowlist

Phase 4 只允许修改：

```text
docs/ui-wrapper-migration-plan.md
docs/ui-migration-report.md
docs/.ui-migration-checkpoints/**
```

不得修改代码，除非 residual scan 发现可安全继续迁移的残留项，并自动回到 Phase 3 对应批次。

## Residual Scan Scope

Residual scan checks business/page usage only.

必须排除 wrapper 实现层：

```bash
# 原生 button
rg -n "<button|</button>" app components --glob '!components/ui/**'

# 原生 input/textarea/select
rg -n "<input|<textarea|<select" app components --glob '!components/ui/**'

# 旧按钮 class
rg -n "ui-button-primary|ui-button-secondary|ui-button-ghost|ui-button-danger|ui-nav-button|app-nav-item|nest-subpage-back" app components --glob '!components/ui/**'

# 旧卡片/输入/弹窗 class
rg -n "ui-card|ui-card-soft|ui-card-hero|ui-card-main|ui-card-compact|ui-card-item|ui-soft-panel|ui-sheet|ui-dialog|ui-input|compact-field-input|ui-modal-header|ui-modal-body|ui-modal-footer" app components --glob '!components/ui/**'

# <a> 标签按钮残留
rg -n "<a\s.*className.*ui-button" app components --glob '!components/ui/**'
```

`components/ui/**` 是 wrapper 实现层。

Wrapper 内部如使用原生 DOM 或语义 class，不算业务页面残留，但必须记录在 wrapper contract 中。

## rg Exit Code Rule

Residual scan 中：

```text
rg exit code 0 = 找到匹配，需要判断是否为已登记例外
rg exit code 1 = 没有匹配项，这是通过状态，不是命令失败
rg exit code >1 = rg 命令错误，需要处理
```

不要把“没有匹配项”误判成失败。

## Residual Scan Rules

扫描规则：

```text
未登记例外的原生 <button> 不允许残留
未登记例外的按钮类裸用不允许残留
未登记例外的低风险 input/textarea/select 不允许残留
未登记例外的 <a> 链接按钮不允许残留
未登记例外的可迁移 card/dialog 裸用不允许残留
已登记的 toast（正确重新分类为 AppToast）不视为 ui-dialog 残留
```

如果有残留：

```text
可以继续迁移则继续迁移
不可安全迁移则写入 exception list
有阻断性例外时最终不能是 Full Success
```

Exception list 必须写入：

```text
docs/ui-wrapper-migration-plan.md
docs/ui-migration-report.md
```

## Build / Lint / Test

运行：

```bash
npm run build
npm run lint
npm run test
```

结果不得比 baseline 更差。

## Visual Verification

必须尝试启动 dev server：

```bash
npm run dev
```

必须尝试用浏览器或 Playwright 截图验证：

```text
Desktop: 1280x900
Mobile: 390x844
```

最低页面 / 状态：

```text
今日页
地图页
商店页
小窝页
今日记录弹窗
数据管理弹窗
确认弹窗
移动端底部导航
```

## Smoke Test Checklist

除截图外，必须验证交互功能：

```text
[ ] 底部导航点击切换 tab
[ ] “记录昨日”按钮可以打开记录弹窗
[ ] 记录弹窗可以填写数据并保存
[ ] 保存后 toast 通知出现并自动消失
[ ] 数据管理弹窗可以打开/关闭
[ ] 导出 JSON 按钮可以触发下载
[ ] 导入 JSON 按钮可以打开文件选择器
[ ] 兑换商店可以浏览商品
[ ] 兑换按钮可以打开兑换确认弹窗
[ ] 小窝页子导航可以切换
[ ] 小窝页返回按钮可以回到主页
[ ] 热力图月份切换正常
[ ] 热力图格子颜色和角标仍然显示
[ ] 移动端无横向溢出
[ ] 弹窗不溢出视口
[ ] 底部导航不遮挡关键按钮
```

检查项：

```text
页面非空
按钮统一为 animal-island-ui backed AppButton / AppButtonLink
卡片统一
输入框统一
textarea/select 统一或已登记例外
toast 与 dialog 正确区分
弹窗不溢出视口
底部导航不遮挡关键按钮
热力图格子仍可见
移动端无明显横向溢出
文字无明显重叠
```

截图失败时不能写 Full Success，只能写：

```text
Partial Success: automated visual screenshot verification unavailable.
```

冒烟测试如果有任何一项失败：

```text
对应组件必须回退到迁移前状态，或登记为 blocking exception。
```

---

## Phase 5: Documentation + Rollback Report

### Phase 5 Allowlist

Phase 5 只允许新增或修改：

```text
docs/ui-migration-audit.md
docs/ui-theme-adapter.md
docs/ui-component-contract.md
docs/ui-wrapper-migration-plan.md
docs/ui-rollback-guide.md
docs/ui-migration-report.md
docs/.ui-migration-checkpoints/**
```

必须生成或更新：

```text
docs/ui-migration-audit.md
docs/ui-theme-adapter.md
docs/ui-component-contract.md
docs/ui-wrapper-migration-plan.md
docs/ui-rollback-guide.md
docs/ui-migration-report.md
```

## docs/ui-theme-adapter.md

必须包含：

```md
# UI Theme Adapter

## Design Goal

## Design Decision Record

Explain:
- 为什么采用 pink/orange 作为主行动色，而不是 animal-island-ui 默认薄荷青。
- 为什么迁移目标是 animal-island-ui backed，而不是 inspired only。
- 为什么保留当前页面信息架构。
- 为什么热力图颜色不跟随主题整体重绘。
- 为什么 wrapper 优先封装官方组件。
- 哪些场景允许 non-blocking structural fallback。
- 为什么选择接受/拒绝 animal-island-ui 字体系统。

## Font Strategy

## Token System

| Token | Value | Purpose |
|---|---|---|

## Legacy Token Mapping

| Old Token | New Token | Notes |
|---|---|---|

## Selector Strategy
## Button Styles
## ButtonLink Styles
## Card Styles
## Input Styles
## Textarea Styles
## Select Styles
## Dialog Styles
## Toast Styles
## Heatmap Protection
## Animation Class Preservation
## Compound Input Patterns
## Relationship with animal-island-ui
```

## docs/ui-component-contract.md

必须包含：

```md
# UI Component Contract

## AppButton API
## AppButtonLink API
## AppCard API
## AppInput API
## AppTextarea API
## AppSelect API
## AppModal API
## AppDialog Structure API
## AppToast API
## Variant Mapping

## Ref Support

| Wrapper | Ref Type | Required |
|---|---|---|

## Special Input Type Exceptions

| Type | Handler | Status |
|---|---|---|

## Fallback Rules
## Blocking vs Non-blocking Fallback
## Forbidden Usage
```

## docs/ui-wrapper-migration-plan.md

必须包含：

```md
# UI Wrapper Migration Plan

## Wrapper Components

## Migration Batches

| Batch | Scope | Status | Verification |
|---|---|---|---|

## Completed Files

| File | Migrated Elements | Verification |
|---|---|---|

## Skipped Files

| File | Reason | Blocks Full Success |
|---|---|---|

## Exception List

| File | Element | Reason | Fallback Type | Blocks Full Success |
|---|---|---|---|---|

## Residual Scan Results

| Command | Result | Notes |
|---|---|---|

## Remaining Gaps

## Optional Enhancements

| Component | Priority | Effort | Recommended |
|---|---|---|---|
```

## docs/ui-rollback-guide.md

必须包含：

```md
# UI Migration Rollback Guide

## Diff Checkpoints

| Checkpoint File | Phase | Created At | Status |
|---|---|---|---|

## Rollback Phase -1
## Rollback Phase 0
## Rollback Phase 1
## Rollback Phase 2
## Rollback Phase 3 Batch
## Rollback Residual Migration
## Verification After Rollback
## Files That Must Not Be Reverted
## How to Recover from Interrupted Migration
```

## docs/ui-migration-report.md

必须包含：

```md
# UI Migration Report

## Result

Full Success / Partial Success / Docs-only Exit / Rolled Back

## Branch Safety
## Baseline Verification
## Final Verification
## Phases Completed
## Files Changed
## Wrapper Summary
## Page Migration Summary
## Residual Scan Results
## Exception List
## Heatmap Safety
## Animation Class Preservation
## Font Strategy
## Smoke Test Results
## Visual Verification
## Rollback Instructions
## Known Limitations
```

---

## Success Levels

## Full Success

只有全部满足才能写 Full Success：

```text
Phase -1 校验通过
Phase 0 审计完成
Phase 1 视觉迁移完成
Phase 2 wrapper 建立完成
Phase 3 所有审计到且可安全迁移的 UI 元素完成迁移
所有未迁移元素均进入 exception list
所有语义按钮迁移到 AppButton
所有 <a> 链接按钮迁移到 AppButtonLink
所有 toast 重新分类为 AppToast
无未登记原生 <button> 残留
无未登记 ui-button-* 裸用残留
无未登记 <a> 链接按钮残留
所有可安全迁移 input/textarea/select/card/dialog 已迁移
残留项全部登记且不阻断目标
blocking fallback 为 0
build/lint/test 不比 baseline 更差
冒烟测试全部通过
桌面和移动端截图验证完成
业务逻辑未修改
热力图语义未修改
文档完整生成
没有自动 commit
没有自动 push
```

## Partial Success

以下情况只能写 Partial Success：

```text
截图验证未完成
冒烟测试有未通过项
存在未迁移但已登记的阻断性例外
Phase 3 只完成部分批次
业务页面仍有已登记但阻断 Full Success 的原生 DOM 残留
官方 animal-island-ui 组件无法承载部分 wrapper，且 fallback 被判定为 blocking
animal-island-ui types 缺失导致只能创建 temporary native wrappers
```

注意：

```text
non-blocking structural fallback 不会单独阻止 Full Success。
```

## Docs-only Exit

未修改代码，只完成审计和方案。

## Rolled Back

尝试过代码修改，但失败阶段或批次已回退。

---

## Rollback Rules

### Default Rollback

默认使用 allowlist rollback：

```text
只处理当前失败 Phase / batch 的 allowlist 文件
只删除当前 Phase 新增的文件
只回退当前 Phase 修改的文件
不使用 git restore .
不使用 git reset --hard
不回退更早已通过 Phase
```

### Rollback Phase 1

如果 Phase 1 修改 `app/globals.css`：

```text
只回退本次 token 和 UI 语义规则改动
不要删除已有 heatmap CSS
不要 restore 整个 globals.css，除非确认没有用户其他改动
```

如果 Phase 1 新增 `app/animal-island-theme.css`：

```text
删除 app/animal-island-theme.css
移除 layout 中对应 import
移除 body 上的 cbg-animal-theme
保留 import "animal-island-ui/style"
```

### Rollback Phase 2

删除或回退本次新增/修改的：

```text
components/ui/AppButton.tsx
components/ui/AppButtonLink.tsx
components/ui/AppCard.tsx
components/ui/AppInput.tsx
components/ui/AppTextarea.tsx
components/ui/AppSelect.tsx
components/ui/AppDialog.tsx
components/ui/AppToast.tsx
components/ui/index.ts
```

如果 `components/ui/**` 迁移前已存在：

```text
不要删除整个目录
只回退本次变更
不要破坏用户已有 wrapper
```

### Rollback Phase 3

只回退当前文件或当前批次的 wrapper 替换。

要求：

```text
不回退 Phase 1
不回退 Phase 2，除非 wrapper 本身导致失败
不回退之前已通过批次
不使用 git restore .
```

### Rollback Docs

文档可以保留，因为它们记录失败原因和后续方案。

如果用户明确要求完全回退，再删除本次新增 docs。

---

## Final Response Format

最终中文输出：

```text
迁移执行结果：
- Full Success / Partial Success / Docs-only Exit / Rolled Back

完成阶段：
- Phase -1:
- Phase 0:
- Phase 1:
- Phase 2:
- Phase 3:
- Phase 4:
- Phase 5:

修改摘要：
- ...

修改文件：
- ...

验证结果：
- build:
- lint:
- test:
- smoke test:
- visual desktop:
- visual mobile:
- residual scan:

UI 统一结果：
- buttons:
- link buttons:
- cards:
- inputs:
- textareas:
- selects:
- dialogs:
- toasts:
- wrappers:
- exceptions:

字体策略：
- ...

是否修改业务逻辑：
- 否

是否触碰热力图：
- 否 / 仅审计 / 说明范围

分支安全：
- current branch:
- commit: none
- push: none

文档：
- docs/ui-migration-audit.md
- docs/ui-theme-adapter.md
- docs/ui-component-contract.md
- docs/ui-wrapper-migration-plan.md
- docs/ui-rollback-guide.md
- docs/ui-migration-report.md

回退方式：
- ...

下一步建议：
- ...
```

## Commit Rules

默认不 commit。

如果用户明确要求 commit，先展示：

```text
准备 commit，当前变更文件如下：
...
commit message:
feat(ui): migrate to animal island UI system
```

push 必须用户再次明确确认。

## Final Instruction

不要在 Phase 1 后停止。

如果 Phase 2 和 Phase 3 可以安全执行，必须继续推进，直到所有页面、所有按钮、所有链接按钮、所有可迁移 UI 元素都迁移完成或被登记为例外。

Full Success 不能有未登记残留。

Partial Success 必须明确列出未迁移原因和下一步。

Residual scan 必须排除 `components/ui/**`，因为那里是 wrapper 实现层。

`rg` exit code 1 在 residual scan 中表示没有匹配项，是通过状态。

不要默认使用 git stash push。

不要自动 commit。

不要自动 push。

## Appendix: animal-island-ui Component Migration Decision

实际可用组件以当前安装包 `dist/types/index.d.ts` 为准。以下是迁移决策模板：

| Component | Migration | Wrapper / Usage | Notes |
|---|---|---|---|
| Button | Yes | AppButton | Core |
| Input | Yes | AppInput | Core |
| Modal | Yes | AppModal / AppDialogShell | Core |
| Card | Yes | AppCard | Core |
| Select | Conditional | AppSelect | Controlled-only |
| Switch | Optional | Direct or wrapper later | For boolean switch |
| Checkbox | No by default | Keep native or evaluate | Options-based API |
| Tabs | Optional | Later enhancement | Manual tabs may remain |
| Collapse | Optional | Later enhancement | Rule explanation |
| Divider | Optional | Later enhancement | Decoration |
| Footer | Optional | Later enhancement | Decoration |
| Icon | Optional | Later enhancement | Emoji replacement |
| Typewriter | Optional | Later enhancement | Avoid in business modal by default |
| Cursor | Optional | Later enhancement | Global cursor |
| Time | Optional | Later enhancement | Decoration |
| Phone | Optional | Later enhancement | Decoration |
| CodeBlock | No | No current use |
| Loading | Optional | Later enhancement |
```