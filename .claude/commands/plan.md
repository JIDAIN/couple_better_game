# Plan Change

请为用户描述的需求做实现方案评估，不要修改代码。

## 自动前置要求

开始前必须先阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. 与需求相关的 `docs/` 文档和源码

如果 `AGENTS.md` 或 `CLAUDE.md` 不存在，请先提醒用户。

## 工作方式

请只做分析和方案，不要修改代码。

需要评估：

1. 需求属于哪一层
2. 可能涉及哪些文件
3. 是否影响数据结构
4. 是否影响 `AppDataStore`
5. 是否影响 `localStorage`
6. 是否影响 snapshot / legacy 兼容
7. 是否需要补测试
8. 是否有破坏当前架构的风险
9. 最小安全实现路径是什么

## 项目边界

重点检查：

- 是否会把业务逻辑写回 UI
- 是否会让 `HomeResourcesProvider.tsx` 重新变胖
- 是否会破坏 `AppDataStore` 抽象
- 是否会混淆 source of truth 和 derived data

## 输出格式

请用中文输出：

1. 需求理解
2. 涉及层级
3. 涉及文件
4. 推荐实现方案
5. 测试建议
6. 风险点
7. 不建议做的事情

## 用户输入

$ARGUMENTS