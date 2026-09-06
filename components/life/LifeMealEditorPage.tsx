"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MealPhotoFrame } from "@/components/life/MealPhotoFrame";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppNutritionBar } from "@/components/ui/AppNutritionBar";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { AppTextarea } from "@/components/ui/AppTextarea";
import { invalidateStaleQuery, peekStaleQuery, setStaleQueryData } from "@/lib/client/use-stale-query";
import { createMealRecord, deleteMealPhoto, deleteMealRecord, fetchMeals, mealPhotoUrl, MealApiError, updateMealPhotoDisplay, updateMealRecord, uploadMealPhoto } from "@/lib/nutrition/meal-client";
import type { MealItemRecord, MealPhotoRotation, MealRecord, MealType, MealWritePayload, NutritionPartnerKey, SnackPeriod } from "@/lib/nutrition/meal-service";

const MEAL_LABELS: Record<MealType, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐", other: "其他" };
const SNACK_LABELS: Record<SnackPeriod, string> = { morning: "上午加餐", afternoon: "下午加餐", evening: "晚上加餐", late_night: "夜间加餐" };
const DEFAULT_MEAL_ART: Record<string, string> = { breakfast: "/illustrations/meals/breakfast.svg", lunch: "/illustrations/meals/lunch.svg", dinner: "/illustrations/meals/dinner.svg", snack: "/illustrations/meals/snack.svg" };
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type ItemDraft = { key: string; rawName: string; portionDescription: string; caloriesKcal: string; carbsG: string; proteinG: string; fatG: string };
function draftKey() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function emptyItem(): ItemDraft { return { key: draftKey(), rawName: "", portionDescription: "", caloriesKcal: "", carbsG: "", proteinG: "", fatG: "" }; }
function fromItem(item: MealItemRecord): ItemDraft { return { key: item.id, rawName: item.rawName, portionDescription: item.portionDescription ?? "", caloriesKcal: item.caloriesKcal == null ? "" : String(item.caloriesKcal), carbsG: item.carbsG == null ? "" : String(item.carbsG), proteinG: item.proteinG == null ? "" : String(item.proteinG), fatG: item.fatG == null ? "" : String(item.fatG) }; }
function numberOrNull(value: string) { const text = value.trim(); if (!text) return null; const number = Number(text); return Number.isFinite(number) && number >= 0 ? number : NaN; }
function dateTimeWithLocalOffset(mealDate: string, time: string) { if (!time) return null; const local = new Date(`${mealDate}T${time}:00`); return Number.isNaN(local.getTime()) ? null : local.toISOString(); }
function validMealType(value: string | null): MealType { return value === "breakfast" || value === "lunch" || value === "dinner" || value === "snack" ? value : "lunch"; }
function validSnackPeriod(value: string | null): SnackPeriod | null { return value === "morning" || value === "afternoon" || value === "evening" || value === "late_night" ? value : null; }
function draftNutrition(items: ItemDraft[]) {
  const fields = ["caloriesKcal", "proteinG", "fatG", "carbsG"] as const;
  const totals: Record<(typeof fields)[number], number> = { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };
  const known: Record<(typeof fields)[number], boolean> = { caloriesKcal: false, proteinG: false, fatG: false, carbsG: false };
  items.forEach((item) => fields.forEach((field) => { const value = numberOrNull(item[field]); if (value != null && !Number.isNaN(value)) { totals[field] += value; known[field] = true; } }));
  return { totals, known };
}

