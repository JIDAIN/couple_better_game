-- R8.2: expose the already-existing transactional R8 backup/restore model to the visible Data Management page.
-- Import accepts the same schemaVersion=1 full export used by R10 backups (user + optional config).

create or replace function public.import_life_full_data(
  p_payload jsonb,
  p_created_by text default null,
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_space_id uuid;
  v_snapshot_id uuid;
  v_scope text;
begin
  if p_created_by is not null and p_created_by not in ('cat','fish') then
    raise exception 'Invalid actor';
  end if;

  if coalesce((p_payload->>'schemaVersion')::integer,0) <> 1
     or jsonb_typeof(p_payload->'user') <> 'object' then
    raise exception 'Unsupported import format';
  end if;

  if p_payload ? 'config' and jsonb_typeof(p_payload->'config') <> 'object' then
    raise exception 'Invalid config payload';
  end if;

  select id into v_space_id
  from public.couple_spaces
  where slug=p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  v_scope := case when p_payload ? 'config' then 'full' else 'user' end;

  insert into public.life_backup_snapshots(
    couple_space_id, scope, reason, schema_version, payload, row_counts, created_by
  ) values (
    v_space_id,
    v_scope,
    'import',
    1,
    p_payload,
    jsonb_build_object(
      'moods', jsonb_array_length(coalesce(p_payload#>'{user,mood_entries}','[]'::jsonb)),
      'meals', jsonb_array_length(coalesce(p_payload#>'{user,meals}','[]'::jsonb)),
      'medicines', jsonb_array_length(coalesce(p_payload#>'{user,medicine_items}','[]'::jsonb)),
      'weights', jsonb_array_length(coalesce(p_payload#>'{user,weight_measurements}','[]'::jsonb)),
      'letters', jsonb_array_length(coalesce(p_payload#>'{user,mailbox_letters}','[]'::jsonb))
    ),
    p_created_by
  ) returning id into v_snapshot_id;

  -- restore_life_backup_snapshot always creates a full pre_restore snapshot first,
  -- so both manual restore and imported restore remain recoverable in one transaction.
  return public.restore_life_backup_snapshot(v_snapshot_id,p_created_by,p_space_slug)
    || jsonb_build_object('importSnapshotId',v_snapshot_id,'scope',v_scope);
end;
$$;

revoke all on function public.import_life_full_data(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.import_life_full_data(jsonb,text,text) to service_role;
