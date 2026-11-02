-- =====================================================================
-- PROPOSTA DE BASELINE — HELPERS DE SESSÃO E DE ACESSO
-- Versão sugerida: 20261101090000_baseline_session_helpers_up.sql
-- =====================================================================
--
-- ARQUIVO DE PROPOSTA. NÃO É MIGRATION APLICÁVEL AINDA.
--
-- Por que está em docs/ e não em supabase/migrations/
-- ---------------------------------------------------
-- Qualquer executor que varra supabase/migrations/ aplicaria este arquivo.
-- Ele é seguro (aborta se algo já existir), mas não deve correr o risco de
-- entrar em produção sem decisão humana. Quando adotado, mova para
-- supabase/migrations/20261101090000_baseline_session_helpers_up.sql.
--
-- Por que ele existe
-- ------------------
-- As 10 funções abaixo EXISTEM no banco e NÃO estão em nenhum arquivo de
-- supabase/migrations/. Sem elas, policies e o pacote da Entrega 1 não
-- funcionam — e um ambiente novo não é reconstruível pelo repositório.
--
-- Contrato de segurança deste arquivo
-- -----------------------------------
--  1. NUNCA sobrescreve definição existente. Se qualquer uma das 10 já
--     existir, o script ABORTA inteiro antes de qualquer CREATE/GRANT.
--  2. Usa `create function`, nunca `create or replace`.
--  3. Não cria tabela, não altera dado, não toca em policy.
--  4. Fecha EXECUTE de PUBLIC e de anon nas 10 e concede apenas a
--     authenticated. Fecha também as duas que a seção 2.1 da migration
--     20261101100300 deixou de fora (is_current_company_name, is_platform_admin).
--  5. Termina com verificação que aborta se o estado final divergir.
--
-- PRÉ-REQUISITO OBRIGATÓRIO
-- -------------------------
-- Precisam existir ANTES: public.companies, public.profiles,
-- public.platform_admins, e o runtime auth.uid() do Supabase.
-- ATENÇÃO: companies e profiles NÃO são criadas por nenhuma migration deste
-- repositório (ver AUDITORIA_V245.md §4.1). Em banco vazio este script FALHA —
-- e falhar é o comportamento correto, em vez de criar um ambiente meio pronto.
--
-- Aplicar SEMPRE dentro de uma transação externa (o arquivo não abre BEGIN).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. GUARDA: recusa executar se qualquer helper já existir
-- ---------------------------------------------------------------------
do $guard$
declare
  v_existentes text;
begin
  select string_agg(f.nome, ', ' order by f.nome)
    into v_existentes
  from (
    values ('public.current_company_id()'),
           ('public.current_company_ref()'),
           ('public.current_company_role()'),
           ('public.current_company_subdomain()'),
           ('public.current_collaborator_ref()'),
           ('public.is_current_company_ref(text)'),
           ('public.is_current_company_name(text)'),
           ('public.is_company_member(uuid)'),
           ('public.is_company_admin(uuid)'),
           ('public.is_platform_admin()')
  ) as f(nome)
  where to_regprocedure(f.nome) is not null;

  if v_existentes is not null then
    raise exception
      'Baseline recusada: helpers já existentes neste banco -> %. Nada foi alterado. Aplique esta baseline apenas em ambiente novo.',
      v_existentes;
  end if;
end
$guard$;


-- ---------------------------------------------------------------------
-- 1. GUARDA: pré-requisitos de tabela
-- ---------------------------------------------------------------------
do $pre$
begin
  if to_regclass('public.companies') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.platform_admins') is null then
    raise exception
      'Pré-requisito ausente: public.companies, public.profiles e public.platform_admins precisam existir. Nada foi alterado.';
  end if;
end
$pre$;


-- ---------------------------------------------------------------------
-- 2. Funções (definições idênticas às efetivas no banco)
-- ---------------------------------------------------------------------

-- Empresa atual: EXATAMENTE UM vínculo ativo. Com 0 ou 2+ devolve NULL
-- (fail-closed; seleção de empresa é outra entrega).
create function public.current_company_id()
 returns uuid
 language sql
 stable security definer
 set search_path to ''
as $function$
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

-- Ref (subdomínio) da empresa atual.
create function public.current_company_ref()
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select c.subdomain
  from public.companies c
  where c.id = public.current_company_id()
$function$;

-- Papel na empresa atual. profiles_role_check aceita apenas
-- 'admin' e 'collaborator'. NÃO existe 'super'.
create function public.current_company_role()
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
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

-- Subdomínio em minúsculas (usado pelas policies de Storage).
create function public.current_company_subdomain()
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select lower(c.subdomain)
  from public.companies c
  where c.id = public.current_company_id()
