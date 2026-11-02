-- =====================================================================
-- ENTREGA 1 — SCRIPT MESTRE (execução transacional única)
-- =====================================================================
--
-- ⚠️  NÃO FOI EXECUTADO PELO AGENTE. Este script é para uso humano, com
--     exportação prévia (docs/entrega1/README.md §5).
--
-- O QUE ESTE ARQUIVO FAZ
--   * Abre UMA transação externa (BEGIN ... COMMIT).
--   * Define o reconhecimento do inventário de storage.objects DENTRO dessa
--     transação (set_config local).
--   * Verifica `company_settings` e os helpers de sessão como PRÉ-REQUISITO
--     (não reaplica a migration já aplicada).
--   * Executa, nesta ordem, exatamente as QUATRO migrações pendentes:
--       ../migrations/20261101100100_entrega1_documents_scope_policy_up.sql
--       ../migrations/20261101100200_entrega1_medical_certificate_versioning_up.sql
--       ../migrations/20261101100300_entrega1_storage_tenant_isolation_up.sql
--       ../migrations/20261101100400_entrega1_subdomain_immutability_up.sql
--   * Nenhum dos quatro arquivos tem BEGIN/COMMIT internos. Portanto uma
--     falha em qualquer ponto reverte TUDO.
--
-- COMO EXECUTAR — CAMINHO A: psql (recomendado; usa meta-comandos)
--   1) psql "$DATABASE_URL" \
--        -v storage_policy_ack="$(SEU_HASH)" \
--        -f supabase/scripts/entrega1_apply_all_transactional.sql
--      (o hash do inventário sai da consulta do README §5)
--   2) Se você NÃO informar -v storage_policy_ack, o script usa o marcador
--      'COLE_O_HASH_AQUI' e a migração 3 aborta antes de qualquer DROP —
--      comportamento desejado (reconhecimento explícito obrigatório).
--
--   ⚠️  ESTE ARQUIVO USA RECURSOS EXCLUSIVOS DO psql: `\set`, `\if`,
--       `:{?var}`, `:'var'`, `\ir`, `\set ON_ERROR_STOP`. Nada disso existe
--       no SQL Editor do Dashboard nem em cliente SQL genérico. O SQL Editor
--       também não aceita `-v` (variável de linha de comando).
--       Não tente colar este arquivo no SQL Editor: `\ir` não será
--       interpretado como inclusão de arquivo (o arquivo nem existe lá).
--
-- COMO EXECUTAR — CAMINHO B: SQL Editor (sem psql, sem meta-comandos)
--   O SQL Editor não inclui arquivos. É preciso CONCATENAR os quatro corpos
--   em um script único, na ordem, e pôr o reconhecimento do inventário como
--   PRIMEIRA instrução. O SQL Editor envolve o script inteiro em uma
--   transação; como nenhum dos quatro arquivos tem BEGIN/COMMIT, não há
--   transação aninhada nem commit parcial.
--
--   B.1  Gere o bundle (na máquina onde o repositório está clonado):
--          { echo "select set_config('app.storage_policy_ack', '<SEU_HASH>', true);"; \
--            cat supabase/migrations/20261101100100_entrega1_documents_scope_policy_up.sql; \
--            cat supabase/migrations/20261101100200_entrega1_medical_certificate_versioning_up.sql; \
--            cat supabase/migrations/20261101100300_entrega1_storage_tenant_isolation_up.sql; \
--            cat supabase/migrations/20261101100400_entrega1_subdomain_immutability_up.sql; \
--          } > entrega1_bundle_sql_editor.sql
--   B.2  Abra UMA aba do SQL Editor, cole o conteúdo de
--        entrega1_bundle_sql_editor.sql e execute UMA vez.
--   B.3  Nada de `\i`, `\ir`, `\set`, `\if`, `:'var'` — nenhum deles é SQL.
--        O único elemento de “reconhecimento” no bundle é o set_config.
--
--   O bundle do §B contém APENAS as quatro migrações pendentes. A verificação
--   de company_settings como pré-requisito é feita pelo $pre$ da migração 3 e
--   pelo $pre$ da migração 2; se quiser a mesma checagem antecipada do bloco
--   $prereq$ abaixo, copie-o para o topo do bundle IMEDIATAMENTE após a linha
--   do set_config (ele é PL/pgSQL puro, sem meta-comandos).
--
-- NÃO reaplique 20261101100000_entrega1_company_settings_up.sql.
-- =====================================================================

\set ON_ERROR_STOP on

\if :{?storage_policy_ack}
\else
  \set storage_policy_ack 'COLE_O_HASH_AQUI'
\endif

begin;

-- Reconhecimento do inventário DENTRO da transação.
select set_config('app.storage_policy_ack', :'storage_policy_ack', true);

-- ---------------------------------------------------------------------
-- Pré-requisitos (apenas verificação; nada é reaplicado)
-- ---------------------------------------------------------------------
do $prereq$
begin
  if to_regclass('public.company_settings') is null then
    raise exception 'company_settings não existe: aplique 20261101100000_entrega1_company_settings_up.sql antes (não é reaplicada aqui).';
  end if;

  if to_regclass('public.documents') is null
     or to_regclass('public.medical_certificates') is null
     or to_regclass('public.internal_regulations') is null
     or to_regclass('public.companies') is null then
    raise exception 'Tabelas-base ausentes (documents/medical_certificates/internal_regulations/companies).';
  end if;

  if to_regprocedure('public.current_company_id()') is null
     or to_regprocedure('public.current_company_role()') is null
     or to_regprocedure('public.current_collaborator_ref()') is null
     or to_regprocedure('public.current_company_subdomain()') is null
     or to_regprocedure('public.is_current_company_ref(text)') is null
     or to_regprocedure('public.is_platform_admin()') is null then
    raise exception 'Helpers de sessão ausentes: company_settings precisa estar aplicada.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'medical_certificates' and column_name = 'storage_path'
  ) then
    raise exception 'medical_certificates.storage_path não existe; schema inesperado.';
  end if;
end
$prereq$;

-- ---------------------------------------------------------------------
-- 1/4 — Escopo de leitura de public.documents
-- ---------------------------------------------------------------------
\ir ../migrations/20261101100100_entrega1_documents_scope_policy_up.sql

-- ---------------------------------------------------------------------
-- 2/4 — Versionamento e imutabilidade de atestados
-- ---------------------------------------------------------------------
\ir ../migrations/20261101100200_entrega1_medical_certificate_versioning_up.sql

-- ---------------------------------------------------------------------
-- 3/4 — Storage: bucket+path, propriedade de referências, policies
-- ---------------------------------------------------------------------
\ir ../migrations/20261101100300_entrega1_storage_tenant_isolation_up.sql

-- ---------------------------------------------------------------------
-- 4/4 — Subdomínio imutável
-- ---------------------------------------------------------------------
\ir ../migrations/20261101100400_entrega1_subdomain_immutability_up.sql

commit;