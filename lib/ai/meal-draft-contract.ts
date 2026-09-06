type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compactConfirmationText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s，。！？、,.!?；;：:]/g, "");
}

export function isMealDraftConfirmationText(value: string) {
  const compact = compactConfirmationText(value);
  if (!compact) return false;

  if (
    [
      "确认",
      "确认记录",
      "确认保存",
      "确认写入",
      "没问题",
      "可以",
      "好",
      "好的",
      "就这样",
      "就这样吧",
      "按这个记",
      "按这个记录",
      "按这个保存",
      "就按这个记",
      "就按这个记录",
      "就按这个保存",
      "记进去",
      "保存吧",
    ].includes(compact)
  ) {
    return true;
  }

  return /(确认(记录|保存|写入)|没问题.*(记|记录|保存|写入)|可以.*(记|记录|保存|写入)|就这样.*(记|记录|保存|写入)|就按(这个|这版).*(记|记录|保存|写入)|按(这个|这版).*(记|记录|保存|写入))/.test(compact);
}

export function isMealCreateMutation(value: unknown) {
  const args = record(value);
  const resource = text(args.resource).toLowerCase();
  if (!["meal", "三餐", "餐食", "饮食", "吃饭"].includes(resource)) return false;

  const action = text(args.action).toLowerCase();
  if (["delete", "删除", "删掉", "移除", "update", "修改", "更新", "编辑"].includes(action)) {
    return false;
  }

  const id = text(args.id ?? args.recordId);
  return !id;
}

export const MEAL_DRAFT_CONFIRMATION_QUESTION =
  "需要向用户确认：这是一顿新的饮食记录。请先根据用户文字和图片生成一份‘待确认饮食草稿’，不要立即写入程序。单张图片时结合用户对实际摄入的描述（例如基本都吃完、吃了一半、吃了几口、某样没吃）估算真正吃下去的量；如果用户同时提供餐前和餐后两张图片，必须先匹配同类食物并按‘实际摄入 = 餐前估计量 - 餐后剩余量’做差分，用户明确文字说明优先于图片差分。草稿应尽量列出每项食物的实际摄入量、估计重量、热量、蛋白质、碳水、脂肪，以及整顿总热量/总蛋白质/总碳水/总脂肪，并标出明显不确定项。先把草稿展示给用户，让用户修改或明确确认；只有用户在看到草稿后回复确认记录、没问题、可以、就这样、按这个记等明确确认，才再次调用 life_mutate 创建正式 meal。";

export const MEAL_DRAFT_AGENT_RULES = [
  "饮食记录必须采用‘先草稿、后确认、再写入’流程。用户第一句话即使说了‘帮我记录/记一下’，只要是新 meal，也不能直接写数据库。",
  "草稿必须基于用户实际吃下去的量，而不是餐前摆盘总量。用户文字说明的优先级最高。",
  "单张图片：结合‘基本都吃完/吃了一半/吃了几口/这个没吃/后来又添了’等文字，估算实际摄入。",
  "两张图片：若是餐前+餐后，先按食物种类匹配，不按位置死配；用餐前量减餐后剩余量估算实际摄入。骨头、果皮、果核、包装等不可食残余不能当成可食剩余机械扣减。多人共享菜要结合用户说明的个人份额。",
  "草稿尽量完整列出每项 rawName/displayName、portionDescription、estimatedWeightG、caloriesKcal、proteinG、carbsG、fatG，并汇总 totalCaloriesKcal、总蛋白质、总碳水、总脂肪。数值是合理估算，不要伪装成精确测量。",
  "如果有一个关键事实完全无法安全判断，可以只追问一个最关键问题；不要为了每个细节连续追问。",
  "用户修改草稿时先重新计算并再次展示，不要边改边写库。",
  "只有用户在看到草稿后明确确认（如确认记录、没问题、可以、就这样、按这个记）才调用 life_mutate 创建 meal；确认后应一次性提交尽可能完整的营养字段。",
  "如果用户还要求保存图片，确认后再把图片和 meal 一起正式绑定；客户端无法透传图片时继续走 MEDIA_ATTACHMENT_REQUIRED 补传链路，不能假装图片已保存。",
].join("\n");
