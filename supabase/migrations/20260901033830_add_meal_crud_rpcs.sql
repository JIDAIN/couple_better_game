create or replace function private.meal_record_json(p_meal_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', m.id,
    'partnerKey', m.partner_key,
    'mealDate', m.meal_date,
    'mealType', m.meal_type,
    'eatenAt', m.eaten_at,
    'snackPeriod', m.snack_period,
    'status', m.status,
    'source', m.source,
    'totalCaloriesKcal', m.total_calories_kcal,
    'calorieMinKcal', m.calorie_min_kcal,
    'calorieMaxKcal', m.calorie_max_kcal,
    'note', m.note,
    'idempotencyKey', m.idempotency_key,
    'createdAt', m.created_at,
    'updatedAt', m.updated_at,
    'deletedAt', m.deleted_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', mi.id,
          'foodId', mi.food_id,
          'rawName', mi.raw_name,
          'displayName', mi.display_name,
          'portionDescription', mi.portion_description,
          'estimatedWeightG', mi.estimated_weight_g,
          'caloriesKcal', mi.calories_kcal,
          'calorieMinKcal', mi.calorie_min_kcal,
          'calorieMaxKcal', mi.calorie_max_kcal,
          'proteinG', mi.protein_g,
          'carbsG', mi.carbs_g,
          'fatG', mi.fat_g,
          'sortOrder', mi.sort_order,
          'createdAt', mi.created_at,
          'updatedAt', mi.updated_at
        ) order by mi.sort_order, mi.created_at, mi.id
      )
      from public.meal_items mi
      where mi.meal_id = m.id
    ), '[]'::jsonb)
  )
  from public.meals m
  where m.id = p_meal_id;
$$;

