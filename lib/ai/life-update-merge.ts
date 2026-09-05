type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function first(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

function setIfDefined(target: JsonRecord, key: string, value: unknown) {
  if (value !== undefined) target[key] = value;
}

export function canonicalizeLifeUpdatePatch(resource: string, input: unknown): JsonRecord {
  const row = record(input);
  const out: JsonRecord = {};

  switch (resource) {
    case "activity":
      setIfDefined(out, "activityDate", first(row, ["activityDate", "date"]));
      setIfDefined(out, "text", first(row, ["text", "name", "title", "description", "content", "activity"]));
      setIfDefined(out, "participantScope", first(row, ["participantScope", "person", "who", "participants"]));
      setIfDefined(out, "occurredAt", first(row, ["occurredAt", "time", "occurred"]));
      setIfDefined(out, "activityType", first(row, ["activityType", "type"]));
      setIfDefined(out, "durationMinutes", first(row, ["durationMinutes", "duration", "minutes", "timeSpent"]));
      break;
    case "meal":
      setIfDefined(out, "mealDate", first(row, ["mealDate", "date"]));
      setIfDefined(out, "mealType", first(row, ["mealType", "type", "meal", "mealName"]));
      setIfDefined(out, "snackPeriod", first(row, ["snackPeriod", "snackTime"]));
      setIfDefined(out, "eatenAt", first(row, ["eatenAt", "time", "mealTime"]));
      setIfDefined(out, "note", first(row, ["note", "remark", "备注"]));
      if (Array.isArray(row.items)) out.items = row.items;
      else {
        const topName = first(row, ["rawName", "name", "foodName", "food"]);
        if (topName !== undefined) {
          out.items = [{
            rawName: topName,
            quantity: first(row, ["quantity", "portion", "serving"]),
            amount: first(row, ["amount", "count", "number"]),
            unit: first(row, ["unit", "measureUnit"]),
          }];
        }
      }
      break;
    case "weight":
      setIfDefined(out, "measurementDate", first(row, ["measurementDate", "date"]));
      setIfDefined(out, "measuredAt", first(row, ["measuredAt", "time"]));
      setIfDefined(out, "weightKg", first(row, ["weightKg", "weight", "kg", "value"]));
      setIfDefined(out, "note", first(row, ["note", "remark", "备注"]));
      break;
    case "medicine":
      setIfDefined(out, "name", first(row, ["name", "medicineName", "drugName", "title", "medicine"]));
      setIfDefined(out, "productionDate", first(row, ["productionDate", "manufactureDate", "madeDate"]));
      setIfDefined(out, "shelfLifeMonths", first(row, ["shelfLifeMonths", "shelfLife", "shelfMonths"]));
      setIfDefined(out, "packageExpiryDate", first(row, ["packageExpiryDate", "expiryDate", "expirationDate", "expiresAt"]));
      setIfDefined(out, "openedDate", first(row, ["openedDate", "openDate"]));
      setIfDefined(out, "openedShelfLifeDays", first(row, ["openedShelfLifeDays", "openedShelfLife", "openShelfDays"]));
      setIfDefined(out, "quantity", first(row, ["quantity", "count", "amount", "number"]));
      setIfDefined(out, "note", first(row, ["note", "remark", "备注"]));
      break;
    case "mailbox":
      setIfDefined(out, "body", first(row, ["body", "content", "text", "message", "letter"]));
      setIfDefined(out, "format", first(row, ["format", "type", "mailType"]));
      setIfDefined(out, "title", first(row, ["title", "subject"]));
      setIfDefined(out, "themeKey", first(row, ["themeKey", "theme"]));
      setIfDefined(out, "sentAt", first(row, ["sentAt", "time"]));
      break;
    default:
      return { ...row };
  }

  return out;
}

export function pickActivityUpdateBase(row: JsonRecord): JsonRecord {
  return {
    activityDate: row.activityDate,
    text: row.text,
    participantScope: row.participantScope,
    occurredAt: row.occurredAt,
    activityType: row.activityType,
    durationMinutes: row.durationMinutes,
  };
}

export function pickMealUpdateBase(row: JsonRecord, items: JsonRecord[]): JsonRecord {
  return {
    mealDate: row.mealDate,
    mealType: row.mealType,
    snackPeriod: row.snackPeriod,
    eatenAt: row.eatenAt,
    note: row.note,
    items,
  };
}

export function pickWeightUpdateBase(row: JsonRecord): JsonRecord {
  return {
    measurementDate: row.measurementDate,
    measuredAt: row.measuredAt,
    weightKg: row.weightKg,
    note: row.note,
  };
}

export function pickMedicineUpdateBase(row: JsonRecord): JsonRecord {
  return {
    name: row.name,
    productionDate: row.productionDate,
    shelfLifeMonths: row.shelfLifeMonths,
    packageExpiryDate: row.packageExpiryDate,
    openedDate: row.openedDate,
    openedShelfLifeDays: row.openedShelfLifeDays,
    quantity: row.quantity,
    note: row.note,
  };
}

export function pickMailboxUpdateBase(row: JsonRecord): JsonRecord {
  return {
    body: row.body,
    format: row.format,
    title: row.title,
    themeKey: row.themeKey,
    sentAt: row.sentAt,
  };
}

export function camelizeDbRow(input: unknown): JsonRecord {
  const row = record(input);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()),
    value,
  ]));
}
