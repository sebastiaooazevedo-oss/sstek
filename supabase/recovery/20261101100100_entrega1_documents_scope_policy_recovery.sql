-- =====================================================================
-- RECUPERAÇÃO (não é migration) — escopo de leitura de documents
-- Par da versão: 20261101100100
-- =====================================================================
--
-- ⚠️  Este arquivo fica FORA de supabase/migrations/ de propósito: não deve
--     ser aplicado por ferramenta automática. Execução manual e consciente.
--
-- O QUE É: recuperação com ACESSO FECHADO, não rollback exato.
--   O estado anterior concedia leitura de TODOS os documentos da empresa a
--   qualquer membro (tenant_read = is_current_company_ref(company_ref)).
--   Restaurar isso desfaria a decisão de acesso. Então NÃO restauramos.
--
-- EFEITO PRÁTICO DEPOIS DE RODAR:
--   * policies restantes em public.documents:
--       documents_all        (ALL, false)          -> nega tudo
--       legacy_all_disabled  (ALL, false)          -> nega tudo
--       tenant_write         (ALL, admin da empresa) -> mantida
--   * administrador continua lendo/escrevendo pelo tenant_write;
--   * colaborador deixa de ler documentos da tabela (fail-closed);
--   * nenhum dado é apagado ou alterado por este arquivo.
--
-- Dependência: se você reaplicar 20261101100100_..._up.sql depois, a policy
-- tenant_read é recriada com o escopo restrito.
-- =====================================================================

begin;

drop policy if exists tenant_read on public.documents;

-- Conferência: nenhuma policy de leitura ampla deve sobrar.
do $check$
declare
  v_problem text[] := array[]::text[];
  pol record;
begin
  for pol in
    select policyname, cmd, qual
    from pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and cmd in ('SELECT', 'ALL')
  loop
    if pol.qual is not null and btrim(pol.qual) not in ('false', '(false)')
       and coalesce(pol.qual, '') !~* 'current_company_role' then
      v_problem := v_problem || format('%s concede leitura sem checagem de papel (%s)', pol.policyname, pol.qual);
    end if;
  end loop;

  if array_length(v_problem, 1) is not null then
    raise exception 'Recuperação falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;

commit;