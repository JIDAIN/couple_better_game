create table if not exists public.life_drive_bridge_configs (
  bridge_id text primary key check (bridge_id in ('cat', 'fish')),
  actor text not null check (actor in ('cat', 'fish')),
  bridge_secret text not null,
  watch_token text not null,
  apps_script_url text,
  apps_script_wake_secret text not null,
  originals_meals_folder_id text not null,
  backup_leader boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_drive_bridge_configs_actor_matches check (actor = bridge_id)
);

alter table public.life_drive_bridge_configs enable row level security;
revoke all on public.life_drive_bridge_configs from public, anon, authenticated;
grant select, insert, update, delete on public.life_drive_bridge_configs to service_role;

comment on table public.life_drive_bridge_configs is
  'R10 server-only runtime credentials and worker routing for Harbor Cat / Harbor Fish.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drive-bridge-staging',
  'drive-bridge-staging',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
