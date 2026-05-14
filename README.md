# 恋爱宝库 / 变美变瘦大作战

这是一个基于 Next.js 的本地 Web MVP。当前数据仍然存储在浏览器 `localStorage`，项目已经为未来接 API、数据库或云同步做了 store 抽象，但目前还没有接入登录、后端或数据库。

## 项目文档

如果你是第一次阅读这个项目，建议按下面顺序查看：

1. [docs/architecture-after-refactor.md](docs/architecture-after-refactor.md)
2. [docs/data-management-after-refactor.md](docs/data-management-after-refactor.md)
3. [docs/module-map-after-refactor.md](docs/module-map-after-refactor.md)
4. [docs/development-guide-after-refactor.md](docs/development-guide-after-refactor.md)
5. [docs/testing-guide.md](docs/testing-guide.md)
6. [docs/rules-confirmation.md](docs/rules-confirmation.md)
7. [docs/heatmap-date-logic.md](docs/heatmap-date-logic.md)
8. [docs/ui-inventory.md](docs/ui-inventory.md)

如果后续再补充产品说明或需求说明文档，可以把它们放在最前面，作为更高层的阅读入口。

## 当前项目状态

- 这是一个纯前端 Web MVP
- 当前状态主要通过 React Context、`AppDataStore` 和 `localStorage` 协同管理
- 结算规则、统计逻辑、每日记录逻辑、兑换逻辑都已经拆到 `lib/home/`
- `HomeResourcesProvider.tsx` 目前主要负责状态编排和对外暴露 action

## 常用命令

```bash
npm run dev
npm run test
npm run lint
npm run build
```

其中：

- `npm run test`：运行 Vitest 单元测试
- `npm run lint`：检查代码风格和类型相关的静态问题
- `npm run build`：执行生产构建

## 目录提示

- `app/`：Next.js 页面入口
- `components/home/`：首页 UI 组件
- `lib/home/`：类型、规则、数据服务、store 抽象、工具函数
- `tests/home/`：首页核心逻辑测试

## 未来扩展方向

当前项目已经把数据访问抽象成 `AppDataStore`，后续如果接 API 或数据库，优先替换存储实现层，不需要先改 UI。  
