-- V2-R1B: allow the first signed-in member to claim one role in the existing
-- couple space. The second member must join through a one-time invite code.

create or replace function public.bootstrap_couple_space_membership(p_partner_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_member public.couple_space_members%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_partner_key not in ('cat', 'fish') then
    raise exception 'INVALID_PARTNER_KEY';
  end if;

  select * into v_member
  from public.couple_space_members
  where user_id = v_user_id
  order by joined_at asc
  limit 1;

  if found then
    return jsonb_build_object(
      'coupleSpaceId', v_member.couple_space_id,
      'partnerKey', v_member.partner_key,
      'memberRole', v_member.member_role
    );
  end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = 'couple-better-game'
    and archived_at is null
  limit 1;

  if v_space_id is null then
    raise exception 'SPACE_NOT_FOUND';
  end if;

  if exists (select 1 from public.couple_space_members where couple_space_id = v_space_id) then
    raise exception 'INVITE_REQUIRED';
  end if;

  insert into public.couple_space_members(couple_space_id, user_id, partner_key, member_role)
  values (v_space_id, v_user_id, p_partner_key, 'owner')
  returning * into v_member;

  return jsonb_build_object(
    'coupleSpaceId', v_member.couple_space_id,
    'partnerKey', v_member.partner_key,
    'memberRole', v_member.member_role
  );
end;
$$;

revoke all on function public.bootstrap_couple_space_membership(text) from public;
revoke all on function public.bootstrap_couple_space_membership(text) from anon;
grant execute on function public.bootstrap_couple_space_membership(text) to authenticated;
