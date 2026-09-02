create table public.life_fixed_accounts (
  partner_key text primary key check (partner_key in ('cat','fish')),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.life_fixed_accounts enable row level security;

revoke all on table public.life_fixed_accounts from anon, authenticated;

create or replace function public.authenticate_fixed_life_account(
  p_username text,
  p_password text
)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select partner_key
  from public.life_fixed_accounts
  where lower(username) = lower(trim(p_username))
    and password_hash = extensions.crypt(p_password, password_hash)
  limit 1;
$$;

revoke all on function public.authenticate_fixed_life_account(text, text) from public, anon, authenticated;
grant execute on function public.authenticate_fixed_life_account(text, text) to service_role;
