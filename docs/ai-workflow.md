# AI 协作开发流程

本文件说明本项目如何同时使用 Codex 和 Claude Code / DeepSeek 进行开发。

## 总原则

- DeepSeek / Claude Code：日常开发主力
- Codex：架构建议、复杂问题、最终 review
- DeepSeek 负责施工，Codex 负责监理
- 不要让两个 AI 同时修改同一批文件

## 必读规则

任何 AI 开始任务前，必须先阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. 与任务相关的 `docs/` 文档

## 日常开发流程

1. 用户描述 bug 或需求
2. Claude Code / DeepSeek 阅读规则和相关代码
3. Claude Code / DeepSeek 做最小修改
4. 运行必要检查
5. 用户查看 `git diff`
6. 关键改动交给 Codex review
7. 根据 Codex 意见再让 DeepSeek 做最小修复

## DeepSeek / Claude Code 适合做什么

- 小 bug 修复
- UI 样式调整
- 小功能实现
- 报错定位
- 补测试
- 补文档
- 根据 Codex review 意见做小范围修复

## Codex 适合做什么

- 架构评估
- 复杂 bug 分析
- 重构方案设计
- 合并前 review
- 检查是否破坏项目分层
- 检查 snapshot、store、legacy 兼容风险

## 开发前检查

```bash
git status
```

如果当前状态稳定，可以先做 checkpoint：

```bash
git add .
git commit -m "checkpoint before ai changes"
```

或新建分支：

```bash
git checkout -b ai-task-name
```

## 修改后检查

普通代码改动后建议运行：

```bash
npm run test
npm run lint
npm run build
```

只改文档时可以不运行，但需要说明原因。

## 日常修 bug 极简提示词

```text
请先阅读 AGENTS.md，然后按项目规则修复这个 bug。

现象：
【描述 bug】

期望：
【描述期望行为】

复现步骤：
【列步骤】

报错：
【粘贴报错，没有就写“暂无”】

要求：
- 做最小修改
- 改完说明修改文件和验证方式
```

## 小功能极简提示词

```text
请先阅读 AGENTS.md，然后按项目规则实现这个小功能。

功能：
【描述功能】

交互：
【描述交互】

数据影响：
【是否影响记录、钱包、热力图、导入导出、localStorage】

要求：
- 先判断影响范围
- 做最小修改
- 涉及规则或数据结构时补测试
- 改完说明修改文件和验证方式
```

## 报错修复极简提示词

```text
请先阅读 AGENTS.md，然后根据下面报错做最小修复。

命令：
【例如 npm run build】

报错：
【粘贴完整报错】

要求：
- 不要扩大修改范围
- 不要安装依赖，除非先说明原因
- 改完说明修改文件和验证方式
```

## Codex review 极简提示词

```text
请先阅读 AGENTS.md，然后 review 这次改动。

目标：
【这次改动想解决什么】

DeepSeek 修改摘要：
【粘贴摘要】

git diff：
【粘贴 diff】

请重点检查：
- 是否破坏项目分层
- 是否把业务逻辑塞回 UI 或 Provider
- 是否影响 AppDataStore / localStorage / snapshot / legacy 兼容
- 是否需要补测试
- 是否有更小更安全的修法
```

## 根据 Codex review 修复

```text
请先阅读 AGENTS.md，然后根据下面 Codex review 做最小修复。

Codex review：
【粘贴 review】

要求：
- 只修 review 指出的问题
- 不要顺手重构
- 改完说明修改文件和验证方式
```

## 提交前 Checklist

- [ ] 没有在 UI 组件里直接读写 `localStorage`
- [ ] 没有把业务规则写回 Provider
- [ ] 没有破坏 `AppDataStore` 抽象
- [ ] 没有混淆 source of truth 和 derived data
- [ ] 修改结算、钱包、store、snapshot 时已补测试
- [ ] 修改热力图日期时已补测试
- [ ] 修改导入导出时已补测试
- [ ] 已运行必要命令
- [ ] 已查看 `git diff`
- [ ] 关键改动已让 Codex review