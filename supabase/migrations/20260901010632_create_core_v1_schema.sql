create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.couple_spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  nickname text not null,
  emoji text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_space_id, partner_key)
);
create unique index partner_profiles_space_auth_user_unique
  on public.partner_profiles(couple_space_id, auth_user_id)
  where auth_user_id is not null;

create table public.app_configs (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null unique references public.couple_spaces(id) on delete cascade,
  heatmap_start_date date,
  coin_week_start_day int not null default 6 check (coin_week_start_day between 0 and 6),
  coin_deficit_streak_days int not null default 7 check (coin_deficit_streak_days > 0),
  visual_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_records (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  record_date date not null,
  bonus_gems int not null default 0,
  coin_delta int not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index daily_records_space_date_active_unique
  on public.daily_records(couple_space_id, record_date)
  where deleted_at is null;
create index daily_records_space_date_idx
  on public.daily_records(couple_space_id, record_date desc);

create table public.daily_record_sides (
  id uuid primary key default gen_random_uuid(),
  daily_record_id uuid not null references public.daily_records(id) on delete cascade,
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  weight_kg numeric(6,2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  deficit_kcal int not null default 0,
  exercise_minutes int not null default 0 check (exercise_minutes >= 0),
  gems int not null default 0 check (gems >= 0),
  heat_level text not null default 'empty' check (heat_level in ('empty','over-light','over-mid','over-strong','over-heavy','none','ok','good','perfect')),
  exercise_tag text not null default 'none' check (exercise_tag in ('none','run','intense')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_record_id, partner_key),
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key)
);
create index daily_record_sides_space_partner_idx
  on public.daily_record_sides(couple_space_id, partner_key);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  canonical_name text not null,
  normalized_name text not null,
  category text not null default 'other' check (category in ('dish','ingredient','beverage','fruit','snack','staple','other')),
  default_calories_per_100g numeric(8,2) check (default_calories_per_100g is null or default_calories_per_100g >= 0),
  default_protein_per_100g numeric(8,2) check (default_protein_per_100g is null or default_protein_per_100g >= 0),
  default_carbs_per_100g numeric(8,2) check (default_carbs_per_100g is null or default_carbs_per_100g >= 0),
  default_fat_per_100g numeric(8,2) check (default_fat_per_100g is null or default_fat_per_100g >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_space_id, normalized_name)
);
create index foods_space_name_idx on public.foods(couple_space_id, canonical_name);

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  partner_key text check (partner_key is null or partner_key in ('fish','cat')),
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key)
);
create unique index food_aliases_shared_unique
  on public.food_aliases(couple_space_id, normalized_alias)
  where partner_key is null;
create unique index food_aliases_personal_unique
  on public.food_aliases(couple_space_id, partner_key, normalized_alias)
  where partner_key is not null;
create index food_aliases_food_idx on public.food_aliases(food_id);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack','other')),
  eaten_at timestamptz,
  snack_period text check (snack_period is null or snack_period in ('morning','afternoon','evening','late_night')),
  status text not null default 'confirmed' check (status in ('draft','confirmed')),
  source text not null default 'manual',
  total_calories_kcal int not null default 0 check (total_calories_kcal >= 0),
  calorie_min_kcal int check (calorie_min_kcal is null or calorie_min_kcal >= 0),
  calorie_max_kcal int check (calorie_max_kcal is null or calorie_max_kcal >= 0),
  note text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key),
  check (calorie_min_kcal is null or calorie_max_kcal is null or calorie_min_kcal <= calorie_max_kcal),
  check (calorie_min_kcal is null or total_calories_kcal >= calorie_min_kcal),
  check (calorie_max_kcal is null or total_calories_kcal <= calorie_max_kcal),
  check (meal_type = 'snack' or snack_period is null)
);
create unique index meals_idempotency_unique
  on public.meals(couple_space_id, idempotency_key)
  where idempotency_key is not null;
create index meals_space_partner_date_idx
  on public.meals(couple_space_id, partner_key, meal_date desc)
  where deleted_at is null;
