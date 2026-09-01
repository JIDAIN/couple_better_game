# Fix Bug

请按当前项目真实架构做最小修复。

## 流程

1. 阅读 `AGENTS.md`、`docs/09-status-roadmap.md` 和相关主文档。
2. 从真实代码 / logs / schema 找根因，不用旧文档猜。
3. 判断 bug 属于 game / nutrition / weight / sync / UI / infra。
4. 给出最小修复范围。
5. 修改并补回归测试。
6. 运行能执行的 targeted test / lint / build。

## 禁止

- 顺手大重构；
- 用 meal/intake 修 deficit；
- 暴露 Supabase secret；
- 绕过 cloud-session / first-device guard；
- 凭 gem/coin legacy 名称改语义；
- 修一个 UI bug 顺便改结算规则。

## 输出

根因、修复、验证、风险、未完成项。

$ARGUMENTS
