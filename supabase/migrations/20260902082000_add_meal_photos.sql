-- V2-P3C: private meal photos with server-only access.
-- Browser clients never talk to Supabase Storage directly; the Next.js API uses
-- the service secret and persists only an opaque storage path on the meal row.

alter table public.meals
  add column if not exists photo_path text;

alter table public.meals
  drop constraint if exists meals_photo_path_length_check;

alter table public.meals
  add constraint meals_photo_path_length_check
  check (photo_path is null or length(photo_path) between 1 and 500);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'meal-photos',
  'meal-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

create or replace function public.get_meal_photo_path(
  p_meal_id uuid,
  p_space_slug text default 'couple-better-game'
)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select m.photo_path
  from public.meals m
  join public.couple_spaces cs on cs.id = m.couple_space_id
  where m.id = p_meal_id
    and cs.slug = p_space_slug
    and cs.archived_at is null
    and m.deleted_at is null;
$$;

create or replace function public.replace_meal_photo_path(
  p_meal_id uuid,
  p_photo_path text,
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
  end if;

  update public.meals
  set photo_path = v_clean_path,
      updated_at = now()
  where id = p_meal_id and couple_space_id = v_space_id;

  return jsonb_build_object(
    'previousPhotoPath', v_previous_path,
    'meal', private.meal_record_json(p_meal_id)
  );
end;
$$;

revoke all on function public.get_meal_photo_path(uuid, text) from public, anon, authenticated;
revoke all on function public.replace_meal_photo_path(uuid, text, text) from public, anon, authenticated;
grant execute on function public.get_meal_photo_path(uuid, text) to service_role;
grant execute on function public.replace_meal_photo_path(uuid, text, text) to service_role;

comment on column public.meals.photo_path is
  'Private Supabase Storage object path in bucket meal-photos; null means use the bundled cartoon fallback.';
comment on function public.replace_meal_photo_path(uuid, text, text) is
  'Service-only meal photo pointer replacement. Returns the previous path for safe object cleanup.';
