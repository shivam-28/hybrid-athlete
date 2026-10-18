-- Nutrition: meals, items, completeness, daily targets, planned meals, lookup cache.
-- See openspec/changes/add-nutrition/design.md (D3–D6).

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.meal_source as enum ('photo', 'text', 'search', 'relog', 'planned');
create type public.nutrient_source as enum ('usda', 'off', 'estimated');

alter table public.profiles
  add column lifestyle_level text not null default 'sedentary'
    check (lifestyle_level in ('sedentary', 'lightly_active', 'active')),
  add column diet_type text not null default 'omnivore'
    check (diet_type in ('omnivore', 'vegetarian', 'vegan', 'pescatarian')),
  add column allergies text[] not null default '{}' check (cardinality(allergies) <= 30),
  add column dislikes text[] not null default '{}' check (cardinality(dislikes) <= 50),
  add column cuisines text[] not null default '{}' check (cardinality(cuisines) <= 20);

-- Meals and items ---------------------------------------------------------------

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  meal_type public.meal_type not null,
  source public.meal_source not null,
  name text check (char_length(name) <= 120),
  photo_path text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nutrient columns are absolute amounts for `grams`; micros are null when the source has no value.
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  position smallint not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 120),
  matched_name text,
  grams numeric(7, 1) not null check (grams > 0 and grams <= 5000),
  quantity_source text not null check (quantity_source in ('user', 'estimated')),
  confidence text check (confidence in ('low', 'medium', 'high')),
  preparation text,
  nutrient_source public.nutrient_source not null,
  source_ref text,
  per100g jsonb not null,
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carb_g numeric(6, 1) not null check (carb_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  fiber_g numeric(6, 1) check (fiber_g >= 0),
  sugar_g numeric(6, 1) check (sugar_g >= 0),
  satfat_g numeric(6, 1) check (satfat_g >= 0),
  sodium_mg numeric(8, 1) check (sodium_mg >= 0),
  potassium_mg numeric(8, 1) check (potassium_mg >= 0),
  calcium_mg numeric(8, 1) check (calcium_mg >= 0),
  iron_mg numeric(7, 2) check (iron_mg >= 0),
  magnesium_mg numeric(8, 1) check (magnesium_mg >= 0),
  vitamin_d_ug numeric(7, 2) check (vitamin_d_ug >= 0),
  b12_ug numeric(7, 2) check (b12_ug >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_items_meal on public.meal_items (meal_id, position);

-- An item may only hang off a meal its owner owns (RLS on meal_items checks user_id only).
create or replace function public.meal_items_check_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.meals m where m.id = new.meal_id and m.user_id = new.user_id) then
    raise exception 'meal not found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger meal_items_owner before insert or update of meal_id, user_id on public.meal_items
  for each row execute function public.meal_items_check_owner();

-- Food log completeness: a day counts as intake evidence only when marked complete.
create table public.food_log_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

-- Targets: today recomputed on read, past days frozen once stored (design D3).
create table public.daily_nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  targets jsonb not null,
  components jsonb not null,
  method text not null check (method in ('formula', 'adaptive')),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  slot public.meal_type not null,
  name text not null check (char_length(name) between 1 and 120),
  items jsonb not null,
  logged_meal_id uuid references public.meals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['meals', 'meal_items', 'food_log_days', 'daily_nutrition_targets', 'planned_meals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end;
$$;

create index meals_user_date on public.meals (user_id, local_date);
create index meals_user_favorite on public.meals (user_id) where is_favorite;
create index planned_meals_user_date on public.planned_meals (user_id, local_date);
create index meal_items_user on public.meal_items (user_id);

-- Shared nutrient lookup cache: instance-wide, no user data, no user_id.
-- RLS on with no policies: only the server (service role) reads and writes it,
-- so users cannot poison results other users will see.
create table public.food_lookup_cache (
  source text not null check (source in ('usda', 'off')),
  query_normalized text not null check (char_length(query_normalized) between 1 and 200),
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (source, query_normalized)
);

alter table public.food_lookup_cache enable row level security;
revoke all on public.food_lookup_cache from anon, authenticated;

-- Private meal photos: <user_id>/<uuid>.jpg -----------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 4194304, array['image/jpeg'])
on conflict (id) do nothing;

create policy meal_photos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meal_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meal_photos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy meal_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
