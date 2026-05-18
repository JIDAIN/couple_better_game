
# 部署说明文档：双人变美变瘦大作战

# 1. 文档目的

本文档说明项目在当前 Web MVP 阶段如何本地运行、构建和部署，以及未来接入后端、数据库、多设备同步、小程序/App 时的部署规划。

本文档重点回答：

* 项目怎么部署；
* 前端部署在哪里；
* 后端部署在哪里；
* 数据库部署在哪里；
* 环境变量有哪些；
* 本地开发和线上部署有什么区别。

---

# 2. 当前项目阶段

## 2.1 当前阶段：前端 Web MVP

当前项目是一个基于 Next.js 的 Web 应用。
现阶段主要依赖浏览器本地存储保存数据，暂未接入独立后端和数据库。

当前阶段部署重点是：

```text
前端页面可以访问
本地数据可以正常保存
构建不报错
核心流程可用
```

---

# 3. 本地开发

## 3.1 安装依赖

```bash
npm install
```

## 3.2 启动开发服务

```bash
npm run dev
```

启动后一般访问：

```text
http://localhost:3000
```

## 3.3 本地开发特点

当前本地开发阶段：

* 使用 Next.js dev server；
* 数据保存在浏览器 localStorage；
* 不需要数据库；
* 不需要后端服务；
* 不需要登录；
* 换浏览器或清空缓存会影响本地数据。

---

# 4. 构建与检查

## 4.1 运行测试

```bash
npm run test
```

## 4.2 监听测试

```bash
npm run test:watch
```

## 4.3 代码检查

```bash
npm run lint
```

## 4.4 生产构建

```bash
npm run build
```

## 4.5 启动生产服务

```bash
npm run start
```

提交部署前建议至少执行：

```bash
npm run test
npm run lint
npm run build
```

---

# 5. 当前部署方案

## 5.1 推荐部署平台

当前 Web MVP 推荐部署到：

```text
Vercel
```

原因：

* 对 Next.js 支持最好；
* 前端部署简单；
* 可直接连接 GitHub；
* 后续可平滑加入 API Route；
* 后续可接数据库环境变量。

## 5.2 当前部署结构

当前阶段可以理解为：

```text
浏览器
  ↓
Vercel / Next.js 前端
  ↓
localStorage
```

数据仍然存在用户浏览器中。

## 5.3 当前部署步骤

1. 将代码推送到 GitHub；
2. 在 Vercel 新建项目；
3. 选择 GitHub 仓库；
4. Framework 选择 Next.js；
5. Build Command 使用：

```bash
npm run build
```

6. Output 设置保持默认；
7. 部署完成后访问 Vercel 提供的域名。

---

# 6. 当前阶段不需要的服务

当前 Web MVP 暂不需要：

```text
数据库
独立后端
Redis
对象存储
登录服务
消息队列
云函数定时任务
```

当前数据由浏览器本地保存，因此线上部署后，不同设备之间不会自动同步。

---

# 7. 未来部署架构

未来接入后端和数据库后，推荐架构为：

```text
浏览器 / 小程序 / App
  ↓
Next.js 前端 + API
  ↓
后端业务服务
  ↓
数据库
```

可以先采用一体化部署：

```text
Next.js 前端 + API Route 部署到 Vercel
数据库使用 Neon / Supabase / Vercel Postgres
```

后续复杂后端再拆分为独立服务。

---

# 8. 前端部署

## 8.1 当前阶段

前端部署到 Vercel。

职责：

* 页面展示；
* 交互逻辑；
* 表单输入；
* 本地预览计算；
* 调用后端 API，未来；
* 展示后端返回结果，未来。

## 8.2 未来阶段

未来前端仍可部署在 Vercel。

前端不应该：

* 直接连接数据库；
* 直接持有数据库密钥；
* 决定最终钱包余额；
* 绕过 API 写数据。

---

# 9. API / 后端部署

## 9.1 当前阶段

当前没有独立后端。

## 9.2 未来第一阶段：Next.js API Routes

可以在同一个 Next.js 项目中增加 API：

```text
app/api/home/snapshot/route.ts
app/api/daily-records/route.ts
app/api/exchanges/route.ts
app/api/config/route.ts
```

部署方式：

```text
前端页面 + API Route 一起部署到 Vercel
```

优点：

