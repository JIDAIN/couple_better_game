create or replace function public.create_chatgpt_meal_record(
  p_payload jsonb,
  p_idempotency_key text,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_payload jsonb;
  v_items jsonb;
  v_item jsonb;
  v_item_count integer;
  v_total integer := 0;
  v_item_calories integer;
  v_min integer;
  v_max integer;
  v_partner_key text;
  v_meal_type text;
  v_meal_date text;
  v_note text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'ChatGPT meal payload must be a JSON object';
  end if;

  if v_key = '' or length(v_key) > 200 or v_key not like 'chatgpt:%' then
    raise exception 'ChatGPT meal idempotency key must start with chatgpt: and be at most 200 characters';
  end if;

  v_partner_key := p_payload->>'partnerKey';
  if v_partner_key not in ('fish', 'cat') then
    raise exception 'ChatGPT meal partnerKey must be fish or cat';
  end if;

  v_meal_type := p_payload->>'mealType';
  if v_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other') then
    raise exception 'ChatGPT meal mealType is invalid';
  end if;

  v_meal_date := p_payload->>'mealDate';
  if v_meal_date is null or v_meal_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'ChatGPT meal mealDate must use YYYY-MM-DD';
  end if;

  begin
    perform v_meal_date::date;
  exception when others then
    raise exception 'ChatGPT meal mealDate is invalid';
  end;

  if v_meal_type <> 'snack' and nullif(p_payload->>'snackPeriod', '') is not null then
    raise exception 'Only snack meals may set snackPeriod';
  end if;

  v_note := p_payload->>'note';
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'ChatGPT meal note must be at most 2000 characters';
  end if;

  v_items := coalesce(p_payload->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'ChatGPT meal items must be an array';
  end if;

  v_item_count := jsonb_array_length(v_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'ChatGPT meal must contain between 1 and 50 items';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each ChatGPT meal item must be a JSON object';
    end if;

    if nullif(btrim(v_item->>'rawName'), '') is null then
      raise exception 'Each ChatGPT meal item requires rawName';
    end if;
    if length(v_item->>'rawName') > 200 then
      raise exception 'ChatGPT meal item rawName must be at most 200 characters';
    end if;
    if length(coalesce(v_item->>'displayName', '')) > 200 then
      raise exception 'ChatGPT meal item displayName must be at most 200 characters';
    end if;
    if length(coalesce(v_item->>'portionDescription', '')) > 300 then
      raise exception 'ChatGPT meal item portionDescription must be at most 300 characters';
    end if;

    if coalesce(v_item->>'caloriesKcal', '') !~ '^\d+$' then
      raise exception 'Each ChatGPT meal item requires non-negative integer caloriesKcal';
    end if;
    v_item_calories := (v_item->>'caloriesKcal')::integer;
    v_total := v_total + v_item_calories;

    if nullif(v_item->>'calorieMinKcal', '') is not null then
      if (v_item->>'calorieMinKcal') !~ '^\d+$' then
        raise exception 'ChatGPT meal item calorieMinKcal must be a non-negative integer';
      end if;
      v_min := (v_item->>'calorieMinKcal')::integer;
      if v_item_calories < v_min then
        raise exception 'ChatGPT meal item caloriesKcal is below calorieMinKcal';
      end if;
    else
      v_min := null;
    end if;

    if nullif(v_item->>'calorieMaxKcal', '') is not null then
      if (v_item->>'calorieMaxKcal') !~ '^\d+$' then
        raise exception 'ChatGPT meal item calorieMaxKcal must be a non-negative integer';
      end if;
      v_max := (v_item->>'calorieMaxKcal')::integer;
      if v_item_calories > v_max then
        raise exception 'ChatGPT meal item caloriesKcal is above calorieMaxKcal';
      end if;
    else
      v_max := null;
    end if;

    if v_min is not null and v_max is not null and v_min > v_max then
      raise exception 'ChatGPT meal item calorie range is invalid';
    end if;
  end loop;

  if nullif(p_payload->>'totalCaloriesKcal', '') is not null then
    if (p_payload->>'totalCaloriesKcal') !~ '^\d+$' then
      raise exception 'ChatGPT meal totalCaloriesKcal must be a non-negative integer';
    end if;
    if (p_payload->>'totalCaloriesKcal')::integer <> v_total then
      raise exception 'ChatGPT meal totalCaloriesKcal must equal the sum of item calories';
    end if;
  end if;

  v_payload := p_payload || jsonb_build_object(
    'source', 'chatgpt',
    'status', 'confirmed',
    'idempotencyKey', v_key,
    'totalCaloriesKcal', v_total
  );

  perform pg_advisory_xact_lock(hashtextextended(p_space_slug || ':' || v_key, 0));

  return public.create_meal_record(v_payload, p_space_slug);
end;
$$;

create or replace function public.get_chatgpt_meal_record(
  p_idempotency_key text,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private
as $$
declare
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_meal_id uuid;
begin
  if v_key = '' or length(v_key) > 200 or v_key not like 'chatgpt:%' then
    raise exception 'ChatGPT meal idempotency key must start with chatgpt: and be at most 200 characters';
  end if;

  select m.id into v_meal_id
  from public.meals m
  join public.couple_spaces cs on cs.id = m.couple_space_id
  where cs.slug = p_space_slug
    and m.idempotency_key = v_key
    and m.source = 'chatgpt'
    and m.deleted_at is null
  limit 1;

  if v_meal_id is null then
    return null;
  end if;

  return private.meal_record_json(v_meal_id);
end;
$$;

revoke all on function public.create_chatgpt_meal_record(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.get_chatgpt_meal_record(text, text) from public, anon, authenticated;

grant execute on function public.create_chatgpt_meal_record(jsonb, text, text) to service_role;
grant execute on function public.get_chatgpt_meal_record(text, text) to service_role;

comment on function public.create_chatgpt_meal_record(jsonb, text, text) is
  'Service-only ChatGPT meal persistence wrapper. Forces source=chatgpt/status=confirmed and requires a chatgpt: idempotency key.';
comment on function public.get_chatgpt_meal_record(text, text) is
  'Service-only lookup for a non-deleted ChatGPT meal by idempotency key.';
