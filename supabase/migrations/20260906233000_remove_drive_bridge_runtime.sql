-- Retire the obsolete Google Drive / Sheets Harbor transport after direct MCP acceptance.
-- Applied migrations that originally created these objects remain immutable in history.

begin;

drop function if exists public.pair_life_drive_bridge_worker(text, text, text, text);

drop table if exists public.life_drive_bridge_commands cascade;
drop table if exists public.life_drive_bridge_configs cascade;

-- The staging bucket is transport-only. Remove it only if it is still empty so
-- an unexpected late object can never be silently discarded by this migration.
delete from storage.buckets b
where b.id = 'drive-bridge-staging'
  and not exists (
    select 1
    from storage.objects o
    where o.bucket_id = b.id
  );

commit;
