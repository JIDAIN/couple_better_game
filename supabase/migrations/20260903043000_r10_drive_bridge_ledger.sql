create table if not exists public.life_drive_bridge_commands (
  command_id text primary key,
  actor text not null check (actor in ('cat', 'fish')),
  tool text not null check (tool in ('life_capabilities', 'life_query', 'life_mutate')),
  request_hash text not null,
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.life_drive_bridge_commands enable row level security;
revoke all on public.life_drive_bridge_commands from anon, authenticated;

comment on table public.life_drive_bridge_commands is
  'R10 server-only idempotency ledger for Google Drive / ChatGPT Project bridge commands.';
