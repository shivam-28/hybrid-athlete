-- Lists public tables that hold per-user rows; the account registry test
-- compares this against src/server/account/registry.ts.
create or replace function public.user_owned_tables()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select c.table_name::text
  from information_schema.columns c
  join information_schema.tables t using (table_schema, table_name)
  where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
  order by 1;
$$;

revoke all on function public.user_owned_tables() from public, anon, authenticated;
grant execute on function public.user_owned_tables() to service_role;