$function$;

-- Ref do colaborador derivada do vínculo (nunca do corpo da chamada).
create function public.current_collaborator_ref()
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p.collaborator_ref
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.company_id = public.current_company_id()
    and p.status = 'active'
  limit 1
$function$;

-- Comparação por company_ref (subdomínio).
create function public.is_current_company_ref(p_ref text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1
    from public.companies c
    where c.id = public.current_company_id()
      and c.subdomain = p_ref
  )
$function$;

-- Comparação por nome de empresa.
create function public.is_current_company_name(p_name text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1
    from public.companies c
    where c.id = public.current_company_id()
      and c.name = p_name
  )
$function$;

-- Vínculo com a empresa atual.
create function public.is_company_member(p_company uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p_company is not null and p_company = public.current_company_id()
$function$;

-- Administrador da empresa atual.
create function public.is_company_admin(p_company uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p_company is not null
     and p_company = public.current_company_id()
     and public.current_company_role() = 'admin'
$function$;

-- Super usuário global. Só ações globais; NUNCA concede contexto de empresa.
create function public.is_platform_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.platform_admins pa
    where pa.auth_user_id = auth.uid() and pa.status = 'active'
  )
$function$;


-- ---------------------------------------------------------------------
-- 3. Privilégios EXECUTE: PUBLIC e anon fechados, authenticated mantido
--    (fecha as 10, incluindo as 2 que a seção 2.1 da migration 3 não cobre)
-- ---------------------------------------------------------------------
revoke all on function public.current_company_id() from public;
revoke all on function public.current_company_id() from anon;
grant execute on function public.current_company_id() to authenticated;

revoke all on function public.current_company_ref() from public;
revoke all on function public.current_company_ref() from anon;
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
revoke all on function public.is_current_company_ref(text) from anon;
grant execute on function public.is_current_company_ref(text) to authenticated;

revoke all on function public.is_current_company_name(text) from public;
revoke all on function public.is_current_company_name(text) from anon;
grant execute on function public.is_current_company_name(text) to authenticated;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_company_member(uuid) from anon;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.is_company_admin(uuid) from public;
revoke all on function public.is_company_admin(uuid) from anon;
grant execute on function public.is_company_admin(uuid) to authenticated;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_platform_admin() from anon;
grant execute on function public.is_platform_admin() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Conferência final: aborta se o estado não for o esperado
-- ---------------------------------------------------------------------
do $check$
declare
  v_nome       text;
  v_ok         boolean;
  v_anon       boolean;
  v_auth       boolean;
  v_publico    boolean;
  v_problemas  text := '';
begin
  foreach v_nome in array array[
    'public.current_company_id()',
    'public.current_company_ref()',
    'public.current_company_role()',
    'public.current_company_subdomain()',
    'public.current_collaborator_ref()',
    'public.is_current_company_ref(text)',
    'public.is_current_company_name(text)',
    'public.is_company_member(uuid)',
    'public.is_company_admin(uuid)',
    'public.is_platform_admin()'
  ]
  loop
    v_ok := to_regprocedure(v_nome) is not null;

    if not v_ok then
      v_problemas := v_problemas || format(E'\n  - %s NAO EXISTE', v_nome);
      continue;
    end if;

    select p.prosecdef
      into v_ok
    from pg_proc p
    where p.oid = to_regprocedure(v_nome);

    if not v_ok then
      v_problemas := v_problemas || format(E'\n  - %s nao e SECURITY DEFINER', v_nome);
    end if;

    v_anon := has_function_privilege('anon', to_regprocedure(v_nome), 'EXECUTE');
    v_auth := has_function_privilege('authenticated', to_regprocedure(v_nome), 'EXECUTE');

    select exists (
      select 1
      from pg_proc p,
           aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = to_regprocedure(v_nome)
        and a.grantee = 0
    )
      into v_publico;

    if v_anon then
      v_problemas := v_problemas || format(E'\n  - %s ainda executavel por anon', v_nome);
    end if;

    if v_publico then
      v_problemas := v_problemas || format(E'\n  - %s ainda com grant a PUBLIC', v_nome);
    end if;

    if not v_auth then
      v_problemas := v_problemas || format(E'\n  - %s sem EXECUTE para authenticated', v_nome);
    end if;
  end loop;

  if v_problemas <> '' then
    raise exception 'Conferencia final falhou (rollback):%', v_problemas;
  end if;

  raise notice 'Baseline dos 10 helpers aplicada e conferida.';
end
$check$;

-- =====================================================================
-- FIM — PROPOSTA, NÃO APLICADA NESTA ETAPA
-- =====================================================================