# 重构后的开发指南

本文档说明以后在当前代码结构下应该如何继续开发，尽量避免把 UI、业务规则和数据管理重新揉回一起。

## 1. 新增 UI 的规则

新增页面或组件时，优先放在 `components/` 下。

开发 UI 时请遵守：

- 不要直接读写 `localStorage`
- 不要在 UI 里计算钱包、金币、热力图等级、热力图角标
- 不要把结算规则写死在组件里
- 通过 `useHomeResources()` 获取状态和 action

如果 UI 只是展示结果，就应该让业务逻辑先在 `lib/home` 里算好。

## 2. 新增业务规则的规则

如果要新增或修改结算规则、金币规则、热力图规则，优先放在：

- `lib/home/settlement-rules.ts`

如果是和“记录创建/补录/删除”相关的纯业务动作，可以放在：

- `lib/home/daily-record-service.ts`
- `lib/home/exchange-service.ts`
- 或新的 `lib/home/*-service.ts`

改规则时一定要补测试。没有测试就改规则，很容易把历史数据或钱包重算搞偏。

## 3. 新增用户数据字段

如果要新增会随着用户操作变化的数据字段，处理顺序建议是：

1. 先更新 `lib/home/types.ts`
2. 再更新 `AppDataSnapshot` 转换
3. 再更新 `home-state-service.ts` 的恢复逻辑
4. 再补对应测试
5. 最后再让 UI 使用新字段

这里最重要的是：**不要只改 UI，不改 snapshot 和恢复逻辑。**

## 4. 新增配置项

如果要新增配置项，处理顺序建议是：

1. 更新 `AppConfigData`
2. 更新默认配置
3. 更新 snapshot 恢复逻辑
4. 更新相关文档
5. 再让 UI 使用配置

配置项应该和运行时数据分开，不要混在一起。

## 5. 新增本地存储字段

如果要新增要落到本地的数据字段：

- 先想清楚它属于 `UserRuntimeData` 还是 `AppConfigData`
- 再更新 snapshot
- 再更新 `home-state-service.ts`
- 再更新 store 测试

不要直接在 UI 组件里读写 `localStorage`。  
当前的本地存储层只应该通过 `AppDataStore` 接口访问。

## 6. 未来接 API 的规则

如果未来要接远程 API 或数据库，优先替换的是 `AppDataStore` 的实现。

推荐顺序：

1. 新增远程实现，例如 `remote-api-app-data-store.ts`
2. 保持 `AppDataStore` 接口不变
3. 让 `home-state-service.ts` 继续通过 store 读写
4. UI 和 Provider 尽量不动

也就是说，UI 不应该关心数据来自本地还是远程。

## 7. 后续继续拆分 Provider 的建议顺序

如果后续还要继续拆 `HomeResourcesProvider.tsx`，建议优先沿着现在的 service 边界继续拆：

1. 把 action 的更多编排继续下沉到 service
2. 把重复的派生字段计算继续整理成更小的纯函数
3. 再考虑 reducer 化

不要为了“看起来更整洁”把逻辑重新塞回 Provider。

## 8. 不要做的事

以后开发时尽量避免：

- 把业务逻辑重新写回 Provider
- 在 UI 组件里计算钱包、金币、热力图
- 把 runtime 数据和 config 混在一起
- 没有测试就改结算规则
- 不通过 `AppDataStore` 直接接触存储

## 9. 当前推荐的开发姿势

一个比较稳的顺序是：

1. 先改 `lib/home`
2. 再补测试
3. 再让 `components/home` 消费新结果
4. 最后跑 `npm run test`、`npm run lint`、`npm run build`

这样做会慢一点，但回头修 bug 会轻松很多。  
