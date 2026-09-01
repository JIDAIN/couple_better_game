# Review Changes

请作为资深前端工程师 review 用户提供的改动、摘要或 diff。

## 自动前置要求

开始前必须先阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. 与改动相关的 `docs/` 文档

如果用户提供了 diff，请重点 review diff。
如果用户没有提供 diff，请提醒用户提供 `git diff`，或者基于当前工作区变更进行 review。

## Review 重点

请重点检查：

1. 是否真正解决了用户目标
2. 是否破坏 `AGENTS.md` 中的分层规则
3. 是否把业务逻辑重新塞回 UI 组件
4. 是否把复杂业务逻辑重新塞回 `HomeResourcesProvider.tsx`
5. 是否错误处理了 source of truth 和 derived data
6. 是否影响 `AppDataStore`
7. 是否影响 `localStorage`
8. 是否影响 snapshot / legacy 兼容
9. 是否影响导入导出
10. 是否影响热力图日期逻辑
11. 是否缺少必要测试
12. 是否引入隐藏 bug
13. 是否有更小、更安全的修法

## 限制

- 不要直接重写全部代码
- 不要做无关重构
- 不要扩大 review 范围到无关文件
- 不要执行 `git commit`
- 不要执行 `git push`

## 输出格式

请用中文输出：

1. 总体结论
2. 必须修的问题
3. 建议优化的问题
4. 可以接受的部分
5. 测试建议
6. 最小修复建议

## 用户输入

$ARGUMENTS