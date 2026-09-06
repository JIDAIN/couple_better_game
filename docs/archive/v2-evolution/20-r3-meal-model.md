# R3：固定三餐、多加餐与饮食权限

> 状态：✅ 2026-09-03 完成。

## 1. 餐次模型

正式 UI 模型：

```text
早餐   固定槽（0/1 主记录）
午餐   固定槽（0/1 主记录）
晚餐   固定槽（0/1 主记录）
加餐   0..N 独立记录
```

早餐 / 午餐 / 晚餐的入口直接决定 `mealType`。编辑页不再提供餐次切换，因此“添加早餐”不会在编辑页被改成午餐或加餐。

历史数据库如果已经存在同一天多个同餐次记录，前端不擅自删除：展示主记录，并提示仍有历史重复数据，避免重构过程静默改写事实。

## 2. 多加餐

点击“新增加餐”先出现选择层：

- 上午加餐 -> `snackPeriod=morning`
- 下午加餐 -> `snackPeriod=afternoon`
- 晚上加餐 -> `snackPeriod=evening`

选择后进入统一餐食编辑页。保存后，每次加餐都是独立 MealRecord，分别拥有时间、照片、食物明细、宏量营养和 kcal。

已存在的每次加餐都有“编辑这次”入口，`mealId` 明确指向具体记录，不再出现“编辑加餐但不知道是哪一次”的歧义。

## 3. 相对身份

饮食页继续使用 R1B 的相对身份：

```text
我 = 当前登录 partnerKey
Ta = 另一方
```

“我”可以新增 / 修改 / 删除自己的餐食；切到 Ta 只读。

## 4. 服务端所有权

R3 不只隐藏按钮，还补齐服务端权限：

- `POST /api/meals`：payload.partnerKey 必须等于当前 session；
- `PUT /api/meals/:id`：先读取已有 meal 的 owner，再校验当前 session；同时禁止把一餐改到另一方名下；
- `DELETE /api/meals/:id`：先读取 owner，再校验；
- `PUT/DELETE /api/meals/:id/photo`：同样先按 meal owner 校验；
- GET 仍允许两个人互相查看。

服务端新增 `getMealOwner(mealId)`，使用 service-side Supabase REST 查询，不相信客户端自己声明 owner。

## 5. 缓存

饮食页接入 R1C query cache：

```text
meals:{partnerKey}:{date}
```

编辑保存或删除后只 invalidate 对应人的对应日期缓存；返回饮食页时保留已有内容并后台同步，不再依赖 `router.refresh()` 整页刷新。

## 6. 验收

- 添加早餐后编辑页不能切餐次；
- 午餐、晚餐同理；
- 加餐可添加多次；
- 新增加餐先选上午/下午/晚上；
- 每次加餐单独编辑；
- Ta 饮食只读；
- 直接伪造 API 也不能修改 Ta 的 Meal / photo；
- 返回饮食页不主动整页 refresh。
