# UI 与 animal-island-ui 维护规范

状态：2026-09-06。

## 1. 视觉规范优先级

V2 生活系统的主视觉规范：

`docs/12-island-life-design-system.md`

任何今日、饮食、日历、小窝、体重、小信箱、家庭药箱、游戏机或未来页面，都应优先遵守同一套 `--life-*` token、App* 组件和 Pattern。

## 2. UI 分层

```text
第三方 primitive / headless
        ↓
components/ui/App*
        ↓
跨域 Pattern
        ↓
components/life / nutrition / weight / medicine / games
```

当前常用 Pattern 包括：

```text
AppPageShell
AppRoleSwitch
AppRecordRow
AppFeatureTile
AppNutritionBar
MealPhotoFrame
```

业务页面优先复用，不为了局部功能重新造第二套 Button / Card / Input / photo frame。

## 3. 双人事实页

饮食、体重等个人事实页统一使用：

```text
我 / Ta
```

切换只改变正在查看的人，不改变当前登录 actor 的写权限。

## 4. 饮食页结构

独立饮食页保持：

- 顶部 `我 / Ta`；
- 一次只看一个人；
- 早餐 / 午餐 / 晚餐 / 加餐；
- 左侧真实照片；
- 右侧碳水 / 蛋白质 / 脂肪 / 总热量；
- 每餐编辑入口；
- 底部当日宏量营养 + 总热量；
- 编辑进入“编辑一餐”子页面。

必须复用 canonical Meal CRUD，不建立第二套餐食数据体系。

## 5. 真实餐食照片显示规则（R11.5）

真实餐食照片统一使用 `MealPhotoFrame`。

### 固定原则

- 卡片视觉框保持 4:3；
- 主图使用 `object-contain`；
- 禁止真实餐食照片使用 `object-cover` 强制铺满；
- 图片完整性优先于“完全无留白”；
- 空余区域使用页面浅色 / 空白背景填充；
- 旋转和大小调整只改变显示 transform，不重新压缩图片。

### 默认方向

上传完成后服务端会根据压缩后尺寸设置默认方向：

```text
竖图 -> 默认 90° 横向显示
横图 -> 默认 0°
```

因此用户手机竖拍的照片默认不会以狭长竖图挤在横向餐卡里。

### 用户编辑

餐食编辑页必须提供：

- 左转 90°；
- 右转 90°；
- 60%–100% 显示大小调节；
- 更换照片；
- 移除照片。

如果用户把照片设回竖向：

```text
完整竖图
+ 两侧留白
```

不得为了铺满横向卡片裁掉左右或上下内容。

## 6. 编辑已有 AI 餐食

用户从 UI 打开 AI 已写入的 meal 时，编辑器必须 round-trip 保留已有：

- 食物 identity / display name；
- estimated weight；
- calories；
- calorie min/max；
- protein / carbs / fat；
- meal-level calorie estimate。

用户只改备注、时间、照片旋转等无关字段时，不得偷偷把营养估算清成 null。

只有用户实际修改食物名称、份量、重量或热量等会影响估算的字段时，才允许相关旧估算失效。

## 7. 默认餐图与真实照片

没有 `photo_path`：

```text
使用 public/illustrations/meals/*.svg 默认插画
```

有 `photo_path`：

```text
使用 MealPhotoFrame 展示真实照片
```

移除真实照片后恢复默认餐次插画，不出现空白坏图。

## 8. 日历

- 标准七列月历；
- 同日显示双人心情；
- 点击日期进入详情；
- 详情回顾心情、睡眠、活动、饮食概览；
- 不做绩效式打卡评价。

## 9. 小窝

固定入口继续包含：

```text
体重 / 小信箱 / 家庭药箱 / 游戏机
```

高密度信息页优先扫描效率，不为了“可爱”堆叠无关装饰。

## 10. 移动端与无感加载

- 触控目标清楚；
- safe-area 不遮挡；
- 长中文不溢出；
- 数字稳定对齐；
- 已有缓存时优先保留旧内容并后台刷新；
- 不因为图片重新加载导致卡片明显闪烁；
- mutation 后旧 in-flight 请求不能覆盖新缓存；
- loading / empty / error 状态可理解，但避免整页反复跳变。

## 11. `/ui-lab`

`/ui-lab` 继续作为视觉回归页：

- 只用假数据；
- 不读写 Supabase；
- 不调用真实 Life API；
- 不触发 Legacy Game settlement；
- 新 Pattern 先在此验证再进入正式页面。

## 12. 验证

可见 UI 最低验证：

```text
npm run test
npm run lint
npm run build
```

并在 Production / Preview 实机确认：

- 竖图默认横向显示；
- 手动旋转后完整图不被裁切；
- 大小滑杆生效；
- 编辑保存后方向和大小持久；
- AI 营养数据没有被无关编辑清空。
