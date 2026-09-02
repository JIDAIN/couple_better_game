import { NextResponse } from "next/server";
import { authorizeLifeRequest, LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody } from "@/lib/server/life-api";
import { createMedicine, listMedicines, MedicineCloudError } from "@/lib/server/supabase-medicine";
import { parseMedicinePayload } from "@/lib/life/medicine-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  try { return NextResponse.json({ ok: true, medicines: await listMedicines() }, { headers: LIFE_NO_STORE_HEADERS }); }
  catch (error) { return lifeJsonError(error instanceof MedicineCloudError ? error.message : "读取药箱失败", 502, "MEDICINE_READ_FAILED"); }
}

export async function POST(request: Request) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  const body = await readJsonBody(request); if (!body.ok) return body.response;
  const parsed = parseMedicinePayload(body.value); if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");
  try { return NextResponse.json({ ok: true, medicine: await createMedicine(parsed.value) }, { headers: LIFE_NO_STORE_HEADERS }); }
  catch (error) { return lifeJsonError(error instanceof MedicineCloudError ? error.message : "保存药品失败", 502, "MEDICINE_WRITE_FAILED"); }
}
