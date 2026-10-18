-- Pre-deploy security review fixes.

-- Photo comparisons may only reference the caller's own photos. FK checks do
-- not consult RLS, so the owner policy alone allowed pointing at foreign ids.
drop policy progress_photo_analyses_owner on public.progress_photo_analyses;
create policy progress_photo_analyses_owner on public.progress_photo_analyses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.progress_photos p where p.id = photo_a_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.progress_photos p where p.id = photo_b_id and p.user_id = (select auth.uid()))
  );

-- Per-item length limits on free-text profile arrays (they are sent to the model).
create or replace function public.text_items_within(items text[], max_len int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(item) between 1 and max_len), true) from unnest(items) as item;
$$;

alter table public.profiles
  add constraint profiles_allergies_item_len check (public.text_items_within(allergies, 60)),
  add constraint profiles_dislikes_item_len check (public.text_items_within(dislikes, 60)),
  add constraint profiles_cuisines_item_len check (public.text_items_within(cuisines, 40));

-- Token hashes are always 64 lowercase hex chars (HMAC-SHA-256).
alter table public.ingest_tokens
  add constraint ingest_tokens_hash_shape check (token_hash ~ '^[0-9a-f]{64}$');

-- Stored FIT files must live under the owner's own storage prefix.
alter table public.activities
  add constraint activities_fit_path_owned check (
    fit_file_path is null
    or (fit_file_path like user_id::text || '/%' and position('..' in fit_file_path) = 0)
  );
