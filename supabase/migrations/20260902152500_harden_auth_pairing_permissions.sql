-- R1B hardening: first-member bootstrap must only happen through the same-origin
-- Next.js migration endpoint, where the legacy migration password is verified.
-- A direct authenticated RPC would bypass that bridge, so it is service-only.
revoke execute on function public.bootstrap_couple_space_membership(text)
from public, anon, authenticated;
grant execute on function public.bootstrap_couple_space_membership(text)
to service_role;

-- Pairing RPCs remain intentionally authenticated privileged operations. They are
-- narrow, validate auth.uid(), membership/slot ownership, expiry and one-time use.
-- Ensure anonymous callers cannot execute either function.
revoke execute on function public.create_couple_space_invite(text) from public, anon;
revoke execute on function public.accept_couple_space_invite(text) from public, anon;
