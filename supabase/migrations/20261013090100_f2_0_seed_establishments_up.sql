-- ============================================================================
-- SSTEK · Migração F2.0 (UP) — Seeds demonstrativos de Estabelecimentos
-- Arquivo: 20261013090100_f2_0_seed_establishments_up.sql
-- Fase:    F2.0d
-- ----------------------------------------------------------------------------
-- Insere as 3 unidades FICTÍCIAS da empresa Metalúrgica Vega.
-- IDEMPOTENTE: usa ON CONFLICT ... DO NOTHING — não sobrescreve dados existentes.
-- Resolve a empresa por ATRIBUTO ÚNICO (subdomain='vega'), NÃO por "primeira empresa".
-- ABORTA se a empresa não existir ou for ambígua.
-- NÃO inventa CNPJ, endereço, cidade, estado, grau de risco ou responsáveis.
-- ----------------------------------------------------------------------------
-- STATUS: PREPARADA — NÃO EXECUTAR sem autorização expressa.
-- ============================================================================

do $$
declare
  v_subdomain  constant text := 'vega';   -- atributo único validado da empresa fictícia
  v_count      int;
  v_company_id uuid;
  v_inseridos  int := 0;
begin
  -- Resolve e VALIDA a empresa (única) por atributo único.
  select count(*) into v_count
  from public.companies
  where subdomain = v_subdomain;

  if v_count = 0 then
    raise exception 'Seed F2.0 abortado: nenhuma empresa com subdomain=% encontrada.', v_subdomain;
  elsif v_count > 1 then
    raise exception 'Seed F2.0 abortado: mais de uma empresa com subdomain=% (ambíguo).', v_subdomain;
  end if;

  select id into v_company_id
  from public.companies
  where subdomain = v_subdomain;

  -- Seeds idempotentes (código único por empresa).
  -- Campos opcionais (cnpj, address, city, state, risk_grade, manager_ref, responsible_ref)
  -- ficam deliberadamente NULL — não inventar.
  insert into public.establishments (company_id, code, name, status)
  values
    (v_company_id, 'MATRIZ',   'Unidade Matriz — São Bernardo do Campo', 'active'),
    (v_company_id, 'CAMPINAS', 'Filial Campinas',                        'active'),
    (v_company_id, 'RECIFE',   'Filial Recife',                          'active')
  on conflict (company_id, code) do nothing;

  get diagnostics v_inseridos = row_count;
  raise notice 'Seed F2.0 concluído: % linha(s) inserida(s) para company_id=%.', v_inseridos, v_company_id;
end $$;

-- ============================================================================
-- Fim do UP — F2.0 (seeds demonstrativos).
-- Reversão dos seeds: 20261013090100_f2_0_seed_establishments_down.sql
-- ============================================================================