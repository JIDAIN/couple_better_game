import type { LifePartnerKey } from "@/lib/life/life-service";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || "https://bfhntnzngozdqsmgfvjk.supabase.co";
const SPACE_SLUG = process.env.COUPLE_SPACE_SLUG?.trim() || "couple-better-game";

function secret() { return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ""; }
async function rpc<T>(name:string, body:Record<string,unknown>) {
  const key=secret(); if(!key) throw new Error("Supabase 服务端环境变量未配置完整");
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  if(!response.ok){const e=await response.json().catch(()=>null) as {message?:string}|null; throw new Error(e?.message||"提醒中心服务调用失败");}
  return await response.json() as T;
}

export function listLifeReminders(actor:LifePartnerKey, includeCompleted=false){return rpc<unknown[]>("list_life_reminders",{p_actor:actor,p_include_completed:includeCompleted,p_space_slug:SPACE_SLUG});}
export function createLifeReminder(actor:LifePartnerKey,input:{recipientScope:"cat"|"fish"|"both";title:string;content?:string;dueAt:string}){return rpc("create_life_custom_reminder",{p_actor:actor,p_recipient_scope:input.recipientScope,p_title:input.title,p_content:input.content||"",p_due_at:input.dueAt,p_space_slug:SPACE_SLUG});}
export function updateLifeReminder(actor:LifePartnerKey,input:{id:string;action:"complete"|"dismiss"|"snooze";snoozeUntil?:string|null}){return rpc("update_life_reminder_instance",{p_actor:actor,p_instance_id:input.id,p_action:input.action,p_snooze_until:input.snoozeUntil||null,p_space_slug:SPACE_SLUG});}
