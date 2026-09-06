-- Retire the obsolete Google Drive / Sheets Harbor transport after direct MCP acceptance.
-- Applied migrations that originally created these objects remain immutable in history.
--
-- Note: Supabase protects storage.buckets from direct SQL deletion. The empty
-- drive-bridge-staging bucket must be removed separately through the Storage API
-- or Dashboard after this migration; do not bypass storage.protect_delete().

begin;

drop function if exists public.pair_life_drive_bridge_worker(text, text, text, text);

drop table if exists public.life_drive_bridge_commands cascade;
drop table if exists public.life_drive_bridge_configs cascade;

commit;
