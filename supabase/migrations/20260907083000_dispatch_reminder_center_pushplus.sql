-- Send due Reminder Center instances through the existing PushPlus channel.

create or replace function private.dispatch_due_life_reminders_for_actor(
  p_actor text,
  p_now timestamptz default now(),
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_space_id uuid; v_row record; v_delivery_id uuid; v_send jsonb; v_sent integer:=0; v_failed integer:=0; v_ai_name text;
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid reminder actor'; end if;
  if private.life_pushplus_token(p_actor) is null then return jsonb_build_object('actor',p_actor,'configured',false,'sent',0,'failed',0); end if;
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  if v_space_id is null then return jsonb_build_object('actor',p_actor,'configured',true,'sent',0,'failed',0); end if;
  v_ai_name:=case when p_actor='cat' then '团子' else '仔仔' end;

  for v_row in
    select i.* from public.life_reminder_instances i
    where i.couple_space_id=v_space_id and i.recipient=p_actor and i.status in ('pending','snoozed')
      and coalesce(i.snoozed_until,i.due_at)<=p_now and i.notified_at is null
    order by coalesce(i.snoozed_until,i.due_at),i.created_at limit 20
  loop
    v_delivery_id:=private.reserve_life_notification_delivery(v_space_id,p_actor,'reminder',(p_now at time zone 'Asia/Shanghai')::date,'reminder:'||v_row.id::text,jsonb_build_object('instanceId',v_row.id,'sourceKind',v_row.source_kind));
    if v_delivery_id is null then continue; end if;
    v_send:=private.life_pushplus_send(p_actor,v_row.title,coalesce(v_row.content,'')||case when coalesce(v_row.content,'')='' then '' else '<br><br>' end||'——'||v_ai_name);
    if coalesce((v_send->>'ok')::boolean,false) then
      perform public.complete_life_notification_delivery(v_delivery_id,p_actor,true,v_send->>'providerMessageId',null,p_space_slug);
      update public.life_reminder_instances set notified_at=p_now,updated_at=now() where id=v_row.id;
      v_sent:=v_sent+1;
    else
      perform public.complete_life_notification_delivery(v_delivery_id,p_actor,false,null,v_send->>'error',p_space_slug);
      v_failed:=v_failed+1;
    end if;
  end loop;
  return jsonb_build_object('actor',p_actor,'configured',true,'sent',v_sent,'failed',v_failed);
end;
$$;

create or replace function private.dispatch_life_pushplus_reminders(
  p_now timestamptz default now(),
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,private
as $$
declare v_cat_legacy jsonb; v_fish_legacy jsonb; v_cat_center jsonb; v_fish_center jsonb;
begin
  v_cat_legacy:=private.dispatch_life_pushplus_for_actor('cat',p_now,p_space_slug);
  v_fish_legacy:=private.dispatch_life_pushplus_for_actor('fish',p_now,p_space_slug);
  v_cat_center:=private.dispatch_due_life_reminders_for_actor('cat',p_now,p_space_slug);
  v_fish_center:=private.dispatch_due_life_reminders_for_actor('fish',p_now,p_space_slug);
  return jsonb_build_object('cat',jsonb_build_object('legacy',v_cat_legacy,'center',v_cat_center),'fish',jsonb_build_object('legacy',v_fish_legacy,'center',v_fish_center));
end;
$$;

revoke all on function private.dispatch_due_life_reminders_for_actor(text,timestamptz,text) from public,anon,authenticated;
