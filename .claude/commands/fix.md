# Fix Bug

请按本项目规则修复用户描述的 bug。

## 自动前置要求

开始前必须先阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `README.md`
4. 与当前 bug 相关的 `docs/` 文档和源码

如果 `AGENTS.md` 或 `CLAUDE.md` 不存在，请先提醒用户，不要跳过项目规则。

## 工作方式

1. 先理解 bug 现象和期望行为
2. 阅读相关代码
3. 判断可能涉及的文件
4. 找到根因
5. 做最小修改
6. 涉及业务规则、数据结构、store、snapshot、热力图、导入导出时，补充或更新测试
7. 修改后说明验证方式

## 项目边界

必须遵守：

- 不要在 UI 组件中直接读写 `localStorage`
- 不要把业务规则写回 UI 组件
- 不要把复杂业务逻辑塞回 `HomeResourcesProvider.tsx`
- 不要擅自安装依赖
- 不要擅自修改 `package.json`
- 不要执行 `git commit`
- 不要执行 `git push`
- 不要扩大修改范围

## 输出格式

完成后用中文输出：

1. 问题原因
2. 修改摘要
3. 修改文件
4. 验证方式
5. 是否已运行测试、lint、build
6. 风险或未完成事项

## 用户输入

$ARGUMENTS