* 实现简单；
* 不需要单独维护后端项目；
* 适合 MVP 进阶阶段；
* 环境变量统一配置。

## 9.3 未来第二阶段：独立后端服务

如果业务复杂，可以拆分独立后端：

```text
前端：Vercel
后端：Railway / Render / Fly.io / AWS / 阿里云 / 腾讯云
数据库：Neon / Supabase / PostgreSQL
```

适合场景：

* 多设备同步复杂；
* 账号系统复杂；
* 需要定时任务；
* 需要更多后端服务能力；
* API 和前端需要独立扩展。

---

# 10. 数据库部署

## 10.1 当前阶段

当前不需要数据库。

## 10.2 未来推荐数据库

推荐使用 PostgreSQL。

可选服务：

```text
Neon
Supabase
Vercel Postgres
Railway Postgres
自建 PostgreSQL
```

## 10.3 本地数据库

本地开发可以使用：

```text
SQLite
PostgreSQL Docker
本地 PostgreSQL
```

如果项目引入 Prisma，常见本地方案：

```text
SQLite：轻量开发
PostgreSQL：更接近线上
```

## 10.4 数据库存储内容

未来数据库保存：

```text
用户账号
情侣空间
成员关系
每日记录
每日角色明细
兑换记录
奖励分类
钱包流水
用户配置
```

数据库不保存：

```text
弹窗是否打开
toast
当前 tab
未保存输入草稿
动画状态
hover 状态
```

---

# 11. 前端、API、数据库关系

## 11.1 正确访问路径

```text
前端
  ↓ API 请求
后端 API
  ↓ 数据库连接
数据库
```

## 11.2 禁止访问路径

```text
前端
  ↓
数据库
```

前端不能直接访问数据库。

## 11.3 原因

* 数据库密钥不能暴露在浏览器；
* 前端数据不可信；
* 钱包和奖励必须由后端最终确认；
* 权限校验必须在后端完成。

---

# 12. 环境变量

## 12.1 当前阶段

当前纯前端 Web MVP 通常不需要必须配置环境变量。

## 12.2 未来通用环境变量

### 数据库

```env
DATABASE_URL=
```

用途：

```text
后端连接 PostgreSQL / Neon / Supabase / Vercel Postgres
```

只能在服务端使用，不能暴露给前端。

---

### 认证，未来

```env
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

用途：

```text
NextAuth / Auth.js 登录认证
```

---

### 微信小程序 / 微信登录，未来

```env
WECHAT_APP_ID=
WECHAT_APP_SECRET=
```

用途：

```text
微信登录
小程序认证
```

---

### 其他可能环境变量

```env
APP_BASE_URL=
NODE_ENV=
```

如果未来接入第三方服务，也可能增加：

```env
SENTRY_DSN=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

## 12.3 前端公开变量

如果某个环境变量必须暴露给浏览器，Next.js 中需要以：

```env
NEXT_PUBLIC_
```

开头。

例如：

```env
NEXT_PUBLIC_APP_NAME=
```

但注意：

```text
任何密钥都不能使用 NEXT_PUBLIC_ 前缀。
```

---

# 13. 本地开发与线上部署区别

## 13.1 当前 Web MVP

| 项目     | 本地开发         | 线上部署               |
| -------- | ---------------- | ---------------------- |
| 运行方式 | `npm run dev`  | Vercel 自动部署        |
| 数据来源 | localStorage     | localStorage           |
| 数据共享 | 当前浏览器       | 当前浏览器             |
| 登录     | 无               | 无                     |
| 数据库   | 无               | 无                     |
| 调试     | 控制台和本地代码 | 浏览器控制台和部署日志 |

## 13.2 未来后端阶段

| 项目     | 本地开发                  | 线上部署                   |
| -------- | ------------------------- | -------------------------- |
| 前端     | Next dev server           | Vercel                     |
| API      | 本地 API route / 本地后端 | Vercel API / 独立后端      |
| 数据库   | SQLite / 本地 Postgres    | Neon / Supabase / Postgres |
| 环境变量 | `.env.local`            | Vercel / 后端平台环境变量  |
| 登录     | 测试账号                  | 正式认证                   |
| 数据同步 | 本地环境                  | 云端同步                   |

---

# 14. `.env.local` 建议

未来接入数据库和登录后，本地可以创建：

