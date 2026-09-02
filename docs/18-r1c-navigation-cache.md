# R1C：导航持久化与数据缓存

> 状态：✅ 2026-09-03 完成基础重构。后续页面在 R2-R5 重做时继续接入同一缓存边界。

## 目标

Production 实机曾出现“切回今日 / 再点页面时整块重新 loading”的刷新感。R1C 的目标不是缩短 loading 文案，而是让已经看过的数据继续留在客户端，页面切换后先展示缓存，再后台同步。

## 实现

1. `LifeIdentityProvider` 从每个 `LifeAppShell` 内部上移到根 `app/layout.tsx`，因此路由切换不会反复重新确认当前 cat/fish 会话。
2. 新增 `lib/client/use-stale-query.ts`，提供轻量 stale-while-revalidate 缓存：
   - 稳定字符串 query key；
   - 内存缓存跨页面 remount 继续存在；
   - TTL 内直接复用；
   - 过期后保留旧数据并后台刷新；
   - 同 key 并发请求合并；
   - 支持强制 refresh 与局部 update/invalidate。
3. 今日页首个接入：`life-day:YYYY-MM-DD`。返回首页时如果已有数据，不再先清空页面显示整块 loading。
4. 当前底部 Tab 再次点击自身继续保持 R1A 的 no-op 导航规则。

## 为什么本阶段没有直接安装 TanStack Query

正式计划原本“优先 TanStack Query”。本次执行环境通过 GitHub Contents API 修改仓库，无法安全运行 `npm install` 自动生成当前仓库完整 `package-lock.json`。为了不手工伪造 lockfile、也不为了一个依赖破坏 `npm ci` 可重复性，本阶段先采用同样的 stale-while-revalidate 查询边界，并把 API 设计限制在 `query key / refresh / invalidate / update` 四个概念上。

当后续在可直接运行 npm 的开发环境中引入 TanStack Query 时，可以把这一层替换掉，页面不应重新回到页面级“清空 → loading → 再填充”的模式。

## 验收规则

- 当前 Tab 连点不重新导航；
- 从其他页返回“今日”，已有今日数据时立即展示；
- 后台刷新只显示轻量同步提示，不清空原内容；
- mutation 完成后强制刷新对应 query，不刷新整个应用；
- 身份 Context 在生活页间切换时不 remount；
- Vercel Git 部署仍保持关闭。
