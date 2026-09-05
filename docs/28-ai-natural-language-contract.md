# AI 自然语言输入与 Clarification Contract

> 状态：AI Access Core 的长期业务契约。Harbor、程序内置 AI、未来 MCP / function calling 共用。

## 1. 目标

用户应该说自然语言，而不是学习数据库字段。

标准链路：

```text
用户自然语言
→ 模型理解意图并抽取可见事实
→ AI Access Core Natural Input Normalizer
→ canonical contract
→ canonical service / permission / idempotency
→ Supabase
```

模型不负责猜内部字段名，也不负责自行解释内部 enum。

## 2. 三类信息处理原则

### A. 可以安全默认：程序自动补

- day / meal / mood / sleep / activity / weight 未给日期：Asia/Shanghai 今天；
- month 未给月份：当前月；
- medicine 新增未给数量：1；
- mailbox 未给格式：letter；
- mood / sleep 未给 action：upsert；
- settings 未给 action：update；
- 一般新增资源未给 action 且没有 record id：create。

### B. 可以安全归一化：程序自动映射

- 我 / 自己 / 本人 → me；
- Ta / 对象 / 伴侣 → ta；
- 双方 / 我们 / 两个人 → all 或 both（按资源语义）；
- 今天 / 昨天 / 前天 → Asia/Shanghai 日期；
- 中文 resource 名称 → canonical resource；
- 中文 action → create/update/delete；
- 数值字符串（如 `64.8kg`）→ number；
- `1小时30分钟` → 90 minutes；
- UI label（如“心动”）→ canonical mood key；
- meal `name / foodName / rawName` → `rawName`；
- meal `quantity` 或 `amount + unit` → `portionDescription`；
- medicine `medicineName / drugName / name` → `name`；
- mailbox `content / text / message / body` → `body`。

### C. 不可安全推断：必须向用户澄清

- “帮我记体重”但没有体重数值；
- “帮我记午饭”但没有食物，也没有照片；
- “药箱帮我记一下”但没有药名；
- “记录睡眠”但没有入睡 / 起床时间；
- “记录活动”但没有活动内容；
- “写封信”但没有正文；
- 修改 / 删除却不知道要操作的记录 ID。

统一错误结构：

```json
{
  "ok": false,
  "errorCode": "LIFE_CLARIFICATION_REQUIRED",
  "clarification": {
    "question": "要记录多少公斤？",
    "missing": ["weightKg"]
  }
}
```

Adapter / AI 收到此类结果时应直接向用户问 `clarification.question`，而不是解释内部字段或让用户排查程序。

## 3. Query contract

| 用户表达 | canonical resource | 自动处理 |
|---|---|---|
| 今天心情 / 睡眠 / 活动 | day | date 默认今天 |
| 本月心情 | month | monthStart 默认本月 1 日 |
| 今天吃了什么 | meal | date 默认今天，person 默认 me |
| 对象今天吃了什么 | meal | person=ta |
| 我们今天吃了什么 | meal | person=all |
| 最近体重 | weight | person 默认 me |
| 药箱里有什么 | medicine | 全部 |
| 有布洛芬吗 | medicine | name 模糊过滤 |
| 信箱 | mailbox | 全部 |
| 生活设置 | settings | 当前设置 |

## 4. Mutation contract

### 4.1 Mood

自然字段：`mood / moodKey / label / emotion`。

程序负责 UI label → canonical key，例如：

```text
心动 → neutral
平静 → calm
```

服务端身份强制当前 actor；用户文本不能切换 owner。

### 4.2 Sleep

接受：

```text
bedtime / sleepTime / fellAsleepAt
wakeTime / wokeAt
```

`23:30` 这类时钟值由程序结合 sleepDate 转为时间戳；起床时刻小于入睡时刻时按跨日处理。

缺入睡或起床时间时必须澄清。

### 4.3 Activity

内容别名：`text / name / title / description / content / activity`。

参与人：

