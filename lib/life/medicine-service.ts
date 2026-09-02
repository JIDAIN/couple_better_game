export type MedicineRecord = {
  id: string;
  name: string;
  productionDate: string | null;
  shelfLifeMonths: number | null;
  packageExpiryDate: string | null;
  openedDate: string | null;
  openedShelfLifeDays: number | null;
  openedExpiryDate: string | null;
  finalExpiryDate: string | null;
  quantity: number;
  note: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type MedicineWritePayload = {
  name: string;
  productionDate?: string | null;
  shelfLifeMonths?: number | null;
  packageExpiryDate?: string | null;
  openedDate?: string | null;
  openedShelfLifeDays?: number | null;
  quantity: number;
  note?: string | null;
};

export type MedicineStatus = "expired" | "soon" | "normal" | "unknown";

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function parseMedicinePayload(value: unknown): { ok: true; value: MedicineWritePayload } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "药品记录格式不正确" };
  const v = value as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || name.length > 120) return { ok: false, reason: "药品名称不能为空且不能超过120字" };
  const dateFields = ["productionDate", "packageExpiryDate", "openedDate"] as const;
  for (const key of dateFields) if (v[key] != null && v[key] !== "" && !isIsoDate(v[key])) return { ok: false, reason: `${key} 必须是 YYYY-MM-DD` };
  const shelf = v.shelfLifeMonths == null || v.shelfLifeMonths === "" ? null : Number(v.shelfLifeMonths);
  const openedDays = v.openedShelfLifeDays == null || v.openedShelfLifeDays === "" ? null : Number(v.openedShelfLifeDays);
  const quantity = Number(v.quantity ?? 1);
  if (shelf != null && (!Number.isInteger(shelf) || shelf < 1 || shelf > 240)) return { ok: false, reason: "有效期月数不正确" };
  if (openedDays != null && (!Number.isInteger(openedDays) || openedDays < 1 || openedDays > 3650)) return { ok: false, reason: "开封后有效天数不正确" };
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) return { ok: false, reason: "数量必须是0到9999的整数" };
  const note = typeof v.note === "string" ? v.note.trim().slice(0, 500) || null : null;
  return { ok: true, value: { name, productionDate: (v.productionDate as string) || null, shelfLifeMonths: shelf, packageExpiryDate: (v.packageExpiryDate as string) || null, openedDate: (v.openedDate as string) || null, openedShelfLifeDays: openedDays, quantity, note } };
}

export function medicineStatus(finalExpiryDate: string | null, today = new Date(), soonDays = 120): MedicineStatus {
  if (!finalExpiryDate) return "unknown";
  const end = new Date(`${finalExpiryDate}T23:59:59`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (end.getTime() < base.getTime()) return "expired";
  return end.getTime() <= base.getTime() + soonDays * 86400000 ? "soon" : "normal";
}
