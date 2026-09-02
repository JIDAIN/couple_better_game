-- V2-R1: Supabase Auth + couple-space membership foundation.
-- Existing life-domain tables remain server-only in this migration; direct browser
-- access is not opened until API/auth migration is complete.

create table if not exists public.life_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_space_members (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_key text not null check (partner_key in ('cat', 'fish')),
  member_role text not null default 'member' check (member_role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_space_id, user_id),
  unique (couple_space_id, partner_key)
);

create index if not exists couple_space_members_user_idx
  on public.couple_space_members(user_id);

create or replace function public.touch_life_auth_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists life_user_profiles_touch_updated_at on public.life_user_profiles;
create trigger life_user_profiles_touch_updated_at
before update on public.life_user_profiles
for each row execute function public.touch_life_auth_updated_at();

drop trigger if exists couple_space_members_touch_updated_at on public.couple_space_members;
create trigger couple_space_members_touch_updated_at
before update on public.couple_space_members
for each row execute function public.touch_life_auth_updated_at();

create or replace function public.handle_new_life_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.life_user_profiles(user_id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_life_profile on auth.users;
create trigger on_auth_user_created_life_profile
after insert on auth.users
for each row execute function public.handle_new_life_user();

create or replace function public.is_couple_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_space_members m
    where m.couple_space_id = p_space_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.current_life_identity()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'userId', u.id,
    'displayName', p.display_name,
    'coupleSpaceId', m.couple_space_id,
    'partnerKey', m.partner_key,
    'memberRole', m.member_role
  )
  from auth.users u
  left join public.life_user_profiles p on p.user_id = u.id
  left join lateral (
    select csm.couple_space_id, csm.partner_key, csm.member_role
    from public.couple_space_members csm
    where csm.user_id = u.id
    order by csm.joined_at asc
    limit 1
  ) m on true
  where u.id = auth.uid();
$$;

grant execute on function public.is_couple_space_member(uuid) to authenticated;
grant execute on function public.current_life_identity() to authenticated;

alter table public.life_user_profiles enable row level security;
alter table public.couple_space_members enable row level security;

drop policy if exists life_user_profiles_select_self on public.life_user_profiles;
create policy life_user_profiles_select_self
on public.life_user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists life_user_profiles_update_self on public.life_user_profiles;
create policy life_user_profiles_update_self
on public.life_user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists couple_space_members_select_same_space on public.couple_space_members;
create policy couple_space_members_select_same_space
on public.couple_space_members
for select
to authenticated
using (public.is_couple_space_member(couple_space_id));

-- Membership writes intentionally remain service-only for now. The pairing flow will
-- add a narrow RPC instead of granting broad INSERT/UPDATE permissions to clients.
