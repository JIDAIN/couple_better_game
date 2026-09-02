import { NextResponse } from "next/server";
import { authorizeLifeRequest, LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody } from "@/lib/server/life-api";
import { deleteMedicine, MedicineCloudError, updateMedicine } from "@/lib/server/supabase-medicine";
import { parseMedicinePayload } from "@/lib/life/medicine-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  const body = await readJsonBody(request); if (!body.ok) return body.response;
  const parsed = parseMedicinePayload(body.value); if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");
  const { id } = await params;
  try { return NextResponse.json({ ok: true, medicine: await updateMedicine(id, parsed.value) }, { headers: LIFE_NO_STORE_HEADERS }); }
  catch (error) { return lifeJsonError(error instanceof MedicineCloudError ? error.message : "更新药品失败", 502, "MEDICINE_WRITE_FAILED"); }
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  const { id } = await params;
  try { return NextResponse.json({ ok: true, medicine: await deleteMedicine(id) }, { headers: LIFE_NO_STORE_HEADERS }); }
  catch (error) { return lifeJsonError(error instanceof MedicineCloudError ? error.message : "删除药品失败", 502, "MEDICINE_WRITE_FAILED"); }
}
