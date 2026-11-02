-- =====================================================================
-- SSTEK — Catálogo de empresas (tenants)
-- =====================================================================
-- 1) Módulos contratados POR EMPRESA (antes era uma chave única para a
--    plataforma inteira em system_settings.enabled_modules).
--    Regra: o módulo fica ativo para a empresa quando NÃO está desligado
--    na plataforma (chave global) E NÃO está desligado na empresa.
--    Ausência de chave = ligado (mantém o comportamento atual).
-- 2) Plano de dados de cada empresa: 'shared' (banco compartilhado, padrão)
--    ou 'dedicated' (projeto exclusivo, para clientes que exigirem). Só o
--    registro: o roteamento para banco dedicado é uma etapa futura.
-- 3) Situação da implantação (onboarding) de cada empresa.
-- 4) Resolução da empresa pelo endereço (subdomínio ou domínio próprio).
--
-- Idempotente. Reversão: 20261102100000_tenant_catalog_down.sql
-- =====================================================================

alter table public.companies
  add column if not exists enabled_modules jsonb not null default '{}'::jsonb,
  add column if not exists data_plane text not null default 'shared',
  add column if not exists dedicated_api_url text,
  add column if not exists onboarding jsonb not null default '{}'::jsonb;

alter table public.companies drop constraint if exists companies_enabled_modules_is_object;
alter table public.companies
  add constraint companies_enabled_modules_is_object check (jsonb_typeof(enabled_modules) = 'object');

alter table public.companies drop constraint if exists companies_onboarding_is_object;
alter table public.companies
  add constraint companies_onboarding_is_object check (jsonb_typeof(onboarding) = 'object');

alter table public.companies drop constraint if exists companies_data_plane_check;
alter table public.companies
  add constraint companies_data_plane_check check (
    data_plane in ('shared', 'dedicated')
    and (data_plane = 'shared' or coalesce(dedicated_api_url ~ '^https://[a-z0-9.-]+$', false))
  );

comment on column public.companies.enabled_modules is
  'Módulos contratados pela empresa: {"cipa": false} desliga. Ausência de chave = ligado.';
comment on column public.companies.data_plane is
  'shared = banco compartilhado (padrão); dedicated = projeto exclusivo (dedicated_api_url).';
comment on column public.companies.onboarding is
  'Situação da implantação: {"template": "...", "steps": {...}, "completed_at": "..."}.';

-- ---------------------------------------------------------------------
-- Módulos efetivos da empresa da sessão (lido pelo app após o login)
-- ---------------------------------------------------------------------
create or replace function public.platform_enabled_modules()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with g as (
    select coalesce((select s.enabled_modules from public.system_settings s where s.id = 1), '{}'::jsonb) as v
  ),
  c as (
    select coalesce(
      (select co.enabled_modules from public.companies co where co.id = public.current_company_id()),
      '{}'::jsonb
    ) as v
  )
  select g.v || coalesce(
    (select jsonb_object_agg(e.key, e.value) from c, jsonb_each(c.v) e where e.value = 'false'::jsonb),
    '{}'::jsonb
  )
  from g
$$;

revoke all on function public.platform_enabled_modules() from public;
revoke all on function public.platform_enabled_modules() from anon;
grant execute on function public.platform_enabled_modules() to authenticated;

-- Para uso nas regras de acesso (RLS) dos módulos na etapa de segurança:
-- permite bloquear no BANCO os dados de um módulo não contratado.
create or replace function public.company_module_enabled(p_module text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((public.platform_enabled_modules() -> p_module)::text, 'true') <> 'false'
$$;

revoke all on function public.company_module_enabled(text) from public;
revoke all on function public.company_module_enabled(text) from anon;
grant execute on function public.company_module_enabled(text) to authenticated;

-- ---------------------------------------------------------------------
-- Resolução da empresa pelo endereço
-- ---------------------------------------------------------------------
-- Chamada ANTES do login (tela de entrada da empresa), por isso é pública.
-- Devolve só o necessário para identificar a empresa — nenhum dado sensível.
-- Domínio próprio só vale depois de configurado/verificado no painel de domínios.
create or replace function public.resolve_tenant_address(p_subdomain text default null, p_domain text default null)
returns table (
  id uuid,
  name text,
  subdomain text,
  status text,
  data_plane text,
  dedicated_api_url text
)
language sql
stable
security definer
set search_path to ''
as $$
  with by_domain as (
    select c.*
    from public.company_domains d
    join public.companies c on c.id = d.company_id
    where p_domain is not null
      and lower(d.domain) = lower(btrim(p_domain))
      and d.kind <> 'subdomain'
      and d.dns_status in ('verified', 'configured')
    limit 1
  ),
  by_sub as (
    select c.*
    from public.companies c
    where p_subdomain is not null
      and lower(c.subdomain) = lower(btrim(p_subdomain))
    limit 1
  ),
  picked as (
    select * from by_domain
    union all
    select * from by_sub where not exists (select 1 from by_domain)
  )
  select p.id, p.name, p.subdomain, p.status, p.data_plane, p.dedicated_api_url
  from picked p
  limit 1
$$;

revoke all on function public.resolve_tenant_address(text, text) from public;
grant execute on function public.resolve_tenant_address(text, text) to anon, authenticated;
