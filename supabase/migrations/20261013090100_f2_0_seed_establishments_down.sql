-- ============================================================================
-- SSTEK · Migração F2.0 (DOWN) — Remoção dos Seeds de Estabelecimentos
-- Arquivo: 20261013090100_f2_0_seed_establishments_down.sql
-- ----------------------------------------------------------------------------
-- Remove SOMENTE as 3 unidades demonstrativas da Metalúrgica Vega.
-- NÃO remove a estrutura (isso é responsabilidade do DOWN 20261013090000).
-- IDEMPOTENTE e restrito por empresa (subdomain='vega') + code conhecido.
-- ----------------------------------------------------------------------------
-- STATUS: PREPARADA — NÃO EXECUTAR sem autorização expressa.
-- ============================================================================

do $$
declare
  v_subdomain  constant text := 'vega';
  v_count      int;
  v_company_id uuid;
  v_removidos  int := 0;
begin
  select count(*) into v_count
  from public.companies
  where subdomain = v_subdomain;

  if v_count = 0 then
    raise notice 'Seed DOWN F2.0: empresa subdomain=% inexistente — nada a fazer.', v_subdomain;
    return;
  elsif v_count > 1 then
    raise exception 'Seed DOWN F2.0 abortado: mais de uma empresa com subdomain=% (ambíguo).', v_subdomain;
  end if;

  select id into v_company_id
  from public.companies
  where subdomain = v_subdomain;

  delete from public.establishments
  where company_id = v_company_id
    and code in ('MATRIZ', 'CAMPINAS', 'RECIFE');

  get diagnostics v_removidos = row_count;
  raise notice 'Seed DOWN F2.0: % linha(s) removida(s) para company_id=%.', v_removidos, v_company_id;
end $$;

-- ============================================================================
-- Fim do DOWN — F2.0 (seeds demonstrativos).
-- ============================================================================