create or replace function public.list_meals(
  p_space_slug text default 'couple-better-game',
  p_partner_key text default null,
  p_meal_date date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select coalesce(
    jsonb_agg(
      private.meal_record_json(m.id)
      order by m.meal_date, coalesce(m.eaten_at, m.created_at), m.created_at, m.id
    ),
    '[]'::jsonb
  )
  from public.meals m
  join public.couple_spaces cs on cs.id = m.couple_space_id
  where cs.slug = p_space_slug
    and m.deleted_at is null
    and (p_partner_key is null or m.partner_key = p_partner_key)
    and (p_meal_date is null or m.meal_date = p_meal_date);
$$;

create or replace function public.create_meal_record(
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_meal_id uuid;
  v_existing_id uuid;
  v_partner_key text := p_payload->>'partnerKey';
  v_idempotency_key text := nullif(btrim(p_payload->>'idempotencyKey'), '');
  v_item jsonb;
  v_ord bigint;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  if not exists (
    select 1 from public.partner_profiles
    where couple_space_id = v_space_id and partner_key = v_partner_key
  ) then
    raise exception 'Partner profile not found';
  end if;

  if v_idempotency_key is not null then
    select id into v_existing_id
    from public.meals
    where couple_space_id = v_space_id
      and idempotency_key = v_idempotency_key;

    if v_existing_id is not null then
      if exists (select 1 from public.meals where id = v_existing_id and deleted_at is not null) then
        raise exception 'Idempotency key belongs to a deleted meal';
      end if;
      return private.meal_record_json(v_existing_id);
    end if;
  end if;

  insert into public.meals (
    couple_space_id,
    partner_key,
    meal_date,
    meal_type,
    eaten_at,
    snack_period,
    status,
    source,
    total_calories_kcal,
    calorie_min_kcal,
    calorie_max_kcal,
    note,
    idempotency_key
  ) values (
    v_space_id,
    v_partner_key,
    (p_payload->>'mealDate')::date,
    p_payload->>'mealType',
    nullif(p_payload->>'eatenAt', '')::timestamptz,
    nullif(p_payload->>'snackPeriod', ''),
    coalesce(nullif(p_payload->>'status', ''), 'confirmed'),
    coalesce(nullif(p_payload->>'source', ''), 'manual'),
    (p_payload->>'totalCaloriesKcal')::integer,
    nullif(p_payload->>'calorieMinKcal', '')::integer,
    nullif(p_payload->>'calorieMaxKcal', '')::integer,
    nullif(p_payload->>'note', ''),
    v_idempotency_key
  ) returning id into v_meal_id;

  for v_item, v_ord in
    select value, ordinality
    from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) with ordinality
  loop
    if nullif(v_item->>'foodId', '') is not null and not exists (
      select 1 from public.foods
      where id = (v_item->>'foodId')::uuid and couple_space_id = v_space_id
    ) then
      raise exception 'Food does not belong to couple space';
    end if;

    insert into public.meal_items (
      meal_id,
      food_id,
      raw_name,
      display_name,
      portion_description,
      estimated_weight_g,
      calories_kcal,
      calorie_min_kcal,
      calorie_max_kcal,
      protein_g,
      carbs_g,
      fat_g,
      sort_order
    ) values (
      v_meal_id,
      nullif(v_item->>'foodId', '')::uuid,
      v_item->>'rawName',
      coalesce(nullif(v_item->>'displayName', ''), v_item->>'rawName'),
      nullif(v_item->>'portionDescription', ''),
      nullif(v_item->>'estimatedWeightG', '')::numeric,
      (v_item->>'caloriesKcal')::integer,
      nullif(v_item->>'calorieMinKcal', '')::integer,
      nullif(v_item->>'calorieMaxKcal', '')::integer,
      nullif(v_item->>'proteinG', '')::numeric,
      nullif(v_item->>'carbsG', '')::numeric,
      nullif(v_item->>'fatG', '')::numeric,
      (v_ord - 1)::integer
    );
  end loop;

  return private.meal_record_json(v_meal_id);
end;
$$;

create or replace function public.update_meal_record(
  p_meal_id uuid,
  p_payload jsonb,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_partner_key text := p_payload->>'partnerKey';
  v_item jsonb;
  v_ord bigint;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  if not exists (
    select 1 from public.meals
    where id = p_meal_id and couple_space_id = v_space_id and deleted_at is null
  ) then
    raise exception 'Meal not found';
  end if;

  if not exists (
    select 1 from public.partner_profiles
    where couple_space_id = v_space_id and partner_key = v_partner_key
  ) then
    raise exception 'Partner profile not found';
  end if;

  update public.meals
  set partner_key = v_partner_key,
      meal_date = (p_payload->>'mealDate')::date,
      meal_type = p_payload->>'mealType',
      eaten_at = nullif(p_payload->>'eatenAt', '')::timestamptz,
      snack_period = nullif(p_payload->>'snackPeriod', ''),
      status = coalesce(nullif(p_payload->>'status', ''), 'confirmed'),
      source = coalesce(nullif(p_payload->>'source', ''), 'manual'),
      total_calories_kcal = (p_payload->>'totalCaloriesKcal')::integer,
      calorie_min_kcal = nullif(p_payload->>'calorieMinKcal', '')::integer,
      calorie_max_kcal = nullif(p_payload->>'calorieMaxKcal', '')::integer,
      note = nullif(p_payload->>'note', ''),
      idempotency_key = nullif(btrim(p_payload->>'idempotencyKey'), ''),
      updated_at = now()
  where id = p_meal_id and couple_space_id = v_space_id and deleted_at is null;

  delete from public.meal_items where meal_id = p_meal_id;

  for v_item, v_ord in
    select value, ordinality
    from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) with ordinality
  loop
    if nullif(v_item->>'foodId', '') is not null and not exists (
      select 1 from public.foods
      where id = (v_item->>'foodId')::uuid and couple_space_id = v_space_id
    ) then
      raise exception 'Food does not belong to couple space';
    end if;

    insert into public.meal_items (
      meal_id,
      food_id,
      raw_name,
      display_name,
      portion_description,
      estimated_weight_g,
      calories_kcal,
      calorie_min_kcal,
      calorie_max_kcal,
      protein_g,
      carbs_g,
      fat_g,
      sort_order
    ) values (
      p_meal_id,
      nullif(v_item->>'foodId', '')::uuid,
      v_item->>'rawName',
      coalesce(nullif(v_item->>'displayName', ''), v_item->>'rawName'),
      nullif(v_item->>'portionDescription', ''),
      nullif(v_item->>'estimatedWeightG', '')::numeric,
      (v_item->>'caloriesKcal')::integer,
      nullif(v_item->>'calorieMinKcal', '')::integer,
      nullif(v_item->>'calorieMaxKcal', '')::integer,
      nullif(v_item->>'proteinG', '')::numeric,
      nullif(v_item->>'carbsG', '')::numeric,
      nullif(v_item->>'fatG', '')::numeric,
      (v_ord - 1)::integer
    );
  end loop;

  return private.meal_record_json(p_meal_id);
end;
$$;

create or replace function public.delete_meal_record(
  p_meal_id uuid,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  update public.meals
  set deleted_at = now(), updated_at = now()
  where id = p_meal_id and couple_space_id = v_space_id and deleted_at is null;

  if not found then
    raise exception 'Meal not found';
  end if;

  return private.meal_record_json(p_meal_id);
end;
$$;

revoke all on function private.meal_record_json(uuid) from public, anon, authenticated;
revoke all on function public.list_meals(text, text, date) from public, anon, authenticated;
revoke all on function public.create_meal_record(jsonb, text) from public, anon, authenticated;
revoke all on function public.update_meal_record(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_meal_record(uuid, text) from public, anon, authenticated;

grant execute on function private.meal_record_json(uuid) to service_role;
grant execute on function public.list_meals(text, text, date) to service_role;
grant execute on function public.create_meal_record(jsonb, text) to service_role;
grant execute on function public.update_meal_record(uuid, jsonb, text) to service_role;
grant execute on function public.delete_meal_record(uuid, text) to service_role;