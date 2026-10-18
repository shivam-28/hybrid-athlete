-- Activity sync: Apple Health ingest (token-authenticated) and FIT imports.
-- See openspec/changes/add-activity-sync/design.md (D1–D7).

alter table public.profiles
  add column max_hr_bpm smallint check (max_hr_bpm between 100 and 230);

-- Daily metrics (one row per user per phone-local day) -------------------------

create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  steps integer check (steps between 0 and 200000),
  active_energy_kcal numeric(7, 1) check (active_energy_kcal between 0 and 20000),
  resting_hr_bpm smallint check (resting_hr_bpm between 20 and 250),
  hrv_sdnn_ms numeric(6, 1) check (hrv_sdnn_ms between 1 and 500),
  sleep_minutes smallint check (sleep_minutes between 0 and 1440),
  sleep_start timestamptz,
  sleep_end timestamptz,
  vo2max numeric(4, 1) check (vo2max between 10 and 100),
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  source text not null default 'apple_health',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

alter table public.daily_metrics enable row level security;
create policy daily_metrics_owner on public.daily_metrics
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger daily_metrics_updated_at before update on public.daily_metrics
  for each row execute function public.set_updated_at();

-- Activities (runs, walks, rides…) from Apple Health and/or FIT files ----------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null,
  local_date date not null,
  sport text not null check (sport in ('running', 'walking', 'cycling', 'strength', 'swimming', 'other')),
  sub_sport text,
  elapsed_s integer check (elapsed_s >= 0),
  moving_s integer check (moving_s >= 0),
  distance_m numeric(9, 1) check (distance_m >= 0),
  avg_hr smallint check (avg_hr between 20 and 250),
  max_hr smallint check (max_hr between 20 and 250),
  elevation_gain_m numeric(7, 1) check (elevation_gain_m >= 0),
  calories_kcal numeric(7, 1) check (calories_kcal >= 0),
  external_id text,
  source_name text,
  sources text[] not null default '{}',
  fit_file_path text,
  fit_locked boolean not null default false,
  -- Seconds spent at each heart rate ({"142": 37, ...}); zones are recomputed from it when max HR changes.
  hr_histogram jsonb,
  hr_zone_s integer[] check (hr_zone_s is null or cardinality(hr_zone_s) = 5),
  max_hr_used smallint,
  max_hr_source text check (max_hr_source in ('profile', 'estimated')),
  load numeric(7, 1) check (load >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index activities_user_external_id on public.activities (user_id, external_id) where external_id is not null;
create index activities_user_sport_time on public.activities (user_id, sport, occurred_at);
create index activities_user_local_date on public.activities (user_id, local_date);

alter table public.activities enable row level security;
create policy activities_owner on public.activities
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

create table public.activity_splits (
  activity_id uuid not null references public.activities (id) on delete cascade,
  idx smallint not null check (idx >= 0),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  distance_m numeric(7, 1) not null check (distance_m > 0),
  duration_s numeric(8, 1) not null check (duration_s >= 0),
  avg_hr smallint,
  elev_delta_m numeric(6, 1),
  primary key (activity_id, idx)
);

alter table public.activity_splits enable row level security;
create policy activity_splits_owner on public.activity_splits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Ingest tokens and rate windows: RLS on, no policies => service role only ----

create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  prefix text not null,
  last4 text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  last_result jsonb
);

create unique index ingest_tokens_one_active on public.ingest_tokens (user_id) where revoked_at is null;
create index ingest_tokens_prefix on public.ingest_tokens (prefix);
alter table public.ingest_tokens enable row level security;
revoke all on public.ingest_tokens from anon, authenticated;