```text
.env.local
```

示例：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/couple_better_game"
NEXTAUTH_SECRET="local-dev-secret"
NEXTAUTH_URL="http://localhost:3000"
WECHAT_APP_ID=""
WECHAT_APP_SECRET=""
```

注意：

```text
.env.local 不应提交到 GitHub。
```

---

# 15. 部署前检查清单

每次部署前建议执行：

```bash
npm run test
npm run lint
npm run build
```

检查项：

```text
测试是否通过
lint 是否通过
build 是否通过
首页能否打开
记录今天是否正常
成长日志是否正常
兑换商店是否正常
刷新后数据是否仍在
移动端是否无明显布局问题
```

---

# 16. Vercel 部署建议

## 16.1 自动部署

建议使用：

```text
main 分支 → 生产环境
其他分支 / PR → 预览环境
```

## 16.2 环境变量配置

在 Vercel 项目中配置：

```text
Project Settings → Environment Variables
```

未来如果有：

```env
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
```

需要分别配置到：

```text
Development
Preview
Production
```

## 16.3 构建失败处理

如果 Vercel 构建失败，优先检查：

```text
npm run build 本地是否通过
环境变量是否缺失
TypeScript 类型错误
ESLint 错误
依赖安装失败
Node 版本问题
```

---

# 17. 数据迁移策略，未来

从当前 localStorage 迁移到数据库时，可以考虑：

## 17.1 用户手动导入

```text
导出 localStorage 数据
登录账号
导入数据到云端
后端校验并写入数据库
```

## 17.2 自动迁移

用户登录后，前端检测本地数据：

```text
发现 localStorage 有数据
  ↓
提示是否迁移到云端
  ↓
用户确认
  ↓
调用导入 API
  ↓
后端写入数据库
```

## 17.3 迁移注意事项

需要处理：

```text
重复日期记录
重复兑换记录
奖励分类冲突
钱包余额重算
规则版本差异
```

---

# 18. 未来部署阶段规划

## 阶段一：纯前端 MVP

```text
Next.js 前端部署到 Vercel
localStorage 保存数据
无后端
无数据库
```

目标：

```text
验证产品闭环
验证 UI 和记录体验
```

---

## 阶段二：Next.js API + 云数据库

```text
Next.js 页面 + API Routes 部署到 Vercel
数据库使用 Neon / Supabase / Vercel Postgres
```

目标：

```text
账号数据持久化
多设备同步
数据备份
```

---

## 阶段三：独立后端

```text
前端部署 Vercel
后端部署 Railway / Render / Fly.io / 云服务器
数据库 PostgreSQL
```

目标：

```text
更复杂权限
更稳定同步
定时任务
更多平台客户端
```

---

## 阶段四：小程序 / App

```text
Web 前端
小程序端
App 端
统一后端 API
统一数据库
```

目标：

```text
手机高频使用
双人实时同步
推送提醒
更完整体验
```

---

# 19. 安全注意事项

## 19.1 不要暴露密钥

以下变量不能暴露到前端：

```text
DATABASE_URL
NEXTAUTH_SECRET
WECHAT_APP_SECRET
数据库密码
对象存储密钥
```

## 19.2 不要信任前端计算结果

前端可以预览奖励，但后端必须重新计算。

## 19.3 数据库权限

线上数据库应：

```text
使用强密码
限制公网访问，视平台能力而定
定期备份
不同环境使用不同数据库
```

---

# 20. 总结

当前项目部署路线：

```text
现在：Next.js Web MVP + localStorage + Vercel
下一步：Next.js API Routes + PostgreSQL
未来：独立后端 + 多设备同步 + 小程序/App
```

核心边界：

```text
前端部署在 Vercel
API 可以先和 Next.js 放在同一项目
数据库是独立服务
前端不能直接访问数据库
后端 API 通过环境变量访问数据库
```

最重要的环境变量：

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
WECHAT_APP_ID=
WECHAT_APP_SECRET=
```

当前阶段不需要急着接数据库，优先把 Web MVP 的记录、奖励、成长地图、成长日志和兑换闭环打磨稳定。
# 当前实现同步说明（2026-05）

当前部署形态仍是本地前端应用。用户迁移数据时，应优先使用首页“数据管理”导出的完整备份 JSON；CSV 仅用于每周复盘，不用于恢复数据。
