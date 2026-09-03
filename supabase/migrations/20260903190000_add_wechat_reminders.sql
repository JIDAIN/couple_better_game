-- R10 follow-up: low-noise WeChat reminders for Harbor Cat / Harbor Fish.
-- PushPlus message tokens stay in each Apps Script project's Script Properties.

create table if not exists public.life_notification_preferences (
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  actor text not null check (actor in ('cat', 'fish')),
  enabled boolean not null default true,
  timezone text not null default 'Asia/Shanghai',
  daily_record_reminder_enabled boolean not null default true,
  daily_record_reminder_time time without time zone not null default time '21:15',
  anniversary_reminder_enabled boolean not null default true,
  anniversary_reminder_time time without time zone not null default time '09:15',
  anniversary_offsets integer[] not null default array[7, 1, 0],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (couple_space_id, actor),
  foreign key (couple_space_id, actor)
    references public.partner_profiles(couple_space_id, partner_key),
  check (coalesce(array_length(anniversary_offsets, 1), 0) between 1 and 10)
);

create table if not exists public.life_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  actor text not null check (actor in ('cat', 'fish')),
  kind text not null check (kind in ('daily_record', 'anniversary')),
  local_date date not null,
  dedupe_key text not null,
  status text not null default 'reserved' check (status in ('reserved', 'accepted', 'failed')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 3),
  metadata jsonb not null default '{}'::jsonb,
  provider text not null default 'pushplus_wechat',
  provider_message_id text,
  provider_error text,
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_space_id, actor)
    references public.partner_profiles(couple_space_id, partner_key),
  unique (couple_space_id, dedupe_key)
);

create index if not exists life_notification_deliveries_actor_time_idx
  on public.life_notification_deliveries(couple_space_id, actor, created_at desc);

alter table public.life_notification_preferences enable row level security;
alter table public.life_notification_deliveries enable row level security;

revoke all on public.life_notification_preferences, public.life_notification_deliveries
from public, anon, authenticated;
grant select, insert, update, delete on public.life_notification_preferences, public.life_notification_deliveries
to service_role;

create trigger life_notification_preferences_set_updated_at
before update on public.life_notification_preferences
for each row execute function private.set_updated_at();

create trigger life_notification_deliveries_set_updated_at
before update on public.life_notification_deliveries
for each row execute function private.set_updated_at();

insert into public.life_notification_preferences(couple_space_id, actor)
select c.id, p.partner_key
from public.couple_spaces c
join public.partner_profiles p on p.couple_space_id = c.id
where c.archived_at is null
on conflict (couple_space_id, actor) do nothing;

create or replace function private.life_actor_has_any_record(
  p_space_id uuid,
  p_actor text,
  p_record_date date
) returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select
    exists(select 1 from public.mood_entries m
      where m.couple_space_id = p_space_id and m.partner_key = p_actor and m.mood_date = p_record_date)
    or exists(select 1 from public.sleep_records s
      where s.couple_space_id = p_space_id and s.partner_key = p_actor and s.sleep_date = p_record_date)
    or exists(select 1 from public.meals m
      where m.couple_space_id = p_space_id and m.partner_key = p_actor and m.meal_date = p_record_date and m.deleted_at is null)
    or exists(select 1 from public.weight_measurements w
      where w.couple_space_id = p_space_id and w.partner_key = p_actor and w.measurement_date = p_record_date)
    or exists(select 1 from public.activity_entries a
      where a.couple_space_id = p_space_id and a.activity_date = p_record_date and a.deleted_at is null
        and a.participant_scope in ('both', p_actor));
$$;

create or replace function private.life_anniversary_for_year(p_anniversary date, p_year integer)
returns date
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
begin
  begin
    return make_date(
      p_year,
      extract(month from p_anniversary)::integer,
      extract(day from p_anniversary)::integer
    );
  exception when datetime_field_overflow then
    -- Feb 29 anniversaries fall back to Feb 28 in non-leap years.
    return make_date(p_year, 2, 28);
  end;
end;
$$;