create index meals_date_type_idx
  on public.meals(meal_date, meal_type)
  where deleted_at is null;

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  raw_name text not null,
  display_name text not null,
  portion_description text,
  estimated_weight_g numeric(8,2) check (estimated_weight_g is null or estimated_weight_g >= 0),
  calories_kcal int not null check (calories_kcal >= 0),
  calorie_min_kcal int check (calorie_min_kcal is null or calorie_min_kcal >= 0),
  calorie_max_kcal int check (calorie_max_kcal is null or calorie_max_kcal >= 0),
  protein_g numeric(8,2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(8,2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(8,2) check (fat_g is null or fat_g >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (calorie_min_kcal is null or calorie_max_kcal is null or calorie_min_kcal <= calorie_max_kcal),
  check (calorie_min_kcal is null or calories_kcal >= calorie_min_kcal),
  check (calorie_max_kcal is null or calories_kcal <= calorie_max_kcal)
);
create index meal_items_meal_idx on public.meal_items(meal_id, sort_order);
create index meal_items_food_idx on public.meal_items(food_id) where food_id is not null;

create table public.weight_measurements (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  measured_at timestamptz,
  measurement_date date not null,
  weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg < 500),
  source text not null default 'manual',
  context text,
  note text,
  linked_daily_record_side_id uuid references public.daily_record_sides(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key)
);
create unique index weight_measurements_daily_side_unique
  on public.weight_measurements(linked_daily_record_side_id)
  where linked_daily_record_side_id is not null;
create unique index weight_measurements_idempotency_unique
  on public.weight_measurements(couple_space_id, idempotency_key)
  where idempotency_key is not null;
create index weight_measurements_space_partner_date_idx
  on public.weight_measurements(couple_space_id, partner_key, measurement_date desc, measured_at desc);

create table public.partner_goal_periods (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  partner_key text not null check (partner_key in ('fish','cat')),
  effective_from date not null,
  effective_to date,
  target_weight_kg numeric(6,2) check (target_weight_kg is null or (target_weight_kg > 0 and target_weight_kg < 500)),
  target_intake_kcal int check (target_intake_kcal is null or target_intake_kcal > 0),
  maintenance_kcal int check (maintenance_kcal is null or maintenance_kcal > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (couple_space_id, partner_key)
    references public.partner_profiles(couple_space_id, partner_key),
  check (effective_to is null or effective_to >= effective_from)
);
create index partner_goal_periods_lookup_idx
  on public.partner_goal_periods(couple_space_id, partner_key, effective_from desc);

create table public.exchange_categories (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  legacy_id text,
  title text not null,
  icon text not null,
  description text not null default '',
  resource_kind text not null check (resource_kind in ('gem','coin')),
  price int not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exchange_categories_legacy_unique
  on public.exchange_categories(couple_space_id, legacy_id)
  where legacy_id is not null;

create table public.exchange_records (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  legacy_id text,
  category_id uuid references public.exchange_categories(id) on delete set null,
  category_title text not null,
  icon text not null,
  resource_kind text not null check (resource_kind in ('gem','coin')),
  price int not null check (price >= 0),
  remark text not null default '',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exchange_records_legacy_unique
  on public.exchange_records(couple_space_id, legacy_id)
  where legacy_id is not null;
create index exchange_records_space_occurred_idx
  on public.exchange_records(couple_space_id, occurred_at desc);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null unique references public.couple_spaces(id) on delete cascade,
  gems int not null default 0 check (gems >= 0),
  coins int not null default 0 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('gem','coin')),
  delta int not null,
  balance_after int,
  reason_type text not null,
  reason_id uuid,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index wallet_ledger_space_time_idx
  on public.wallet_ledger(couple_space_id, occurred_at desc);
create index wallet_ledger_reason_idx
  on public.wallet_ledger(reason_type, reason_id)
  where reason_id is not null;

create trigger couple_spaces_set_updated_at before update on public.couple_spaces
for each row execute function private.set_updated_at();
create trigger partner_profiles_set_updated_at before update on public.partner_profiles
for each row execute function private.set_updated_at();
create trigger app_configs_set_updated_at before update on public.app_configs
for each row execute function private.set_updated_at();
create trigger daily_records_set_updated_at before update on public.daily_records
for each row execute function private.set_updated_at();
create trigger daily_record_sides_set_updated_at before update on public.daily_record_sides
for each row execute function private.set_updated_at();
create trigger foods_set_updated_at before update on public.foods
for each row execute function private.set_updated_at();
create trigger meals_set_updated_at before update on public.meals
for each row execute function private.set_updated_at();
create trigger meal_items_set_updated_at before update on public.meal_items
for each row execute function private.set_updated_at();
create trigger weight_measurements_set_updated_at before update on public.weight_measurements
for each row execute function private.set_updated_at();
create trigger partner_goal_periods_set_updated_at before update on public.partner_goal_periods
for each row execute function private.set_updated_at();
create trigger exchange_categories_set_updated_at before update on public.exchange_categories
for each row execute function private.set_updated_at();
create trigger exchange_records_set_updated_at before update on public.exchange_records
for each row execute function private.set_updated_at();
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function private.set_updated_at();

alter table public.couple_spaces enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.app_configs enable row level security;
alter table public.daily_records enable row level security;
alter table public.daily_record_sides enable row level security;
alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.weight_measurements enable row level security;
alter table public.partner_goal_periods enable row level security;
alter table public.exchange_categories enable row level security;
alter table public.exchange_records enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
