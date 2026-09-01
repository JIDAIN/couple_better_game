# Fix Error

请根据用户提供的报错信息定位并修复问题。

## 自动前置要求

开始前必须先阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. `package.json`
5. 与报错相关的源码和文档

如果 `AGENTS.md` 或 `CLAUDE.md` 不存在，请先提醒用户。

## 工作方式

1. 分析报错信息
2. 判断报错来自构建、lint、测试、运行时还是浏览器控制台
3. 找到最可能的问题文件
4. 做最小修复
5. 不要顺手重构
6. 修复后说明应该运行什么命令验证

## 常见验证命令

```bash
npm run test
npm run lint
npm run build
```

## 限制

- 不要擅自安装依赖
- 不要擅自修改 `package.json`
- 不要执行 `git commit`
- 不要执行 `git push`
- 不要使用危险命令
- 不要扩大修改范围

## 输出格式

完成后用中文输出：

1. 报错原因
2. 修改摘要
3. 修改文件
4. 验证方式
5. 是否已运行测试、lint、build
6. 风险或未完成事项

## 用户输入

$ARGUMENTS