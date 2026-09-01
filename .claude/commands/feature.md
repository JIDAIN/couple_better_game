# Implement Feature

请按本项目规则实现用户描述的小功能。

## 自动前置要求

开始前必须先阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. 与功能相关的 `docs/` 文档和源码

如果 `AGENTS.md` 或 `CLAUDE.md` 不存在，请先提醒用户。

## 影响范围判断

开始实现前，请先判断该功能是否涉及：

- UI 展示
- 用户交互
- `HomeResourcesProvider.tsx`
- `lib/home/` 业务规则
- 数据结构
- `AppDataStore`
- `localStorage`
- snapshot / legacy 兼容
- 热力图
- 兑换系统
- 导入导出
- 测试

如果影响超过 3 个主要文件，先给方案再修改。

## 项目边界

必须遵守：

- UI 只负责展示和交互
- 业务规则放在 `lib/home/`
- 不要在 UI 组件里直接读写 `localStorage`
- 不要把复杂业务逻辑塞回 `HomeResourcesProvider.tsx`
- 不要擅自安装依赖
- 不要执行 `git commit`
- 不要执行 `git push`

## 测试要求

如果功能涉及以下内容，必须补充或更新测试：

- 结算规则
- 钱包计算
- 数据结构
- store
- snapshot
- legacy 兼容
- 热力图日期
- 导入导出

## 输出格式

完成后用中文输出：

1. 实现摘要
2. 修改文件
3. 验证方式
4. 是否已运行测试、lint、build
5. 风险或未完成事项

## 用户输入

$ARGUMENTS