-- V2-P5: Life weight page reads the canonical weight_measurements timeline.
-- Legacy daily-checkin-backed rows remain owned by the legacy sync bridge and
-- cannot be edited/deleted through the Life API, avoiding two writers fighting.

create or replace function private.weight_record_json(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', w.id,
    'partnerKey', w.partner_key,
    'measuredAt', w.measured_at,
    'measurementDate', w.measurement_date,
    'weightKg', w.weight_kg,
    'source', w.source,
    'context', w.context,
    'note', w.note,
    'linkedDailyRecordSideId', w.linked_daily_record_side_id,
    'createdAt', w.created_at,
    'updatedAt', w.updated_at
  )
  from public.weight_measurements w
  where w.id = p_id;
$$;

create or replace function public.list_weight_measurements(
  p_partner_key text,
  p_limit integer default 365,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select coalesce(jsonb_agg(private.weight_record_json(x.id) order by x.measurement_date desc, coalesce(x.measured_at, x.created_at) desc), '[]'::jsonb)
  from (
    select w.id, w.measurement_date, w.measured_at, w.created_at
    from public.weight_measurements w
    join public.couple_spaces cs on cs.id = w.couple_space_id
    where cs.slug = p_space_slug
      and cs.archived_at is null
      and w.partner_key = p_partner_key
    order by w.measurement_date desc, coalesce(w.measured_at, w.created_at) desc
    limit greatest(1, least(coalesce(p_limit, 365), 2000))
  ) x;
$$;

create or replace function public.create_weight_measurement(
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
  v_id uuid;
begin
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  if not exists (select 1 from public.partner_profiles where couple_space_id = v_space_id and partner_key = p_payload->>'partnerKey') then
    raise exception 'Partner profile not found';
  end if;
  insert into public.weight_measurements(
    couple_space_id, partner_key, measurement_date, measured_at, weight_kg, source, context, note
  ) values (
    v_space_id,
    p_payload->>'partnerKey',
    (p_payload->>'measurementDate')::date,
    nullif(p_payload->>'measuredAt', '')::timestamptz,
    (p_payload->>'weightKg')::numeric,
    'manual',
    '由生活系统记录',
    nullif(btrim(p_payload->>'note'), '')
  ) returning id into v_id;
  return private.weight_record_json(v_id);
end;
$$;

create or replace function public.update_weight_measurement(
  p_weight_id uuid,
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
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  if exists (
    select 1 from public.weight_measurements
    where id = p_weight_id and couple_space_id = v_space_id and linked_daily_record_side_id is not null
  ) then raise exception 'Legacy-linked weight is managed by daily check-in'; end if;
  update public.weight_measurements
  set partner_key = p_payload->>'partnerKey',
      measurement_date = (p_payload->>'measurementDate')::date,
      measured_at = nullif(p_payload->>'measuredAt', '')::timestamptz,
      weight_kg = (p_payload->>'weightKg')::numeric,
      source = 'manual',
      context = '由生活系统记录',
      note = nullif(btrim(p_payload->>'note'), ''),
      updated_at = now()
  where id = p_weight_id and couple_space_id = v_space_id;
  if not found then raise exception 'Weight not found'; end if;
  return private.weight_record_json(p_weight_id);
end;
$$;

create or replace function public.delete_weight_measurement(
  p_weight_id uuid,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_record jsonb;
begin
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  if exists (
    select 1 from public.weight_measurements
    where id = p_weight_id and couple_space_id = v_space_id and linked_daily_record_side_id is not null
  ) then raise exception 'Legacy-linked weight is managed by daily check-in'; end if;
  v_record := private.weight_record_json(p_weight_id);
  delete from public.weight_measurements where id = p_weight_id and couple_space_id = v_space_id;
  if not found then raise exception 'Weight not found'; end if;
  return v_record;
end;
$$;

revoke all on function private.weight_record_json(uuid) from public, anon, authenticated;
revoke all on function public.list_weight_measurements(text, integer, text) from public, anon, authenticated;
revoke all on function public.create_weight_measurement(jsonb, text) from public, anon, authenticated;
revoke all on function public.update_weight_measurement(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_weight_measurement(uuid, text) from public, anon, authenticated;

grant execute on function private.weight_record_json(uuid) to service_role;
grant execute on function public.list_weight_measurements(text, integer, text) to service_role;
grant execute on function public.create_weight_measurement(jsonb, text) to service_role;
grant execute on function public.update_weight_measurement(uuid, jsonb, text) to service_role;
grant execute on function public.delete_weight_measurement(uuid, text) to service_role;
