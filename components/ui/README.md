# UI adapter boundary

`components/ui` 是项目统一视觉适配层。

V2 所有可见 UI 的视觉规范源：

```text
docs/12-island-life-design-system.md
```

## 强制规则

1. 业务页面优先使用 `App*` / Project Pattern，不直接把第三方视觉组件带入页面。
2. `animal-island-ui` 可以升级或补充，但必须先通过本层归一到已确认的「岛屿生活 V2」视觉语言。
3. 外部 GitHub 代码如果视觉不同，只复用交互、状态、布局、日期算法、accessibility，不复用其独立色板/阴影/Button/Card/Modal 体系。
4. 新颜色、圆角、阴影优先增加到全局 design token，不在业务 JSX 散落 hard-coded 视觉值。
5. 跨域复用 Pattern 稳定后放在 `components/ui`；领域专属 UI 分别放在 `components/life`、`nutrition`、`weight`、`medicine`、`games`。
6. `/ui-lab` 只用于假数据视觉回归，不能写真实生活数据或触发 Legacy Game settlement。
7. `/ui-lab` 与设计文档冲突时，以 `docs/12-island-life-design-system.md` 为准。
8. 已人工确认的主页面结构不得由实现者自行删减、换色板或改成另一种信息架构。

## 当前必须统一的跨域 Pattern

```text
AppPageShell
AppSectionPanel
AppRecordRow
AppEmptyState
AppPopover
AppToast
AppFeatureTile
AppMonthCalendar
AppRoleSwitch    // 固定文案：我 / Ta
```

## 视觉实现原则

- 暖白/奶油白主背景；
- 薄荷/青绿主识别；
- 柔黄/珊瑚/浅蓝辅助；
- 不回到大面积棕色；
- 高信息密度页面以数据可读性优先；
- 生活系统不得使用旧游戏金币/宝石/排名/热力图的视觉语义。

新增或修改 App* 前必须先阅读 `docs/12-island-life-design-system.md`。
