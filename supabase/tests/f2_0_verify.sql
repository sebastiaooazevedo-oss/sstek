-- ============================================================================
-- SSTEK · F2.0 — VERIFICAÇÃO DE ACEITAÇÃO (SOMENTE LEITURA)
-- Arquivo: supabase/tests/f2_0_verify.sql
-- ----------------------------------------------------------------------------
-- ⚠️ CLASSIFICAÇÃO: script de VERIFICAÇÃO MANUAL. NÃO é migration.
--    NÃO deve ser executado por ferramenta automática de migrations.
--    Não faz nenhuma escrita. Apenas SELECTs de catálogo e de dados.
-- ----------------------------------------------------------------------------
-- COBERTURA: T1, T2, T3, T4, T5, T6, T7, T12.
-- PRÉ-REQUISITO: F2.0 já aplicada (tabelas establishments / collaborator_establishments).
-- ----------------------------------------------------------------------------
-- COMO LER O RESULTADO:
--   Cada consulta devolve: teste | descricao | resultado_esperado | resultado_observado | situacao
--   situacao = 'PASSOU' quando o critério está atendido, 'FALHOU' caso contrário.
-- ----------------------------------------------------------------------------
-- LIMITAÇÃO (registrada na DIRETRIZ 009, §4):
--   Inspeção de catálogo prova EXISTÊNCIA/DEFINIÇÃO das estruturas, NÃO o comportamento.
--   A rejeição real de operações inválidas (isolamento, duplicidade, principal única,
--   acesso anônimo) só é comprovada por supabase/tests/f2_0_acceptance_transactional.sql.
-- ----------------------------------------------------------------------------
-- LIMITAÇÃO: este script NÃO foi executado. Cada "situacao" só é real APÓS a execução.
-- ============================================================================


-- ============================================================================
-- T1 — Estrutura: existência das tabelas e colunas previstas
-- ============================================================================
select
  'T1' as teste,
  'Estrutura: existência das tabelas e colunas previstas' as descricao,
  'establishments (14 colunas) + collaborator_establishments (9 colunas)' as resultado_esperado,
  format(
    'establishments=%s (%s cols) | collaborator_establishments=%s (%s cols)',
    (to_regclass('public.establishments') is not null),
    (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'establishments'),
    (to_regclass('public.collaborator_establishments') is not null),
    (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'collaborator_establishments')
  ) as resultado_observado,
  case when
    to_regclass('public.establishments') is not null
    and to_regclass('public.collaborator_establishments') is not null
    and (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'establishments') = 14
    and (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'collaborator_establishments') = 9
  then 'PASSOU' else 'FALHOU' end as situacao;


-- ============================================================================
-- T2 — Estabelecimentos: presença das 3 unidades fictícias da Metalúrgica Vega
-- ============================================================================
select
  'T2' as teste,
  'Estabelecimentos: presença das 3 unidades fictícias da Metalúrgica Vega' as descricao,
  'MATRIZ, CAMPINAS, RECIFE (empresa subdomain = vega)' as resultado_esperado,
  coalesce(string_agg(e.code, ', ' order by e.code), '(nenhum)') as resultado_observado,
  case when count(*) = 3 then 'PASSOU' else 'FALHOU' end as situacao
from public.establishments e
join public.companies c on c.id = e.company_id
where c.subdomain = 'vega'
  and e.code in ('MATRIZ', 'CAMPINAS', 'RECIFE');


-- ============================================================================
-- T3 — Unicidade: restrição UNIQUE (company_id, code) em establishments
-- ============================================================================
select
  'T3' as teste,
  'Unicidade: restrição UNIQUE (company_id, code) em establishments' as descricao,
  'constraint establishments_company_code_key = UNIQUE (company_id, code)' as resultado_esperado,
  coalesce((
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class r      on r.oid = c.conrelid
    join pg_namespace n  on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'establishments'
      and c.conname = 'establishments_company_code_key' and c.contype = 'u'
  ), '(ausente)') as resultado_observado,
  case when exists (
    select 1
    from pg_constraint c
    join pg_class r      on r.oid = c.conrelid
    join pg_namespace n  on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'establishments'
      and c.conname = 'establishments_company_code_key' and c.contype = 'u'
  ) then 'PASSOU' else 'FALHOU' end as situacao;


-- ============================================================================
-- T4 — Integridade: existência das FKs compostas que impedem vínculo entre empresas
-- ============================================================================
select
  'T4' as teste,
  'Integridade: FKs compostas de isolamento por empresa existem' as descricao,
  'collab_est_collab_fkey + collab_est_est_fkey (ambas FOREIGN KEY)' as resultado_esperado,
  coalesce(string_agg(c.conname || ' => ' || pg_get_constraintdef(c.oid), ' | ' order by c.conname), '(nenhuma)') as resultado_observado,
  case when count(*) = 2 then 'PASSOU' else 'FALHOU' end as situacao
