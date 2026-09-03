# R10 Production 上线记录

**上线日期：2026-09-03**

## 1. Production 部署

用户已明确授权本次 R10 Production 部署。

最终上线源码固定为：

```text
GitHub repo: JIDAIN/couple_better_game
commit: 5c175a38586a77675580193ed47ac5e855ad6692
```

该 commit 包含：

- R10 Google Drive / Sheets Bridge；
- Harbor Cat / Harbor Fish 双入口；
- actor-specific HMAC、watch、wake；
- Drive 原图 + Supabase 临时 staging + 600px WebP 展示图；
- 单一家庭 Daily / Monthly 备份；
- R9 `/ai` 备用入口；
- Harbor Cat AI 称呼“团子”；
- Harbor Fish AI 称呼“仔仔”；
- PushPlus 微信提醒后端与 Apps Script worker 代码。

Vercel Production：

```text
deployment: dpl_CzGCg22uf1A1pqfPXqg5gCuMUCNj
state: READY
target: production
primary domain: https://couple-better-game.vercel.app
```

构建日志明确输出：

```text
R10 source pinned to 5c175a38586a77675580193ed47ac5e855ad6692
```

并成功生成 R10 关键路由：

```text
/api/drive-bridge/execute
/api/drive-bridge/reminders
/api/drive-bridge/snapshot
/api/drive-bridge/stage
/api/drive-bridge/watch
/ai
/mcp
```

## 2. 一次性部署方式

由于当前 Vercel connector 的高层 `deploy_to_vercel` 工具没有自动获得本地 Git workspace，本次使用受控 bootstrap source deployment：

1. connector 只上传最小 Next.js 引导包；
2. build 阶段从公开 GitHub 仓库下载**固定 commit**的 tarball；
3. 下载后在同一次 build 中运行真实仓库的 `next build`；
4. 最终产物来自固定 commit，不追随未来 Git push。

该方式没有修改项目的 Git 自动部署策略。

`main/vercel.json` 仍保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

因此本文件及后续普通 Git 提交不会自动生成新的 Preview / Production deployment。

## 3. 上线后 HTTP 验收

生产域名：

```text
GET / -> 200 OK
GET /ai -> 200 OK
```

R10 POST-only route 存在性验证：

```text
GET /api/drive-bridge/reminders -> 405 Method Not Allowed
GET /api/drive-bridge/snapshot  -> 405 Method Not Allowed
```

405 是预期行为，说明 Production 已命中新 R10 route，而不是旧版本 404。

Vercel runtime error 检查：

```text
No runtime errors found
```

## 4. Supabase Production 状态

R10 数据库与微信提醒 migration 均已执行 Production。

双 Harbor server-only config 已建立：

```text
cat  -> actor=cat,  backup_leader=true
fish -> actor=fish, backup_leader=false
```

微信提醒默认配置：

```text
timezone: Asia/Shanghai
daily record: 21:15
anniversary: 09:15
offsets: [7, 1, 0]
```

提醒 claim 已做无副作用测试：Cat / Fish 都正常返回空列表，测试未创建 delivery，也未发送微信。

## 5. Harbor AI 身份

```text
Harbor Cat
AI 会话称呼 = 团子
authoritative actor = cat
Ta = fish

Harbor Fish
AI 会话称呼 = 仔仔
authoritative actor = fish
Ta = cat
```

“团子 / 仔仔”只帮助自然语言和 Project 会话识别，不能覆盖服务端 `cat / fish` 权限绑定。

## 6. R10 仍未完成的最后外部步骤

R10 Production 后端已经上线，但整个 R10 仍不能标记为完全验收，原因是 Google Apps Script 当前无法由 ChatGPT connector 直接创建/发布。

当前 Production 数据库中：

```text
cat.apps_script_url  = empty
fish.apps_script_url = empty
```

仍需一次性完成：

1. 建立 Harbor Cat Worker Apps Script；
2. 建立 Harbor Fish Worker Apps Script；
3. 两边分别填写已有 R10 Script Properties；
4. 两边分别填写自己的 `PUSHPLUS_TOKEN`；
5. 部署两个 Web App；
6. 执行 `setupR10All()`；
7. 将两个 Web App URL 回填 `life_drive_bridge_configs`；
8. 做 Harbor Cat / Harbor Fish 真实读取、写入、照片、watch + 1 分钟 fallback、备份、微信提醒端到端验收。

只有完成以上步骤，R10 才能从“Production backend READY”升级为“R10 fully operational”。
