-- Reminder Center V1: reusable reminder rules + instances on top of PushPlus delivery.

create table if not exists public.life_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  created_by text not null check (created_by in ('cat','fish')),
  recipient_scope text not null check (recipient_scope in ('cat','fish','both')),
  source_kind text not null default 'custom' check (source_kind in ('custom','medicine','anniversary','system')),
  title text not null check (length(btrim(title)) between 1 and 120),
  content text,
  enabled boolean not null default true,
  schedule_type text not null default 'once' check (schedule_type in ('once','daily')),
  due_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (couple_space_id, created_by) references public.partner_profiles(couple_space_id, partner_key)
);

create table if not exists public.life_reminder_instances (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  rule_id uuid references public.life_reminder_rules(id) on delete cascade,
  recipient text not null check (recipient in ('cat','fish')),
  source_kind text not null check (source_kind in ('custom','medicine','anniversary','system')),
  source_ref text,
  title text not null check (length(btrim(title)) between 1 and 120),
  content text,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','snoozed','completed','dismissed')),
  snoozed_until timestamptz,
  notified_at timestamptz,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (couple_space_id, recipient, dedupe_key)
);

create index if not exists life_reminder_rules_due_idx on public.life_reminder_rules(couple_space_id, enabled, due_at) where archived_at is null;
create index if not exists life_reminder_instances_upcoming_idx on public.life_reminder_instances(couple_space_id, recipient, status, due_at);

alter table public.life_reminder_rules enable row level security;
alter table public.life_reminder_instances enable row level security;
revoke all on public.life_reminder_rules, public.life_reminder_instances from public, anon, authenticated;
grant select, insert, update, delete on public.life_reminder_rules, public.life_reminder_instances to service_role;

create trigger life_reminder_rules_set_updated_at before update on public.life_reminder_rules for each row execute function private.set_updated_at();
create trigger life_reminder_instances_set_updated_at before update on public.life_reminder_instances for each row execute function private.set_updated_at();

alter table public.life_notification_deliveries drop constraint if exists life_notification_deliveries_kind_check;
alter table public.life_notification_deliveries add constraint life_notification_deliveries_kind_check check (kind in ('daily_record','anniversary','reminder'));

create or replace function private.materialize_life_reminder_rule(p_rule_id uuid)
returns integer language plpgsql security invoker set search_path=public,private as $$
declare v_rule public.life_reminder_rules%rowtype; v_actor text; v_count integer:=0; v_key text;
begin
  select * into v_rule from public.life_reminder_rules where id=p_rule_id and enabled and archived_at is null;
  if not found then return 0; end if;
  for v_actor in select unnest(case when v_rule.recipient_scope='both' then array['cat','fish']::text[] else array[v_rule.recipient_scope]::text[] end)
  loop
    v_key := 'rule:'||v_rule.id::text||':'||v_actor||':'||v_rule.due_at::text;
    insert into public.life_reminder_instances(couple_space_id,rule_id,recipient,source_kind,title,content,due_at,dedupe_key,metadata)
    values(v_rule.couple_space_id,v_rule.id,v_actor,v_rule.source_kind,v_rule.title,v_rule.content,v_rule.due_at,v_key,v_rule.metadata)
    on conflict (couple_space_id,recipient,dedupe_key) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end; $$;

create or replace function public.create_life_custom_reminder(p_actor text,p_recipient_scope text,p_title text,p_content text,p_due_at timestamptz,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid; v_id uuid;
begin
  if p_actor not in ('cat','fish') or p_recipient_scope not in ('cat','fish','both') then raise exception 'Invalid reminder identity'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 120 then raise exception 'Invalid reminder title'; end if;
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  insert into public.life_reminder_rules(couple_space_id,created_by,recipient_scope,source_kind,title,content,due_at)
  values(v_space_id,p_actor,p_recipient_scope,'custom',btrim(p_title),nullif(btrim(coalesce(p_content,'')),''),p_due_at) returning id into v_id;
  perform private.materialize_life_reminder_rule(v_id);
  return jsonb_build_object('id',v_id,'recipientScope',p_recipient_scope,'title',btrim(p_title),'dueAt',p_due_at);
end; $$;

create or replace function public.list_life_reminders(p_actor text,p_include_completed boolean default false,p_space_slug text default 'couple-better-game')
returns jsonb language sql stable security invoker set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'ruleId',i.rule_id,'recipient',i.recipient,'sourceKind',i.source_kind,'title',i.title,'content',i.content,'dueAt',i.due_at,'status',i.status,'snoozedUntil',i.snoozed_until,'notifiedAt',i.notified_at,'completedAt',i.completed_at,'metadata',i.metadata) order by coalesce(i.snoozed_until,i.due_at),i.created_at),'[]'::jsonb)
  from public.life_reminder_instances i join public.couple_spaces c on c.id=i.couple_space_id
  where c.slug=p_space_slug and c.archived_at is null and i.recipient=p_actor and (p_include_completed or i.status in ('pending','snoozed'));
