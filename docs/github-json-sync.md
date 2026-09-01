# GitHub JSON 同步说明

本文档说明当前版本的 GitHub JSON 数据同步方案。

当前同步方案只做一件事：把完整备份 JSON 保存到 GitHub 仓库里的 `public/data/couple-data.json`，再让页面可以从这个公开 JSON 自动加载或手动重新加载数据。

本阶段不做登录、数据库、实时协同，也不做 CSV 导入。

## 当前数据流

```text
页面首次打开
  -> 自动读取 /data/couple-data.json
  -> 如果远端 updatedAt 更新，则覆盖 localStorage
浏览器 localStorage
  -> 用户本地修改后显示“有未同步修改”
  -> 数据管理：手动同步到 GitHub
  -> /api/save-data
  -> GitHub REST API
  -> public/data/couple-data.json
  -> Vercel 自动重新部署
  -> /data/couple-data.json
  -> 页面下次打开自动加载，或手动从 GitHub 重新加载
  -> 浏览器 localStorage
```

`localStorage` 仍然是页面运行时的本地缓存。GitHub JSON 是自动加载、手动上传用的公开数据源。

## 新增文件

```text
public/data/couple-data.json
app/api/save-data/route.ts
docs/github-json-sync.md
```

`public/data/couple-data.json` 的结构与完整备份 JSON 基本一致，但时间字段使用：

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-05-18T00:00:00.000Z"
}
```

其余字段包括：

```text
wallet
dailyRecords
exchangeRecords
exchangeCategories
heatmapStartDate
coinRules
visualRules
```

`exchangeRecords` 会在同步前补齐历史快照字段，不依赖 `exchangeCategories` 才能显示历史记录。

## Vercel 环境变量

在 Vercel 项目中打开：

```text
Project Settings -> Environment Variables
```

添加以下变量，并配置到 Production 环境：

```env
GITHUB_TOKEN=
GITHUB_REPO_OWNER=JIDAIN
GITHUB_REPO_NAME=couple_better_game
GITHUB_DATA_FILE_PATH=public/data/couple-data.json
DATA_EDIT_PASSWORD=
```

### GITHUB_TOKEN

`GITHUB_TOKEN` 只在服务端 API Route 中使用，不能写到前端代码里。

建议创建 GitHub fine-grained personal access token：

1. 打开 GitHub。
2. 进入 `Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens`。
3. 选择仓库 `JIDAIN/couple_better_game`。
4. 给仓库内容写权限：

```text
Contents: Read and write
```

5. 生成 token 后填入 Vercel 的 `GITHUB_TOKEN`。

### DATA_EDIT_PASSWORD

`DATA_EDIT_PASSWORD` 是页面“同步到 GitHub”时需要输入的同步密码。

它只用于阻止误操作，不是完整账号系统。请不要把这个密码写入代码或提交到 GitHub。

## 自动加载与手动重新加载

页面首次打开时会自动请求：

```text
/data/couple-data.json
```

如果远端 `updatedAt` 晚于本机保存的 `lastSyncedAt`，或者本机没有本地数据，页面会自动用远端数据覆盖当前 state 和 `localStorage`。

如果自动加载失败，页面会保留本地数据，并显示轻量提示。

在页面里打开“数据管理”弹窗，点击：

```text
从 GitHub 重新加载
```

手动重新加载也会请求：

```text
/data/couple-data.json
```

手动重新加载会复用现有 JSON 导入和 normalize 逻辑，把远端数据覆盖到当前本地 state 和 `localStorage`。

成功后提示：

```text
已从 GitHub 重新加载
```

失败时会显示错误提示，当前本地数据不会被成功导入以外的流程覆盖。

## 同步到 GitHub

在页面里打开“数据管理”弹窗：

1. 在“同步密码”里输入 `DATA_EDIT_PASSWORD`。
2. 点击“同步到 GitHub”。

页面会把当前完整快照提交到：

```text
POST /api/save-data
```

服务端会：

1. 校验同步密码。
2. 复用现有导入 normalize 逻辑检查数据结构。
3. 生成带 `updatedAt` 的同步 JSON。
4. 使用 GitHub REST API 更新 `public/data/couple-data.json`。

成功后提示：

```text
已同步到 GitHub
```

成功同步后，本机会更新 `lastSyncedAt`，同步状态回到“已是最新”。

本地修改记录、成长日志、兑换、导入 JSON 后，会显示“有未同步修改”。系统不会自动上传，仍然需要手动点击“同步到 GitHub”。

## 重要限制

GitHub 文件更新后，Vercel 通常会因为 `main` 分支产生新提交而自动重新部署。部署完成后，新的 `/data/couple-data.json` 才会稳定出现在 Vercel 线上地址。

这不是实时协同：

- 两台设备同时编辑可能互相覆盖。
- 没有账号权限系统。
- 没有冲突合并。
- 没有数据库事务。
- CSV 仍然只用于每周复盘，不用于导入恢复。

当前推荐使用方式是：

```text
设备 A 记录数据
设备 A 同步到 GitHub
等待 Vercel 部署完成
设备 B 打开页面自动加载，或手动从 GitHub 重新加载
```

## localStorage 仍然保留

即使开启 GitHub JSON 同步，每台设备仍然会把数据保存到自己的 `localStorage`。

这样做的好处是：

- 页面打开后可以立刻读取本地数据。
- 没有网络时仍能查看本机缓存。
- 同步失败不会直接清空本地数据。

跨设备一致性依赖“自动加载远端数据”和手动点击“同步到 GitHub”完成；系统不会自动上传本地修改。
