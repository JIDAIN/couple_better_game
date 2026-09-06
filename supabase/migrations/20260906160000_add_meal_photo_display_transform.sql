-- Meal photo presentation metadata.
-- Pixels stay untouched after EXIF-normalized compression; the UI applies a
-- non-destructive rotation/fit transform. Portrait uploads default to 90° at
-- the server upload layer, while users can later choose another rotation/size.

alter table public.meals
  add column if not exists photo_rotation_degrees smallint not null default 0,
  add column if not exists photo_scale numeric(4,2) not null default 1.00;

alter table public.meals
  drop constraint if exists meals_photo_rotation_degrees_check;
alter table public.meals
  add constraint meals_photo_rotation_degrees_check
  check (photo_rotation_degrees in (0, 90, 180, 270));

alter table public.meals
  drop constraint if exists meals_photo_scale_check;
alter table public.meals
  add constraint meals_photo_scale_check
  check (photo_scale between 0.60 and 1.00);

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
    'photoPath', m.photo_path,
    'photoRotationDegrees', m.photo_rotation_degrees,
    'photoScale', m.photo_scale,
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

create or replace function public.replace_meal_photo_state(
  p_meal_id uuid,
  p_photo_path text,
  p_rotation_degrees smallint default 0,
  p_scale numeric default 1.00,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_previous_path text;
  v_clean_path text := nullif(btrim(p_photo_path), '');
  v_rotation smallint := coalesce(p_rotation_degrees, 0);
  v_scale numeric := coalesce(p_scale, 1.00);
begin
  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  select photo_path into v_previous_path
  from public.meals
  where id = p_meal_id
    and couple_space_id = v_space_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Meal not found';
  end if;

  if v_clean_path is not null then
    if length(v_clean_path) > 500 then
      raise exception 'Meal photo path is too long';
    end if;
    if v_clean_path not like p_space_slug || '/' || p_meal_id::text || '/%' then
      raise exception 'Meal photo path does not belong to meal';
    end if;
    if v_clean_path ~ '[^A-Za-z0-9._/-]' then
      raise exception 'Meal photo path contains invalid characters';
    end if;
    if v_rotation not in (0, 90, 180, 270) then
      raise exception 'Meal photo rotation is invalid';
    end if;
    if v_scale < 0.60 or v_scale > 1.00 then
      raise exception 'Meal photo scale is invalid';
    end if;
  else
    v_rotation := 0;
    v_scale := 1.00;
  end if;

  update public.meals
  set photo_path = v_clean_path,
      photo_rotation_degrees = v_rotation,
      photo_scale = v_scale,
      updated_at = now()
  where id = p_meal_id and couple_space_id = v_space_id;

  return jsonb_build_object(
    'previousPhotoPath', v_previous_path,
    'meal', private.meal_record_json(p_meal_id)
  );
end;
$$;

create or replace function public.update_meal_photo_display(
  p_meal_id uuid,
  p_rotation_degrees smallint,
  p_scale numeric,
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
  if p_rotation_degrees not in (0, 90, 180, 270) then
    raise exception 'Meal photo rotation is invalid';
  end if;
  if p_scale < 0.60 or p_scale > 1.00 then
    raise exception 'Meal photo scale is invalid';
  end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;

  if v_space_id is null then
    raise exception 'Couple space not found';
  end if;

  update public.meals
  set photo_rotation_degrees = p_rotation_degrees,
      photo_scale = p_scale,
      updated_at = now()
  where id = p_meal_id
    and couple_space_id = v_space_id
    and deleted_at is null
    and photo_path is not null;

  if not found then
    raise exception 'Meal photo not found';
  end if;

  return private.meal_record_json(p_meal_id);
end;
$$;

revoke all on function public.replace_meal_photo_state(uuid, text, smallint, numeric, text) from public, anon, authenticated;
revoke all on function public.update_meal_photo_display(uuid, smallint, numeric, text) from public, anon, authenticated;
grant execute on function public.replace_meal_photo_state(uuid, text, smallint, numeric, text) to service_role;
grant execute on function public.update_meal_photo_display(uuid, smallint, numeric, text) to service_role;

comment on column public.meals.photo_rotation_degrees is
  'Non-destructive meal photo display rotation in degrees: 0/90/180/270.';
comment on column public.meals.photo_scale is
  'Non-destructive fit scale for the meal photo, 0.60 through 1.00. Values never crop the fitted image.';
comment on function public.replace_meal_photo_state(uuid, text, smallint, numeric, text) is
  'Service-only atomic meal photo pointer + display transform replacement.';
comment on function public.update_meal_photo_display(uuid, smallint, numeric, text) is
  'Service-only meal photo display transform update without rewriting image pixels.';
