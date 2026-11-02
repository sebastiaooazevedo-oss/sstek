-- =====================================================================
-- SSTEK — Exportar a ESTRUTURA do banco (sem dados)
-- =====================================================================
-- Para que serve: gerar um retrato completo do esquema `public` (tabelas,
-- colunas, chaves, índices, regras de acesso RLS, funções, gatilhos e
-- permissões) para guardar no repositório. NÃO exporta nenhum dado de
-- empresa, colaborador ou documento.
--
-- Como usar:
--   1. Supabase → SQL Editor → New query
--   2. Cole este arquivo inteiro e clique em Run
--   3. O resultado é UMA linha com a coluna "ddl". Use "Export → CSV"
--      (ou copie o conteúdo da célula) e envie o arquivo.
--
-- É apenas leitura: não altera nada no banco.
-- =====================================================================
with
tabs as (
  select c.oid, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
cols as (
  select t.relname,
         string_agg(
           format('  %I %s%s%s',
             a.attname,
             format_type(a.atttypid, a.atttypmod),
             case when a.attnotnull then ' not null' else '' end,
             coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
           ), E',\n' order by a.attnum) as body
  from tabs t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = t.oid and d.adnum = a.attnum
  group by t.relname
),
cons as (
  select string_agg(format('alter table public.%I add constraint %I %s;', t.relname, k.conname, pg_get_constraintdef(k.oid)),
                    E'\n' order by t.relname, k.contype desc, k.conname) as ddl
  from tabs t join pg_constraint k on k.conrelid = t.oid
  where k.contype <> 'f'
),
fks as (
  select string_agg(format('alter table public.%I add constraint %I %s;', t.relname, k.conname, pg_get_constraintdef(k.oid)),
                    E'\n' order by t.relname, k.conname) as ddl
  from tabs t join pg_constraint k on k.conrelid = t.oid
  where k.contype = 'f'
),
idx as (
  select tablename as relname, string_agg(indexdef || ';', E'\n' order by indexname) as ddl
  from pg_indexes
  where schemaname = 'public'
    and indexname not in (select conname from pg_constraint)
  group by tablename
),
rls as (
  select t.relname,
         case when c.relrowsecurity then format('alter table public.%I enable row level security;', t.relname) else '' end
         || case when c.relforcerowsecurity then format(E'\nalter table public.%I force row level security;', t.relname) else '' end as ddl
  from tabs t join pg_class c on c.oid = t.oid
),
pol as (
  select tablename as relname,
         string_agg(
           format('create policy %I on public.%I as %s for %s to %s%s%s;',
             policyname, tablename, permissive, cmd, array_to_string(roles, ', '),
             coalesce(E'\n  using (' || qual || ')', ''),
             coalesce(E'\n  with check (' || with_check || ')', '')),
           E'\n' order by policyname) as ddl
  from pg_policies where schemaname = 'public'
  group by tablename
),
grants as (
  select table_name as relname,
         string_agg(format('grant %s on public.%I to %I;', privilege_type, table_name, grantee), E'\n'
                    order by grantee, privilege_type) as ddl
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
  group by table_name
),
trg as (
  select c.relname, string_agg(pg_get_triggerdef(tg.oid) || ';', E'\n' order by tg.tgname) as ddl
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal
  group by c.relname
),
funcs as (
  select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' order by p.proname) as ddl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
),
fgrants as (
  -- Permissões reais de execução: revoga do PUBLIC e concede só a quem tem hoje.
  select string_agg(stmt, E'\n' order by fname, ord, stmt) as ddl
  from (
    select p.proname as fname, 0 as ord,
           format('revoke all on function public.%I(%s) from public;', p.proname, pg_get_function_identity_arguments(p.oid)) as stmt
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
    union all
    select p.proname, 1,
           format('grant execute on function public.%I(%s) to %s;', p.proname, pg_get_function_identity_arguments(p.oid),
                  case when acl.grantee = 0 then 'public' else quote_ident(r.rolname) end)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    left join pg_roles r on r.oid = acl.grantee
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and acl.privilege_type = 'EXECUTE'
      and (acl.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))
  ) x
),
storage_pol as (
  select string_agg(
           format('create policy %I on storage.objects as %s for %s to %s%s%s;',
             policyname, permissive, cmd, array_to_string(roles, ', '),
             coalesce(E'\n  using (' || qual || ')', ''),
             coalesce(E'\n  with check (' || with_check || ')', '')),
           E'\n' order by policyname) as ddl
  from pg_policies where schemaname = 'storage'
),
buckets as (
  select string_agg(format('-- bucket %s (public=%s)', id, public), E'\n' order by id) as ddl
  from storage.buckets
),
tables as (
  select string_agg(format(E'create table if not exists public.%I (\n%s\n);', cols.relname, cols.body), E'\n\n' order by cols.relname) as ddl
  from cols
),
sect as (
  select
    (select string_agg(ddl, E'\n') from idx) as idx,
    (select string_agg(ddl, E'\n') from rls where ddl <> '') as rls,
    (select string_agg(ddl, E'\n') from pol) as pol,
    (select string_agg(ddl, E'\n') from trg) as trg,
    (select string_agg(ddl, E'\n') from grants) as grants
)
select
  '-- SSTEK — estrutura exportada em ' || now()::text || E'\n'
  || '-- Postgres ' || current_setting('server_version') || E'\n'
  || E'-- Ordem: funções → tabelas → restrições → chaves estrangeiras → índices → RLS → regras → gatilhos → permissões\n'
  || E'set check_function_bodies = off;\n\n'
  || E'-- ===================== FUNÇÕES =====================\n'
  || coalesce((select ddl from funcs), '') || E'\n\n'
  || E'-- ===================== TABELAS =====================\n'
  || coalesce((select ddl from tables), '') || E'\n\n'
  || E'-- ===================== RESTRIÇÕES =====================\n'
  || coalesce((select ddl from cons), '') || E'\n\n'
  || E'-- ===================== CHAVES ESTRANGEIRAS =====================\n'
  || coalesce((select ddl from fks), '') || E'\n\n'
  || E'-- ===================== ÍNDICES =====================\n'
  || coalesce((select idx from sect), '') || E'\n\n'
  || E'-- ===================== RLS (segurança por linha) =====================\n'
  || coalesce((select rls from sect), '') || E'\n\n'
  || E'-- ===================== REGRAS DE ACESSO =====================\n'
  || coalesce((select pol from sect), '') || E'\n\n'
  || E'-- ===================== GATILHOS =====================\n'
  || coalesce((select trg from sect), '') || E'\n\n'
  || E'-- ===================== PERMISSÕES DAS TABELAS =====================\n'
  || coalesce((select grants from sect), '') || E'\n\n'
  || E'-- ===================== PERMISSÕES DE EXECUÇÃO DAS FUNÇÕES =====================\n'
  || coalesce((select ddl from fgrants), '') || E'\n\n'
  || E'-- ===================== STORAGE (referência) =====================\n'
  || coalesce((select ddl from buckets), '') || E'\n'
  || coalesce((select ddl from storage_pol), '') as ddl;
