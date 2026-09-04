# R8.6 跨页面共享日期缓存

## 根因

R8.5 的启动预热没有解决历史日期链路，因为各页面使用了不同缓存模型：

```text
日历月页预热 -> life-day:{date} + meals:{actor}:{date}
日历详情     -> calendar-day:{date}:{actor}
饮食页       -> meals:{actor}:{date}
```

因此：

```text
月历 -> 某天详情 -> 查看当天饮食
```

会重复读取同一天的数据；历史餐食照片也没有在详情阶段提前进入浏览器图片缓存。

## R8.6

### 单次月度读取

新增 service-only RPC：

```text
get_life_month_bundle
```

一次返回该月 28~31 天的：

- mood
- sleep
- activity
- cat meals
- fish meals

首次进入站点时把当前月写入 canonical cache；切换日历月份时也只需一个 bundle 请求。

### Canonical cache

统一为：

```text
life-day:{date}
meals:{cat|fish}:{date}
```

`LifeCalendarDayPage` 不再拥有 `calendar-day:*` 私有 bundle cache。

因此 Today、CalendarDay、Food 三处消费同一份数据。

### 图片

- 日历按下某天时根据已缓存 meals 预加载真实餐食照片；
- 日详情挂载后继续 decode 当天餐食照片；
- 点击“查看饮食”再次复用相同 preload promise / 浏览器缓存；
- 心情素材使用 raw URL + eager，避免历史日期的图标延迟绘制。

### 本地持久缓存

缓存容量由 120 提升到 220 条，以覆盖两人一个完整月的 day + meals；月度 hydrate 使用批量写入，只进行一次 localStorage persistence。

## 验证

PR #55：

```text
Test  ✅
Lint  ✅
Build ✅
```

Production Supabase migration 已执行：

```text
get_life_month_bundle(date,text)
service_role  EXECUTE ✅
authenticated EXECUTE ❌
anon          EXECUTE ❌
```

2026-09 月 bundle 返回 30 天。

## 部署边界

代码已合并 main；本轮尚未获得新的 Vercel Production 授权，因此线上仍是上一版，等待用户明确许可后再部署 R8.6。
