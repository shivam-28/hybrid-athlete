-- Workout logging: exercise library, custom exercises, aliases, progression
-- overrides, sessions and sets. See openspec/changes/add-workout-logging/design.md.

create extension if not exists pg_trgm with schema extensions;

create type public.muscle_group as enum (
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core',
  'glutes', 'quads', 'hamstrings', 'calves', 'full_body', 'cardio'
);
create type public.muscle_role as enum ('primary', 'secondary');
create type public.tracking_mode as enum ('weight_reps', 'bodyweight_reps', 'duration', 'distance_duration');
create type public.set_type as enum ('warmup', 'working', 'drop', 'failure');
create type public.set_source as enum ('manual', 'voice', 'text');

-- Exercises -------------------------------------------------------------------
-- user_id null = seeded/shared (deliberate deviation from D4); set = private custom.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  source_id text unique,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  search_name text not null,
  category text,
  equipment text,
  level text,
  mechanic text,
  force text,
  tracking_mode public.tracking_mode not null,
  instructions text[] not null default '{}',
  image_paths text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_seeded_xor_custom check ((source_id is null) <> (user_id is null))
);

create index exercises_search_name_trgm on public.exercises using gin (search_name extensions.gin_trgm_ops);
create index exercises_user_id on public.exercises (user_id) where user_id is not null;

alter table public.exercises enable row level security;

create policy exercises_read on public.exercises
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source_id is null);
create policy exercises_update_own on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and source_id is null);
create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle_group public.muscle_group not null,
  role public.muscle_role not null,
  primary key (exercise_id, muscle_group, role)
);

alter table public.exercise_muscles enable row level security;

-- Visibility follows the parent exercise (RLS on exercises applies inside the subquery).
create policy exercise_muscles_read on public.exercise_muscles
  for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id));
create policy exercise_muscles_write_own on public.exercise_muscles
  for all to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid())));

-- Personal aliases and progression overrides ------------------------------------

create table public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phrase_normalised text not null check (char_length(phrase_normalised) between 1 and 100),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phrase_normalised)
);

alter table public.exercise_aliases enable row level security;
create policy exercise_aliases_owner on public.exercise_aliases
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger exercise_aliases_updated_at before update on public.exercise_aliases
  for each row execute function public.set_updated_at();

create table public.exercise_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  increment_kg numeric(5, 2) check (increment_kg > 0 and increment_kg <= 50),
  duration_increment_s smallint check (duration_increment_s between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id),
  check (rep_min is null or rep_max is null or rep_min <= rep_max)
);

alter table public.exercise_settings enable row level security;
create policy exercise_settings_owner on public.exercise_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger exercise_settings_updated_at before update on public.exercise_settings
  for each row execute function public.set_updated_at();

-- Sessions and sets -----------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  local_date date not null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= occurred_at)
);

create unique index workout_sessions_one_active on public.workout_sessions (user_id) where finished_at is null;
create index workout_sessions_user_date on public.workout_sessions (user_id, local_date);

alter table public.workout_sessions enable row level security;
create policy workout_sessions_owner on public.workout_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  occurred_at timestamptz not null default now(),
  -- local_date and set_number are always set by workout_sets_before_insert;
  -- the defaults only keep them optional for API clients.
  local_date date not null default current_date,
  set_number smallint not null default 0 check (set_number >= 1),
  set_type public.set_type not null default 'working',
  weight_kg numeric(6, 2) check (weight_kg between 0 and 500),
  reps smallint check (reps between 1 and 100),
  duration_s integer check (duration_s between 1 and 7200),
  distance_m numeric(8, 1) check (distance_m between 1 and 50000),
  rpe numeric(3, 1) check (rpe between 1 and 10 and rpe * 2 = trunc(rpe * 2)),
  source public.set_source not null default 'manual',
  transcript text check (char_length(transcript) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sets_number_unique unique (session_id, exercise_id, set_number) deferrable initially deferred
);

create index workout_sets_user_date on public.workout_sets (user_id, local_date);
create index workout_sets_user_exercise on public.workout_sets (user_id, exercise_id, occurred_at desc);

alter table public.workout_sets enable row level security;
create policy workout_sets_owner on public.workout_sets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create trigger workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- New sets: copy the session's day, number per exercise, refuse finished sessions
-- and archived/invisible exercises. Runs as the caller, so RLS still applies.
create or replace function public.workout_sets_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_date date;
  session_finished timestamptz;
begin
  select s.local_date, s.finished_at into session_date, session_finished
  from public.workout_sessions s where s.id = new.session_id;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if session_finished is not null then
    raise exception 'session is finished' using errcode = 'P0001', hint = 'session_finished';
  end if;
  if not exists (select 1 from public.exercises e where e.id = new.exercise_id and e.archived_at is null) then
    raise exception 'exercise not available' using errcode = 'P0002';
  end if;

  new.local_date := session_date;
  if new.set_number is null or new.set_number < 1 then
    select coalesce(max(w.set_number), 0) + 1 into new.set_number
    from public.workout_sets w
    where w.session_id = new.session_id and w.exercise_id = new.exercise_id;
  end if;
  return new;
