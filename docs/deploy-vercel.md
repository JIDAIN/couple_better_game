# Vercel 部署说明

本文档说明如何把当前 GitHub 仓库 `JIDAIN/couple_better_game` 部署到 Vercel。

当前阶段只部署前端 Next.js 应用，不新增登录、数据库、云同步或 GitHub JSON 同步。应用数据仍然保存在每台设备、每个浏览器自己的 `localStorage` 中。

## 1. 用 GitHub 登录 Vercel

1. 打开 [Vercel](https://vercel.com/)。
2. 点击 `Sign Up` 或 `Log In`。
3. 选择 `Continue with GitHub`。
4. 按 GitHub 页面提示授权 Vercel 访问仓库。

如果之前已经注册过 Vercel，直接用同一个 GitHub 账号登录即可。

## 2. 导入 GitHub 仓库

1. 登录 Vercel 后进入 Dashboard。
2. 点击 `Add New...`。
3. 选择 `Project`。
4. 在导入列表中找到 `JIDAIN/couple_better_game`。
5. 点击该仓库右侧的 `Import`。

如果列表里没有看到仓库，可以点击 GitHub 授权设置，确认 Vercel 已被允许访问 `JIDAIN/couple_better_game`。

## 3. 选择 main 分支自动部署

导入项目时，Vercel 默认会把 GitHub 仓库的默认分支作为生产部署分支。当前仓库使用 `main` 分支。

推荐保持以下设置：

```text
Production Branch: main
```

之后每次把代码 push 到 GitHub 的 `main` 分支，Vercel 都会自动触发一次生产部署。

其他分支或 Pull Request 通常会生成 Preview Deployment，适合部署前预览，不影响正式网址。

## 4. 构建命令和默认配置

当前项目是标准 Next.js 项目，Vercel 会自动识别框架。

推荐保持 Vercel 默认配置：

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: .next
Root Directory: ./
```

当前项目暂时不需要配置环境变量。

本地已验证：

```bash
npm run build
```

构建可以通过，因此可以部署到 Vercel。

## 5. 手机访问 Vercel 网址

部署完成后，Vercel 会生成一个线上网址，常见格式类似：

```text
https://couple-better-game.vercel.app
```

手机访问方式：

1. 在电脑上打开 Vercel 项目页面。
2. 找到 Production Deployment 的网址。
3. 把网址复制到手机浏览器打开，或发送到微信、备忘录等应用后在手机上点击。
4. 如果后续绑定了自定义域名，也可以直接用自定义域名访问。

手机首次打开线上网址时，会使用手机浏览器自己的本地存储空间。

## 6. 为什么部署后 localStorage 不会跨设备同步

当前应用的数据保存在浏览器 `localStorage` 中。

`localStorage` 的特点是：

```text
同一个网址
同一台设备
同一个浏览器
```

三者都相同，才能读到同一份本地数据。

因此：

- 电脑 Chrome 里的数据，不会自动出现在手机 Safari。
- 手机 Safari 里的数据，不会自动出现在手机微信内置浏览器。
- 清理浏览器数据后，本地记录可能会被删除。
- Vercel 只负责托管网页代码，不会自动保存或同步用户数据。

当前已经有 JSON 导出/导入功能，可以用于手动备份和迁移数据；CSV 导出用于每周复盘，不用于恢复完整数据。

## 7. 下一步同步方案

下一步计划通过 GitHub JSON 同步解决跨设备数据一致问题。

目标是让不同设备访问同一份可同步的数据，而不是只依赖某一台设备的 `localStorage`。

后续设计时需要继续保持边界清晰：

- 不让 UI 直接处理复杂同步规则。
- 不破坏现有导出/导入能力。
- 保留当前本地可用的体验。
- 再逐步加入 GitHub JSON 同步流程。

在 GitHub JSON 同步完成前，跨设备使用仍建议通过“导出完整备份 JSON -> 在另一台设备导入 JSON”的方式迁移数据。
