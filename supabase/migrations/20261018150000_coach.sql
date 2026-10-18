-- Coach: training preferences, weekly plans, planned sessions and daily readiness.
-- See openspec/changes/add-coach/design.md (D5, D6).

-- Preferences (one settings row per user) ---------------------------------------

create table public.training_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  days_per_week smallint not null check (days_per_week between 1 and 7),
  max_session_min smallint not null check (max_session_min between 20 and 240),
  -- ISO weekday: 1 = Monday … 7 = Sunday
  long_run_weekday smallint not null check (long_run_weekday between 1 and 7),
  equipment text not null check (equipment in ('gym', 'home')),
  race_distance_km numeric(6, 3) check (race_distance_km > 0 and race_distance_km <= 250),
  race_date date,
  race_goal_time interval check (race_goal_time > interval '0'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((race_distance_km is null) = (race_date is null)),
  check (race_goal_time is null or race_date is not null)
);

alter table public.training_preferences enable row level security;
create policy training_preferences_owner on public.training_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger training_preferences_updated_at before update on public.training_preferences
  for each row execute function public.set_updated_at();

-- Plans ---------------------------------------------------------------------------

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  local_date date not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded')),
  phase text not null check (phase in ('base', 'build', 'peak', 'taper')),
  context_snapshot jsonb not null,
  warnings jsonb not null default '[]',
  acknowledged_warnings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index training_plans_one_active_per_week on public.training_plans (user_id, week_start) where status = 'active';
create index training_plans_user_local_date on public.training_plans (user_id, local_date);
create index training_plans_user_week on public.training_plans (user_id, week_start);

alter table public.training_plans enable row level security;
create policy training_plans_owner on public.training_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger training_plans_updated_at before update on public.training_plans
  for each row execute function public.set_updated_at();

-- Planned sessions (local_date = the scheduled day) --------------------------------

create table public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  local_date date not null,
  day_index smallint not null check (day_index between 0 and 6),
  position smallint not null default 0,
  type text not null check (type in ('strength', 'run', 'core', 'mobility', 'rest')),
  details jsonb not null,
  adjusted_details jsonb,
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  workout_session_id uuid references public.workout_sessions (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,
  auto_completed boolean not null default false,
  -- Set when the user marks/skips/undoes by hand; auto-completion then leaves the session alone.
  manual boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each logged workout or recorded activity completes at most one planned session.
create unique index planned_sessions_workout_once on public.planned_sessions (workout_session_id) where workout_session_id is not null;
create unique index planned_sessions_activity_once on public.planned_sessions (activity_id) where activity_id is not null;
create index planned_sessions_user_local_date on public.planned_sessions (user_id, local_date);
create index planned_sessions_plan on public.planned_sessions (plan_id);

alter table public.planned_sessions enable row level security;
create policy planned_sessions_owner on public.planned_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create trigger planned_sessions_updated_at before update on public.planned_sessions
  for each row execute function public.set_updated_at();

-- Daily readiness check-ins ----------------------------------------------------------

create table public.readiness_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  local_date date not null,
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  pain_flag boolean not null default false,
  pain_note text check (char_length(pain_note) <= 500),
  score text not null check (score in ('green', 'amber', 'red')),
  -- Snapshot of what the user saw: reasons and the objective signals used.
  reasons jsonb not null default '[]',
  signals jsonb not null default '[]',
  adjustment_choice text not null default 'none' check (adjustment_choice in ('accepted', 'overridden', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

alter table public.readiness_checkins enable row level security;
create policy readiness_checkins_owner on public.readiness_checkins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger readiness_checkins_updated_at before update on public.readiness_checkins
  for each row execute function public.set_updated_at();

-- Accept: supersede the week's active plan and activate this one, atomically.
-- Security invoker, so RLS limits it to the caller's own plans.

create or replace function public.accept_training_plan(p_plan_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.training_plans;
begin
  select * into v_plan from public.training_plans where id = p_plan_id for update;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  if v_plan.status = 'superseded' then
    raise exception 'plan was superseded' using errcode = '22023';
  end if;
  if jsonb_array_length(v_plan.warnings) > 0 and not v_plan.acknowledged_warnings then
    raise exception 'plan warnings must be acknowledged' using errcode = '22023';
  end if;

  update public.training_plans
    set status = 'superseded'
    where user_id = v_plan.user_id and week_start = v_plan.week_start and status = 'active' and id <> p_plan_id;
  update public.training_plans set status = 'active' where id = p_plan_id;
end;
$$;

revoke all on function public.accept_training_plan(uuid) from public, anon;
grant execute on function public.accept_training_plan(uuid) to authenticated;
