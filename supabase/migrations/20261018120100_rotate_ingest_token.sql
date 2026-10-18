-- Rotation revokes the active token and inserts the new one atomically.
create or replace function public.rotate_ingest_token(p_user_id uuid, p_token_hash text, p_prefix text, p_last4 text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.ingest_tokens set revoked_at = now() where user_id = p_user_id and revoked_at is null;
  insert into public.ingest_tokens (user_id, token_hash, prefix, last4)
  values (p_user_id, p_token_hash, p_prefix, p_last4)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.rotate_ingest_token(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.rotate_ingest_token(uuid, text, text, text) to service_role;