create table public.ingest_rate (
  token_id uuid not null references public.ingest_tokens (id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (token_id, window_start)
);

alter table public.ingest_rate enable row level security;
revoke all on public.ingest_rate from anon, authenticated;

-- Private bucket for original FIT files: <user_id>/<activity_id>.fit ---------

insert into storage.buckets (id, name, public, file_size_limit)
values ('activity-files', 'activity-files', false, 26214400)
on conflict (id) do nothing;

create policy activity_files_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'activity-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy activity_files_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy activity_files_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'activity-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy activity_files_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'activity-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Matching: external_id first, else same sport starting within ±2 minutes ----

create or replace function public.match_activity(p_user_id uuid, p_sport text, p_start timestamptz, p_external_id text)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_external_id is not null then
    select id into v_id from public.activities where user_id = p_user_id and external_id = p_external_id;
    if found then
      return v_id;
    end if;
  end if;

  select id into v_id
  from public.activities
  where user_id = p_user_id
    and sport = p_sport
    and occurred_at between p_start - interval '2 minutes' and p_start + interval '2 minutes'
  order by abs(extract(epoch from occurred_at - p_start))
  limit 1;
  return v_id;
end;
$$;

revoke all on function public.match_activity(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.match_activity(uuid, text, timestamptz, text) to authenticated, service_role;

create or replace function public.int_array(p jsonb)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select case when p is null or jsonb_typeof(p) <> 'array' then null
    else array(select (e.value)::integer from jsonb_array_elements_text(p) with ordinality e(value, n) order by e.n) end;
$$;

-- Apple Health ingest: one transaction per request, presence-aware upserts ---
-- Called only by the server (service role) with user_id from a verified token.

create or replace function public.ingest_health(p_user_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tz text;
  d jsonb;
  w jsonb;
  v_date date;
  cur public.daily_metrics;
  nxt public.daily_metrics;
  acur public.activities;
  anew public.activities;
  v_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('ingest:' || p_user_id::text, 0));
  select coalesce(p.timezone, 'Europe/Copenhagen') into v_tz from public.profiles p where p.user_id = p_user_id;
  v_tz := coalesce(v_tz, 'Europe/Copenhagen');

  for d in select value from jsonb_array_elements(coalesce(p_payload -> 'daily', '[]'::jsonb)) loop
    v_date := (d ->> 'date')::date;
    select * into cur from public.daily_metrics where user_id = p_user_id and local_date = v_date for update;
    if not found then
      insert into public.daily_metrics (
        user_id, local_date, occurred_at, steps, active_energy_kcal, resting_hr_bpm, hrv_sdnn_ms,
        sleep_minutes, sleep_start, sleep_end, vo2max, weight_kg
      ) values (
        p_user_id, v_date, v_date::timestamp at time zone v_tz,
        (d ->> 'steps')::integer, (d ->> 'active_energy_kcal')::numeric, (d ->> 'resting_hr_bpm')::smallint,
        (d ->> 'hrv_sdnn_ms')::numeric, (d ->> 'sleep_minutes')::smallint, (d ->> 'sleep_start')::timestamptz,
        (d ->> 'sleep_end')::timestamptz, (d ->> 'vo2max')::numeric, (d ->> 'weight_kg')::numeric
      );
      v_inserted := v_inserted + 1;
    else
      nxt := cur;
      -- Only keys present in the payload overwrite; absent keys never null out stored values.
      if d ? 'steps' then nxt.steps := (d ->> 'steps')::integer; end if;
      if d ? 'active_energy_kcal' then nxt.active_energy_kcal := (d ->> 'active_energy_kcal')::numeric; end if;
      if d ? 'resting_hr_bpm' then nxt.resting_hr_bpm := (d ->> 'resting_hr_bpm')::smallint; end if;
      if d ? 'hrv_sdnn_ms' then nxt.hrv_sdnn_ms := (d ->> 'hrv_sdnn_ms')::numeric; end if;
      if d ? 'sleep_minutes' then nxt.sleep_minutes := (d ->> 'sleep_minutes')::smallint; end if;
      if d ? 'sleep_start' then nxt.sleep_start := (d ->> 'sleep_start')::timestamptz; end if;
      if d ? 'sleep_end' then nxt.sleep_end := (d ->> 'sleep_end')::timestamptz; end if;
      if d ? 'vo2max' then nxt.vo2max := (d ->> 'vo2max')::numeric; end if;
      if d ? 'weight_kg' then nxt.weight_kg := (d ->> 'weight_kg')::numeric; end if;
      if nxt is distinct from cur then
        update public.daily_metrics set
          steps = nxt.steps, active_energy_kcal = nxt.active_energy_kcal, resting_hr_bpm = nxt.resting_hr_bpm,
          hrv_sdnn_ms = nxt.hrv_sdnn_ms, sleep_minutes = nxt.sleep_minutes, sleep_start = nxt.sleep_start,
          sleep_end = nxt.sleep_end, vo2max = nxt.vo2max, weight_kg = nxt.weight_kg
        where id = cur.id;
        v_updated := v_updated + 1;
      else
        v_unchanged := v_unchanged + 1;
      end if;
    end if;
  end loop;

  for w in select value from jsonb_array_elements(coalesce(p_payload -> 'workouts', '[]'::jsonb)) loop
    v_start := (w ->> 'start')::timestamptz;
    v_end := (w ->> 'end')::timestamptz;
    v_id := public.match_activity(p_user_id, w ->> 'sport', v_start, w ->> 'external_id');

    if v_id is null then
      insert into public.activities (
        user_id, occurred_at, local_date, sport, elapsed_s, moving_s, distance_m, avg_hr, max_hr, calories_kcal,
        external_id, source_name, sources, load, max_hr_used, max_hr_source
      ) values (
        p_user_id, v_start, (v_start at time zone v_tz)::date, w ->> 'sport',
        round(extract(epoch from v_end - v_start))::integer, (w ->> 'duration_s')::integer,
        (w ->> 'distance_m')::numeric, (w ->> 'avg_hr')::smallint, (w ->> 'max_hr')::smallint,
        (w ->> 'active_energy_kcal')::numeric, w ->> 'external_id', w ->> 'source_name', array['apple_health'],
        (w ->> 'load')::numeric, (w ->> 'max_hr_used')::smallint, w ->> 'max_hr_source'
      );
      v_inserted := v_inserted + 1;
      continue;
    end if;

    select * into acur from public.activities where id = v_id for update;
    anew := acur;
    if acur.fit_locked then
      -- FIT-derived fields win; Apple Health may only fill gaps.
      anew.elapsed_s := coalesce(acur.elapsed_s, round(extract(epoch from v_end - v_start))::integer);
      anew.moving_s := coalesce(acur.moving_s, (w ->> 'duration_s')::integer);
      anew.distance_m := coalesce(acur.distance_m, (w ->> 'distance_m')::numeric);
      anew.avg_hr := coalesce(acur.avg_hr, (w ->> 'avg_hr')::smallint);
      anew.max_hr := coalesce(acur.max_hr, (w ->> 'max_hr')::smallint);
      anew.calories_kcal := coalesce(acur.calories_kcal, (w ->> 'active_energy_kcal')::numeric);
      anew.load := coalesce(acur.load, (w ->> 'load')::numeric);
      anew.max_hr_used := coalesce(acur.max_hr_used, (w ->> 'max_hr_used')::smallint);
      anew.max_hr_source := coalesce(acur.max_hr_source, w ->> 'max_hr_source');
    else
      anew.elapsed_s := round(extract(epoch from v_end - v_start))::integer;
      anew.moving_s := (w ->> 'duration_s')::integer;
      if w ? 'distance_m' then anew.distance_m := (w ->> 'distance_m')::numeric; end if;
      if w ? 'avg_hr' then anew.avg_hr := (w ->> 'avg_hr')::smallint; end if;
      if w ? 'max_hr' then anew.max_hr := (w ->> 'max_hr')::smallint; end if;
      if w ? 'active_energy_kcal' then anew.calories_kcal := (w ->> 'active_energy_kcal')::numeric; end if;
      if w ? 'load' then anew.load := (w ->> 'load')::numeric; end if;
      if w ? 'max_hr_used' then anew.max_hr_used := (w ->> 'max_hr_used')::smallint; end if;
      if w ? 'max_hr_source' then anew.max_hr_source := w ->> 'max_hr_source'; end if;
    end if;
    anew.external_id := coalesce(acur.external_id, w ->> 'external_id');
    anew.source_name := coalesce(acur.source_name, w ->> 'source_name');
    if not ('apple_health' = any (acur.sources)) then
      anew.sources := acur.sources || array['apple_health'];
    end if;

    if anew is distinct from acur then
      update public.activities set
        elapsed_s = anew.elapsed_s, moving_s = anew.moving_s, distance_m = anew.distance_m, avg_hr = anew.avg_hr,
        max_hr = anew.max_hr, calories_kcal = anew.calories_kcal, load = anew.load, max_hr_used = anew.max_hr_used,
        max_hr_source = anew.max_hr_source, external_id = anew.external_id, source_name = anew.source_name,
        sources = anew.sources
      where id = v_id;
      v_updated := v_updated + 1;
    else
      v_unchanged := v_unchanged + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'unchanged', v_unchanged);
end;
$$;

revoke all on function public.ingest_health(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_health(uuid, jsonb) to service_role;

-- FIT import: runs as the signed-in user (RLS applies), same matching rules ---

create or replace function public.import_fit_activity(p_activity jsonb, p_splits jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_start timestamptz := (p_activity ->> 'occurred_at')::timestamptz;
  v_id uuid;
  v_status text;
  acur public.activities;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ingest:' || v_uid::text, 0));
  select coalesce(p.timezone, 'Europe/Copenhagen') into v_tz from public.profiles p where p.user_id = v_uid;
  v_tz := coalesce(v_tz, 'Europe/Copenhagen');

  v_id := public.match_activity(v_uid, p_activity ->> 'sport', v_start, null);

  if v_id is not null then
    select * into acur from public.activities where id = v_id for update;
    if 'fit' = any (acur.sources) then
      return jsonb_build_object('status', 'duplicate', 'activity_id', v_id);
    end if;
    update public.activities set
      sub_sport = coalesce(p_activity ->> 'sub_sport', sub_sport),
      elapsed_s = coalesce((p_activity ->> 'elapsed_s')::integer, elapsed_s),
      moving_s = coalesce((p_activity ->> 'moving_s')::integer, moving_s),
      distance_m = coalesce((p_activity ->> 'distance_m')::numeric, distance_m),
      avg_hr = coalesce((p_activity ->> 'avg_hr')::smallint, avg_hr),
      max_hr = coalesce((p_activity ->> 'max_hr')::smallint, max_hr),
      elevation_gain_m = coalesce((p_activity ->> 'elevation_gain_m')::numeric, elevation_gain_m),
      calories_kcal = coalesce((p_activity ->> 'calories_kcal')::numeric, calories_kcal),
      hr_histogram = coalesce(p_activity -> 'hr_histogram', hr_histogram),
      hr_zone_s = coalesce(public.int_array(p_activity -> 'hr_zone_s'), hr_zone_s),
      max_hr_used = coalesce((p_activity ->> 'max_hr_used')::smallint, max_hr_used),
      max_hr_source = coalesce(p_activity ->> 'max_hr_source', max_hr_source),
      load = coalesce((p_activity ->> 'load')::numeric, load),
      fit_file_path = p_activity ->> 'fit_file_path',
      fit_locked = true,
      sources = sources || array['fit']
    where id = v_id;
    v_status := 'merged';
  else
    v_id := (p_activity ->> 'id')::uuid;
    insert into public.activities (
      id, user_id, occurred_at, local_date, sport, sub_sport, elapsed_s, moving_s, distance_m, avg_hr, max_hr,
      elevation_gain_m, calories_kcal, hr_histogram, hr_zone_s, max_hr_used, max_hr_source, load,
      fit_file_path, fit_locked, sources
    ) values (
      v_id, v_uid, v_start, (v_start at time zone v_tz)::date, p_activity ->> 'sport', p_activity ->> 'sub_sport',
      (p_activity ->> 'elapsed_s')::integer, (p_activity ->> 'moving_s')::integer, (p_activity ->> 'distance_m')::numeric,
      (p_activity ->> 'avg_hr')::smallint, (p_activity ->> 'max_hr')::smallint, (p_activity ->> 'elevation_gain_m')::numeric,
      (p_activity ->> 'calories_kcal')::numeric, p_activity -> 'hr_histogram', public.int_array(p_activity -> 'hr_zone_s'),
      (p_activity ->> 'max_hr_used')::smallint, p_activity ->> 'max_hr_source', (p_activity ->> 'load')::numeric,
      p_activity ->> 'fit_file_path', true, array['fit']
    );
    v_status := 'created';
  end if;

  delete from public.activity_splits where activity_id = v_id;
  insert into public.activity_splits (activity_id, idx, user_id, distance_m, duration_s, avg_hr, elev_delta_m)
  select v_id, (s ->> 'idx')::smallint, v_uid, (s ->> 'distance_m')::numeric, (s ->> 'duration_s')::numeric,
         (s ->> 'avg_hr')::smallint, (s ->> 'elev_delta_m')::numeric
  from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) s;

  return jsonb_build_object('status', v_status, 'activity_id', v_id);
end;
$$;

revoke all on function public.import_fit_activity(jsonb, jsonb) from public, anon;
grant execute on function public.import_fit_activity(jsonb, jsonb) to authenticated;

-- Fixed hourly rate-limit window per token; prunes old windows as it goes ----

create or replace function public.bump_ingest_rate(p_token_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.ingest_rate where window_start < now() - interval '1 day';
  insert into public.ingest_rate (token_id, window_start, count)
  values (p_token_id, date_trunc('hour', now()), 1)
  on conflict (token_id, window_start) do update set count = public.ingest_rate.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

revoke all on function public.bump_ingest_rate(uuid) from public, anon, authenticated;
grant execute on function public.bump_ingest_rate(uuid) to service_role;

revoke all on function public.int_array(jsonb) from public, anon;
