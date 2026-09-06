# R2：首页心情与睡眠交互

> 状态：✅ 2026-09-03 完成。

## 心情

首页继续同时展示“我 / Ta”的当天心情，但编辑入口只属于当前登录账号。

```text
cat 登录：我=cat，Ta=fish
fish 登录：我=fish，Ta=cat
```

点击“记录我的 / 修改我的”后打开独立 bottom sheet，不再在首页卡片内展开两套编辑器。弹层只保存当前 `mePartnerKey`，Ta 的心情由 Ta 自己登录后填写。

原来的 ASCII 字符脸（如 `•ᴗ•`、`•﹏•`）已删除，统一改为真实表情图标 + 岛屿生活柔和色块，并预留 R6 继续升级插画资产的视觉边界。

## 睡眠

睡眠仍同时展示双方事实，但编辑器只出现“我”的入睡和起床时间。Ta 的睡眠只读，服务端继续由 `OWN_RECORD_ONLY` 兜底。

## 权限链路

```text
UI 只提供我的编辑入口
        ↓
API payload.partnerKey = mePartnerKey
        ↓
服务端 authorizePersonalPartnerWrite
        ↓
当前 session partnerKey 必须一致
```

这样即使前端被人为改动，也不能通过正常 API 替 Ta 写个人记录。

## 验收

- 心情卡同时显示我 / Ta；
- 只有“我的”编辑按钮；
- 点击后弹出独立心情选择层；
- 选中后保存并关闭；
- 不再出现 ASCII 字符脸；
- 睡眠只编辑我；
- Ta 保持可见但只读。
