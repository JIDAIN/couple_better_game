create table public.record_write_receipts (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  source text not null check (source in ('chatgpt','import')),
  domain text not null check (domain in ('meal','mood','sleep','activity','weight','medicine')),
  idempotency_key text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (couple_space_id, idempotency_key)
);
create index record_write_receipts_space_domain_idx
  on public.record_write_receipts(couple_space_id, domain, created_at desc);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  mood_date date not null,
  mood_key text not null check (mood_key in ('happy','calm','neutral','anxious','sad','angry','tired')),
  source text not null default 'manual' check (source in ('manual','chatgpt','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key),
  unique (couple_space_id, partner_key, mood_date)
);
create index mood_entries_space_date_idx
  on public.mood_entries(couple_space_id, mood_date desc, partner_key);

create table public.sleep_records (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  sleep_date date not null,
  fell_asleep_at timestamptz not null,
  woke_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual','chatgpt','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key),
  check (woke_at > fell_asleep_at),
  unique (couple_space_id, partner_key, sleep_date)
);
create index sleep_records_space_date_idx
  on public.sleep_records(couple_space_id, sleep_date desc, partner_key);

create table public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  activity_date date not null,
  occurred_at timestamptz,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  participant_scope text not null default 'both' check (participant_scope in ('both','fish','cat')),
  activity_type text,
  duration_minutes int check (duration_minutes is null or duration_minutes >= 0),
  source text not null default 'manual' check (source in ('manual','chatgpt','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index activity_entries_space_date_idx
  on public.activity_entries(couple_space_id, activity_date desc, coalesce(occurred_at, created_at) desc)
  where deleted_at is null;

create trigger mood_entries_set_updated_at before update on public.mood_entries
for each row execute function private.set_updated_at();
create trigger sleep_records_set_updated_at before update on public.sleep_records
for each row execute function private.set_updated_at();
create trigger activity_entries_set_updated_at before update on public.activity_entries
for each row execute function private.set_updated_at();

alter table public.record_write_receipts enable row level security;
alter table public.mood_entries enable row level security;
alter table public.sleep_records enable row level security;
alter table public.activity_entries enable row level security;

revoke all on public.record_write_receipts, public.mood_entries, public.sleep_records, public.activity_entries
from anon, authenticated;
grant select, insert, update, delete on public.record_write_receipts, public.mood_entries, public.sleep_records, public.activity_entries
to service_role;

create or replace function private.mood_record_json(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', m.id,
    'partnerKey', m.partner_key,
    'moodDate', m.mood_date,
    'moodKey', m.mood_key,
    'source', m.source,
    'createdAt', m.created_at,
    'updatedAt', m.updated_at
  )
  from public.mood_entries m
  where m.id = p_id;
$$;

create or replace function private.sleep_record_json(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', s.id,
    'partnerKey', s.partner_key,
    'sleepDate', s.sleep_date,
    'fellAsleepAt', s.fell_asleep_at,
    'wokeAt', s.woke_at,
    'source', s.source,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at
  )
  from public.sleep_records s
  where s.id = p_id;
$$;

create or replace function private.activity_record_json(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', a.id,
    'activityDate', a.activity_date,
    'occurredAt', a.occurred_at,
    'text', a.text,
    'participantScope', a.participant_scope,
    'activityType', a.activity_type,
    'durationMinutes', a.duration_minutes,
    'source', a.source,
    'createdAt', a.created_at,
    'updatedAt', a.updated_at,
    'deletedAt', a.deleted_at
  )
  from public.activity_entries a
  where a.id = p_id;
$$;

create or replace function public.get_life_day(
  p_record_date date,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'date', p_record_date,
    'moods', coalesce((
      select jsonb_agg(private.mood_record_json(m.id) order by m.partner_key)
      from public.mood_entries m
      where m.couple_space_id = cs.id and m.mood_date = p_record_date
    ), '[]'::jsonb),
    'sleeps', coalesce((
      select jsonb_agg(private.sleep_record_json(s.id) order by s.partner_key)
      from public.sleep_records s
      where s.couple_space_id = cs.id and s.sleep_date = p_record_date
    ), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(
        private.activity_record_json(a.id)
        order by coalesce(a.occurred_at, a.created_at), a.created_at, a.id
      )
      from public.activity_entries a
      where a.couple_space_id = cs.id
        and a.activity_date = p_record_date
        and a.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.couple_spaces cs
  where cs.slug = p_space_slug and cs.archived_at is null;
$$;

create or replace function public.upsert_mood_record(
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_record_id uuid;
  v_existing_entity uuid;
  v_partner_key text := p_payload->>'partnerKey';
  v_source text := coalesce(nullif(p_payload->>'source', ''), 'manual');
  v_idempotency_key text := nullif(btrim(p_payload->>'idempotencyKey'), '');
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  if not exists (
    select 1 from public.partner_profiles
    where couple_space_id = v_space_id and partner_key = v_partner_key
  ) then raise exception 'Partner profile not found'; end if;

  if v_idempotency_key is not null then
    select entity_id into v_existing_entity
    from public.record_write_receipts
    where couple_space_id = v_space_id and idempotency_key = v_idempotency_key;
    if v_existing_entity is not null then
      return private.mood_record_json(v_existing_entity);
    end if;
  end if;

  insert into public.mood_entries (
    couple_space_id, partner_key, mood_date, mood_key, source
  ) values (
    v_space_id,
    v_partner_key,
    (p_payload->>'moodDate')::date,
    p_payload->>'moodKey',
    v_source
  )
  on conflict (couple_space_id, partner_key, mood_date)
  do update set
    mood_key = excluded.mood_key,
    source = excluded.source,
    updated_at = now()
  returning id into v_record_id;

  if v_idempotency_key is not null then
    insert into public.record_write_receipts (
      couple_space_id, source, domain, idempotency_key, entity_id
    ) values (
      v_space_id, v_source, 'mood', v_idempotency_key, v_record_id
    );
  end if;

  return private.mood_record_json(v_record_id);
end;
$$;

create or replace function public.upsert_sleep_record(
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_record_id uuid;
  v_existing_entity uuid;
  v_partner_key text := p_payload->>'partnerKey';
  v_source text := coalesce(nullif(p_payload->>'source', ''), 'manual');
  v_idempotency_key text := nullif(btrim(p_payload->>'idempotencyKey'), '');
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  if not exists (
    select 1 from public.partner_profiles
    where couple_space_id = v_space_id and partner_key = v_partner_key
  ) then raise exception 'Partner profile not found'; end if;

  if v_idempotency_key is not null then
    select entity_id into v_existing_entity
    from public.record_write_receipts
    where couple_space_id = v_space_id and idempotency_key = v_idempotency_key;
    if v_existing_entity is not null then
      return private.sleep_record_json(v_existing_entity);
    end if;
  end if;

  insert into public.sleep_records (
    couple_space_id, partner_key, sleep_date, fell_asleep_at, woke_at, source
  ) values (
    v_space_id,
    v_partner_key,
    (p_payload->>'sleepDate')::date,
    (p_payload->>'fellAsleepAt')::timestamptz,
    (p_payload->>'wokeAt')::timestamptz,
    v_source
  )
  on conflict (couple_space_id, partner_key, sleep_date)
  do update set
    fell_asleep_at = excluded.fell_asleep_at,
    woke_at = excluded.woke_at,
    source = excluded.source,
    updated_at = now()
  returning id into v_record_id;

  if v_idempotency_key is not null then
    insert into public.record_write_receipts (
      couple_space_id, source, domain, idempotency_key, entity_id
    ) values (
      v_space_id, v_source, 'sleep', v_idempotency_key, v_record_id
    );
  end if;

  return private.sleep_record_json(v_record_id);
end;
$$;

create or replace function public.create_activity_record(
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_record_id uuid;
  v_existing_entity uuid;
  v_source text := coalesce(nullif(p_payload->>'source', ''), 'manual');
  v_idempotency_key text := nullif(btrim(p_payload->>'idempotencyKey'), '');
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  if v_idempotency_key is not null then
    select entity_id into v_existing_entity
    from public.record_write_receipts
    where couple_space_id = v_space_id and idempotency_key = v_idempotency_key;
    if v_existing_entity is not null then
      return private.activity_record_json(v_existing_entity);
    end if;
  end if;

  insert into public.activity_entries (
    couple_space_id,
    activity_date,
    occurred_at,
    text,
    participant_scope,
    activity_type,
    duration_minutes,
    source
  ) values (
    v_space_id,
    (p_payload->>'activityDate')::date,
    nullif(p_payload->>'occurredAt', '')::timestamptz,
    btrim(p_payload->>'text'),
    coalesce(nullif(p_payload->>'participantScope', ''), 'both'),
    nullif(btrim(p_payload->>'activityType'), ''),
    nullif(p_payload->>'durationMinutes', '')::integer,
    v_source
  ) returning id into v_record_id;

  if v_idempotency_key is not null then
    insert into public.record_write_receipts (
      couple_space_id, source, domain, idempotency_key, entity_id
    ) values (
      v_space_id, v_source, 'activity', v_idempotency_key, v_record_id
    );
  end if;

  return private.activity_record_json(v_record_id);
end;
$$;

create or replace function public.update_activity_record(
  p_activity_id uuid,
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  update public.activity_entries
  set activity_date = (p_payload->>'activityDate')::date,
      occurred_at = nullif(p_payload->>'occurredAt', '')::timestamptz,
      text = btrim(p_payload->>'text'),
      participant_scope = coalesce(nullif(p_payload->>'participantScope', ''), 'both'),
      activity_type = nullif(btrim(p_payload->>'activityType'), ''),
      duration_minutes = nullif(p_payload->>'durationMinutes', '')::integer,
      source = coalesce(nullif(p_payload->>'source', ''), source),
      updated_at = now()
  where id = p_activity_id and couple_space_id = v_space_id and deleted_at is null;

  if not found then raise exception 'Activity not found'; end if;
  return private.activity_record_json(p_activity_id);
end;
$$;

create or replace function public.delete_activity_record(
  p_activity_id uuid,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  update public.activity_entries
  set deleted_at = now(), updated_at = now()
  where id = p_activity_id and couple_space_id = v_space_id and deleted_at is null;

  if not found then raise exception 'Activity not found'; end if;
  return private.activity_record_json(p_activity_id);
end;
$$;

revoke all on function private.mood_record_json(uuid) from public, anon, authenticated;
revoke all on function private.sleep_record_json(uuid) from public, anon, authenticated;
revoke all on function private.activity_record_json(uuid) from public, anon, authenticated;
revoke all on function public.get_life_day(date, text) from public, anon, authenticated;
revoke all on function public.upsert_mood_record(jsonb, text) from public, anon, authenticated;
revoke all on function public.upsert_sleep_record(jsonb, text) from public, anon, authenticated;
revoke all on function public.create_activity_record(jsonb, text) from public, anon, authenticated;
revoke all on function public.update_activity_record(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_activity_record(uuid, text) from public, anon, authenticated;

grant execute on function private.mood_record_json(uuid) to service_role;
grant execute on function private.sleep_record_json(uuid) to service_role;
grant execute on function private.activity_record_json(uuid) to service_role;
grant execute on function public.get_life_day(date, text) to service_role;
grant execute on function public.upsert_mood_record(jsonb, text) to service_role;
grant execute on function public.upsert_sleep_record(jsonb, text) to service_role;
grant execute on function public.create_activity_record(jsonb, text) to service_role;
grant execute on function public.update_activity_record(uuid, jsonb, text) to service_role;
grant execute on function public.delete_activity_record(uuid, text) to service_role;