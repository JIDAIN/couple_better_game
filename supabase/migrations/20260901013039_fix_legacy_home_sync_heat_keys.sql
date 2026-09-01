create or replace function public.replace_home_sync_snapshot(
  p_data jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_space_id uuid;
  v_item jsonb;
  v_side jsonb;
  v_date date;
  v_record_id uuid;
  v_side_id uuid;
  v_partner text;
  v_category_id uuid;
  v_exchange_id uuid;
  v_occ timestamptz;
  v_expected_gems int;
  v_expected_coins int;
  v_actual_gems int;
  v_actual_coins int;
  v_updated_at timestamptz := now();
begin
  if coalesce((p_data->>'schemaVersion')::int, 0) <> 1 then
    raise exception 'unsupported schemaVersion';
  end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug
  limit 1;
  if v_space_id is null then
    raise exception 'couple space not found';
  end if;

  update public.app_configs
  set
    heatmap_start_date = nullif(p_data->>'heatmapStartDate', '')::date,
    coin_week_start_day = coalesce((p_data->'coinRules'->>'weekStartDay')::int, coin_week_start_day),
    coin_deficit_streak_days = coalesce((p_data->'coinRules'->>'deficitStreakDays')::int, coin_deficit_streak_days),
    visual_rules = coalesce(p_data->'visualRules', visual_rules)
  where couple_space_id = v_space_id;

  delete from public.weight_measurements wm
  where wm.couple_space_id = v_space_id
    and wm.linked_daily_record_side_id in (
      select ds.id
      from public.daily_record_sides ds
      join public.daily_records dr on dr.id = ds.daily_record_id
      where dr.couple_space_id = v_space_id
        and dr.deleted_at is null
        and dr.record_date not in (
          select (x->>'recordDate')::date
          from jsonb_array_elements(coalesce(p_data->'dailyRecords', '[]'::jsonb)) x
        )
    );

  delete from public.daily_records dr
  where dr.couple_space_id = v_space_id
    and dr.record_date not in (
      select (x->>'recordDate')::date
      from jsonb_array_elements(coalesce(p_data->'dailyRecords', '[]'::jsonb)) x
    );

  for v_item in select * from jsonb_array_elements(coalesce(p_data->'dailyRecords', '[]'::jsonb))
  loop
    v_date := (v_item->>'recordDate')::date;
    select id into v_record_id
    from public.daily_records
    where couple_space_id = v_space_id and record_date = v_date and deleted_at is null
    limit 1;

    if v_record_id is null then
      insert into public.daily_records(
        couple_space_id, record_date, bonus_gems, coin_delta, created_at, updated_at
      ) values (
        v_space_id,
        v_date,
        coalesce((v_item->>'bonus')::int, 0),
        coalesce((v_item->>'coins')::int, 0),
        coalesce((v_item->>'createdAt')::timestamptz, now()),
        now()
      ) returning id into v_record_id;
    else
      update public.daily_records
      set
        bonus_gems = coalesce((v_item->>'bonus')::int, 0),
        coin_delta = coalesce((v_item->>'coins')::int, 0),
        deleted_at = null
      where id = v_record_id;
    end if;

    foreach v_partner in array array['fish','cat']
    loop
      v_side := v_item->v_partner;
      insert into public.daily_record_sides(
        daily_record_id, couple_space_id, partner_key,
        weight_kg, deficit_kcal, exercise_minutes, gems,
        heat_level, exercise_tag
      ) values (
        v_record_id,
        v_space_id,
        v_partner,
        case when v_side->'weightKg' is null or v_side->>'weightKg' is null then null else (v_side->>'weightKg')::numeric end,
        coalesce((v_side->>'deficit')::int, 0),
        greatest(0, coalesce((v_side->>'minutes')::int, 0)),
        greatest(0, coalesce((v_side->>'gems')::int, 0)),
        coalesce(v_item->(v_partner || 'Heat')->>'level', 'none'),
        coalesce(v_item->(v_partner || 'Heat')->>'exercise', 'none')
      )
      on conflict (daily_record_id, partner_key) do update
      set
        weight_kg = excluded.weight_kg,
        deficit_kcal = excluded.deficit_kcal,
        exercise_minutes = excluded.exercise_minutes,
        gems = excluded.gems,
        heat_level = excluded.heat_level,
        exercise_tag = excluded.exercise_tag
      returning id into v_side_id;

      if v_side->'weightKg' is null or v_side->>'weightKg' is null then
        delete from public.weight_measurements where linked_daily_record_side_id = v_side_id;
      else
        update public.weight_measurements
        set
          measurement_date = v_date,
          weight_kg = (v_side->>'weightKg')::numeric,
          source = 'daily_checkin'
        where linked_daily_record_side_id = v_side_id;
        if not found then
          insert into public.weight_measurements(
            couple_space_id, partner_key, measurement_date, weight_kg,
            source, context, linked_daily_record_side_id
          ) values (
            v_space_id, v_partner, v_date, (v_side->>'weightKg')::numeric,
            'daily_checkin', '由每日打卡同步', v_side_id
          );
        end if;
      end if;
    end loop;
  end loop;

  update public.exchange_categories
  set is_active = false
  where couple_space_id = v_space_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_data->'exchangeCategories', '[]'::jsonb))
  loop
    select id into v_category_id
    from public.exchange_categories
    where couple_space_id = v_space_id and legacy_id = v_item->>'id'
    limit 1;

    if v_category_id is null then
      insert into public.exchange_categories(
        couple_space_id, legacy_id, title, icon, description,
        resource_kind, price, is_active
      ) values (
        v_space_id, v_item->>'id', v_item->>'title', coalesce(v_item->>'icon','🎁'),
        coalesce(v_item->>'description',''), coalesce(v_item->>'resourceKind','coin'),
        greatest(0, coalesce((v_item->>'price')::int,0)), true
      ) returning id into v_category_id;
    else
      update public.exchange_categories
      set
        title = v_item->>'title',
        icon = coalesce(v_item->>'icon','🎁'),
        description = coalesce(v_item->>'description',''),
        resource_kind = coalesce(v_item->>'resourceKind','coin'),
        price = greatest(0, coalesce((v_item->>'price')::int,0)),
        is_active = true
      where id = v_category_id;
    end if;
  end loop;

  delete from public.exchange_records er
  where er.couple_space_id = v_space_id
    and coalesce(er.legacy_id, er.id::text) not in (
      select x->>'id'
      from jsonb_array_elements(coalesce(p_data->'exchangeRecords', '[]'::jsonb)) x
    );

  for v_item in select * from jsonb_array_elements(coalesce(p_data->'exchangeRecords', '[]'::jsonb))
  loop
    select id into v_category_id
    from public.exchange_categories
    where couple_space_id = v_space_id
      and title = v_item->>'category'
      and is_active
    order by created_at
    limit 1;

    begin
      v_occ := (v_item->>'occurredAt')::timestamp at time zone 'Asia/Shanghai';
    exception when others then
      v_occ := now();
    end;

    select id into v_exchange_id
    from public.exchange_records
    where couple_space_id = v_space_id and legacy_id = v_item->>'id'
    limit 1;

    if v_exchange_id is null then
      insert into public.exchange_records(
        couple_space_id, legacy_id, category_id, category_title, icon,
        resource_kind, price, remark, occurred_at, created_at
      ) values (
        v_space_id, v_item->>'id', v_category_id,
        coalesce(v_item->>'category','未知兑换'), coalesce(v_item->>'icon','🎁'),
        coalesce(v_item->>'resourceKind','coin'), greatest(0, coalesce((v_item->>'price')::int,0)),
        coalesce(v_item->>'remark',''), v_occ,
        coalesce((v_item->>'createdAt')::timestamptz, now())
      );
    else
      update public.exchange_records
      set
        category_id = v_category_id,
        category_title = coalesce(v_item->>'category','未知兑换'),
        icon = coalesce(v_item->>'icon','🎁'),
        resource_kind = coalesce(v_item->>'resourceKind','coin'),
        price = greatest(0, coalesce((v_item->>'price')::int,0)),
        remark = coalesce(v_item->>'remark',''),
        occurred_at = v_occ
      where id = v_exchange_id;
    end if;
  end loop;

  select r.gems, r.coins into v_actual_gems, v_actual_coins
  from private.rebuild_wallet_ledger(v_space_id) r;

  v_expected_gems := coalesce((p_data->'wallet'->>'gems')::int, 0);
  v_expected_coins := coalesce((p_data->'wallet'->>'coins')::int, 0);

  if v_actual_gems <> v_expected_gems or v_actual_coins <> v_expected_coins then
    raise exception 'wallet replay mismatch: expected gems %, coins %, got gems %, coins %',
      v_expected_gems, v_expected_coins, v_actual_gems, v_actual_coins;
  end if;

  update public.couple_spaces
  set home_sync_updated_at = v_updated_at
  where id = v_space_id;

  return jsonb_build_object(
    'ok', true,
    'updatedAt', v_updated_at,
    'wallet', jsonb_build_object('gems', v_actual_gems, 'coins', v_actual_coins)
  );
end;
$$;

revoke all on function public.replace_home_sync_snapshot(jsonb, text) from public, anon, authenticated;
grant execute on function public.replace_home_sync_snapshot(jsonb, text) to service_role;
