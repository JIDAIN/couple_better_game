-- R1B was simplified after mobile/product review: the app has exactly two
-- fixed accounts (cat/fish) that reuse the existing shared password.
-- No Supabase Auth registration or pairing/invite schema is needed.

DROP TRIGGER IF EXISTS on_auth_user_created_life_profile ON auth.users;

DROP FUNCTION IF EXISTS public.accept_couple_space_invite(text);
DROP FUNCTION IF EXISTS public.create_couple_space_invite(text);
DROP FUNCTION IF EXISTS public.bootstrap_couple_space_membership(text);
DROP FUNCTION IF EXISTS public.current_life_identity();
DROP FUNCTION IF EXISTS private.is_couple_space_member(uuid);
DROP FUNCTION IF EXISTS public.handle_new_life_user();

DROP TABLE IF EXISTS public.couple_space_invites;
DROP TABLE IF EXISTS public.couple_space_members;
DROP TABLE IF EXISTS public.life_user_profiles;
