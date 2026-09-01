alter table public.couple_spaces
  add column if not exists home_sync_updated_at timestamptz;

update public.couple_spaces
set home_sync_updated_at = coalesce(home_sync_updated_at, now())
where slug = 'couple-better-game';

create or replace function private.rebuild_wallet_ledger(p_space_id uuid)
returns table(gems int, coins int)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_gems int := 0;
  v_coins int := 0;
  v_next int;
  v_delta int;
  e record;
begin
  delete from public.wallet_ledger where couple_space_id = p_space_id;

  for e in
    select *
    from (
      select
        (dr.record_date::timestamp at time zone 'Asia/Shanghai') as event_time,
        10 as event_order,
        'coin'::text as resource_kind,
        (coalesce(fs.gems, 0) + coalesce(cs.gems, 0) + dr.bonus_gems)::int as requested_delta,
        'daily_growth'::text as reason_type,
        dr.id as reason_id,
        ('每日成长奖励 +' || (coalesce(fs.gems, 0) + coalesce(cs.gems, 0) + dr.bonus_gems)::text)::text as description
      from public.daily_records dr
      left join public.daily_record_sides fs on fs.daily_record_id = dr.id and fs.partner_key = 'fish'
      left join public.daily_record_sides cs on cs.daily_record_id = dr.id and cs.partner_key = 'cat'
      where dr.couple_space_id = p_space_id and dr.deleted_at is null

      union all

      select
        (dr.record_date::timestamp at time zone 'Asia/Shanghai') + interval '1 second',
        20,
        'gem'::text,
        dr.coin_delta::int,
        'daily_special_reward'::text,
        dr.id,
        ('每日特殊奖励 +' || dr.coin_delta::text)::text
      from public.daily_records dr
      where dr.couple_space_id = p_space_id
        and dr.deleted_at is null
        and dr.coin_delta <> 0

      union all

      select
        er.occurred_at,
        30,
        er.resource_kind,
        -er.price,
        'exchange'::text,
        er.id,
        ('兑换：' || er.category_title || case when er.remark <> '' then '（' || er.remark || '）' else '' end)::text
      from public.exchange_records er
      where er.couple_space_id = p_space_id
    ) events
    order by event_time, event_order, reason_id
  loop
    if e.resource_kind = 'coin' then
      if e.requested_delta >= 0 then
        v_next := least(50, v_coins + e.requested_delta);
      else
        v_next := greatest(0, v_coins + e.requested_delta);
      end if;
      v_delta := v_next - v_coins;
      if v_delta <> 0 then
        insert into public.wallet_ledger(
          couple_space_id, resource_kind, delta, balance_after,
          reason_type, reason_id, description, occurred_at
        ) values (
          p_space_id, 'coin', v_delta, v_next,
          e.reason_type, e.reason_id,
          case
            when e.reason_type = 'daily_growth' and v_delta <> e.requested_delta
              then '每日成长奖励：应得 ' || e.requested_delta::text || '，实际入账 ' || v_delta::text
            else e.description
          end,
          e.event_time
        );
      end if;
      v_coins := v_next;
    else
      v_next := greatest(0, v_gems + e.requested_delta);
      v_delta := v_next - v_gems;
      if v_delta <> 0 then
        insert into public.wallet_ledger(
          couple_space_id, resource_kind, delta, balance_after,
          reason_type, reason_id, description, occurred_at
        ) values (
          p_space_id, 'gem', v_delta, v_next,
          e.reason_type, e.reason_id, e.description, e.event_time
        );
      end if;
      v_gems := v_next;
    end if;
  end loop;

  insert into public.wallets(couple_space_id, gems, coins)
  values (p_space_id, v_gems, v_coins)
  on conflict (couple_space_id) do update
  set gems = excluded.gems, coins = excluded.coins;

  return query select v_gems, v_coins;
end;
$$;

