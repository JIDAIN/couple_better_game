-- Harden the R1 auth helpers after security-advisor review.

-- Trigger functions should never be callable as public RPCs.
revoke all on function public.handle_new_life_user() from public;
revoke all on function public.handle_new_life_user() from anon;
revoke all on function public.handle_new_life_user() from authenticated;

-- Move the RLS recursion-breaker out of the exposed public API schema.
create or replace function private.is_couple_space_member(p_space_id uuid)
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

revoke all on function private.is_couple_space_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_couple_space_member(uuid) to authenticated;

drop policy if exists couple_space_members_select_same_space on public.couple_space_members;
create policy couple_space_members_select_same_space
on public.couple_space_members
for select
to authenticated
using (private.is_couple_space_member(couple_space_id));

revoke all on function public.is_couple_space_member(uuid) from public;
revoke all on function public.is_couple_space_member(uuid) from anon;
revoke all on function public.is_couple_space_member(uuid) from authenticated;
drop function public.is_couple_space_member(uuid);

-- Identity lookup does not need SECURITY DEFINER. RLS on profile/membership tables
-- already constrains it to the signed-in user and their shared couple space.
create or replace function public.current_life_identity()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'userId', auth.uid(),
    'displayName', p.display_name,
    'coupleSpaceId', m.couple_space_id,
    'partnerKey', m.partner_key,
    'memberRole', m.member_role
  )
  from public.life_user_profiles p
  left join lateral (
    select csm.couple_space_id, csm.partner_key, csm.member_role
    from public.couple_space_members csm
    where csm.user_id = p.user_id
    order by csm.joined_at asc
    limit 1
  ) m on true
  where p.user_id = auth.uid();
$$;

revoke all on function public.current_life_identity() from public;
revoke all on function public.current_life_identity() from anon;
grant execute on function public.current_life_identity() to authenticated;
