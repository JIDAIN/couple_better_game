-- Add a formal ownership-safe mood delete path for web/API/AI callers.
create or replace function public.delete_mood_record(
  p_mood_id uuid,
  p_partner_key text,
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
  if p_partner_key not in ('cat','fish') then
    raise exception 'Invalid partner key';
  end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select private.mood_record_json(m.id) into v_record
  from public.mood_entries m
  where m.id = p_mood_id
    and m.couple_space_id = v_space_id
    and m.partner_key = p_partner_key;

  if v_record is null then
    raise exception 'Mood not found or not owned by actor';
  end if;

  delete from public.mood_entries m
  where m.id = p_mood_id
    and m.couple_space_id = v_space_id
    and m.partner_key = p_partner_key;

  delete from public.record_write_receipts r
  where r.couple_space_id = v_space_id
    and r.domain = 'mood'
    and r.entity_id = p_mood_id;

  return v_record;
end;
$$;

revoke all on function public.delete_mood_record(uuid,text,text) from public, anon, authenticated;
grant execute on function public.delete_mood_record(uuid,text,text) to service_role;
