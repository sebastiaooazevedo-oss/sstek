-- =====================================================================
-- Entrega 1 — Escopo de leitura de public.documents
-- Versão: 20261101100100 (única)  |  Ordem de aplicação: 1 de 4 pendentes
-- =====================================================================
--
-- ⚠️  NÃO EXECUTADO PELO AGENTE. Aplicar manualmente (SQL Editor) ou pelo
--     script mestre supabase/scripts/entrega1_apply_all_transactional.sql.
--
-- ESTE ARQUIVO NÃO TEM begin;/commit; PRÓPRIOS. Ele é um corpo de statements.
-- A atomicidade vem de fora: o SQL Editor envolve o script inteiro em uma
-- transação, e o Supabase CLI envolve cada migration em uma transação.
--
-- Decisão de acesso (vale para a tabela e é espelhada no Storage):
--   * Administrador da empresa (profiles.role = 'admin'): todos os
--     documentos da própria empresa.
--   * Colaborador: documentos individuais DELE + materiais GERAIS
--     publicados (scope <> 'colaborador' e visible_to_collaborator = true).
--   * Documento individual de outra pessoa: inacessível, mesmo com
--     visible_to_collaborator = true.
--   * Usuário sem contexto de empresa definido (0 ou 2+ vínculos ativos):
--     nega tudo. Decisão de produto — a seleção de empresa é outra entrega.
--
-- Não existe papel 'super' em public.profiles:
--   profiles_role_check = CHECK (role = ANY (ARRAY['admin','collaborator']))
--
-- ESTADO REAL CONFERIDO (pg_policies em public.documents):
--   documents_all        | ALL    | public        | false | false -> deny
--   legacy_all_disabled  | ALL    | authenticated | false | false -> deny
--   tenant_read          | SELECT | authenticated | is_current_company_ref(company_ref)
--   tenant_write         | ALL    | authenticated | is_current_company_ref(company_ref)
--                                                    AND current_company_role() = 'admin'
--
-- CORREÇÃO DO INVENTÁRIO (revisão externa, item 2):
--   A versão anterior abortava com QUALQUER policy SELECT/ALL cujo `qual`
--   não fosse literalmente false — inclusive `tenant_write`, que é ALL de
--   administrador e é legítima. Agora:
--     * `tenant_write` é verificada pela FORMA (comando, papéis, expressão
--       de admin e ausência de 'super'); se mudar, aborta.
--     * policies RESTRITIVAS nunca são tratadas como concessão de leitura
--       (restrictive só estreita; não soma por OR).
--     * policies desconhecidas só abortam quando são PERMISSIVAS e de
--       leitura (SELECT/ALL) com `qual` que não seja literalmente false.
--     * policies desconhecidas de escrita (INSERT/UPDATE) não ampliam
--       leitura; ficam registradas como aviso, não como bloqueio.
--
-- Recuperação: supabase/recovery/20261101100100_entrega1_documents_scope_policy_recovery.sql
--              (fail-closed: NÃO restaura leitura ampla)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Inventário com reconhecimento da autorização administrativa
-- ---------------------------------------------------------------------
do $inventory$
declare
  pol record;
  v_problems text[] := array[]::text[];
begin
  for pol in
    select policyname, permissive, cmd, roles::text[] as roles, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'documents'
    order by policyname
  loop
    -- Substituída logo abaixo.
    if pol.policyname = 'tenant_read' then
      continue;
    end if;

    -- Autorização administrativa necessária: precisa existir e ter esta forma.
    if pol.policyname = 'tenant_write' then
      if pol.permissive <> 'PERMISSIVE'
         or pol.cmd <> 'ALL'
         or pol.roles is distinct from array['authenticated']::text[]
         or coalesce(pol.qual, '') !~* 'is_current_company_ref'
         or coalesce(pol.qual, '') !~* 'current_company_role\s*\(\s*\)\s*=\s*''admin'''
         or coalesce(pol.with_check, '') !~* 'current_company_role\s*\(\s*\)\s*=\s*''admin'''
         or coalesce(pol.qual, '') ~* '''super'''
         or coalesce(pol.with_check, '') ~* '''super'''
         or btrim(coalesce(pol.qual, '')) in ('true', '(true)')
         or btrim(coalesce(pol.with_check, '')) in ('true', '(true)') then
        v_problems := v_problems || format(
          'tenant_write mudou de forma (cmd=%s, papéis=%s, using=%s, check=%s). A autorização administrativa precisa ser revista manualmente.',
          pol.cmd,
          array_to_string(pol.roles, ','),
          coalesce(pol.qual, '<null>'),
          coalesce(pol.with_check, '<null>')
        );
      end if;
      continue;
    end if;

    -- Deny placeholders conhecidos: exigem false/false.
    if pol.policyname in ('documents_all', 'legacy_all_disabled') then
      if pol.cmd <> 'ALL'
         or btrim(coalesce(pol.qual, '')) not in ('false', '(false)')
         or btrim(coalesce(pol.with_check, '')) not in ('false', '(false)') then
        v_problems := v_problems || format(
          '%s deveria negar tudo (false/false) mas está como using=%s check=%s',
          pol.policyname,
          coalesce(pol.qual, '<null>'),
          coalesce(pol.with_check, '<null>')
        );
      end if;
      continue;
    end if;

    -- Política desconhecida: só amplia leitura se for PERMISSIVA e de leitura.
    if pol.permissive = 'PERMISSIVE' and pol.cmd in ('SELECT', 'ALL') then
      if btrim(coalesce(pol.qual, 'true')) not in ('false', '(false)') then
        v_problems := v_problems || format(
          '%s concede leitura em documents (cmd %s, papéis %s) com expressão %s',
          pol.policyname,
          pol.cmd,
          array_to_string(pol.roles, ','),
          coalesce(pol.qual, '<null>')
        );
      end if;
    elsif pol.permissive = 'PERMISSIVE' then
      raise notice 'Aviso: policy % de escrita (cmd %) em documents não reconhecida. Não amplia leitura; as referências de arquivo são validadas por gatilho.', pol.policyname, pol.cmd;
    end if;
  end loop;

  if array_length(v_problems, 1) is not null then
    raise exception
      E'Migração interrompida. NENHUMA policy foi alterada.\nPolicies de leitura extra em public.documents:\n  - %\nRevise antes de continuar.',
      array_to_string(v_problems, E'\n  - ');
  end if;