from pg_constraint c
join pg_class r      on r.oid = c.conrelid
join pg_namespace n  on n.oid = r.relnamespace
where n.nspname = 'public'
  and r.relname = 'collaborator_establishments'
  and c.contype = 'f'
  and c.conname in ('collab_est_collab_fkey', 'collab_est_est_fkey');


-- ============================================================================
-- T5 — Unidade principal: índice único parcial (no máximo 1 principal por colaborador)
-- ============================================================================
select
  'T5' as teste,
  'Unidade principal: índice único parcial collab_est_one_primary' as descricao,
  'índice único parcial em (company_id, collaborator_ref) WHERE is_primary' as resultado_esperado,
  coalesce((
    select indexdef from pg_indexes
    where schemaname = 'public' and indexname = 'collab_est_one_primary'
  ), '(ausente)') as resultado_observado,
  case when exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'collab_est_one_primary'
  ) then 'PASSOU' else 'FALHOU' end as situacao;


-- ============================================================================
-- T6 — Segurança: RLS habilitada nas tabelas novas e ausência de policies permissivas
-- ============================================================================
select
  'T6' as teste,
  'Segurança: RLS habilitada e ausência de policies nas tabelas novas' as descricao,
  'relrowsecurity = true e 0 policies em ambas as tabelas' as resultado_esperado,
  format(
    'establishments: rls=%s, policies=%s | collaborator_establishments: rls=%s, policies=%s',
    (select relrowsecurity from pg_class where oid = to_regclass('public.establishments')),
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'establishments'),
    (select relrowsecurity from pg_class where oid = to_regclass('public.collaborator_establishments')),
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'collaborator_establishments')
  ) as resultado_observado,
  case when
    (select relrowsecurity from pg_class where oid = to_regclass('public.establishments'))
    and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'establishments') = 0
    and (select relrowsecurity from pg_class where oid = to_regclass('public.collaborator_establishments'))
    and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'collaborator_establishments') = 0
  then 'PASSOU' else 'FALHOU' end as situacao;


-- ============================================================================
-- T7 — Isolamento: as FKs compostas carregam company_id nas duas pontas
--      (é isso que impede fisicamente o vínculo entre empresas diferentes)
-- ============================================================================
with fks as (
  select c.conname, pg_get_constraintdef(c.oid) as def
  from pg_constraint c
  join pg_class r      on r.oid = c.conrelid
  join pg_namespace n  on n.oid = r.relnamespace
  where n.nspname = 'public'
    and r.relname = 'collaborator_establishments'
    and c.contype = 'f'
)
select
  'T7' as teste,
  'Isolamento: FKs compostas contêm company_id no lado local e no referenciado' as descricao,
  '2 FKs, cada uma com company_id nos dois lados' as resultado_esperado,
  coalesce(string_agg(conname || ' => ' || def, ' | ' order by conname), '(nenhuma)') as resultado_observado,
  case when count(*) filter (
    where (length(def) - length(replace(def, 'company_id', ''))) / length('company_id') >= 2
  ) = 2 then 'PASSOU' else 'FALHOU' end as situacao
from fks;


-- ============================================================================
-- T12 — Compatibilidade: estruturas anteriores preservadas
-- ============================================================================
select
  'T12' as teste,
  'Compatibilidade: estruturas anteriores preservadas' as descricao,
  'companies + company_collaborators + collab.establishment(text) + documents + cipa_elections intactos' as resultado_esperado,
  format(
    'companies=%s | company_collaborators=%s | collab.establishment(text)=%s | documents=%s | cipa_elections=%s',
    (to_regclass('public.companies') is not null),
    (to_regclass('public.company_collaborators') is not null),
    exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'company_collaborators'
        and column_name = 'establishment' and data_type = 'text'
    ),
    (to_regclass('public.documents') is not null),
    (to_regclass('public.cipa_elections') is not null)
  ) as resultado_observado,
  case when
    to_regclass('public.companies') is not null
    and to_regclass('public.company_collaborators') is not null
    and exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'company_collaborators'
        and column_name = 'establishment' and data_type = 'text'
    )
    and to_regclass('public.documents') is not null
    and to_regclass('public.cipa_elections') is not null
  then 'PASSOU' else 'FALHOU' end as situacao;

-- ============================================================================
-- Fim do script de verificação (somente leitura). Nenhum dado foi modificado.
-- ============================================================================