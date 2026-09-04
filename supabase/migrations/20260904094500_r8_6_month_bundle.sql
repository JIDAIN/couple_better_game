-- R8.6: load one whole month of day facts + meals in a single server round-trip.
-- This is a read accelerator only; Supabase remains the canonical source of truth.

create or replace function public.get_life_month_bundle(
  p_month_start date,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  with target_space as (
    select id
    from public.couple_spaces
    where slug = p_space_slug and archived_at is null
  ), dates as (
    select generate_series(
      date_trunc('month', p_month_start::timestamp)::date,
      (date_trunc('month', p_month_start::timestamp) + interval '1 month - 1 day')::date,
      interval '1 day'
    )::date as record_date
  )
  select jsonb_build_object(
    'month', to_char(date_trunc('month', p_month_start::timestamp), 'YYYY-MM'),
    'days', coalesce(jsonb_agg(
      jsonb_build_object(
        'date', d.record_date,
        'day', jsonb_build_object(
          'date', d.record_date,
          'moods', coalesce((
            select jsonb_agg(private.mood_record_json(m.id) order by m.partner_key)
            from public.mood_entries m
            where m.couple_space_id = cs.id and m.mood_date = d.record_date
          ), '[]'::jsonb),
          'sleeps', coalesce((
            select jsonb_agg(private.sleep_record_json(s.id) order by s.partner_key)
            from public.sleep_records s
            where s.couple_space_id = cs.id and s.sleep_date = d.record_date
          ), '[]'::jsonb),
          'activities', coalesce((
            select jsonb_agg(
              private.activity_record_json(a.id)
              order by coalesce(a.occurred_at, a.created_at), a.created_at, a.id
            )
            from public.activity_entries a
            where a.couple_space_id = cs.id
              and a.activity_date = d.record_date
              and a.deleted_at is null
          ), '[]'::jsonb)
        ),
        'meals', coalesce((
          select jsonb_agg(
            private.meal_record_json(m.id)
            order by coalesce(m.eaten_at, m.created_at), m.created_at, m.id
          )
          from public.meals m
          where m.couple_space_id = cs.id
            and m.meal_date = d.record_date
            and m.deleted_at is null
        ), '[]'::jsonb)
      ) order by d.record_date
    ), '[]'::jsonb)
  )
  from target_space cs
  cross join dates d;
$$;

revoke all on function public.get_life_month_bundle(date,text) from public,anon,authenticated;
grant execute on function public.get_life_month_bundle(date,text) to service_role;

comment on function public.get_life_month_bundle(date,text) is
  'Service-only monthly read bundle for R8.6 client cache hydration. Returns every date in the month with life facts and both partners meals.';
