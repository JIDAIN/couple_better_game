# Implement Feature

请实现用户描述的功能，但先按当前项目架构判断影响范围。

## 前置阅读

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/09-status-roadmap.md`
4. 与功能相关的主文档和源码

## 先分类

判断属于：

- game
- nutrition
- weight
- sync/auth
- UI
- Supabase/infrastructure

如果跨域，明确每个写入属于哪个数据域。

## 必守边界

- intake / deficit / weight / exercise 不混淆。
- UI 不重新实现业务规则。
- secret 只在服务端。
- 不恢复 GitHub public JSON。
- 多表写入考虑事务。
- 不根据 legacy coin/gem 变量名猜业务语义。
- Provider 大改前先考虑 service/client 下沉。

## 验证

按 `docs/07-development-testing.md` 选择测试；能运行时完成相关 test/lint/build。

## 完成输出

1. 实现摘要
2. 修改文件 / migration
3. 验证结果
4. 数据/安全影响
5. 未完成项
6. 是否更新 CHANGELOG / roadmap

## 用户输入

$ARGUMENTS