$$;

create or replace function public.update_life_reminder_instance(p_actor text,p_instance_id uuid,p_action text,p_snooze_until timestamptz default null,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_space_id uuid; v_result jsonb;
begin
  if p_actor not in ('cat','fish') or p_action not in ('complete','dismiss','snooze') then raise exception 'Invalid reminder action'; end if;
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  if p_action='snooze' and (p_snooze_until is null or p_snooze_until<=now()) then raise exception 'Invalid snooze time'; end if;
  update public.life_reminder_instances set
    status=case p_action when 'complete' then 'completed' when 'dismiss' then 'dismissed' else 'snoozed' end,
    snoozed_until=case when p_action='snooze' then p_snooze_until else null end,
    completed_at=case when p_action='complete' then now() else null end,
    updated_at=now()
  where id=p_instance_id and couple_space_id=v_space_id and recipient=p_actor and status in ('pending','snoozed')
  returning jsonb_build_object('id',id,'status',status,'snoozedUntil',snoozed_until,'completedAt',completed_at) into v_result;
  if v_result is null then raise exception 'Reminder not found'; end if; return v_result;
end; $$;

create or replace function private.materialize_medicine_expiry_reminders(p_space_slug text default 'couple-better-game',p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,private as $$
declare v_space_id uuid; m record; v_actor text; v_offset integer; v_due_date date; v_expiry date; v_count integer:=0; v_key text;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null; if v_space_id is null then return 0; end if;
 for m in select * from public.medicine_items where couple_space_id=v_space_id and archived_at is null loop
   v_expiry:=case when m.package_expiry_date is null then case when m.opened_date is not null and m.opened_shelf_life_days is not null then m.opened_date+m.opened_shelf_life_days else null end when m.opened_date is null or m.opened_shelf_life_days is null then m.package_expiry_date else least(m.package_expiry_date,m.opened_date+m.opened_shelf_life_days) end;
   if v_expiry is null then continue; end if;
   foreach v_offset in array array[30,7,1,0] loop
     v_due_date:=v_expiry-v_offset;
     if v_due_date < (p_now at time zone 'Asia/Shanghai')::date then continue; end if;
     foreach v_actor in array array['cat','fish']::text[] loop
       v_key:='medicine:'||m.id::text||':'||v_actor||':'||v_offset::text||':'||v_expiry::text;
       insert into public.life_reminder_instances(couple_space_id,recipient,source_kind,source_ref,title,content,due_at,dedupe_key,metadata)
       values(v_space_id,v_actor,'medicine',m.id::text,'药箱提醒｜'||m.name,case when v_offset=0 then m.name||' 今天到期' else m.name||' 还有 '||v_offset||' 天到期' end,(v_due_date::timestamp+time '09:00') at time zone 'Asia/Shanghai',v_key,jsonb_build_object('medicineId',m.id,'expiryDate',v_expiry,'daysUntil',v_offset))
       on conflict(couple_space_id,recipient,dedupe_key) do nothing; if found then v_count:=v_count+1; end if;
     end loop;
   end loop;
 end loop; return v_count;
end; $$;

revoke all on function private.materialize_life_reminder_rule(uuid) from public,anon,authenticated;
revoke all on function private.materialize_medicine_expiry_reminders(text,timestamptz) from public,anon,authenticated;
revoke all on function public.create_life_custom_reminder(text,text,text,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.list_life_reminders(text,boolean,text) from public,anon,authenticated;
revoke all on function public.update_life_reminder_instance(text,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function private.materialize_life_reminder_rule(uuid) to service_role;
grant execute on function private.materialize_medicine_expiry_reminders(text,timestamptz) to service_role;
grant execute on function public.create_life_custom_reminder(text,text,text,text,timestamptz,text) to service_role;
grant execute on function public.list_life_reminders(text,boolean,text) to service_role;
grant execute on function public.update_life_reminder_instance(text,uuid,text,timestamptz,text) to service_role;

-- Materialize medicine reminders daily. Push delivery remains handled by the existing 5-minute dispatcher.
do $$ declare v_job_id bigint; begin
 for v_job_id in select jobid from cron.job where jobname='life-reminder-materialize-v1' loop perform cron.unschedule(v_job_id); end loop;
 perform cron.schedule('life-reminder-materialize-v1','10 0 * * *','select private.materialize_medicine_expiry_reminders();');
end $$;
