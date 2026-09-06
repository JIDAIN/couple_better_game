# R4：情绪日历

> 状态：✅ 2026-09-03 完成。

## 1. 交互目标

Production 实机验收明确要求月历更接近“日期 + 情绪直接落在格子里”的生活记录，而不是后台系统式卡片网格。

最终规则：

```text
没有心情 -> 日期下方完全留空
今天       -> 日期旁显示小太阳
有一人心情 -> 显示一个情绪图
双方都有   -> 显示两枚轻微错位的情绪图
```

不再渲染空心圆、虚线圈或“我/Ta”占位符。

## 2. 成熟项目参考

日期排布和“情绪显示在日期下方”的交互参考了 MIT 开源项目：

- GitHub-Xzhi/obsidian-mood-calendar
- https://github.com/github-xzhi/obsidian-mood-calendar
- License: MIT

参考的是成熟产品模式：月历网格、today highlight、date 下方 mood emoji、无 mood 时不强塞情绪占位。没有复制其视觉资产或 Obsidian 插件代码；本项目仍使用自己的 Next.js 数据层、双人相对身份和岛屿视觉 CSS。

## 3. 双人相对身份

月历中的显示顺序始终是：

```text
第一枚 = 我 = mePartnerKey
第二枚 = Ta = taPartnerKey
```

因此 cat/fish 登录后视觉顺序会自动切换，不把 cat 永久写成“我”。

## 4. 缓存

月历接入 R1C stale-while-revalidate：

```text
life-month:{YYYY-MM}
```

切换回已经看过的月份时先展示缓存，过期后后台同步，不先清空整个月历。

## 5. 视觉

新增 `app/island-life-refactor.css` 作为 R4-R6 视觉实施层：

- `life-calendar-paper`
- `life-calendar-day`
- `life-calendar-date`
- `life-today-sun`
- `life-calendar-mood`

日期格不再是独立 SaaS 卡片；整体更像一张柔和纸质月历。

## 6. 验收

- 没有心情的日期下方为空；
- 今天始终有小太阳特殊标识；
- 一方有心情只出现一枚；
- 双方有心情出现两枚；
- 我/Ta 顺序跟随当前登录；
- 月份切换保留事实展示，不加入连续天数、完成率、评分或双方比较。