export function LifeMealEditorPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { mePartnerKey, loading: identityLoading } = useLifeIdentity();
  const mealId = params.get("mealId");
  const initialDate = params.get("date") || new Date().toISOString().slice(0, 10);
  const requestedPartner = params.get("person") === "fish" ? "fish" : "cat";
  const requestedType = validMealType(params.get("type"));
  const requestedSnackPeriod = validSnackPeriod(params.get("snackPeriod"));
  const partnerKey = requestedPartner as NutritionPartnerKey;
  const canEdit = mePartnerKey === partnerKey;
  const cachedMeal = mealId ? peekStaleQuery<MealRecord[]>(`meals:${partnerKey}:${initialDate}`)?.find((record) => record.id === mealId) ?? null : null;

  const [meal, setMeal] = useState<MealRecord | null>(cachedMeal);
  const [date, setDate] = useState(cachedMeal?.mealDate ?? initialDate);
  const [mealType, setMealType] = useState<MealType>(cachedMeal?.mealType ?? requestedType);
  const [snackPeriod, setSnackPeriod] = useState<SnackPeriod | null>(cachedMeal?.mealType === "snack" ? cachedMeal.snackPeriod : requestedType === "snack" ? requestedSnackPeriod ?? "afternoon" : null);
  const [time, setTime] = useState(cachedMeal?.eatenAt ? new Date(cachedMeal.eatenAt).toTimeString().slice(0, 5) : "");
  const [note, setNote] = useState(cachedMeal?.note ?? "");
  const [items, setItems] = useState<ItemDraft[]>(cachedMeal?.items.length ? cachedMeal.items.map(fromItem) : [emptyItem()]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoRotationDegrees, setPhotoRotationDegrees] = useState<MealPhotoRotation>(cachedMeal?.photoRotationDegrees ?? 0);
  const [photoScale, setPhotoScale] = useState(cachedMeal?.photoScale ?? 1);
  const [photoTransformTouched, setPhotoTransformTouched] = useState(false);
  const photoTransformTouchedRef = useRef(false);
  const [loading, setLoading] = useState(Boolean(mealId && !cachedMeal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);
  useEffect(() => {
    if (!mealId || !canEdit) return;
    let cancelled = false;
    fetchMeals({ mealDate: initialDate, partnerKey }).then((records) => {
      if (cancelled) return;
      const found = records.find((record) => record.id === mealId && record.deletedAt == null) ?? null;
      if (!found) throw new Error("没有找到这餐记录");
      setMeal(found); setDate(found.mealDate); setMealType(found.mealType); setSnackPeriod(found.mealType === "snack" ? found.snackPeriod : null); setTime(found.eatenAt ? new Date(found.eatenAt).toTimeString().slice(0, 5) : ""); setNote(found.note ?? ""); setItems(found.items.length ? found.items.map(fromItem) : [emptyItem()]); setPhotoRotationDegrees(found.photoRotationDegrees ?? 0); setPhotoScale(found.photoScale ?? 1); setPhotoTransformTouched(false); photoTransformTouchedRef.current = false;
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "读取这餐失败")).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cachedMeal, canEdit, initialDate, mealId, partnerKey]);

  const nutritionPreview = useMemo(() => draftNutrition(items), [items]);
  const caloriePreview = nutritionPreview.known.caloriesKcal ? nutritionPreview.totals.caloriesKcal : null;
  const photoSrc = photoPreviewUrl ?? (!removePhoto && meal?.photoPath ? mealPhotoUrl(meal) : (DEFAULT_MEAL_ART[mealType] ?? DEFAULT_MEAL_ART.lunch));
  const customPhotoVisible = Boolean(photoPreviewUrl || (!removePhoto && meal?.photoPath));
  const title = mealType === "snack" ? (SNACK_LABELS[snackPeriod ?? "afternoon"] ?? "加餐") : MEAL_LABELS[mealType];

  function markPhotoTransformTouched() { photoTransformTouchedRef.current = true; setPhotoTransformTouched(true); }
  function updateItem(itemKey: string, patch: Partial<ItemDraft>) { setItems((current) => current.map((item) => item.key === itemKey ? { ...item, ...patch } : item)); }
  function choosePhoto(file: File | null) {
    setError(null); if (!file) return;
    if (!PHOTO_TYPES.has(file.type.toLowerCase())) { setError("照片仅支持 JPEG、PNG、WebP、HEIC/HEIF"); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError("照片需要小于 10MB"); return; }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setPhotoFile(file); setRemovePhoto(false); setPhotoPreviewUrl(previewUrl); setPhotoRotationDegrees(0); setPhotoScale(1); setPhotoTransformTouched(false); photoTransformTouchedRef.current = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (!photoTransformTouchedRef.current) {
        setPhotoRotationDegrees(probe.naturalHeight > probe.naturalWidth ? 90 : 0);
      }
    };
    probe.src = previewUrl;
  }
  function clearPhoto() { setPhotoFile(null); if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); setRemovePhoto(Boolean(meal?.photoPath)); setPhotoRotationDegrees(0); setPhotoScale(1); setPhotoTransformTouched(false); photoTransformTouchedRef.current = false; }
  function rotatePhoto(delta: -90 | 90) {
    setPhotoRotationDegrees((current) => ((current + delta + 360) % 360) as MealPhotoRotation);
    markPhotoTransformTouched();
  }
  function resizePhoto(percent: number) {
    setPhotoScale(Math.max(0.6, Math.min(1, percent / 100)));
    markPhotoTransformTouched();
  }

  async function save() {
    if (!canEdit) return;
    setError(null);
    if (!items.length || items.some((item) => !item.rawName.trim())) { setError("每个食物明细都需要填写名称"); return; }
    const parsedItems: MealWritePayload["items"] = [];
    for (const item of items) {
      const calories = numberOrNull(item.caloriesKcal); const carbs = numberOrNull(item.carbsG); const protein = numberOrNull(item.proteinG); const fat = numberOrNull(item.fatG);
      if ([calories, carbs, protein, fat].some((value) => Number.isNaN(value))) { setError("营养数值只能填写 0 或更大的数字"); return; }
      if (calories != null && !Number.isInteger(calories)) { setError("热量如果填写，需要使用整数 kcal"); return; }
      parsedItems.push({ foodId: null, rawName: item.rawName.trim(), displayName: item.rawName.trim(), portionDescription: item.portionDescription.trim() || null, estimatedWeightG: null, caloriesKcal: calories, calorieMinKcal: null, calorieMaxKcal: null, proteinG: protein, carbsG: carbs, fatG: fat });
    }
    const payload: MealWritePayload = { partnerKey, mealDate: date, mealType, eatenAt: dateTimeWithLocalOffset(date, time), snackPeriod: mealType === "snack" ? snackPeriod ?? "afternoon" : null, status: "confirmed", source: meal?.source ?? "manual", totalCaloriesKcal: parsedItems.every((item) => item.caloriesKcal !== null) ? parsedItems.reduce((sum, item) => sum + (item.caloriesKcal ?? 0), 0) : null, calorieMinKcal: null, calorieMaxKcal: null, note: note.trim() || null, idempotencyKey: meal?.idempotencyKey ?? null, items: parsedItems };
    setSaving(true);
    try {
      let saved = meal ? await updateMealRecord(meal.id, payload) : await createMealRecord(payload);
      try {
        if (photoFile) {
          saved = await uploadMealPhoto(saved.id, photoFile);
          if (photoTransformTouched) saved = await updateMealPhotoDisplay(saved.id, { rotationDegrees: photoRotationDegrees, scale: photoScale });
        } else if (removePhoto && saved.photoPath) {
          saved = await deleteMealPhoto(saved.id);
        } else if (saved.photoPath && photoTransformTouched) {
          saved = await updateMealPhotoDisplay(saved.id, { rotationDegrees: photoRotationDegrees, scale: photoScale });
        }
      }
      catch (cause) { setError(cause instanceof MealApiError ? `餐食已经保存，但照片没有保存：${cause.message}` : "餐食已经保存，但照片没有保存成功"); return; }
      const targetKey = `meals:${partnerKey}:${saved.mealDate}`;
      const targetCache = peekStaleQuery<MealRecord[]>(targetKey);
      if (targetCache) {
        setStaleQueryData(targetKey, [...targetCache.filter((record) => record.id !== saved.id), saved]);
      } else {
        invalidateStaleQuery(targetKey);
      }
      if (meal && meal.mealDate !== saved.mealDate) {
        const previousKey = `meals:${partnerKey}:${meal.mealDate}`;
        const previousCache = peekStaleQuery<MealRecord[]>(previousKey);
        if (previousCache) setStaleQueryData(previousKey, previousCache.filter((record) => record.id !== saved.id));
      }
      invalidateStaleQuery(`life-month-bundle:${saved.mealDate.slice(0, 7)}`);
      router.push(`/food?date=${encodeURIComponent(saved.mealDate)}`);
    } catch (cause) { setError(cause instanceof MealApiError ? cause.message : "这餐暂时没有保存成功"); }
    finally { setSaving(false); }
  }

  async function removeMeal() {
    if (!meal || !canEdit || !window.confirm(`删除这条${title}记录吗？`)) return;
    setSaving(true);
    try {
      await deleteMealRecord(meal.id);
      const key = `meals:${partnerKey}:${meal.mealDate}`;
      const cached = peekStaleQuery<MealRecord[]>(key);
      if (cached) setStaleQueryData(key, cached.filter((record) => record.id !== meal.id));
      else invalidateStaleQuery(key);
      invalidateStaleQuery(`life-month-bundle:${meal.mealDate.slice(0, 7)}`);
      router.push(`/food?date=${encodeURIComponent(meal.mealDate)}`);
    }
    catch (cause) { setError(cause instanceof MealApiError ? cause.message : "删除失败"); }
    finally { setSaving(false); }
  }

  if (identityLoading) return <AppPageShell title="编辑饮食" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  if (!canEdit) return <AppPageShell title="不能编辑 Ta 的饮食" subtitle="饮食可以互相查看，但各自维护自己的记录。"><section className="life-surface life-section-card"><p className="text-sm text-[var(--life-text-body)]">当前链接属于 Ta。只有 Ta 登录后才能修改这条记录。</p><Link href="/food" className="mt-4 inline-flex rounded-full bg-[var(--life-teal)] px-4 py-2.5 text-sm font-black text-white">返回饮食</Link></section></AppPageShell>;

  return (
    <AppPageShell title={meal ? `编辑${title}` : `添加${title}`} subtitle="把这一餐轻轻记下来。">
      <div className="grid gap-3">
        <section className="life-surface life-section-card life-editor-meta grid gap-3"><div className="grid grid-cols-2 gap-2.5"><label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">日期<AppInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">时间（可选）<AppInput type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div></section>

        <section className="life-surface life-section-card life-meal-editor-overview">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[var(--life-text)]">餐食照片与营养</p>{customPhotoVisible ? <button type="button" onClick={clearPhoto} className="text-xs font-bold text-[var(--life-danger)]">移除照片</button> : null}</div>
          <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] gap-3">
            <div className="grid gap-2">
              <label className="relative cursor-pointer">
                {customPhotoVisible ? <MealPhotoFrame src={photoSrc} alt="当前餐食照片" rotationDegrees={photoRotationDegrees} scale={photoScale}><span className="life-meal-photo-action">更换照片</span></MealPhotoFrame> : <div className="life-meal-editor-photo relative aspect-[4/3] overflow-hidden rounded-[var(--life-radius-control)] bg-[var(--life-surface-warm)]"><Image unoptimized src={photoSrc} alt="默认餐食卡通图" fill sizes="(max-width: 480px) 42vw, 190px" className="object-cover" /><span className="life-meal-photo-action">＋ 上传照片</span></div>}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" disabled={saving} onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)} />
              </label>
              {customPhotoVisible ? <div className="rounded-xl bg-[var(--life-surface-soft)] p-2.5"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => rotatePhoto(-90)} className="rounded-lg bg-[var(--life-surface)] px-2 py-2 text-xs font-bold text-[var(--life-text-body)]">↶ 左转 90°</button><button type="button" onClick={() => rotatePhoto(90)} className="rounded-lg bg-[var(--life-surface)] px-2 py-2 text-xs font-bold text-[var(--life-text-body)]">右转 90° ↷</button></div><label className="mt-2 grid gap-1 text-[10px] font-bold text-[var(--life-text-muted)]"><span className="flex justify-between"><span>照片大小</span><span>{Math.round(photoScale * 100)}%</span></span><input type="range" min="60" max="100" step="5" value={Math.round(photoScale * 100)} onChange={(event) => resizePhoto(Number(event.target.value))} /></label><p className="mt-1.5 text-[9px] leading-4 text-[var(--life-text-muted)]">竖着显示也会完整保留照片内容，空余位置留白，不自动裁掉两边。</p></div> : null}
            </div>
            <div className="grid gap-2 self-center"><AppNutritionBar label="碳水" value={nutritionPreview.known.carbsG ? Number(nutritionPreview.totals.carbsG.toFixed(1)) : null} unit="g" max={100} /><AppNutritionBar label="蛋白质" value={nutritionPreview.known.proteinG ? Number(nutritionPreview.totals.proteinG.toFixed(1)) : null} unit="g" max={60} /><AppNutritionBar label="脂肪" value={nutritionPreview.known.fatG ? Number(nutritionPreview.totals.fatG.toFixed(1)) : null} unit="g" max={50} /><div className="flex items-baseline justify-between border-t border-[var(--life-border-soft)] pt-2"><span className="text-xs font-bold text-[var(--life-text-body)]">总热量</span><strong className="text-base tabular-nums text-[var(--life-text)]">{caloriePreview == null ? "未估算" : `${Math.round(caloriePreview)} kcal`}</strong></div></div>
          </div>
        </section>

        {items.map((item, index) => <section key={item.key} className="life-surface life-section-card life-food-item-editor"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-extrabold text-[var(--life-text)]">食物 {index + 1}</p>{items.length > 1 ? <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))} className="text-xs font-bold text-[var(--life-danger)]">移除</button> : null}</div><div className="grid gap-2.5"><AppInput placeholder="食物名称，例如：米饭、鸡胸肉" value={item.rawName} onChange={(event) => updateItem(item.key, { rawName: event.target.value })} /><AppInput placeholder="份量描述（可选）" value={item.portionDescription} onChange={(event) => updateItem(item.key, { portionDescription: event.target.value })} /><div className="grid grid-cols-2 gap-2"><AppInput inputMode="numeric" placeholder="热量 kcal（可选）" value={item.caloriesKcal} onChange={(event) => updateItem(item.key, { caloriesKcal: event.target.value })} /><AppInput inputMode="decimal" placeholder="碳水 g（可选）" value={item.carbsG} onChange={(event) => updateItem(item.key, { carbsG: event.target.value })} /><AppInput inputMode="decimal" placeholder="蛋白质 g（可选）" value={item.proteinG} onChange={(event) => updateItem(item.key, { proteinG: event.target.value })} /><AppInput inputMode="decimal" placeholder="脂肪 g（可选）" value={item.fatG} onChange={(event) => updateItem(item.key, { fatG: event.target.value })} /></div></div></section>)}

        <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="rounded-[var(--life-radius-control)] border border-dashed border-[var(--life-mint-strong)] bg-[var(--life-surface-soft)] px-4 py-3 text-sm font-extrabold text-[var(--life-teal-strong)]">＋ 添加食物</button>
        <section className="life-surface life-section-card"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-extrabold text-[var(--life-text)]">补充说明</p><span className="text-xs font-bold text-[var(--life-text-muted)]">{caloriePreview == null ? "热量未完整估算" : `约 ${Math.round(caloriePreview)} kcal`}</span></div><AppTextarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="地点、口味、份量等（可选）" /></section>
        {error ? <div className="rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_16%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
        <AppButton variant="primary" disabled={saving || loading} onClick={() => void save()}>{saving ? "保存中…" : `保存${title}`}</AppButton>
        {meal ? <button type="button" disabled={saving} onClick={() => void removeMeal()} className="rounded-full px-4 py-2.5 text-sm font-bold text-[var(--life-danger)]">删除这条记录</button> : null}
      </div>
    </AppPageShell>
  );
}