create or replace function private.reserve_life_notification_delivery(
  p_space_id uuid,
  p_actor text,
  p_kind text,
  p_local_date date,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_id uuid;
begin
  insert into public.life_notification_deliveries(
    couple_space_id, actor, kind, local_date, dedupe_key, metadata
  ) values (
    p_space_id, p_actor, p_kind, p_local_date, p_dedupe_key, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (couple_space_id, dedupe_key) do update
  set status = 'reserved',
      attempt_count = public.life_notification_deliveries.attempt_count + 1,
      metadata = excluded.metadata,
      provider_message_id = null,
      provider_error = null,
      reserved_at = now(),
      completed_at = null,
      updated_at = now()
  where (
      public.life_notification_deliveries.status = 'failed'
      and public.life_notification_deliveries.attempt_count < 3
      and public.life_notification_deliveries.updated_at <= now() - interval '5 minutes'
    ) or (
      public.life_notification_deliveries.status = 'reserved'
      and public.life_notification_deliveries.attempt_count < 3
      and public.life_notification_deliveries.reserved_at <= now() - interval '15 minutes'
    )
  returning id into v_id;

  return v_id;
end;
$$;

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
  v_anniversary date;
  v_target_date date;
  v_days_until integer;
  v_delivery_id uuid;
  v_reminders jsonb := '[]'::jsonb;
begin
  if p_actor not in ('cat', 'fish') then
    raise exception 'Invalid reminder actor';
  end if;

  select c.id into v_space_id
  from public.couple_spaces c
  where c.slug = p_space_slug and c.archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select * into v_pref
  from public.life_notification_preferences n
  where n.couple_space_id = v_space_id and n.actor = p_actor;
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
      v_space_id,
      p_actor,
      'daily_record',
      v_local_date,
      'daily_record:' || p_actor || ':' || v_local_date::text,
      jsonb_build_object('recordDate', v_local_date)
    );
    if v_delivery_id is not null then
      v_reminders := v_reminders || jsonb_build_array(jsonb_build_object(
        'deliveryId', v_delivery_id,
        'kind', 'daily_record',
        'localDate', v_local_date
      ));
    end if;
  end if;

  if v_pref.anniversary_reminder_enabled
     and v_local_time >= v_pref.anniversary_reminder_time
     and v_local_time < (v_pref.anniversary_reminder_time + interval '20 minutes')::time
  then
    select a.anniversary_date into v_anniversary
    from public.app_configs a
    where a.couple_space_id = v_space_id;

    if v_anniversary is not null then
      v_target_date := private.life_anniversary_for_year(
        v_anniversary,
        extract(year from v_local_date)::integer
      );
      if v_target_date < v_local_date then
        v_target_date := private.life_anniversary_for_year(
          v_anniversary,
          extract(year from v_local_date)::integer + 1
        );
      end if;
      v_days_until := v_target_date - v_local_date;

      if v_days_until = any(v_pref.anniversary_offsets) then
        v_delivery_id := private.reserve_life_notification_delivery(
          v_space_id,
          p_actor,
          'anniversary',
          v_local_date,
          'anniversary:' || p_actor || ':' || v_target_date::text || ':' || v_days_until::text,
          jsonb_build_object('targetDate', v_target_date, 'daysUntil', v_days_until)
        );
        if v_delivery_id is not null then
          v_reminders := v_reminders || jsonb_build_array(jsonb_build_object(
            'deliveryId', v_delivery_id,
            'kind', 'anniversary',
            'localDate', v_local_date,
            'targetDate', v_target_date,
            'daysUntil', v_days_until
          ));
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object('actor', p_actor, 'reminders', v_reminders);
end;
$$;

create or replace function public.complete_life_notification_delivery(
  p_delivery_id uuid,
  p_actor text,
  p_accepted boolean,
  p_provider_message_id text default null,
  p_provider_error text default null,
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
  select c.id into v_space_id
  from public.couple_spaces c
  where c.slug = p_space_slug and c.archived_at is null;

  update public.life_notification_deliveries d
  set status = case when p_accepted then 'accepted' else 'failed' end,
      provider_message_id = nullif(btrim(coalesce(p_provider_message_id, '')), ''),
      provider_error = case
        when p_accepted then null
        else left(nullif(btrim(coalesce(p_provider_error, '')), ''), 1000)
      end,
      completed_at = now(),
      updated_at = now()
  where d.id = p_delivery_id
    and d.couple_space_id = v_space_id
    and d.actor = p_actor
    and d.status = 'reserved'
  returning jsonb_build_object(
    'deliveryId', d.id,
    'actor', d.actor,
    'kind', d.kind,
    'status', d.status,
    'attemptCount', d.attempt_count,
    'providerMessageId', d.provider_message_id,
    'completedAt', d.completed_at
  ) into v_result;

  if v_result is null then raise exception 'Reminder delivery not found or not reserved'; end if;
  return v_result;
end;
$$;

revoke all on function private.life_actor_has_any_record(uuid, text, date) from public, anon, authenticated;
revoke all on function private.life_anniversary_for_year(date, integer) from public, anon, authenticated;
revoke all on function private.reserve_life_notification_delivery(uuid, text, text, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_life_notification_reminders(text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.complete_life_notification_delivery(uuid, text, boolean, text, text, text) from public, anon, authenticated;

grant execute on function private.life_actor_has_any_record(uuid, text, date) to service_role;
grant execute on function private.life_anniversary_for_year(date, integer) to service_role;
grant execute on function private.reserve_life_notification_delivery(uuid, text, text, date, text, jsonb) to service_role;
grant execute on function public.claim_life_notification_reminders(text, timestamptz, text) to service_role;
grant execute on function public.complete_life_notification_delivery(uuid, text, boolean, text, text, text) to service_role;