```text
我 → 当前 actor
Ta / 对象 → 另一方
我们 / 一起 / 双方 → both
```

时长：

```text
30分钟 → 30
1小时 → 60
1小时30分钟 → 90
```

### 4.4 Meal

餐次：早餐 / 午饭 / 晚饭 / 加餐 / 零食 / 夜宵自动映射。

食物名称兼容：

```text
items[].name
items[].foodName
items[].rawName
items[].displayName
```

统一进入 canonical `rawName`，`displayName` 默认使用食物名。

份量兼容：

```text
quantity: "1碗"
```

或：

```text
amount: 1
unit: "碗"
```

统一进入 `portionDescription`。

营养数字允许常见别名，最终仍由 canonical meal parser 严格校验。

有可信餐食图片且用户明确要求保存时，可以先创建照片餐食；看不清的重量和营养值不得伪造精确值。

### 4.5 Weight

接受：`weightKg / weight / kg / value`。

`64.8kg` 自动转为 `64.8`。

缺数值必须问用户。

### 4.6 Medicine

药名：`name / medicineName / drugName / title`。

新增数量缺省为 1；明确数量使用 `quantity / count / amount / number`。

日期别名：

- manufactureDate → productionDate；
- expiryDate / expirationDate → packageExpiryDate；
- openDate → openedDate。

不能安全推断药名时必须澄清。

### 4.7 Mailbox

正文：`body / content / text / message / letter`。

格式：明信片 → postcard；否则默认 letter。

sender / recipient 永远由服务端身份规则决定，不允许模型指定越权。

### 4.8 Settings

- anniversary / anniversaryDate → anniversaryDate；
- targetWeight / weightGoal / targetWeightKg → targetWeightKg。

不知道用户要改哪种设置时澄清。

## 5. Update / Delete 规则

自然输入层不得为了“方便”猜 UUID。

```text
修改 / 删除
→ 如果没有可靠 record id
→ 先 query 找到候选记录
→ 有歧义则向用户确认
→ 再 mutate
```

Delete 的安全检查优先于 create/update 字段完整性检查：删除不需要补 meal items、medicine name 等新增字段，但仍必须满足当前消息的明确删除意图和服务端 ownership。

`legacy_home.replace` 继续要求精确确认短语：`确认覆盖游戏数据`。

## 6. 分层责任

### 模型负责

- 识别用户是在查询、记录、修改还是删除；
- 从自然语言 / 图片中抽取用户确实提供的信息；
- 收到 clarification 后问一个简洁问题；
- 不编造不可见事实。

### AI Access Core 负责

- alias；
- default；
- relative date；
- unit / time normalization；
- UI label / enum mapping；
- clarification contract；
- stable tool schema。

### Canonical Service 负责

- 最终严格 schema；
- 权限；
- ownership；
- 幂等；
- 删除安全；
- 正式写入与查询。

### Adapter 负责

- Harbor Sheet / Fast Wake / MCP / API transport；
- 可信身份入口；
- transport auth / retry / timeout；
- 原样传递 clarification 和 tool result。

## 7. 新模块规则

未来新增 cycle、生理期等模块时，必须先扩展这份 contract：

```text
自然表达
→ aliases/defaults
→ 不可推断字段
→ clarification question
→ canonical schema
→ permission
→ tests
```

然后 Harbor / MCP / 内置 AI 自动共享，不为每个 AI 入口重复写业务规则。

## 8. 统一验收矩阵

上线前不再只靠逐条人工试错，至少自动覆盖：

- 查询默认日期 / person；
- 每个 resource 的常见 aliases；
- 缺关键字段的 clarification；
- cat / fish ownership；
- create / update / delete；
- delete 明确意图；
- idempotency；
- meal 图片入口；
- moodLabel 等用户可读语义；
- Harbor receipt 结构；
- MCP / 内置 AI 共用 contract。

人工统一验收只负责验证真实用户体验，不再负责发现基础字段名错误。