end
$inventory$;

-- ---------------------------------------------------------------------
-- 2) Substitui a leitura
-- ---------------------------------------------------------------------
drop policy if exists tenant_read on public.documents;

create policy tenant_read on public.documents
  for select to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and (
      public.current_company_role() = 'admin'
      -- Documento individual do próprio colaborador
      or (
        scope = 'colaborador'
        and collaborator_id is not null
        and public.current_collaborator_ref() is not null
        and collaborator_id = public.current_collaborator_ref()
      )
      -- Material geral explicitamente publicado para colaboradores
      or (
        coalesce(scope, 'empresa') <> 'colaborador'
        and visible_to_collaborator is true
      )
    )
  );

-- ---------------------------------------------------------------------
-- 3) Conferência estrutural (mesmas regras do inventário)
-- ---------------------------------------------------------------------
do $check$
declare
  v_problem text[] := array[]::text[];
  pol record;
begin
  select * into pol
  from pg_policies
  where schemaname = 'public' and tablename = 'documents' and policyname = 'tenant_read';

  if pol.policyname is null then
    v_problem := v_problem || 'tenant_read não existe';
  else
    if pol.cmd <> 'SELECT' then
      v_problem := v_problem || format('tenant_read com cmd %s', pol.cmd);
    end if;
    if pol.roles::text[] is distinct from array['authenticated']::text[] then
      v_problem := v_problem || format('tenant_read com papéis %s', array_to_string(pol.roles::text[], ','));
    end if;
    if coalesce(pol.qual, '') !~* 'current_company_role' then
      v_problem := v_problem || 'tenant_read sem checagem de papel';
    end if;
    if coalesce(pol.qual, '') !~* 'collaborator_id' then
      v_problem := v_problem || 'tenant_read sem checagem de colaborador';
    end if;
    if coalesce(pol.qual, '') ~* '''super''' then
      v_problem := v_problem || 'tenant_read usa o papel inexistente ''super''';
    end if;
  end if;

  -- tenant_write precisa continuar existindo e autorizando apenas admin.
  select * into pol
  from pg_policies
  where schemaname = 'public' and tablename = 'documents' and policyname = 'tenant_write';

  if pol.policyname is null then
    v_problem := v_problem || 'tenant_write desapareceu (administrador perderia a escrita)';
  elsif pol.cmd <> 'ALL'
        or coalesce(pol.qual, '') !~* 'current_company_role\s*\(\s*\)\s*=\s*''admin'''
        or coalesce(pol.qual, '') ~* '''super''' then
    v_problem := v_problem || 'tenant_write não autoriza apenas admin da própria empresa';
  end if;

  for pol in
    select policyname, permissive, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname not in ('tenant_read', 'tenant_write')
  loop
    if pol.policyname in ('documents_all', 'legacy_all_disabled') then
      if btrim(coalesce(pol.qual, '')) not in ('false', '(false)')
         or btrim(coalesce(pol.with_check, '')) not in ('false', '(false)') then
        v_problem := v_problem || format('%s deixou de negar tudo', pol.policyname);
      end if;
    elsif pol.permissive = 'PERMISSIVE' and pol.cmd in ('SELECT', 'ALL') then
      if btrim(coalesce(pol.qual, 'true')) not in ('false', '(false)') then
        v_problem := v_problem || format('policy extra %s concedendo leitura', pol.policyname);
      end if;
    end if;
  end loop;

  if array_length(v_problem, 1) is not null then
    raise exception 'Conferência final falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;