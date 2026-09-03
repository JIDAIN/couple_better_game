create table if not exists public.life_drive_bridge_commands (
  actor text not null check (actor in ('cat', 'fish')),
  command_id text not null,
  tool text not null check (tool in ('life_capabilities', 'life_query', 'life_mutate')),
  request_hash text not null,
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor, command_id)
);

alter table public.life_drive_bridge_commands enable row level security;
revoke all on public.life_drive_bridge_commands from public, anon, authenticated;
grant select, insert, update, delete on public.life_drive_bridge_commands to service_role;

comment on table public.life_drive_bridge_commands is
  'R10 server-only idempotency ledger for Harbor Cat / Harbor Fish Google Drive bridge commands.';

create or replace function public.get_life_full_export(
  p_space_slug text default 'couple-better-game'
) returns jsonb
language plpgsql
stable
security invoker
set search_path=public,private
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug=p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'exportedAt', now(),
    'user', private.life_user_payload(v_space_id),
    'config', private.life_config_payload(v_space_id)
  );
end;
$$;

revoke all on function public.get_life_full_export(text) from public, anon, authenticated;
grant execute on function public.get_life_full_export(text) to service_role;
