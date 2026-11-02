-- Entrega 1 — Configuração por empresa (SSTEK)
--
-- Cria `public.company_settings` (uma linha por empresa), permite leitura por
-- membro da empresa e escrita apenas pelo administrador da empresa.
-- Também tira `system_settings` da leitura pública e expõe os módulos
-- contratados (controlados pela plataforma) por função.
--
-- Reversão: 20261101100000_entrega1_company_settings_down.sql

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  logo_path text,
  letterhead_path text,
  company_legal_name text not null default '',
  company_cnpj text not null default '',
  technical_responsible text not null default '',
  technical_registration text not null default '',
  sesmt_phone text not null default '',
  public_base_url text,
  validar_ca_ativo_no_epi boolean not null default true,
  permitir_ca_nao_encontrado boolean not null default false,
  permitir_ca_vencido boolean not null default false,
  replacement_sla_hours jsonb not null default jsonb_build_object(),
  document_renewal_sla_days jsonb not null default jsonb_build_object(),
  document_renewal_idle_days integer not null default 5,
  document_renewal_sla_warning_days integer not null default 3,
  document_renewal_manager_warning_days integer not null default 7,
  document_renewal_escalation_days integer not null default 5,
  dashboard_mood_attention boolean not null default true,
  certificate_leave_alert_days integer not null default 3,
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

drop policy if exists company_settings_read on public.company_settings;
create policy company_settings_read on public.company_settings
  for select to authenticated
  using (public.is_company_member(company_id));

drop policy if exists company_settings_insert on public.company_settings;
create policy company_settings_insert on public.company_settings
  for insert to authenticated
  with check (public.is_company_admin(company_id));

drop policy if exists company_settings_update on public.company_settings;
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

grant select, insert, update on public.company_settings to authenticated;
revoke all on public.company_settings from anon;

-- Helper: subdomínio da empresa do chamador (usado pelas policies de Storage).
create or replace function public.current_company_subdomain()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select lower(c.subdomain)
  from public.companies c
  where c.id = public.current_company_id()
$$;

revoke all on function public.current_company_subdomain() from public;
grant execute on function public.current_company_subdomain() to authenticated;

-- Módulos contratados: definidos pela plataforma, apenas leitura pelo cliente.
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
grant execute on function public.platform_enabled_modules() to authenticated, anon;

-- system_settings deixa de ser leitura pública (continha dados da empresa).
drop policy if exists system_settings_select_public on public.system_settings;
drop policy if exists system_settings_insert_public on public.system_settings;
drop policy if exists system_settings_update_public on public.system_settings;

drop policy if exists system_settings_platform_read on public.system_settings;
create policy system_settings_platform_read on public.system_settings
  for select to authenticated
  using (public.is_platform_admin());

revoke all on public.system_settings from anon;