-- ============================================================================
-- SSTEK · F2.0 — TESTES DE ACEITAÇÃO COMPORTAMENTAIS (TRANSACIONAIS)
-- Arquivo: supabase/tests/f2_0_acceptance_transactional.sql
-- ----------------------------------------------------------------------------
-- ⚠️ CLASSIFICAÇÃO: roteiro de teste MANUAL. NÃO é migration.
--    Executa ESCRITAS dentro de UMA transação e finaliza com ROLLBACK.
--    NUNCA deve ser executado por ferramenta automática de migrations.
--    Executar SOMENTE em ambiente controlado (dev), com autorização expressa.
-- ----------------------------------------------------------------------------
-- PRÉ-REQUISITO: F2.0 já aplicada (tabelas establishments / collaborator_establishments).
-- SEGURANÇA: tudo roda em transação; o ROLLBACK final descarta TODAS as escritas.
--            Nenhum dado de teste persiste.
-- ----------------------------------------------------------------------------
-- COMO LER O RESULTADO (via NOTICE):
--   "Cx PASSOU"   -> comportamento correto (rejeição/idempotência conforme esperado)
--   "Cx FALHOU"   -> comportamento incorreto, investigar
--   "Cx IGNORADO" -> pré-requisito de dados ausente (ex.: sem colaborador na vega)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- C1 — Inserir CÓDIGO DE ESTABELECIMENTO DUPLICADO (deve ser REJEITADO)
--      Esperado: unique_violation em establishments_company_code_key.
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid;
begin
  select id into v_company from public.companies where subdomain = 'vega';
  if v_company is null then
    raise notice 'C1 IGNORADO: empresa vega não encontrada.';
    return;
  end if;

  begin
    insert into public.establishments (company_id, code, name, status)
    values (v_company, 'MATRIZ', '__F2_0_TESTE_DUP__', 'active');
    raise notice 'C1 FALHOU: código duplicado (MATRIZ) foi ACEITO.';
  exception
    when unique_violation then
      raise notice 'C1 PASSOU: código duplicado rejeitado (unique_violation).';
    when others then
      raise notice 'C1 FALHOU/REVISAR: erro inesperado -> % (%)', sqlerrm, sqlstate;
  end;
end $$;


-- ----------------------------------------------------------------------------
-- C2 — Associar COLABORADOR da Vega a ESTABELECIMENTO de OUTRA empresa
--      (deve ser REJEITADO pela FK composta de isolamento — decisão E5)
-- ----------------------------------------------------------------------------
do $$
declare
  v_company_a uuid;
  v_company_b uuid;
  v_est_b     uuid;
  v_ref       text;
begin
  select id into v_company_a from public.companies where subdomain = 'vega';

  select ref into v_ref
  from public.company_collaborators
  where company_id = v_company_a
  limit 1;

  if v_company_a is null or v_ref is null then
    raise notice 'C2 IGNORADO: sem colaborador na vega para o teste.';
    return;
  end if;

  -- empresa temporária (removida no ROLLBACK)
  insert into public.companies (name, subdomain)
  values ('__F2_0_TESTE_EMPRESA__', '__f2_0_teste_empresa__')
  returning id into v_company_b;

  -- estabelecimento pertencente à OUTRA empresa
  insert into public.establishments (company_id, code, name, status)
  values (v_company_b, 'TESTE_B', '__F2_0_TESTE_B__', 'active')
  returning id into v_est_b;

  begin
    -- colaborador (empresa A) + estabelecimento (empresa B) com company_id = A:
    -- deve violar a FK composta (establishment_id, company_id)
    insert into public.collaborator_establishments
      (company_id, collaborator_ref, establishment_id, is_primary)
    values
      (v_company_a, v_ref, v_est_b, false);
    raise notice 'C2 FALHOU: vínculo entre empresas foi ACEITO.';
  exception
    when foreign_key_violation then
      raise notice 'C2 PASSOU: vínculo entre empresas rejeitado (FK composta).';
    when others then
      raise notice 'C2 FALHOU/REVISAR: erro inesperado -> % (%)', sqlerrm, sqlstate;
  end;
end $$;


-- ----------------------------------------------------------------------------
-- C3 — Cadastrar DUAS UNIDADES PRINCIPAIS para o mesmo colaborador
--      Esperado: a 2ª linha is_primary=true é REJEITADA por collab_est_one_primary.
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid;
  v_ref     text;
  v_est1    uuid;
  v_est2    uuid;
