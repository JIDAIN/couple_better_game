-- Reminder Center V1 closeout:
-- - per-actor medicine reminder settings
-- - anniversary reminders become first-class Reminder Center instances
-- - snooze can re-notify safely
-- - legacy PushPlus claim keeps only the low-noise daily-record nudge

alter table public.life_notification_preferences
  add column if not exists medicine_reminder_enabled boolean not null default true,
  add column if not exists medicine_offsets integer[] not null default array[30, 7, 1, 0];

alter table public.life_notification_preferences
  drop constraint if exists life_notification_preferences_medicine_offsets_check;
alter table public.life_notification_preferences
  add constraint life_notification_preferences_medicine_offsets_check
  check (coalesce(array_length(medicine_offsets, 1), 0) between 1 and 10);

create or replace function public.get_life_reminder_settings(
  p_actor text,
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_space_id uuid;
  v_pref public.life_notification_preferences%rowtype;
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid reminder actor'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select * into v_pref
  from public.life_notification_preferences
  where couple_space_id = v_space_id and actor = p_actor;
  if not found then raise exception 'Reminder preferences not found'; end if;

  return jsonb_build_object(
    'actor', p_actor,
    'timezone', v_pref.timezone,
    'medicineReminderEnabled', v_pref.medicine_reminder_enabled,
    'medicineOffsets', v_pref.medicine_offsets,
    'anniversaryReminderEnabled', v_pref.anniversary_reminder_enabled,
    'anniversaryOffsets', v_pref.anniversary_offsets,
    'pushPlusConfigured', private.life_pushplus_token(p_actor) is not null
  );
end;
$$;

create or replace function private.materialize_medicine_expiry_reminders(
  p_space_slug text default 'couple-better-game',
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_pref public.life_notification_preferences%rowtype;
  m record;
  v_offset integer;
  v_due_date date;
  v_expiry date;
  v_count integer := 0;
  v_key text;
  v_today date;
  v_horizon date;
begin
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then return 0; end if;

  for v_pref in
    select * from public.life_notification_preferences
    where couple_space_id = v_space_id and enabled and medicine_reminder_enabled
  loop
    v_today := (p_now at time zone v_pref.timezone)::date;
    v_horizon := v_today + 90;

    for m in
      select * from public.medicine_items
      where couple_space_id = v_space_id and archived_at is null
    loop
      v_expiry := case
        when m.package_expiry_date is null then
          case when m.opened_date is not null and m.opened_shelf_life_days is not null
            then m.opened_date + m.opened_shelf_life_days else null end
        when m.opened_date is null or m.opened_shelf_life_days is null then m.package_expiry_date
        else least(m.package_expiry_date, m.opened_date + m.opened_shelf_life_days)
      end;
      if v_expiry is null then continue; end if;

      foreach v_offset in array v_pref.medicine_offsets loop
        if v_offset < 0 or v_offset > 90 then continue; end if;
        v_due_date := v_expiry - v_offset;
        if v_due_date < v_today or v_due_date > v_horizon then continue; end if;

        v_key := 'medicine:' || m.id::text || ':' || v_pref.actor || ':' || v_offset::text || ':' || v_expiry::text;
        insert into public.life_reminder_instances(
          couple_space_id, recipient, source_kind, source_ref, title, content, due_at, dedupe_key, metadata
        ) values (
          v_space_id,
          v_pref.actor,
          'medicine',
          m.id::text,
          '药箱提醒｜' || m.name,
          case when v_offset = 0 then m.name || ' 今天到期' else m.name || ' 还有 ' || v_offset || ' 天到期' end,
          (v_due_date::timestamp + time '09:00') at time zone v_pref.timezone,
          v_key,
          jsonb_build_object('medicineId', m.id, 'expiryDate', v_expiry, 'daysUntil', v_offset)
        )
        on conflict (couple_space_id, recipient, dedupe_key) do nothing;
        if found then v_count := v_count + 1; end if;
      end loop;
    end loop;
  end loop;
  return v_count;
end;
$$;

create or replace function private.materialize_anniversary_reminders(
  p_space_slug text default 'couple-better-game',
  p_now timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_anniversary date;
  v_pref public.life_notification_preferences%rowtype;
  v_today date;
  v_target_date date;
  v_due_date date;
  v_offset integer;
  v_count integer := 0;
  v_key text;
  v_title text;
  v_content text;
begin
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then return 0; end if;

  select anniversary_date into v_anniversary from public.app_configs where couple_space_id = v_space_id;
  if v_anniversary is null then return 0; end if;

  for v_pref in
    select * from public.life_notification_preferences
    where couple_space_id = v_space_id and enabled and anniversary_reminder_enabled
  loop
    v_today := (p_now at time zone v_pref.timezone)::date;
    v_target_date := private.life_anniversary_for_year(v_anniversary, extract(year from v_today)::integer);
    if v_target_date < v_today then
      v_target_date := private.life_anniversary_for_year(v_anniversary, extract(year from v_today)::integer + 1);
    end if;

    foreach v_offset in array v_pref.anniversary_offsets loop
      if v_offset < 0 or v_offset > 365 then continue; end if;
      v_due_date := v_target_date - v_offset;
      if v_due_date < v_today or v_due_date > v_today + 370 then continue; end if;

      if v_offset = 0 then
        v_title := '纪念日提醒｜今天是你们的纪念日';
        v_content := '今天是你们的纪念日 💛 给彼此留一点开心的时间就很好。';
      elsif v_offset = 1 then
        v_title := '纪念日提醒｜明天是你们的纪念日';
        v_content := '明天就是你们的纪念日啦 💛 想庆祝的话，可以提前留一点时间给彼此。';
      else
        v_title := '纪念日提醒｜还有 ' || v_offset || ' 天';
        v_content := '还有 ' || v_offset || ' 天就是你们的纪念日啦 💛';
      end if;

      v_key := 'anniversary:' || v_pref.actor || ':' || v_target_date::text || ':' || v_offset::text;
      insert into public.life_reminder_instances(
        couple_space_id, recipient, source_kind, source_ref, title, content, due_at, dedupe_key, metadata
      ) values (
        v_space_id,
        v_pref.actor,
        'anniversary',
        v_target_date::text,
        v_title,
        v_content,
        (v_due_date::timestamp + v_pref.anniversary_reminder_time) at time zone v_pref.timezone,
        v_key,
        jsonb_build_object('targetDate', v_target_date, 'daysUntil', v_offset)
      )
      on conflict (couple_space_id, recipient, dedupe_key) do nothing;
      if found then v_count := v_count + 1; end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

create or replace function public.update_life_reminder_settings(
  p_actor text,
  p_medicine_enabled boolean,
  p_medicine_offsets integer[],
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_space_id uuid;
  v_offsets integer[];
  v_bad_offset boolean;
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid reminder actor'; end if;

  select array_agg(distinct x order by x desc) into v_offsets
  from unnest(coalesce(p_medicine_offsets, array[]::integer[])) x;
  if coalesce(array_length(v_offsets, 1), 0) not between 1 and 10 then
    raise exception 'Medicine reminder offsets must contain 1 to 10 values';
  end if;
  select exists(select 1 from unnest(v_offsets) x where x < 0 or x > 90) into v_bad_offset;
  if v_bad_offset then raise exception 'Medicine reminder offsets must be between 0 and 90 days'; end if;

  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  update public.life_notification_preferences
  set medicine_reminder_enabled = p_medicine_enabled,
      medicine_offsets = v_offsets,
      updated_at = now()
  where couple_space_id = v_space_id and actor = p_actor;
  if not found then raise exception 'Reminder preferences not found'; end if;

  -- Rebuild only still-active medicine occurrences. Dismissed/completed history stays intact.
  delete from public.life_reminder_instances
  where couple_space_id = v_space_id
    and recipient = p_actor
    and source_kind = 'medicine'
    and status in ('pending', 'snoozed');

  if p_medicine_enabled then
    perform private.materialize_medicine_expiry_reminders(p_space_slug, now());
  end if;

  return public.get_life_reminder_settings(p_actor, p_space_slug);
end;
$$;

-- Snoozing a reminder after a successful push must make it eligible for a later push again.
create or replace function public.update_life_reminder_instance(
  p_actor text,
  p_instance_id uuid,
  p_action text,
  p_snooze_until timestamptz default null,
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_space_id uuid;
  v_result jsonb;
begin
  if p_actor not in ('cat','fish') or p_action not in ('complete','dismiss','snooze') then raise exception 'Invalid reminder action'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if p_action = 'snooze' and (p_snooze_until is null or p_snooze_until <= now()) then raise exception 'Invalid snooze time'; end if;

  update public.life_reminder_instances set
    status = case p_action when 'complete' then 'completed' when 'dismiss' then 'dismissed' else 'snoozed' end,
    snoozed_until = case when p_action = 'snooze' then p_snooze_until else null end,
    notified_at = case when p_action = 'snooze' then null else notified_at end,
    completed_at = case when p_action = 'complete' then now() else null end,
    updated_at = now()
  where id = p_instance_id and couple_space_id = v_space_id and recipient = p_actor and status in ('pending','snoozed')
  returning jsonb_build_object('id', id, 'status', status, 'snoozedUntil', snoozed_until, 'completedAt', completed_at) into v_result;

  if v_result is null then raise exception 'Reminder not found'; end if;
  return v_result;
end;
$$;

-- Anniversary delivery now comes from Reminder Center instances. Keep the legacy claim only for the daily-record nudge.
create or replace function public.claim_life_notification_reminders(
  p_actor text,
  p_now timestamptz default now(),
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_pref public.life_notification_preferences%rowtype;
  v_local_ts timestamp without time zone;
  v_local_date date;
  v_local_time time without time zone;
  v_delivery_id uuid;
  v_reminders jsonb := '[]'::jsonb;
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid reminder actor'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select * into v_pref from public.life_notification_preferences
  where couple_space_id = v_space_id and actor = p_actor;
  if not found or not v_pref.enabled then
    return jsonb_build_object('actor', p_actor, 'reminders', v_reminders);
  end if;

  v_local_ts := p_now at time zone v_pref.timezone;
  v_local_date := v_local_ts::date;
  v_local_time := v_local_ts::time;

  if v_pref.daily_record_reminder_enabled
     and v_local_time >= v_pref.daily_record_reminder_time
     and v_local_time < (v_pref.daily_record_reminder_time + interval '20 minutes')::time
     and not private.life_actor_has_any_record(v_space_id, p_actor, v_local_date)
  then
    v_delivery_id := private.reserve_life_notification_delivery(
      v_space_id, p_actor, 'daily_record', v_local_date,
      'daily_record:' || p_actor || ':' || v_local_date::text,
      jsonb_build_object('recordDate', v_local_date)
    );
    if v_delivery_id is not null then
      v_reminders := v_reminders || jsonb_build_array(jsonb_build_object(
        'deliveryId', v_delivery_id, 'kind', 'daily_record', 'localDate', v_local_date
      ));
    end if;
  end if;

  return jsonb_build_object('actor', p_actor, 'reminders', v_reminders);
end;
$$;

-- Use effective due time in delivery dedupe, so a snoozed reminder can legitimately send again.
create or replace function private.dispatch_due_life_reminders_for_actor(
  p_actor text,
  p_now timestamptz default now(),
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_space_id uuid;
  v_row record;
  v_delivery_id uuid;
  v_send jsonb;
  v_sent integer := 0;
  v_failed integer := 0;
  v_ai_name text;
  v_effective_due timestamptz;
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid reminder actor'; end if;
  if private.life_pushplus_token(p_actor) is null then return jsonb_build_object('actor',p_actor,'configured',false,'sent',0,'failed',0); end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then return jsonb_build_object('actor',p_actor,'configured',true,'sent',0,'failed',0); end if;
  v_ai_name := case when p_actor='cat' then '团子' else '仔仔' end;

  for v_row in
    select i.* from public.life_reminder_instances i
    where i.couple_space_id = v_space_id and i.recipient = p_actor and i.status in ('pending','snoozed')
      and coalesce(i.snoozed_until,i.due_at) <= p_now and i.notified_at is null
    order by coalesce(i.snoozed_until,i.due_at), i.created_at limit 20
  loop
    v_effective_due := coalesce(v_row.snoozed_until, v_row.due_at);
    v_delivery_id := private.reserve_life_notification_delivery(
      v_space_id,
      p_actor,
      'reminder',
      (p_now at time zone 'Asia/Shanghai')::date,
      'reminder:' || v_row.id::text || ':' || extract(epoch from v_effective_due)::bigint::text,
      jsonb_build_object('instanceId',v_row.id,'sourceKind',v_row.source_kind,'effectiveDueAt',v_effective_due)
    );
    if v_delivery_id is null then continue; end if;

    v_send := private.life_pushplus_send(
      p_actor,
      v_row.title,
      coalesce(v_row.content,'') || case when coalesce(v_row.content,'')='' then '' else '<br><br>' end || '——' || v_ai_name
    );
    if coalesce((v_send->>'ok')::boolean,false) then
      perform public.complete_life_notification_delivery(v_delivery_id,p_actor,true,v_send->>'providerMessageId',null,p_space_slug);
      update public.life_reminder_instances set notified_at = p_now, updated_at = now() where id = v_row.id;
      v_sent := v_sent + 1;
    else
      perform public.complete_life_notification_delivery(v_delivery_id,p_actor,false,null,v_send->>'error',p_space_slug);
      v_failed := v_failed + 1;
    end if;
  end loop;
  return jsonb_build_object('actor',p_actor,'configured',true,'sent',v_sent,'failed',v_failed);
end;
$$;

revoke all on function public.get_life_reminder_settings(text,text) from public,anon,authenticated;
revoke all on function public.update_life_reminder_settings(text,boolean,integer[],text) from public,anon,authenticated;
revoke all on function private.materialize_anniversary_reminders(text,timestamptz) from public,anon,authenticated;
grant execute on function public.get_life_reminder_settings(text,text) to service_role;
grant execute on function public.update_life_reminder_settings(text,boolean,integer[],text) to service_role;
grant execute on function private.materialize_anniversary_reminders(text,timestamptz) to service_role;

-- Keep one materializer job for the first-class Reminder Center sources.
do $$
declare v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'life-reminder-materialize-v1' loop
    perform cron.unschedule(v_job_id);
  end loop;
  perform cron.schedule(
    'life-reminder-materialize-v1',
    '10 0 * * *',
    'select private.materialize_medicine_expiry_reminders(), private.materialize_anniversary_reminders();'
  );
end $$;

-- Materialize current future occurrences immediately.
select private.materialize_medicine_expiry_reminders();
select private.materialize_anniversary_reminders();
