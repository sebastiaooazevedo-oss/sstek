-- =====================================================================
-- ENTREGA 1 — HELPERS DE SESSÃO E DE ACESSO (JÁ APLICADOS)
-- =====================================================================
--
-- ESTE ARQUIVO NÃO É MIGRATION E NÃO DEVE SER APLICADO COMO NOVO PASSO.
--
-- Ele reproduz, para revisão externa, o SQL dos helpers que JÁ EXISTEM no
-- banco e dos quais o pacote depende. As definições foram extraídas do
-- ambiente com pg_get_functiondef() (leitura pura) porque elas NÃO estão em
-- nenhum arquivo de supabase/migrations/ do repositório.
--
-- Confirmado por leitura: todas as funções abaixo são SECURITY DEFINER,
-- donas de `postgres`, com `SET search_path TO ''`.
--
-- ESTADO EFETIVO DE EXECUTE (pg_proc.proacl, lido antes desta revisão):
--   current_company_id()        anon=nao  authenticated=sim
--   current_company_ref()       anon=nao  authenticated=sim
--   current_company_role()      anon=nao  authenticated=sim
--   is_company_admin(uuid)      anon=nao  authenticated=sim
--   is_company_member(uuid)     anon=nao  authenticated=sim
--   is_current_company_name()   anon=nao  authenticated=sim
--   is_current_company_ref()    anon=nao  authenticated=sim
--   is_platform_admin()         anon=nao  authenticated=sim
--   current_collaborator_ref()  anon=SIM + PUBLIC (`=X/postgres`)  <-- CORRIGIDO na migration 3, secao 2.1
--   current_company_subdomain() anon=SIM                          <-- CORRIGIDO na migration 3, secao 2.1
--
-- Os dois últimos são o achado do item 5 da revisão: revogar só de `anon`
-- não bastava porque `current_collaborator_ref()` também tinha o grant
-- implícito a PUBLIC. A migration 3 fecha ambos e reconcede a authenticated.
--
-- `platform_enabled_modules()` fica de fora de propósito: é leitura pública
-- de módulos habilitados e continua concedida a anon + authenticated.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Empresa atual: EXATAMENTE UM vínculo ativo. Com 0 ou 2+ devolve NULL
-- (decisão fail-closed; seleção de empresa é outra entrega).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with links as (
    select distinct p.company_id
    from public.profiles p
    join public.companies c on c.id = p.company_id
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
      and p.company_id is not null
      and c.status in ('active','trial')
  )
  select case when count(*) = 1 then (array_agg(company_id))[1] else null end from links
$function$;

-- ---------------------------------------------------------------------
-- Subdomínio da empresa atual (company_ref das tabelas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_company_ref()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.subdomain
  from public.companies c
  where c.id = public.current_company_id()
$function$;

-- ---------------------------------------------------------------------
-- Papel na empresa atual. profiles_role_check aceita apenas
-- 'admin' e 'collaborator'. NÃO existe 'super' em public.profiles.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_company_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with links as (
    select distinct p.company_id, p.role
    from public.profiles p
    join public.companies c on c.id = p.company_id
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
      and p.company_id is not null
      and c.status in ('active','trial')
  )
  select case when count(*) = 1 then (array_agg(role))[1] else null end from links
$function$;

-- ---------------------------------------------------------------------
-- Subdomínio da empresa atual (helper usado pelas policies de Storage).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_company_subdomain()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select lower(c.subdomain)
  from public.companies c
  where c.id = public.current_company_id()
$function$;

-- ---------------------------------------------------------------------
-- Ref do colaborador derivada do vínculo (nunca do corpo da chamada).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_collaborator_ref()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.collaborator_ref
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.company_id = public.current_company_id()
    and p.status = 'active'
  limit 1
$function$;

-- ---------------------------------------------------------------------
-- Comparações usadas pelas policies de tenant.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_company_ref(p_ref text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.companies c
    where c.id = public.current_company_id()
      and c.subdomain = p_ref
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_current_company_name(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.companies c
    where c.id = public.current_company_id()
      and c.name = p_name
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_company_member(p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_company is not null and p_company = public.current_company_id()
$function$;

CREATE OR REPLACE FUNCTION public.is_company_admin(p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_company is not null
     and p_company = public.current_company_id()
     and public.current_company_role() = 'admin'
$function$;

-- ---------------------------------------------------------------------
-- Super usuário global: só ações globais (platform-admin / caepi-base).
-- NUNCA concede contexto de empresa. Deriva de auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.platform_admins pa
    where pa.auth_user_id = auth.uid() and pa.status = 'active'
  )
$function$;

-- ---------------------------------------------------------------------
-- Privilégios (estado pretendido depois da migration 3, seção 2.1)
-- ---------------------------------------------------------------------
revoke all on function public.current_company_id() from public;
revoke all on function public.current_company_id() from anon;
grant execute on function public.current_company_id() to authenticated;

revoke all on function public.current_company_ref() from public;
grant execute on function public.current_company_ref() to authenticated;

revoke all on function public.current_company_role() from public;
revoke all on function public.current_company_role() from anon;
grant execute on function public.current_company_role() to authenticated;

revoke all on function public.current_company_subdomain() from public;
revoke all on function public.current_company_subdomain() from anon;
grant execute on function public.current_company_subdomain() to authenticated;

revoke all on function public.current_collaborator_ref() from public;
revoke all on function public.current_collaborator_ref() from anon;
grant execute on function public.current_collaborator_ref() to authenticated;

revoke all on function public.is_current_company_ref(text) from public;
grant execute on function public.is_current_company_ref(text) to authenticated;

revoke all on function public.is_current_company_name(text) from public;
grant execute on function public.is_current_company_name(text) to authenticated;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.is_company_admin(uuid) from public;
grant execute on function public.is_company_admin(uuid) to authenticated;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;