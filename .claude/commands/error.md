# Diagnose Error

根据用户提供的命令、日志或报错定位问题。

1. 先读 `AGENTS.md` 和相关主文档。
2. 确认错误发生在 browser / Next.js API / Vercel build/runtime / Supabase / test 哪一层。
3. 优先找第一处真实失败，不用后续连锁报错代替根因。
4. 不修改无关领域。
5. 如果涉及 production data，先设计只读诊断或可回滚验证。
6. 修复后说明是否真实运行了 test/lint/build/DB smoke。

$ARGUMENTS