begin
  select id into v_company from public.companies where subdomain = 'vega';

  select est.id into v_est1
  from public.establishments est
  where est.company_id = v_company
  order by est.code
  limit 1;

  select est.id into v_est2
  from public.establishments est
  where est.company_id = v_company
  order by est.code
  limit 1 offset 1;

  -- colaborador que AINDA não possui unidade principal
  select cc.ref into v_ref
  from public.company_collaborators cc
  where cc.company_id = v_company
    and not exists (
      select 1 from public.collaborator_establishments ce
      where ce.company_id = v_company
        and ce.collaborator_ref = cc.ref
        and ce.is_primary
    )
  limit 1;

  if v_company is null or v_ref is null or v_est1 is null or v_est2 is null then
    raise notice 'C3 IGNORADO: pré-requisitos insuficientes (colaborador/2 estabelecimentos).';
    return;
  end if;

  -- 1ª principal (deve ser ACEITA)
  insert into public.collaborator_establishments
    (company_id, collaborator_ref, establishment_id, is_primary)
  values
    (v_company, v_ref, v_est1, true);

  begin
    -- 2ª principal (deve ser REJEITADA)
    insert into public.collaborator_establishments
      (company_id, collaborator_ref, establishment_id, is_primary)
    values
      (v_company, v_ref, v_est2, true);
    raise notice 'C3 FALHOU: segunda unidade principal foi ACEITA.';
  exception
    when unique_violation then
      raise notice 'C3 PASSOU: segunda unidade principal rejeitada (índice único parcial).';
    when others then
      raise notice 'C3 FALHOU/REVISAR: erro inesperado -> % (%)', sqlerrm, sqlstate;
  end;
end $$;


-- ----------------------------------------------------------------------------
-- C5 — REEXECUÇÃO DOS SEEDS: idempotência (a contagem NÃO deve mudar)
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid;
  v_antes   int;
  v_depois  int;
begin
  select id into v_company from public.companies where subdomain = 'vega';
  if v_company is null then
    raise notice 'C5 IGNORADO: empresa vega não encontrada.';
    return;
  end if;

  select count(*) into v_antes
  from public.establishments
  where company_id = v_company and code in ('MATRIZ', 'CAMPINAS', 'RECIFE');

  -- mesma carga do seed (idempotente via ON CONFLICT DO NOTHING)
  insert into public.establishments (company_id, code, name, status)
  values
    (v_company, 'MATRIZ',   'Unidade Matriz — São Bernardo do Campo', 'active'),
    (v_company, 'CAMPINAS', 'Filial Campinas',                        'active'),
    (v_company, 'RECIFE',   'Filial Recife',                          'active')
  on conflict (company_id, code) do nothing;

  select count(*) into v_depois
  from public.establishments
  where company_id = v_company and code in ('MATRIZ', 'CAMPINAS', 'RECIFE');

  if v_antes = v_depois then
    raise notice 'C5 PASSOU: reexecução dos seeds idempotente (% linha(s) antes e depois).', v_antes;
  else
    raise notice 'C5 FALHOU: contagem mudou (% -> %).', v_antes, v_depois;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- C4 — ACESSO ANÔNIMO (leitura). Deve ser BLOQUEADO.
--      SET ROLE não funciona dentro de DO block, por isso roda no nível da transação.
--      Com RLS ligada e SEM policy (default deny), o esperado é 0 linha visível.
--      (Se retornar erro de permissão, também é considerado BLOQUEADO = PASSOU.)
-- ----------------------------------------------------------------------------
set local role anon;
select
  'C4' as teste,
  'Leitura anônima (RLS default deny)' as descricao,
  (select count(*) from public.establishments) as linhas_visiveis,
  case when (select count(*) from public.establishments) = 0
       then 'PASSOU (0 linhas)'
       else 'FALHOU (dados expostos)' end as situacao;
reset role;

-- ----------------------------------------------------------------------------
-- C4b — ACESSO ANÔNIMO (gravação). Deve ser BLOQUEADO.
--      COMENTADO: um erro aqui ABORTA a transação e interrompe o script.
--      Rode manualmente em passo separado; o esperado é ERRO (permissão/RLS),
--      o que caracteriza PASSOU (bloqueio de escrita anônima).
-- ----------------------------------------------------------------------------
-- set local role anon;
-- insert into public.establishments (company_id, code, name, status)
-- values ('00000000-0000-0000-0000-000000000000', '__F2_0_TESTE_ANON__', 'Teste Anon', 'active');
-- -- Esperado: ERROR: permission denied / new row violates row-level security policy
-- reset role;


-- ----------------------------------------------------------------------------
-- ROLLBACK — descarta TODAS as escritas dos testes. Nenhum dado persiste.
-- ----------------------------------------------------------------------------
rollback;

-- ============================================================================
-- Fim do roteiro comportamental. O banco volta ao estado anterior (ROLLBACK).
-- ============================================================================