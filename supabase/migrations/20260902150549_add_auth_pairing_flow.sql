-- V2-R1B pairing migration already applied to production; this file records it
-- in the repository so fresh environments reproduce the same schema.

create table if not exists public.couple_space_invites (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  invited_partner_key text not null check (invited_partner_key in ('cat','fish')),
  code_hash text not null,
  expires_at timestamptz not null,
  used_by_user_id uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.couple_space_invites enable row level security;
revoke all on table public.couple_space_invites from anon;
revoke all on table public.couple_space_invites from authenticated;

create or replace function public.create_couple_space_invite(p_partner_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_code text;
  v_expires_at timestamptz := now() + interval '24 hours';
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_partner_key not in ('cat','fish') then raise exception 'INVALID_PARTNER_KEY'; end if;
  select m.couple_space_id into v_space_id
  from public.couple_space_members m
  where m.user_id=v_user_id
  order by m.joined_at asc limit 1;
  if v_space_id is null then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if exists(select 1 from public.couple_space_members m where m.couple_space_id=v_space_id and m.partner_key=p_partner_key) then
    raise exception 'PARTNER_SLOT_TAKEN';
  end if;
  delete from public.couple_space_invites i
  where i.couple_space_id=v_space_id and i.invited_partner_key=p_partner_key and i.used_at is null;
  v_code := upper(encode(gen_random_bytes(6),'hex'));
  insert into public.couple_space_invites(couple_space_id,created_by_user_id,invited_partner_key,code_hash,expires_at)
  values(v_space_id,v_user_id,p_partner_key,encode(digest(v_code,'sha256'),'hex'),v_expires_at);
  return jsonb_build_object('code',v_code,'partnerKey',p_partner_key,'expiresAt',v_expires_at);
end;
$$;

create or replace function public.accept_couple_space_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.couple_space_invites%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.couple_space_members m where m.user_id=v_user_id) then raise exception 'ALREADY_PAIRED'; end if;
  select i.* into v_invite
  from public.couple_space_invites i
  where i.code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex')
    and i.used_at is null and i.expires_at>now()
  for update limit 1;
  if v_invite.id is null then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;
  if exists(select 1 from public.couple_space_members m where m.couple_space_id=v_invite.couple_space_id and m.partner_key=v_invite.invited_partner_key) then
    raise exception 'PARTNER_SLOT_TAKEN';
  end if;
  insert into public.couple_space_members(couple_space_id,user_id,partner_key,member_role)
  values(v_invite.couple_space_id,v_user_id,v_invite.invited_partner_key,'member');
  update public.couple_space_invites set used_by_user_id=v_user_id, used_at=now() where id=v_invite.id;
  return jsonb_build_object('coupleSpaceId',v_invite.couple_space_id,'partnerKey',v_invite.invited_partner_key);
end;
$$;

revoke all on function public.create_couple_space_invite(text) from public;
revoke all on function public.create_couple_space_invite(text) from anon;
revoke all on function public.accept_couple_space_invite(text) from public;
revoke all on function public.accept_couple_space_invite(text) from anon;
grant execute on function public.create_couple_space_invite(text) to authenticated;
grant execute on function public.accept_couple_space_invite(text) to authenticated;
