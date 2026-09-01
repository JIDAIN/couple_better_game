create or replace function private.recalculate_meal_totals(target_meal_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  item_count int;
  min_count int;
  max_count int;
  total_kcal int;
  min_kcal int;
  max_kcal int;
begin
  select
    count(*)::int,
    count(calorie_min_kcal)::int,
    count(calorie_max_kcal)::int,
    coalesce(sum(calories_kcal), 0)::int,
    sum(calorie_min_kcal)::int,
    sum(calorie_max_kcal)::int
  into item_count, min_count, max_count, total_kcal, min_kcal, max_kcal
  from public.meal_items
  where meal_id = target_meal_id;

  update public.meals
  set
    total_calories_kcal = total_kcal,
    calorie_min_kcal = case when item_count > 0 and min_count = item_count then min_kcal else null end,
    calorie_max_kcal = case when item_count > 0 and max_count = item_count then max_kcal else null end
  where id = target_meal_id;
end;
$$;

create or replace function private.sync_meal_totals_from_items()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_meal_totals(old.meal_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.meal_id is distinct from new.meal_id then
    perform private.recalculate_meal_totals(old.meal_id);
  end if;

  perform private.recalculate_meal_totals(new.meal_id);
  return new;
end;
$$;

revoke all on function private.recalculate_meal_totals(uuid) from public, anon, authenticated;
revoke all on function private.sync_meal_totals_from_items() from public, anon, authenticated;

drop trigger if exists meal_items_sync_meal_totals on public.meal_items;
create trigger meal_items_sync_meal_totals
after insert or update or delete on public.meal_items
for each row execute function private.sync_meal_totals_from_items();

create or replace view public.daily_nutrition_summary
with (security_invoker = true)
as
with item_totals as (
  select
    mi.meal_id,
    sum(mi.protein_g) as protein_g,
    sum(mi.carbs_g) as carbs_g,
    sum(mi.fat_g) as fat_g
  from public.meal_items mi
  group by mi.meal_id
)
select
  m.couple_space_id,
  m.partner_key,
  m.meal_date as record_date,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'breakfast'), 0)::int as breakfast_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'lunch'), 0)::int as lunch_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'dinner'), 0)::int as dinner_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'snack'), 0)::int as snack_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'snack' and m.snack_period = 'morning'), 0)::int as morning_snack_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'snack' and m.snack_period = 'afternoon'), 0)::int as afternoon_snack_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'snack' and m.snack_period = 'evening'), 0)::int as evening_snack_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'snack' and m.snack_period = 'late_night'), 0)::int as late_night_snack_kcal,
  coalesce(sum(m.total_calories_kcal) filter (where m.meal_type = 'other'), 0)::int as other_kcal,
  coalesce(sum(m.total_calories_kcal), 0)::int as total_calories_kcal,
  case when count(*) = count(m.calorie_min_kcal) then sum(m.calorie_min_kcal)::int else null end as calorie_min_kcal,
  case when count(*) = count(m.calorie_max_kcal) then sum(m.calorie_max_kcal)::int else null end as calorie_max_kcal,
  sum(it.protein_g)::numeric(10,2) as protein_g,
  sum(it.carbs_g)::numeric(10,2) as carbs_g,
  sum(it.fat_g)::numeric(10,2) as fat_g,
  count(*)::int as meal_count
from public.meals m
left join item_totals it on it.meal_id = m.id
where m.deleted_at is null
  and m.status = 'confirmed'
group by m.couple_space_id, m.partner_key, m.meal_date;

create or replace view public.daily_weight_summary
with (security_invoker = true)
as
select
  wm.couple_space_id,
  wm.partner_key,
  wm.measurement_date as record_date,
  (array_agg(wm.weight_kg order by coalesce(wm.measured_at, wm.created_at) asc, wm.created_at asc))[1]::numeric(6,2) as first_weight_kg,
  (array_agg(wm.weight_kg order by coalesce(wm.measured_at, wm.created_at) desc, wm.created_at desc))[1]::numeric(6,2) as last_weight_kg,
  (array_agg(wm.weight_kg order by coalesce(wm.measured_at, wm.created_at) asc, wm.created_at asc))[1]::numeric(6,2) as representative_weight_kg,
  count(*)::int as measurement_count
from public.weight_measurements wm
group by wm.couple_space_id, wm.partner_key, wm.measurement_date;

create or replace view public.partner_daily_overview
with (security_invoker = true)
as
with checkin as (
  select
    dr.couple_space_id,
    dr.record_date,
    drs.partner_key,
    drs.weight_kg as checkin_weight_kg,
    drs.deficit_kcal,
    drs.exercise_minutes,
    drs.gems,
    drs.heat_level,
    drs.exercise_tag,
    dr.bonus_gems,
    dr.coin_delta
  from public.daily_records dr
  join public.daily_record_sides drs on drs.daily_record_id = dr.id
  where dr.deleted_at is null
),
all_days as (
  select couple_space_id, partner_key, record_date from checkin
  union
  select couple_space_id, partner_key, record_date from public.daily_nutrition_summary
  union
  select couple_space_id, partner_key, record_date from public.daily_weight_summary
)
select
  d.couple_space_id,
  d.partner_key,
  d.record_date,
  n.breakfast_kcal,
  n.lunch_kcal,
  n.dinner_kcal,
  n.snack_kcal,
  n.morning_snack_kcal,
  n.afternoon_snack_kcal,
  n.evening_snack_kcal,
  n.late_night_snack_kcal,
  n.other_kcal,
  n.total_calories_kcal,
  n.calorie_min_kcal,
  n.calorie_max_kcal,
  n.protein_g,
  n.carbs_g,
  n.fat_g,
  w.representative_weight_kg,
  w.first_weight_kg,
  w.last_weight_kg,
  w.measurement_count,
  c.checkin_weight_kg,
  c.deficit_kcal,
  c.exercise_minutes,
  c.gems,
  c.heat_level,
  c.exercise_tag,
  c.bonus_gems,
  c.coin_delta
from all_days d
left join public.daily_nutrition_summary n
  on n.couple_space_id = d.couple_space_id
 and n.partner_key = d.partner_key
 and n.record_date = d.record_date
left join public.daily_weight_summary w
  on w.couple_space_id = d.couple_space_id
 and w.partner_key = d.partner_key
 and w.record_date = d.record_date
left join checkin c
  on c.couple_space_id = d.couple_space_id
 and c.partner_key = d.partner_key
 and c.record_date = d.record_date;

revoke all on public.daily_nutrition_summary from anon, authenticated;
revoke all on public.daily_weight_summary from anon, authenticated;
revoke all on public.partner_daily_overview from anon, authenticated;
grant select on public.daily_nutrition_summary to service_role;
grant select on public.daily_weight_summary to service_role;
grant select on public.partner_daily_overview to service_role;
