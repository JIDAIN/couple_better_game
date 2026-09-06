# 历史文档归档

这里保存已经完成使命、但仍有追溯价值的开发过程文档。

**本目录不是当前事实源。** 当历史文档与当前实现冲突时，优先级固定为：

```text
Production 已验证行为 / 当前 Supabase schema
→ main 代码
→ docs/ 顶层当前主文档
→ docs/archive/ 历史文档
→ Git 历史 / 旧聊天
```

目录：

- `v2-evolution/`：R1C-R8 的 UI、导航、模型迁移与重构过程；
- `ai-integration/`：AI Access Core / MCP 的阶段性实现、验收、hardening 与客户端兼容研究；
- `harbor/`：已退役的旧 Project Instructions；
- `deployments/`：一次性 Production 授权与部署触发记录。

新的阶段性验收、临时调研和迁移报告优先记录在 PR / Issue / CHANGELOG。只有确有长期追溯价值时才进入 archive，不能再堆回 `docs/` 顶层。
