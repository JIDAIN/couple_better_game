-- Harden Cat/Fish write boundaries without breaking the currently deployed legacy RPCs.
-- New server code must use these actor-aware wrappers; old RPCs remain temporarily for
-- compatibility with the currently deployed Production until the next authorized deploy.

create or replace function public.create_activity_record_authorized(
  p_actor text,
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_scope text := coalesce(nullif(p_payload->>'participantScope', ''), 'both');
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid activity actor'; end if;
  if v_scope not in (p_actor, 'both') then raise exception 'OWN_RECORD_ONLY'; end if;
  return public.create_activity_record(p_payload, p_space_slug);
end;
$$;

create or replace function public.update_activity_record_authorized(
  p_actor text,
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
  v_existing_scope text;
  v_new_scope text := coalesce(nullif(p_payload->>'participantScope', ''), 'both');
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid activity actor'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select participant_scope into v_existing_scope
  from public.activity_entries
  where id = p_activity_id and couple_space_id = v_space_id and deleted_at is null;
  if v_existing_scope is null then raise exception 'Activity not found'; end if;

  if v_existing_scope not in (p_actor, 'both') then raise exception 'OWN_RECORD_ONLY'; end if;
  if v_existing_scope = 'both' and v_new_scope <> 'both' then raise exception 'SHARED_ACTIVITY_SCOPE_LOCKED'; end if;
  if v_existing_scope = p_actor and v_new_scope not in (p_actor, 'both') then raise exception 'OWN_RECORD_ONLY'; end if;

  return public.update_activity_record(p_activity_id, p_payload, p_space_slug);
end;
$$;

create or replace function public.delete_activity_record_authorized(
  p_actor text,
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
  v_existing_scope text;
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid activity actor'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select participant_scope into v_existing_scope
  from public.activity_entries
  where id = p_activity_id and couple_space_id = v_space_id and deleted_at is null;
  if v_existing_scope is null then raise exception 'Activity not found'; end if;
  if v_existing_scope not in (p_actor, 'both') then raise exception 'OWN_RECORD_ONLY'; end if;

  return public.delete_activity_record(p_activity_id, p_space_slug);
end;
$$;

create or replace function public.create_weight_measurement_authorized(
  p_actor text,
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid weight actor'; end if;
  if p_payload->>'partnerKey' <> p_actor then raise exception 'OWN_RECORD_ONLY'; end if;
  return public.create_weight_measurement(p_payload, p_space_slug);
end;
$$;

create or replace function public.update_weight_measurement_authorized(
  p_actor text,
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
  v_owner text;
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid weight actor'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select partner_key into v_owner
  from public.weight_measurements
  where id = p_weight_id and couple_space_id = v_space_id;
  if v_owner is null then raise exception 'Weight not found'; end if;
  if v_owner <> p_actor or p_payload->>'partnerKey' <> p_actor then raise exception 'OWN_RECORD_ONLY'; end if;

  return public.update_weight_measurement(p_weight_id, p_payload, p_space_slug);
end;
$$;

create or replace function public.delete_weight_measurement_authorized(
  p_actor text,
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
  v_owner text;
begin
  if p_actor not in ('cat', 'fish') then raise exception 'Invalid weight actor'; end if;
  select id into v_space_id from public.couple_spaces where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select partner_key into v_owner
  from public.weight_measurements
  where id = p_weight_id and couple_space_id = v_space_id;
  if v_owner is null then raise exception 'Weight not found'; end if;
  if v_owner <> p_actor then raise exception 'OWN_RECORD_ONLY'; end if;

  return public.delete_weight_measurement(p_weight_id, p_space_slug);
end;
$$;

revoke all on function public.create_activity_record_authorized(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.update_activity_record_authorized(text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_activity_record_authorized(text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_weight_measurement_authorized(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.update_weight_measurement_authorized(text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_weight_measurement_authorized(text, uuid, text) from public, anon, authenticated;

grant execute on function public.create_activity_record_authorized(text, jsonb, text) to service_role;
grant execute on function public.update_activity_record_authorized(text, uuid, jsonb, text) to service_role;
grant execute on function public.delete_activity_record_authorized(text, uuid, text) to service_role;
grant execute on function public.create_weight_measurement_authorized(text, jsonb, text) to service_role;
grant execute on function public.update_weight_measurement_authorized(text, uuid, jsonb, text) to service_role;
grant execute on function public.delete_weight_measurement_authorized(text, uuid, text) to service_role;
