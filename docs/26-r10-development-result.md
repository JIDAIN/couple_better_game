# R10 开发完成记录

**日期：2026-09-03**

## 最终开发状态

R10 `ChatGPT Project × Google Drive Bridge` 已完成代码、Google Drive 工作区、Bridge Sheet、Apps Script worker、Supabase migration、服务端安全层与自动化测试。

PR：#42 `R10: ChatGPT Project Google Drive bridge and backups`

最终功能代码 CI（run #229 / `33715825150`）：

```text
Test   ✅
Lint   ✅
Build  ✅
```

该 CI 覆盖的 head 为：

```text
b21e15c921a6811161166548e10f794439b006b5
```

## 备份实现口径修正

R10 实际实现的 Drive 结构化备份不是 R8 的仅用户数据 `get_life_export`，而是 R10 新增：

```text
get_life_full_export
```

它包含：

```text
user
+ config
```

Apps Script 的 Daily / Monthly backup 还会把：

```text
settings
+ legacy_home
```

一起写入 Drive 快照。因此生产激活后的 Daily/Monthly JSON 设计目标是完整结构化灾备，而不是只备份餐食、体重等 user rows。

`docs/25-r10-chatgpt-project-drive-bridge.md` 中第 10 节仍出现旧函数名 `get_life_export` 的文字描述时，以本记录和实际代码 `get_life_full_export` 为准；后续文档整理时统一替换。

## 已完成但尚未 Production 激活

已完成：

- `Couple Better Game` Google Drive 工作区；
- `Couple Better Game AI Bridge` 原生 Google Sheet；
- `COMMANDS / RECEIPTS / STATE_* / META / ASSETS`；
- HMAC Bridge auth；
- 固定 `cat` actor；
- durable command ledger；
- Drive push wake + 1 分钟 fallback；
- Apps Script watch renewal；
- Drive 原图不压缩保存；
- trusted Drive original 最大 25MB → 600px WebP 展示版；
- Daily / Monthly full structured backup；
- 单条 malformed command 隔离，不阻塞整批命令。

尚未执行：

- Production Supabase R10 migration；
- Google Cloud Service Account 的生产创建/授权；
- Apps Script Web App 的生产部署与授权；
- R10 Vercel Production env；
- 任意 R10 Vercel Preview / Production deployment；
- ChatGPT Project 多新窗口真实端到端读写验证；
- 旧 Supabase-only 历史照片一次性归档到 `Backups/Legacy-Photos`。

因此当前只能标记为：

```text
R10 code / architecture / CI    ✅
R10 Google Drive workspace      ✅
R10 Production activation       ⏳
R10 ChatGPT Project E2E         ⏳
```

任何 Vercel Preview / Production deployment 仍必须先取得用户单次明确授权；`vercel.json -> git.deploymentEnabled=false` 保持不变。
