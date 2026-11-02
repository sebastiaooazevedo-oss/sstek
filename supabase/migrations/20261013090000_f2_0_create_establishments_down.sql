-- ============================================================================
-- SSTEK · Migração F2.0 (DOWN) — Reversão do Catálogo de Estabelecimentos
-- Arquivo: 20261013090000_f2_0_create_establishments_down.sql
-- ----------------------------------------------------------------------------
-- Reverte SOMENTE os objetos criados pelo UP 20261013090000.
-- NÃO toca em nenhuma tabela/registro anterior.
-- NÃO toca em documentos, assinaturas, CIPA, urna, DDS, APR, EPI.
-- ----------------------------------------------------------------------------
-- STATUS: PREPARADA — NÃO EXECUTAR sem autorização expressa.
-- Segura apenas sob as condições documentadas (PLANO F2.0 §7).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GUARDA — aborta se houver dependências posteriores apontando para as tabelas novas.
-- Evita exclusão silenciosa de estruturas criadas DEPOIS da F2.0 (ex.: F2.2+).
-- Ignora a própria FK interna (collaborator_establishments -> establishments).
-- ----------------------------------------------------------------------------
do $$
declare
  v_dep int;
begin
  select count(*) into v_dep
  from pg_constraint c
  join pg_class rel      on rel.oid  = c.conrelid
  join pg_namespace ns   on ns.oid   = rel.relnamespace
  join pg_class frel     on frel.oid = c.confrelid
  where c.contype = 'f'
    and ns.nspname = 'public'
    and frel.relname in ('establishments', 'collaborator_establishments')
    and rel.relname  not in ('collaborator_establishments'); -- ignora a FK interna da F2.0

  if v_dep > 0 then
    raise exception
      'DOWN F2.0 abortado: % FK(s) externas referenciam as tabelas novas. Remova-as antes de reverter.',
      v_dep;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Verificação (informativa) antes de remover — apenas contagens.
-- ----------------------------------------------------------------------------
-- select count(*) from public.collaborator_establishments;
-- select count(*) from public.establishments;

-- ----------------------------------------------------------------------------
-- Reversão — remove EXCLUSIVAMENTE os objetos criados pela F2.0.
-- Ordem correta: índice -> tabela dependente -> tabela base.
-- ----------------------------------------------------------------------------
drop index if exists public.collab_est_one_primary;
drop index if exists public.idx_collab_est_establishment;
drop index if exists public.idx_establishments_company;
drop table  if exists public.collaborator_establishments;
drop table  if exists public.establishments;

-- ============================================================================
-- Fim do DOWN — F2.0 (estrutura). company_collaborators.establishment (texto)
-- permanece INTACTO.
-- ============================================================================