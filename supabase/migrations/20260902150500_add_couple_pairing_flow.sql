-- V2-R1B: narrow authenticated pairing flow for the existing couple space.
-- No broad INSERT/UPDATE grants are added to membership tables.

create table if not exists public.couple_space_invites (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists couple_space_invites_creator_idx
  on public.couple_space_invites(created_by, created_at desc);

alter table public.couple_space_invites enable row level security;

-- RPC only; the table itself is not directly writable/readable from the browser.
revoke all on table public.couple_space_invites from anon;
revoke all on table public.couple_space_invites from authenticated;

create or replace function public.claim_default_life_space(p_partner_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_space_id uuid;
  v_existing public.couple_space_members%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if p_partner_key not in ('cat', 'fish') then
    raise exception 'invalid partner key';
  end if;

  select * into v_existing
  from public.couple_space_members
  where user_id = v_user
  order by joined_at asc
  limit 1;

  if found then
    return jsonb_build_object(
      'coupleSpaceId', v_existing.couple_space_id,
      'partnerKey', v_existing.partner_key,
      'memberRole', v_existing.member_role
    );
  end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = 'couple-better-game'
    and archived_at is null
  limit 1;

  if v_space_id is null then
    raise exception 'default couple space not found';
  end if;

  if exists (
    select 1 from public.couple_space_members
    where couple_space_id = v_space_id and partner_key = p_partner_key
  ) then
    raise exception 'partner role already claimed';
  end if;

  insert into public.couple_space_members(couple_space_id, user_id, partner_key, member_role)
  values (v_space_id, v_user, p_partner_key, 'owner')
  returning * into v_existing;

  return jsonb_build_object(
    'coupleSpaceId', v_existing.couple_space_id,
    'partnerKey', v_existing.partner_key,
    'memberRole', v_existing.member_role
  );
end;
$$;

create or replace function public.create_couple_invite()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_member public.couple_space_members%rowtype;
  v_code text;
  v_exp timestamptz := now() + interval '24 hours';
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select * into v_member
  from public.couple_space_members
  where user_id = v_user
  order by joined_at asc
  limit 1;

  if not found then
    raise exception 'claim a couple space before inviting';
  end if;

  update public.couple_space_invites
  set expires_at = now()
  where created_by = v_user and redeemed_at is null and expires_at > now();

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.couple_space_invites where code = v_code);
  end loop;

  insert into public.couple_space_invites(couple_space_id, created_by, code, expires_at)
  values (v_member.couple_space_id, v_user, v_code, v_exp);

  return jsonb_build_object('code', v_code, 'expiresAt', v_exp);
end;
$$;

create or replace function public.redeem_couple_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.couple_space_invites%rowtype;
  v_creator public.couple_space_members%rowtype;
  v_partner_key text;
  v_member public.couple_space_members%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if exists (select 1 from public.couple_space_members where user_id = v_user) then
    raise exception 'user already belongs to a couple space';
  end if;

  select * into v_invite
  from public.couple_space_invites
  where code = upper(trim(p_code))
    and redeemed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite code is invalid or expired';
  end if;
  if v_invite.created_by = v_user then
    raise exception 'cannot redeem your own invite';
  end if;

  select * into v_creator
  from public.couple_space_members
  where couple_space_id = v_invite.couple_space_id
    and user_id = v_invite.created_by
  limit 1;

  if not found then
    raise exception 'invite creator is no longer a member';
  end if;

  v_partner_key := case when v_creator.partner_key = 'cat' then 'fish' else 'cat' end;

  if exists (
    select 1 from public.couple_space_members
    where couple_space_id = v_invite.couple_space_id and partner_key = v_partner_key
  ) then
    raise exception 'couple space is already full';
  end if;

  insert into public.couple_space_members(couple_space_id, user_id, partner_key, member_role)
  values (v_invite.couple_space_id, v_user, v_partner_key, 'member')
  returning * into v_member;

  update public.couple_space_invites
  set redeemed_by = v_user, redeemed_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'coupleSpaceId', v_member.couple_space_id,
    'partnerKey', v_member.partner_key,
    'memberRole', v_member.member_role
  );
end;
$$;

revoke all on function public.claim_default_life_space(text) from public;
revoke all on function public.create_couple_invite() from public;
revoke all on function public.redeem_couple_invite(text) from public;
revoke all on function public.claim_default_life_space(text) from anon;
revoke all on function public.create_couple_invite() from anon;
revoke all on function public.redeem_couple_invite(text) from anon;
grant execute on function public.claim_default_life_space(text) to authenticated;
grant execute on function public.create_couple_invite() to authenticated;
grant execute on function public.redeem_couple_invite(text) to authenticated;
