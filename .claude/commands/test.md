# Test Change

根据改动范围选择验证，不要只机械跑一个命令。

## 基础命令

```bash
npm run test
npm run lint
npm run build
```

## 额外验证

- game rules：边界值 + wallet/history rebuild
- snapshot/sync：import/export + first-device/dirty guard
- nutrition：payload validation + RPC CRUD
- Supabase：permission + transaction + cleanup smoke data
- API：unauthorized path + success path + error status
- UI：移动端关键交互 smoke

如果环境无法执行某项，明确写“未运行”和原因，不能写成通过。

$ARGUMENTS
