-- R8: shared configuration, mailbox stationery metadata, weight targets, and transactional snapshots.
alter table public.app_configs add column if not exists anniversary_date date;
alter table public.partner_profiles add column if not exists target_weight_kg numeric(5,2)
  check (target_weight_kg is null or (target_weight_kg > 0 and target_weight_kg < 500));
alter table public.mailbox_letters add column if not exists title text;
alter table public.mailbox_letters add column if not exists theme_key text not null default 'cream';

create or replace function private.mailbox_letter_json(p_id uuid)
returns jsonb language sql stable security invoker set search_path=public,private as $$
 select jsonb_build_object('id',m.id,'senderKey',m.sender_key,'recipientKey',m.recipient_key,'format',m.format,'title',m.title,'themeKey',m.theme_key,'body',m.body,'sentAt',m.sent_at,'source',m.source,'createdAt',m.created_at,'updatedAt',m.updated_at)
 from public.mailbox_letters m where m.id=p_id and m.deleted_at is null;
$$;

create or replace function public.create_mailbox_letter(p_payload jsonb,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid; v_id uuid;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
 insert into public.mailbox_letters(couple_space_id,sender_key,recipient_key,format,title,theme_key,body,sent_at,source)
 values(v_space_id,p_payload->>'senderKey',p_payload->>'recipientKey',coalesce(p_payload->>'format','letter'),nullif(btrim(p_payload->>'title'),''),coalesce(p_payload->>'themeKey','cream'),btrim(p_payload->>'body'),coalesce(nullif(p_payload->>'sentAt','')::timestamptz,now()),'manual') returning id into v_id;
 return private.mailbox_letter_json(v_id);
end;$$;

create or replace function public.update_mailbox_letter(p_letter_id uuid,p_payload jsonb,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
 update public.mailbox_letters set sender_key=p_payload->>'senderKey',recipient_key=p_payload->>'recipientKey',format=coalesce(p_payload->>'format','letter'),title=nullif(btrim(p_payload->>'title'),''),theme_key=coalesce(p_payload->>'themeKey','cream'),body=btrim(p_payload->>'body'),sent_at=coalesce(nullif(p_payload->>'sentAt','')::timestamptz,sent_at),updated_at=now()
 where id=p_letter_id and couple_space_id=v_space_id and deleted_at is null;
 if not found then raise exception 'Letter not found'; end if;
 return private.mailbox_letter_json(p_letter_id);
end;$$;

create table if not exists public.life_backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  scope text not null default 'full' check (scope in ('user','config','full')),
  reason text not null default 'manual' check (reason in ('manual','scheduled','pre_restore','import')),
  schema_version integer not null default 1,
  payload jsonb not null,
  row_counts jsonb not null default '{}'::jsonb,
  created_by text check (created_by is null or created_by in ('cat','fish')),
  created_at timestamptz not null default now()
);
create index if not exists life_backup_snapshots_space_created_idx
  on public.life_backup_snapshots(couple_space_id, created_at desc);
alter table public.life_backup_snapshots enable row level security;

create or replace function public.get_life_settings(p_space_slug text default 'couple-better-game')
returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
   'anniversaryDate',a.anniversary_date,
   'targetWeights',coalesce((select jsonb_object_agg(p.partner_key,p.target_weight_kg) from public.partner_profiles p where p.couple_space_id=c.id),'{}'::jsonb)
 ) from public.couple_spaces c join public.app_configs a on a.couple_space_id=c.id where c.slug=p_space_slug and c.archived_at is null;
$$;

