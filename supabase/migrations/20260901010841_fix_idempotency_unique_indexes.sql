drop index if exists public.meals_idempotency_unique;
create unique index meals_idempotency_unique
  on public.meals(couple_space_id, idempotency_key);

drop index if exists public.weight_measurements_idempotency_unique;
create unique index weight_measurements_idempotency_unique
  on public.weight_measurements(couple_space_id, idempotency_key);