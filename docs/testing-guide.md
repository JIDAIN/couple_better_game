# 测试指南

当前项目使用 Vitest 作为测试框架。测试重点放在核心结算规则、数据恢复、store 抽象和状态重算上。

## 常用命令

```bash
npm run test
npm run test:watch
```

另外，提交前建议一起跑：

```bash
npm run lint
npm run build
```

## 测试目录

当前测试主要放在 `tests/home/`。

## 当前测试文件说明

| 文件 | 覆盖内容 |
|---|---|
| `settlement-rules.test.ts` | 保护热量宝石、运动宝石、恢复日、情侣 bonus、金币规则、热力图等级和角标 |
| `app-data-store.test.ts` | 保护 snapshot 结构、legacy 兼容、state 与 snapshot 的转换 |
| `memory-app-data-store.test.ts` | 保护内存 store 的读写、清空和引用隔离 |
| `home-stat-service.test.ts` | 保护钱包重算、周统计、连续打卡、seed 导入 |
| `exchange-service.test.ts` | 保护兑换分类、兑换记录创建、排序和兑换对钱包的影响 |
| `daily-record-service.test.ts` | 保护今日记录、历史补录、历史删除和派生统计更新 |
| `home-state-service.test.ts` | 保护默认 state、snapshot 恢复、legacy 兼容、fallback 和重算 |

## 什么时候必须加测试

只要动到下面这些地方，就应该补测试：

- 结算规则
- 金币规则
- 钱包计算
- `DailyRecord` 结构
- `ExchangeRecord` 结构
- snapshot 恢复逻辑
- `localStorage` 或 store 逻辑

## 测试策略

当前项目优先写“真实行为测试”，而不是只测单个函数参数。

推荐思路：

1. 先确认输入
2. 再确认派生结果
3. 再确认 store 或 snapshot 是否正确写回

这样更接近真实业务，也更能保护当前的本地 MVP。  
