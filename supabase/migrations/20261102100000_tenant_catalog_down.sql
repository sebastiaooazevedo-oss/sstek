-- Reversão de 20261102100000_tenant_catalog_up.sql
-- Volta os módulos a uma chave única da plataforma e remove o catálogo.

drop function if exists public.resolve_tenant_address(text, text);
drop function if exists public.company_module_enabled(text);

create or replace function public.platform_enabled_modules()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((select s.enabled_modules from public.system_settings s where s.id = 1), jsonb_build_object())
$$;
revoke all on function public.platform_enabled_modules() from public;
grant execute on function public.platform_enabled_modules() to authenticated;

alter table public.companies drop constraint if exists companies_data_plane_check;
alter table public.companies drop constraint if exists companies_onboarding_is_object;
alter table public.companies drop constraint if exists companies_enabled_modules_is_object;
alter table public.companies
  drop column if exists onboarding,
  drop column if exists dedicated_api_url,
  drop column if exists data_plane,
  drop column if exists enabled_modules;
