-- V2-P6: household medicine cabinet. Real inventory rows are imported separately and are never committed.

create table if not exists public.medicine_items (
  id uuid primary key default gen_random_uuid(),
  couple_space_id uuid not null references public.couple_spaces(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  production_date date,
  shelf_life_months integer check (shelf_life_months is null or shelf_life_months between 1 and 240),
  package_expiry_date date,
  opened_date date,
  opened_shelf_life_days integer check (opened_shelf_life_days is null or opened_shelf_life_days between 1 and 3650),
  quantity integer not null default 1 check (quantity >= 0 and quantity <= 9999),
  note text,
  source text not null default 'manual',
  import_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (couple_space_id, import_key)
);

create index if not exists medicine_items_space_expiry_idx
  on public.medicine_items(couple_space_id, package_expiry_date, opened_date)
  where archived_at is null;
create index if not exists medicine_items_space_name_idx
  on public.medicine_items(couple_space_id, lower(name))
  where archived_at is null;

alter table public.medicine_items enable row level security;

create or replace function private.medicine_record_json(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'productionDate', m.production_date,
    'shelfLifeMonths', m.shelf_life_months,
    'packageExpiryDate', m.package_expiry_date,
    'openedDate', m.opened_date,
    'openedShelfLifeDays', m.opened_shelf_life_days,
    'openedExpiryDate', case when m.opened_date is not null and m.opened_shelf_life_days is not null then m.opened_date + m.opened_shelf_life_days else null end,
    'finalExpiryDate', case
      when m.package_expiry_date is null then case when m.opened_date is not null and m.opened_shelf_life_days is not null then m.opened_date + m.opened_shelf_life_days else null end
      when m.opened_date is null or m.opened_shelf_life_days is null then m.package_expiry_date
      else least(m.package_expiry_date, m.opened_date + m.opened_shelf_life_days)
    end,
    'quantity', m.quantity,
    'note', m.note,
    'source', m.source,
    'createdAt', m.created_at,
    'updatedAt', m.updated_at
  )
  from public.medicine_items m where m.id = p_id;
$$;

create or replace function public.list_medicine_items(p_space_slug text default 'couple-better-game')
returns jsonb
language sql stable security invoker set search_path = public, private
as $$
  select coalesce(jsonb_agg(private.medicine_record_json(m.id) order by
    case
      when (case when m.package_expiry_date is null then case when m.opened_date is not null and m.opened_shelf_life_days is not null then m.opened_date + m.opened_shelf_life_days else null end when m.opened_date is null or m.opened_shelf_life_days is null then m.package_expiry_date else least(m.package_expiry_date, m.opened_date + m.opened_shelf_life_days) end) is null then 1 else 0 end,
    (case when m.package_expiry_date is null then case when m.opened_date is not null and m.opened_shelf_life_days is not null then m.opened_date + m.opened_shelf_life_days else null end when m.opened_date is null or m.opened_shelf_life_days is null then m.package_expiry_date else least(m.package_expiry_date, m.opened_date + m.opened_shelf_life_days) end),
    m.name), '[]'::jsonb)
  from public.medicine_items m
  join public.couple_spaces cs on cs.id = m.couple_space_id
  where cs.slug = p_space_slug and cs.archived_at is null and m.archived_at is null;
$$;

create or replace function public.create_medicine_item(p_payload jsonb, p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path = public, private as $$
declare v_space_id uuid; v_id uuid;
begin
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  insert into public.medicine_items(couple_space_id,name,production_date,shelf_life_months,package_expiry_date,opened_date,opened_shelf_life_days,quantity,note,source)
  values(v_space_id,btrim(p_payload->>'name'),nullif(p_payload->>'productionDate','')::date,nullif(p_payload->>'shelfLifeMonths','')::integer,nullif(p_payload->>'packageExpiryDate','')::date,nullif(p_payload->>'openedDate','')::date,nullif(p_payload->>'openedShelfLifeDays','')::integer,coalesce(nullif(p_payload->>'quantity','')::integer,1),nullif(btrim(p_payload->>'note'),''),'manual') returning id into v_id;
  return private.medicine_record_json(v_id);
end; $$;

create or replace function public.update_medicine_item(p_medicine_id uuid, p_payload jsonb, p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path = public, private as $$
declare v_space_id uuid;
begin
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;
  update public.medicine_items set
    name=btrim(p_payload->>'name'), production_date=nullif(p_payload->>'productionDate','')::date,
    shelf_life_months=nullif(p_payload->>'shelfLifeMonths','')::integer, package_expiry_date=nullif(p_payload->>'packageExpiryDate','')::date,
    opened_date=nullif(p_payload->>'openedDate','')::date, opened_shelf_life_days=nullif(p_payload->>'openedShelfLifeDays','')::integer,
    quantity=coalesce(nullif(p_payload->>'quantity','')::integer,1), note=nullif(btrim(p_payload->>'note'),''), source='manual', updated_at=now()
  where id=p_medicine_id and couple_space_id=v_space_id and archived_at is null;
  if not found then raise exception 'Medicine not found'; end if;
  return private.medicine_record_json(p_medicine_id);
end; $$;

create or replace function public.delete_medicine_item(p_medicine_id uuid, p_space_slug text default 'couple-better-game')
returns jsonb language plpgsql security invoker set search_path = public, private as $$
declare v_space_id uuid; v_record jsonb;
begin
  select id into v_space_id from public.couple_spaces where slug=p_space_slug and archived_at is null;
  v_record := private.medicine_record_json(p_medicine_id);
  update public.medicine_items set archived_at=now(), updated_at=now() where id=p_medicine_id and couple_space_id=v_space_id and archived_at is null;
  if not found then raise exception 'Medicine not found'; end if;
  return v_record;
end; $$;

revoke all on table public.medicine_items from public, anon, authenticated;
revoke all on function private.medicine_record_json(uuid) from public, anon, authenticated;
revoke all on function public.list_medicine_items(text) from public, anon, authenticated;
revoke all on function public.create_medicine_item(jsonb,text) from public, anon, authenticated;
revoke all on function public.update_medicine_item(uuid,jsonb,text) from public, anon, authenticated;
revoke all on function public.delete_medicine_item(uuid,text) from public, anon, authenticated;
grant execute on function private.medicine_record_json(uuid) to service_role;
grant execute on function public.list_medicine_items(text) to service_role;
grant execute on function public.create_medicine_item(jsonb,text) to service_role;
grant execute on function public.update_medicine_item(uuid,jsonb,text) to service_role;
grant execute on function public.delete_medicine_item(uuid,text) to service_role;