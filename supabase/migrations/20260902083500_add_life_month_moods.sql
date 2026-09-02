-- V2-P4: lightweight month read model for the calendar.
-- The month grid only needs mood facts, so avoid 28-31 separate day requests
-- and do not pull sleep/activity/meal detail until the user opens a day.

create or replace function public.get_life_month_moods(
  p_month_start date,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  with bounds as (
    select
      date_trunc('month', p_month_start)::date as month_start,
      (date_trunc('month', p_month_start) + interval '1 month')::date as month_end
  )
  select jsonb_build_object(
    'month', to_char(b.month_start, 'YYYY-MM'),
    'days', coalesce((
      select jsonb_agg(day_row order by day_row->>'date')
      from (
        select jsonb_build_object(
          'date', m.mood_date,
          'moods', jsonb_agg(private.mood_record_json(m.id) order by m.partner_key)
        ) as day_row
        from public.mood_entries m
        where m.couple_space_id = cs.id
          and m.mood_date >= b.month_start
          and m.mood_date < b.month_end
        group by m.mood_date
      ) grouped
    ), '[]'::jsonb)
  )
  from public.couple_spaces cs
  cross join bounds b
  where cs.slug = p_space_slug and cs.archived_at is null;
$$;

revoke all on function public.get_life_month_moods(date, text) from public, anon, authenticated;
grant execute on function public.get_life_month_moods(date, text) to service_role;

comment on function public.get_life_month_moods(date, text) is
  'Service-only lightweight calendar read model. Returns only mood facts grouped by date for one month.';
