-- Mailbox V2 backup compatibility.
-- Schema v1 exports created before mailbox draft/sent support do not contain
-- mailbox_letters.status. Restore those rows as immutable sent messages while
-- preserving draft/sent for newer snapshots.

create or replace function public.restore_life_backup_snapshot(
  p_snapshot_id uuid,
  p_created_by text default null,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_payload jsonb;
  v_scope text;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;

  select payload, scope into v_payload, v_scope
  from public.life_backup_snapshots
  where id = p_snapshot_id and couple_space_id = v_space_id;

  if v_payload is null then raise exception 'Backup snapshot not found'; end if;

  perform public.create_life_backup_snapshot('full', 'pre_restore', p_created_by, p_space_slug);

  if v_scope in ('user','full') then
    delete from public.meal_items
      where meal_id in (select id from public.meals where couple_space_id = v_space_id);
    delete from public.meals where couple_space_id = v_space_id;
    delete from public.mood_entries where couple_space_id = v_space_id;
    delete from public.sleep_records where couple_space_id = v_space_id;
    delete from public.activity_entries where couple_space_id = v_space_id;
    delete from public.medicine_items where couple_space_id = v_space_id;
    delete from public.weight_measurements where couple_space_id = v_space_id;
    delete from public.mailbox_letters where couple_space_id = v_space_id;

    insert into public.mood_entries
      select * from jsonb_populate_recordset(
        null::public.mood_entries,
        coalesce(v_payload#>'{user,mood_entries}', '[]'::jsonb)
      );
    insert into public.sleep_records
      select * from jsonb_populate_recordset(
        null::public.sleep_records,
        coalesce(v_payload#>'{user,sleep_records}', '[]'::jsonb)
      );
    insert into public.activity_entries
      select * from jsonb_populate_recordset(
        null::public.activity_entries,
        coalesce(v_payload#>'{user,activity_entries}', '[]'::jsonb)
      );
    insert into public.meals
      select * from jsonb_populate_recordset(
        null::public.meals,
        coalesce(v_payload#>'{user,meals}', '[]'::jsonb)
      );
    insert into public.meal_items
      select * from jsonb_populate_recordset(
        null::public.meal_items,
        coalesce(v_payload#>'{user,meal_items}', '[]'::jsonb)
      );
    insert into public.medicine_items
      select * from jsonb_populate_recordset(
        null::public.medicine_items,
        coalesce(v_payload#>'{user,medicine_items}', '[]'::jsonb)
      );
    insert into public.weight_measurements
      select * from jsonb_populate_recordset(
        null::public.weight_measurements,
        coalesce(v_payload#>'{user,weight_measurements}', '[]'::jsonb)
      );

    insert into public.mailbox_letters(
      id,
      couple_space_id,
      sender_key,
      recipient_key,
      format,
      body,
      sent_at,
      source,
      created_at,
      updated_at,
      deleted_at,
      title,
      theme_key,
      status
    )
    select
      x.id,
      x.couple_space_id,
      x.sender_key,
      x.recipient_key,
      coalesce(x.format, 'letter'),
      x.body,
      case
        when x.status = 'draft' then null
        else coalesce(x.sent_at, x.created_at, now())
      end,
      coalesce(x.source, 'manual'),
      coalesce(x.created_at, now()),
      coalesce(x.updated_at, x.created_at, now()),
      x.deleted_at,
      case when coalesce(x.format, 'letter') = 'letter' then x.title else null end,
      coalesce(x.theme_key, 'cream'),
      case when x.status = 'draft' then 'draft' else 'sent' end
    from jsonb_populate_recordset(
      null::public.mailbox_letters,
      coalesce(v_payload#>'{user,mailbox_letters}', '[]'::jsonb)
    ) x;

    update public.partner_profiles p
    set nickname = x.nickname,
        emoji = x.emoji,
        target_weight_kg = x.target_weight_kg,
        updated_at = now()
    from jsonb_populate_recordset(
      null::public.partner_profiles,
      coalesce(v_payload#>'{user,partner_profiles}', '[]'::jsonb)
    ) x
    where p.couple_space_id = v_space_id and p.partner_key = x.partner_key;
  end if;

  if v_scope in ('config','full') then
    update public.app_configs a
    set heatmap_start_date = x.heatmap_start_date,
        coin_week_start_day = x.coin_week_start_day,
        coin_deficit_streak_days = x.coin_deficit_streak_days,
        visual_rules = x.visual_rules,
        anniversary_date = x.anniversary_date,
        updated_at = now()
    from jsonb_populate_recordset(
      null::public.app_configs,
      coalesce(v_payload#>'{config,app_configs}', '[]'::jsonb)
    ) x
    where a.couple_space_id = v_space_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'restoredSnapshotId', p_snapshot_id,
    'restoredAt', now()
  );
end;
$$;

revoke all on function public.restore_life_backup_snapshot(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.restore_life_backup_snapshot(uuid, text, text)
to service_role;