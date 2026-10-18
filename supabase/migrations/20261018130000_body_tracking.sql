-- Body tracking: weights, measurements, body composition tests, progress photos,
-- goals. See openspec/changes/add-body-tracking/design.md (D1–D9).

create type public.body_comp_method as enum ('inbody', 'tanita', 'dexa', 'withings', 'other_bia', 'skinfold', 'other');
create type public.photo_pose as enum ('front', 'side', 'back');
create type public.goal_status as enum ('active', 'archived');

alter table public.profiles add column progress_photo_ai_consent_at timestamptz;

-- Manual weigh-ins (Apple Health weights stay in daily_metrics) ---------------

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Circumferences (cm), any subset per entry -------------------------------------

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  waist_cm numeric(4, 1) check (waist_cm between 10 and 250),
  hips_cm numeric(4, 1) check (hips_cm between 10 and 250),
  chest_cm numeric(4, 1) check (chest_cm between 10 and 250),
  arm_cm numeric(4, 1) check (arm_cm between 10 and 250),
  thigh_cm numeric(4, 1) check (thigh_cm between 10 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(waist_cm, hips_cm, chest_cm, arm_cm, thigh_cm) > 0)
);

-- Body composition tests (confirmed only; flagged values may still be saved) ---

create table public.body_composition_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  method public.body_comp_method not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 0 and 100),
  fat_mass_kg numeric(5, 2) check (fat_mass_kg between 0 and 400),
  lean_mass_kg numeric(5, 2) check (lean_mass_kg between 0 and 400),
  skeletal_muscle_kg numeric(5, 2) check (skeletal_muscle_kg between 0 and 200),
  visceral_fat_level numeric(4, 1) check (visceral_fat_level between 0 and 60),
  bmr_kcal integer check (bmr_kcal between 500 and 6000),
  total_body_water_kg numeric(5, 2) check (total_body_water_kg between 0 and 200),
  segmental_lean jsonb,
  derived_fields text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'extracted')),
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Progress photos and consented AI comparisons ---------------------------------

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  pose public.photo_pose not null,
  storage_path text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only qualitative observations are stored: no body-fat figure from photos is
-- persisted (progress-photos spec, "Qualitative AI analysis").
create table public.progress_photo_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  photo_a_id uuid not null references public.progress_photos (id) on delete cascade,
  photo_b_id uuid not null references public.progress_photos (id) on delete cascade,
  observations text[] not null check (cardinality(observations) between 1 and 12),
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (photo_a_id <> photo_b_id)
);

-- Goals: one active per user, older ones archived -------------------------------

create table public.body_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  goal_weight_kg numeric(5, 2) check (goal_weight_kg between 20 and 400),
  goal_body_fat_pct numeric(4, 1) check (goal_body_fat_pct between 2 and 60),
  target_date date,
  status public.goal_status not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(goal_weight_kg, goal_body_fat_pct) > 0),
  check ((status = 'archived') = (archived_at is not null))
);

create unique index body_goals_one_active on public.body_goals (user_id) where status = 'active';

-- RLS, triggers, indexes (foundation D4) ---------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['body_weights', 'body_measurements', 'body_composition_tests',
                           'progress_photos', 'progress_photo_analyses', 'body_goals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
    execute format('create index on public.%I (user_id, local_date)', t);
  end loop;
end;
$$;

-- Replacing the active goal atomically: archive the old one, insert the new one.
create or replace function public.replace_body_goal(
  p_goal_weight_kg numeric,
  p_goal_body_fat_pct numeric,
  p_target_date date,
  p_occurred_at timestamptz,
  p_local_date date
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  update public.body_goals
     set status = 'archived', archived_at = now()
   where user_id = (select auth.uid()) and status = 'active';
  insert into public.body_goals (goal_weight_kg, goal_body_fat_pct, target_date, occurred_at, local_date)
  values (p_goal_weight_kg, p_goal_body_fat_pct, p_target_date, p_occurred_at, p_local_date)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.replace_body_goal(numeric, numeric, date, timestamptz, date) from public, anon;
grant execute on function public.replace_body_goal(numeric, numeric, date, timestamptz, date) to authenticated;

-- Canonical daily weight: earliest manual entry of the local day, else the
-- Apple Health weight for that date. security_invoker => callers' RLS applies.

create view public.daily_body_weight with (security_invoker = true) as
with manual as (
  select distinct on (user_id, local_date) user_id, local_date, weight_kg
  from public.body_weights
  order by user_id, local_date, occurred_at
),
health as (
  select user_id, local_date, weight_kg
  from public.daily_metrics
  where weight_kg is not null
)
select
  coalesce(m.user_id, h.user_id) as user_id,
  coalesce(m.local_date, h.local_date) as local_date,
  coalesce(m.weight_kg, h.weight_kg) as weight_kg,
  case when m.user_id is not null then 'manual' else 'apple_health' end as source
from manual m
full join health h on h.user_id = m.user_id and h.local_date = m.local_date;

grant select on public.daily_body_weight to authenticated;

-- Private buckets: <user_id>/<uuid>.<ext> ----------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('body-comp-docs', 'body-comp-docs', false, 10485760, array['image/jpeg', 'application/pdf']),
  ('progress-photos', 'progress-photos', false, 4194304, array['image/jpeg'])
on conflict (id) do nothing;

do $$
declare
  b text;
  slug text;
begin
  foreach b in array array['body-comp-docs', 'progress-photos']
  loop
    slug := replace(b, '-', '_');
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      slug || '_owner_select', b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      slug || '_owner_insert', b);
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      slug || '_owner_update', b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      slug || '_owner_delete', b);
  end loop;
end;
$$;