create or replace function public.update_life_settings(p_payload jsonb,p_actor text,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_space_id uuid;
begin
 select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
 if p_payload ? 'anniversaryDate' then update public.app_configs set anniversary_date=nullif(p_payload->>'anniversaryDate','')::date,updated_at=now() where couple_space_id=v_space_id; end if;
 if p_payload ? 'targetWeightKg' then update public.partner_profiles set target_weight_kg=nullif(p_payload->>'targetWeightKg','')::numeric,updated_at=now() where couple_space_id=v_space_id and partner_key=p_actor; end if;
 return public.get_life_settings(p_space_slug);
end;$$;

create or replace function private.life_user_payload(p_space_id uuid)
returns jsonb language sql stable security invoker set search_path=public,private as $$
  select jsonb_build_object(
    'mood_entries',coalesce((select jsonb_agg(to_jsonb(t)) from public.mood_entries t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'sleep_records',coalesce((select jsonb_agg(to_jsonb(t)) from public.sleep_records t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'activity_entries',coalesce((select jsonb_agg(to_jsonb(t)) from public.activity_entries t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'meals',coalesce((select jsonb_agg(to_jsonb(t)) from public.meals t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'meal_items',coalesce((select jsonb_agg(to_jsonb(i)) from public.meal_items i join public.meals m on m.id=i.meal_id where m.couple_space_id=p_space_id),'[]'::jsonb),
    'medicine_items',coalesce((select jsonb_agg(to_jsonb(t)) from public.medicine_items t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'weight_measurements',coalesce((select jsonb_agg(to_jsonb(t)) from public.weight_measurements t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'mailbox_letters',coalesce((select jsonb_agg(to_jsonb(t)) from public.mailbox_letters t where t.couple_space_id=p_space_id),'[]'::jsonb),
    'partner_profiles',coalesce((select jsonb_agg(to_jsonb(t)) from public.partner_profiles t where t.couple_space_id=p_space_id),'[]'::jsonb)
  );
$$;

create or replace function private.life_config_payload(p_space_id uuid)
returns jsonb language sql stable security invoker set search_path=public,private as $$
  select jsonb_build_object(
    'app_configs',coalesce((select jsonb_agg(to_jsonb(t)) from public.app_configs t where t.couple_space_id=p_space_id),'[]'::jsonb)
  );
$$;

create or replace function public.create_life_backup_snapshot(
  p_scope text default 'full', p_reason text default 'manual',
  p_created_by text default null, p_space_slug text default 'couple-better-game'
) returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid; v_payload jsonb; v_id uuid;
begin
  if p_scope not in ('user','config','full') then raise exception 'Invalid backup scope'; end if;
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  v_payload := case p_scope
    when 'user' then jsonb_build_object('schemaVersion',1,'user',private.life_user_payload(v_space_id))
    when 'config' then jsonb_build_object('schemaVersion',1,'config',private.life_config_payload(v_space_id))
    else jsonb_build_object('schemaVersion',1,'user',private.life_user_payload(v_space_id),'config',private.life_config_payload(v_space_id)) end;
  insert into public.life_backup_snapshots(couple_space_id,scope,reason,payload,row_counts,created_by)
  values(v_space_id,p_scope,p_reason,v_payload,jsonb_build_object(
    'moods',jsonb_array_length(coalesce(v_payload#>'{user,mood_entries}','[]'::jsonb)),
    'meals',jsonb_array_length(coalesce(v_payload#>'{user,meals}','[]'::jsonb)),
    'medicines',jsonb_array_length(coalesce(v_payload#>'{user,medicine_items}','[]'::jsonb)),
    'weights',jsonb_array_length(coalesce(v_payload#>'{user,weight_measurements}','[]'::jsonb)),
    'letters',jsonb_array_length(coalesce(v_payload#>'{user,mailbox_letters}','[]'::jsonb))
  ),p_created_by) returning id into v_id;
  return (select jsonb_build_object('id',id,'scope',scope,'reason',reason,'schemaVersion',schema_version,'rowCounts',row_counts,'createdBy',created_by,'createdAt',created_at) from public.life_backup_snapshots where id=v_id);
end; $$;

create or replace function public.list_life_backup_snapshots(p_space_slug text default 'couple-better-game')
returns jsonb language sql stable security invoker set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'scope',b.scope,'reason',b.reason,'schemaVersion',b.schema_version,'rowCounts',b.row_counts,'createdBy',b.created_by,'createdAt',b.created_at) order by b.created_at desc),'[]'::jsonb)
  from public.life_backup_snapshots b join public.couple_spaces c on c.id=b.couple_space_id where c.slug=p_space_slug and c.archived_at is null;
$$;

create or replace function public.get_life_export(p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql stable security invoker set search_path=public,private as $$
declare v_space_id uuid;
begin
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  return jsonb_build_object('schemaVersion',1,'exportedAt',now(),'user',private.life_user_payload(v_space_id));
end; $$;

-- Restore uses one database transaction. A pre-restore snapshot is always created first.
create or replace function public.restore_life_backup_snapshot(p_snapshot_id uuid,p_created_by text default null,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public,private as $$
declare v_space_id uuid; v_payload jsonb; v_scope text;
begin
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  select payload,scope into v_payload,v_scope from public.life_backup_snapshots where id=p_snapshot_id and couple_space_id=v_space_id;
  if v_payload is null then raise exception 'Backup snapshot not found'; end if;
  perform public.create_life_backup_snapshot('full','pre_restore',p_created_by,p_space_slug);
  if v_scope in ('user','full') then
    delete from public.meal_items where meal_id in (select id from public.meals where couple_space_id=v_space_id);
    delete from public.meals where couple_space_id=v_space_id;
    delete from public.mood_entries where couple_space_id=v_space_id;
    delete from public.sleep_records where couple_space_id=v_space_id;
    delete from public.activity_entries where couple_space_id=v_space_id;
    delete from public.medicine_items where couple_space_id=v_space_id;
    delete from public.weight_measurements where couple_space_id=v_space_id;
    delete from public.mailbox_letters where couple_space_id=v_space_id;
    insert into public.mood_entries select * from jsonb_populate_recordset(null::public.mood_entries,coalesce(v_payload#>'{user,mood_entries}','[]'::jsonb));
    insert into public.sleep_records select * from jsonb_populate_recordset(null::public.sleep_records,coalesce(v_payload#>'{user,sleep_records}','[]'::jsonb));
    insert into public.activity_entries select * from jsonb_populate_recordset(null::public.activity_entries,coalesce(v_payload#>'{user,activity_entries}','[]'::jsonb));
    insert into public.meals select * from jsonb_populate_recordset(null::public.meals,coalesce(v_payload#>'{user,meals}','[]'::jsonb));
    insert into public.meal_items select * from jsonb_populate_recordset(null::public.meal_items,coalesce(v_payload#>'{user,meal_items}','[]'::jsonb));
    insert into public.medicine_items select * from jsonb_populate_recordset(null::public.medicine_items,coalesce(v_payload#>'{user,medicine_items}','[]'::jsonb));
    insert into public.weight_measurements select * from jsonb_populate_recordset(null::public.weight_measurements,coalesce(v_payload#>'{user,weight_measurements}','[]'::jsonb));
    insert into public.mailbox_letters select * from jsonb_populate_recordset(null::public.mailbox_letters,coalesce(v_payload#>'{user,mailbox_letters}','[]'::jsonb));
    update public.partner_profiles p set nickname=x.nickname, emoji=x.emoji, target_weight_kg=x.target_weight_kg, updated_at=now()
      from jsonb_populate_recordset(null::public.partner_profiles,coalesce(v_payload#>'{user,partner_profiles}','[]'::jsonb)) x
      where p.couple_space_id=v_space_id and p.partner_key=x.partner_key;
  end if;
  if v_scope in ('config','full') then
    update public.app_configs a set heatmap_start_date=x.heatmap_start_date,coin_week_start_day=x.coin_week_start_day,coin_deficit_streak_days=x.coin_deficit_streak_days,visual_rules=x.visual_rules,anniversary_date=x.anniversary_date,updated_at=now()
      from jsonb_populate_recordset(null::public.app_configs,coalesce(v_payload#>'{config,app_configs}','[]'::jsonb)) x where a.couple_space_id=v_space_id;
  end if;
  return jsonb_build_object('ok',true,'restoredSnapshotId',p_snapshot_id,'restoredAt',now());
end; $$;

create or replace function public.import_life_user_data(p_payload jsonb,p_created_by text default null,p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_space_id uuid; v_id uuid;
begin
  if coalesce((p_payload->>'schemaVersion')::integer,0) <> 1 or jsonb_typeof(p_payload->'user') <> 'object' then
    raise exception 'Unsupported import format';
  end if;
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  insert into public.life_backup_snapshots(couple_space_id,scope,reason,payload,created_by)
  values(v_space_id,'user','import',p_payload,p_created_by) returning id into v_id;
  return public.restore_life_backup_snapshot(v_id,p_created_by,p_space_slug);
end; $$;

revoke all on table public.life_backup_snapshots from public,anon,authenticated;
revoke all on function public.get_life_settings(text) from public,anon,authenticated;
revoke all on function public.update_life_settings(jsonb,text,text) from public,anon,authenticated;
revoke all on function private.life_user_payload(uuid) from public,anon,authenticated;
revoke all on function private.life_config_payload(uuid) from public,anon,authenticated;
revoke all on function public.create_life_backup_snapshot(text,text,text,text) from public,anon,authenticated;
revoke all on function public.list_life_backup_snapshots(text) from public,anon,authenticated;
revoke all on function public.get_life_export(text) from public,anon,authenticated;
revoke all on function public.restore_life_backup_snapshot(uuid,text,text) from public,anon,authenticated;
revoke all on function public.import_life_user_data(jsonb,text,text) from public,anon,authenticated;
grant execute on function private.life_user_payload(uuid) to service_role;
grant execute on function public.get_life_settings(text) to service_role;
grant execute on function public.update_life_settings(jsonb,text,text) to service_role;
grant execute on function private.life_config_payload(uuid) to service_role;
grant execute on function public.create_life_backup_snapshot(text,text,text,text) to service_role;
grant execute on function public.list_life_backup_snapshots(text) to service_role;
grant execute on function public.get_life_export(text) to service_role;
grant execute on function public.restore_life_backup_snapshot(uuid,text,text) to service_role;
grant execute on function public.import_life_user_data(jsonb,text,text) to service_role;

-- OAuth authorization codes are short-lived signed values, but their hashes are
-- persisted to enforce one-time redemption across serverless instances.
create table if not exists public.life_mcp_code_redemptions (
  code_hash text primary key,
  redeemed_at timestamptz not null default now()
);
revoke all on table public.life_mcp_code_redemptions from public,anon,authenticated;
grant insert,select,delete on table public.life_mcp_code_redemptions to service_role;
