-- =====================================================================
-- Entrega 1 — Subdomínio imutável no fluxo normal
-- Versão: 20261101100400 (única)  |  Ordem de aplicação: 4 de 4 pendentes
-- =====================================================================
--
-- ⚠️  NÃO EXECUTADO PELO AGENTE. Aplicar manualmente ou pelo script mestre
--     supabase/scripts/entrega1_apply_all_transactional.sql.
--
-- ESTE ARQUIVO NÃO TEM begin;/commit; PRÓPRIOS (a transação vem de fora).
--
-- Duas camadas:
--   * Servidor (implantado): platform-admin / upsert_company responde
--     409 SUBDOMAIN_IMMUTABLE quando o subdomínio muda em edição.
--   * Banco (este arquivo): gatilho bloqueia UPDATE de subdomain.
--
-- `app.allow_subdomain_change` NÃO é autorização. Qualquer sessão define os
-- próprios GUCs, inclusive um usuário comum autenticado. Por isso o gatilho
-- exige DUAS coisas:
--   1) privilégio real: is_platform_admin() (derivado de auth.uid() +
--      platform_admins.status='active'), OU sessão direta do proprietário do
--      banco (current_user in ('postgres','supabase_admin')) — caminho que só
--      existe no console SQL; o PostgREST sempre executa como
--      authenticator -> anon/authenticated/service_role;
--   2) o marcador do procedimento planejado.
--
-- A função é SECURITY INVOKER de propósito: com SECURITY DEFINER,
-- `current_user` passaria a ser o dono (postgres) e o teste de proprietário
-- seria sempre verdadeiro — bypass silencioso. O $check$ falha se alguém
-- tornar a função DEFINER.
--
-- Recuperação: supabase/recovery/20261101100400_entrega1_subdomain_immutability_recovery.sql
--              (rollback exato: remove só o que este arquivo criou)
-- =====================================================================

create or replace function public.companies_block_subdomain_change()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_privileged boolean;
  v_marker boolean;
begin
  if new.subdomain is not distinct from old.subdomain then
    return new;
  end if;

  v_privileged := public.is_platform_admin()
                  or current_user in ('postgres', 'supabase_admin');

  if not v_privileged then
    raise exception
      'Somente o super usuário da plataforma pode alterar o subdomínio, e apenas por procedimento planejado.'
      using errcode = 'check_violation';
  end if;

  v_marker := coalesce(current_setting('app.allow_subdomain_change', true), '') = 'true';

  if not v_marker then
    raise exception
      'Subdomínio é imutável por este fluxo. A troca exige procedimento planejado: set local app.allow_subdomain_change = ''true'' na mesma transação, executado pelo proprietário.'
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists companies_block_subdomain_change on public.companies;
create trigger companies_block_subdomain_change
  before update of subdomain on public.companies
  for each row execute function public.companies_block_subdomain_change();

revoke all on function public.companies_block_subdomain_change() from public;
revoke all on function public.companies_block_subdomain_change() from anon;
revoke all on function public.companies_block_subdomain_change() from authenticated;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
do $check$
declare
  v_problem text[] := array[]::text[];
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.companies'::regclass
      and tgname = 'companies_block_subdomain_change'
      and not tgisinternal
  ) then
    v_problem := v_problem || 'gatilho companies_block_subdomain_change ausente';
  end if;

  if exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure('public.companies_block_subdomain_change()')
      and p.prosecdef = true
  ) then
    v_problem := v_problem || 'função é SECURITY DEFINER e anularia a checagem de privilégio';
  end if;

  if has_function_privilege('anon', 'public.companies_block_subdomain_change()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.companies_block_subdomain_change()', 'EXECUTE') then
    v_problem := v_problem || 'função de gatilho executável por anon/authenticated';
  end if;

  if array_length(v_problem, 1) is not null then
    raise exception 'Conferência final falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;