end;
$$;

create trigger workout_sets_before_insert before insert on public.workout_sets
  for each row execute function public.workout_sets_before_insert();

-- Functions -------------------------------------------------------------------

-- Deletes a set and renumbers the exercise's remaining sets in that session.
create or replace function public.delete_set(p_set_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session uuid;
  v_exercise uuid;
begin
  delete from public.workout_sets w where w.id = p_set_id
  returning w.session_id, w.exercise_id into v_session, v_exercise;
  if v_session is null then
    raise exception 'set not found' using errcode = 'P0002';
  end if;

  update public.workout_sets w
  set set_number = r.rn
  from (
    select x.id, row_number() over (order by x.set_number, x.created_at) as rn
    from public.workout_sets x
    where x.session_id = v_session and x.exercise_id = v_exercise
  ) r
  where w.id = r.id and w.set_number <> r.rn;
end;
$$;

-- Working sets per muscle group for the ISO week starting p_week_start (a Monday,
-- in the user's timezone: local_date is already a local day). Primary = 1, secondary = 0.5.
create or replace function public.weekly_muscle_volume(p_week_start date)
returns table (muscle_group public.muscle_group, sets numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.muscle_group, sum(case m.role when 'primary' then 1.0 else 0.5 end) as sets
  from public.workout_sets w
  join public.exercise_muscles m on m.exercise_id = w.exercise_id
  where w.user_id = (select auth.uid())
    and w.set_type <> 'warmup'
    and w.local_date between p_week_start and p_week_start + 6
  group by m.muscle_group
  order by sets desc, m.muscle_group;
$$;

-- Typo-tolerant search over seeded + own custom exercises (RLS applies).
-- p_query must already be normalised by src/lib/workouts/normalise.ts.
create or replace function public.match_exercises(
  p_query text default '',
  p_limit integer default 20,
  p_muscle public.muscle_group default null,
  p_equipment text default null
)
returns table (
  id uuid,
  name text,
  equipment text,
  tracking_mode public.tracking_mode,
  is_custom boolean,
  primary_groups public.muscle_group[],
  score real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.id,
    e.name,
    e.equipment,
    e.tracking_mode,
    e.user_id is not null as is_custom,
    array(select m.muscle_group from exercise_muscles m where m.exercise_id = e.id and m.role = 'primary' order by 1),
    -- Mean of whole-name and best-word-window similarity: rewards names that are close overall,
    -- not just names that contain the query.
    case when p_query = '' then 0 else (similarity(e.search_name, p_query) + word_similarity(p_query, e.search_name)) / 2 end as score
  from exercises e
  where e.archived_at is null
    and (p_equipment is null or e.equipment = p_equipment)
    and (p_muscle is null or exists (select 1 from exercise_muscles m where m.exercise_id = e.id and m.muscle_group = p_muscle))
    and (p_query = '' or similarity(e.search_name, p_query) > 0.15 or word_similarity(p_query, e.search_name) > 0.3)
  order by score desc, e.name
  limit least(greatest(p_limit, 1), 100);
$$;

-- Seeding: upsert seeded exercises and replace their muscles in one transaction.
-- Never touches custom exercises or any user table. Service role only.
create or replace function public.seed_exercises(p_exercises jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  v_id uuid;
  n integer := 0;
begin
  for rec in select * from jsonb_array_elements(p_exercises) loop
    insert into public.exercises as e (
      source_id, user_id, name, search_name, category, equipment, level, mechanic, force,
      tracking_mode, instructions, image_paths
    ) values (
      rec ->> 'source_id', null, rec ->> 'name', rec ->> 'search_name', rec ->> 'category', rec ->> 'equipment',
      rec ->> 'level', rec ->> 'mechanic', rec ->> 'force', (rec ->> 'tracking_mode')::public.tracking_mode,
      array(select jsonb_array_elements_text(rec -> 'instructions')),
      array(select jsonb_array_elements_text(rec -> 'image_paths'))
    )
    on conflict (source_id) do update set
      name = excluded.name,
      search_name = excluded.search_name,
      category = excluded.category,
      equipment = excluded.equipment,
      level = excluded.level,
      mechanic = excluded.mechanic,
      force = excluded.force,
      tracking_mode = excluded.tracking_mode,
      instructions = excluded.instructions,
      image_paths = excluded.image_paths
    returning e.id into v_id;

    delete from public.exercise_muscles m where m.exercise_id = v_id;
    insert into public.exercise_muscles (exercise_id, muscle_group, role)
    select distinct v_id, (x ->> 'group')::public.muscle_group, (x ->> 'role')::public.muscle_role
    from jsonb_array_elements(rec -> 'muscles') x;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.seed_exercises(jsonb) from public, anon, authenticated;
grant execute on function public.seed_exercises(jsonb) to service_role;

-- Finish/reopen use the database clock so finished_at can never precede occurred_at.
create or replace function public.finish_session(p_session_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.workout_sessions set finished_at = greatest(now(), occurred_at)
  where id = p_session_id and finished_at is null;
$$;
