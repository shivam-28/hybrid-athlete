-- Bring-your-own AI provider: Anthropic (default) or Microsoft Foundry.
-- Endpoint and deployment names are not secret; the API key stays encrypted.
alter table public.user_ai_keys
  add column provider text not null default 'anthropic' check (provider in ('anthropic', 'foundry')),
  add column endpoint text,
  add column main_deployment text check (main_deployment ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  add column fast_deployment text check (fast_deployment ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  add constraint user_ai_keys_provider_fields check (
    case provider
      when 'foundry' then endpoint is not null and endpoint ~ '^https://[a-z0-9-]+\.services\.ai\.azure\.com/anthropic$'
      else endpoint is null and main_deployment is null and fast_deployment is null
    end
  );
