-- R10 worker activation: one-time pairing code bound to Harbor actor + Bridge Sheet.
-- Long-lived bridge secrets never need to be copied through chat or visible Sheet cells.

alter table public.life_drive_bridge_configs
  add column if not exists sheet_id text,
  add column if not exists pairing_code_hash text,
  add column if not exists pairing_expires_at timestamptz,
  add column if not exists paired_at timestamptz;

create unique index if not exists life_drive_bridge_configs_sheet_id_uq
  on public.life_drive_bridge_configs(sheet_id)
  where sheet_id is not null;

create or replace function public.pair_life_drive_bridge_worker(
  p_bridge_id text,
  p_sheet_id text,
  p_pairing_code_hash text,
  p_web_app_url text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.life_drive_bridge_configs%rowtype;
begin
  if p_bridge_id not in ('cat', 'fish') then
    raise exception 'PAIRING_INVALID';
  end if;
  if nullif(btrim(coalesce(p_sheet_id, '')), '') is null
     or nullif(btrim(coalesce(p_pairing_code_hash, '')), '') is null
     or nullif(btrim(coalesce(p_web_app_url, '')), '') is null then
    raise exception 'PAIRING_INVALID';
  end if;

  update public.life_drive_bridge_configs c
  set apps_script_url = btrim(p_web_app_url),
      paired_at = now(),
      pairing_code_hash = null,
      pairing_expires_at = null,
      updated_at = now()
  where c.bridge_id = p_bridge_id
    and c.actor = p_bridge_id
    and c.active = true
    and c.sheet_id = btrim(p_sheet_id)
    and c.pairing_code_hash = lower(btrim(p_pairing_code_hash))
    and c.pairing_expires_at is not null
    and c.pairing_expires_at > now()
  returning c.* into v_row;

  if not found then
    raise exception 'PAIRING_INVALID_OR_EXPIRED';
  end if;

  return jsonb_build_object(
    'bridgeId', v_row.bridge_id,
    'actor', v_row.actor,
    'sheetId', v_row.sheet_id,
    'bridgeSecret', v_row.bridge_secret,
    'watchToken', v_row.watch_token,
    'wakeSecret', v_row.apps_script_wake_secret,
    'originalsMealsFolderId', v_row.originals_meals_folder_id,
    'backupLeader', v_row.backup_leader,
    'webAppUrl', v_row.apps_script_url,
    'pairedAt', v_row.paired_at
  );
end;
$$;

revoke all on function public.pair_life_drive_bridge_worker(text, text, text, text)
from public, anon, authenticated;
grant execute on function public.pair_life_drive_bridge_worker(text, text, text, text)
to service_role;

comment on function public.pair_life_drive_bridge_worker(text, text, text, text) is
  'Consumes one Harbor worker pairing code once, returns long-lived credentials to the bound Apps Script worker, and records its Web App URL.';