create or replace function public.export_home_sync_snapshot(p_space_slug text default 'couple-better-game')
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $$
with s as (
  select * from public.couple_spaces where slug = p_space_slug limit 1
),
cfg as (
  select ac.* from public.app_configs ac join s on s.id = ac.couple_space_id
),
wal as (
  select w.* from public.wallets w join s on s.id = w.couple_space_id
),
daily as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', dr.id::text,
      'date', extract(year from dr.record_date)::int::text || '年' || extract(month from dr.record_date)::int::text || '月' || extract(day from dr.record_date)::int::text || '日',
      'recordDate', dr.record_date::text,
      'createdAt', dr.created_at,
      'day', extract(day from dr.record_date)::int,
      'fish', jsonb_build_object(
        'weightKg', fs.weight_kg,
        'deficit', fs.deficit_kcal,
        'minutes', fs.exercise_minutes,
        'gems', fs.gems
      ),
      'cat', jsonb_build_object(
        'weightKg', cs.weight_kg,
        'deficit', cs.deficit_kcal,
        'minutes', cs.exercise_minutes,
        'gems', cs.gems
      ),
      'bonus', dr.bonus_gems,
      'coins', dr.coin_delta,
      'fishHeat', jsonb_build_object('level', fs.heat_level, 'exercise', fs.exercise_tag),
      'catHeat', jsonb_build_object('level', cs.heat_level, 'exercise', cs.exercise_tag)
    ) order by dr.record_date desc
  ), '[]'::jsonb) as data
  from public.daily_records dr
  join s on s.id = dr.couple_space_id
  join public.daily_record_sides fs on fs.daily_record_id = dr.id and fs.partner_key = 'fish'
  join public.daily_record_sides cs on cs.daily_record_id = dr.id and cs.partner_key = 'cat'
  where dr.deleted_at is null
),
cats as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', coalesce(ec.legacy_id, ec.id::text),
      'title', ec.title,
      'icon', ec.icon,
      'description', ec.description,
      'resourceKind', ec.resource_kind,
      'price', ec.price
    ) order by ec.created_at, ec.title
  ), '[]'::jsonb) as data
  from public.exchange_categories ec
  join s on s.id = ec.couple_space_id
  where ec.is_active
),
exchanges as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', coalesce(er.legacy_id, er.id::text),
      'date', extract(month from (er.occurred_at at time zone 'Asia/Shanghai'))::int::text || '月' || extract(day from (er.occurred_at at time zone 'Asia/Shanghai'))::int::text || '日 ' || to_char(er.occurred_at at time zone 'Asia/Shanghai', 'HH24:MI'),
      'createdAt', er.created_at,
      'occurredAt', to_char(er.occurred_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD"T"HH24:MI'),
      'time', to_char(er.occurred_at at time zone 'Asia/Shanghai', 'HH24:MI'),
      'category', er.category_title,
      'icon', er.icon,
      'resourceKind', er.resource_kind,
      'price', er.price,
      'remark', er.remark
    ) order by er.occurred_at desc, er.created_at desc
  ), '[]'::jsonb) as data
  from public.exchange_records er
  join s on s.id = er.couple_space_id
)
select jsonb_build_object(
  'schemaVersion', 1,
  'currencySemanticsVersion', 2,
  'updatedAt', coalesce(s.home_sync_updated_at, s.updated_at),
  'wallet', jsonb_build_object('gems', wal.gems, 'coins', wal.coins),
  'dailyRecords', daily.data,
  'exchangeRecords', exchanges.data,
  'exchangeCategories', cats.data,
  'heatmapStartDate', cfg.heatmap_start_date::text,
  'coinRules', jsonb_build_object(
    'weekStartDay', cfg.coin_week_start_day,
    'deficitStreakDays', cfg.coin_deficit_streak_days
  ),
  'visualRules', cfg.visual_rules
)
from s, cfg, wal, daily, cats, exchanges;
$$;

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
        coalesce(v_item->v_partner || 'Heat'->>'level', 'none'),
        coalesce(v_item->v_partner || 'Heat'->>'exercise', 'none')
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

revoke all on function public.export_home_sync_snapshot(text) from public, anon, authenticated;
revoke all on function public.replace_home_sync_snapshot(jsonb, text) from public, anon, authenticated;
grant execute on function public.export_home_sync_snapshot(text) to service_role;
grant execute on function public.replace_home_sync_snapshot(jsonb, text) to service_role;
