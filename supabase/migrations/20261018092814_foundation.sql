-- Foundation: profiles, BYO AI keys, signup allowlist + auth hook.
-- Conventions for every user-owned table: see openspec/changes/add-foundation/design.md (D4).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null,
  height_cm numeric(5, 1) not null check (height_cm between 100 and 250),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  timezone text not null default 'Europe/Copenhagen',
  strength_experience text not null check (strength_experience in ('beginner', 'intermediate', 'advanced')),
  running_experience text not null check (running_experience in ('none', 'beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_owner on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- BYO Anthropic keys: RLS on, no policies => no client role can read or write.
-- Only the server-side service-role client touches this table.

create table public.user_ai_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version smallint not null default 1,
  last4 text not null check (char_length(last4) = 4),
  invalid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ai_keys enable row level security;
revoke all on public.user_ai_keys from anon, authenticated;

create trigger user_ai_keys_updated_at before update on public.user_ai_keys
  for each row execute function public.set_updated_at();

-- Signup allowlist: exact email or "@domain". Empty table => open signups.

create table public.signup_allowlist (
  pattern text primary key check (pattern <> '')
);

alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

create or replace function public.normalize_allowlist_pattern()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.pattern = lower(trim(new.pattern));
  return new;
end;
$$;

create trigger signup_allowlist_normalize before insert or update on public.signup_allowlist
  for each row execute function public.normalize_allowlist_pattern();

-- Auth hook: runs inside Supabase Auth before any user is created, so it
-- cannot be bypassed by calling the Auth API directly with the anon key.

create schema if not exists auth_hooks;
grant usage on schema auth_hooks to supabase_auth_admin;

create or replace function auth_hooks.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := lower(event -> 'user' ->> 'email');
begin
  if not exists (select 1 from public.signup_allowlist) then
    return '{}'::jsonb;
  end if;

  if exists (
    select 1
    from public.signup_allowlist a
    where a.pattern = email
       or (left(a.pattern, 1) = '@' and right(email, char_length(a.pattern)) = a.pattern)
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'This instance is invite-only.')
  );
end;
$$;

revoke all on function auth_hooks.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function auth_hooks.before_user_created(jsonb) to supabase_auth_admin;
