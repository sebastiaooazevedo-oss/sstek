-- =====================================================================
-- RECUPERAÇÃO (não é migration) — isolamento de Storage + propriedade
-- Par da versão: 20261101100300
-- =====================================================================
--
-- ⚠️  Fica FORA de supabase/migrations/ de propósito.
--
-- O QUE É: recuperação com ACESSO FECHADO. NÃO é rollback ao estado anterior.
--
-- EFEITO: os três buckets ficam PRIVADOS e SEM NENHUMA policy em
-- storage.objects. Consequência intencional: o app não lê nem envia arquivos
-- até que uma policy seja aplicada novamente. Preferível a vazar arquivos
-- entre empresas.
--
-- REMOVE (o que este par introduziu como barreira):
--   * 9 policies de storage.objects criadas pelo UP
--   * 4 gatilhos de validação de referência (documents, medical_certificates,
--     internal_regulations, company_settings)
--   * 10 funções helper/validadoras
--
-- O que NÃO é restaurado de propósito:
--   * caepi_base_all — a policy legada era `to public` (incluía anon).
--   * documents_* e branding_* legadas, todas `to public` com filtro apenas
--     de bucket_id. Não voltam.
--
-- Nenhum objeto é movido, renomeado ou apagado por este arquivo.
-- Nenhuma coluna é removida. Nenhum dado de registro é alterado.
-- =====================================================================

begin;

drop trigger if exists company_settings_validate_branding_reference on public.company_settings;

-- ---------------------------------------------------------------------
-- PRIVILÉGIOS EXECUTE — NÃO são reabertos de propósito
-- ---------------------------------------------------------------------
-- O UP (seção 2.1) revogou EXECUTE de PUBLIC e de anon nos helpers de sessão
-- e reconcedeu apenas a authenticated. Este arquivo NÃO devolve o grant a
-- PUBLIC nem a anon:
--   * o grant a PUBLIC (`=X/...`) é justamente o defeito que o UP fecha;
--   * restabecê-lo reintroduziria execução por qualquer papel presente ou
--     futuro, sem nenhuma chamada legítima que dependa disso.
-- O que este arquivo garante é apenas que `authenticated` continua com
-- EXECUTE — se algum dia for preciso reabrir, isso é decisão humana explícita.
do $grants$
begin
  if not has_function_privilege('authenticated', 'public.current_collaborator_ref()', 'EXECUTE') then
    raise exception 'authenticated perdeu EXECUTE em current_collaborator_ref(); as policies de documents e de Storage dependem dela.';
  end if;
  if not has_function_privilege('authenticated', 'public.current_company_subdomain()', 'EXECUTE') then
    raise exception 'authenticated perdeu EXECUTE em current_company_subdomain(); as policies de Storage dependem dela.';
  end if;
  raise notice 'EXECUTE de PUBLIC/anon mantido fechado (fail-closed) por decisão do pacote.';
end
$grants$;
drop trigger if exists internal_regulations_validate_storage_reference on public.internal_regulations;
drop trigger if exists medical_certificates_validate_file_reference on public.medical_certificates;
drop trigger if exists documents_validate_storage_reference on public.documents;

drop function if exists public.company_settings_validate_branding_reference();
drop function if exists public.internal_regulations_validate_storage_reference();
drop function if exists public.medical_certificates_validate_file_reference();
drop function if exists public.documents_validate_storage_reference();

drop policy if exists documents_read on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;
drop policy if exists branding_read on storage.objects;
drop policy if exists branding_insert on storage.objects;
drop policy if exists branding_update on storage.objects;
drop policy if exists branding_delete on storage.objects;
drop policy if exists caepi_base_platform_all on storage.objects;

drop function if exists public.storage_reference_problem(text, text, uuid, text, text, text);
drop function if exists public.storage_can_delete(text, text);
drop function if exists public.storage_can_update(text, text);
drop function if exists public.storage_can_insert(text, text);
drop function if exists public.storage_can_read(text, text);
drop function if exists public.storage_object_scope(text, text);
drop function if exists public.storage_path_is_medical_certificate(text, text);
drop function if exists public.storage_object_exists(text, text);
drop function if exists public.storage_path_is_own_certificate_folder(text);
drop function if exists public.storage_path_in_current_company(text);

-- Mantém os buckets privados.
update storage.buckets
   set public = false
 where id in ('documents', 'branding', 'caepi-base');

do $check$
declare
  v_problem text[] := array[]::text[];
  pol record;
begin
  if exists (
    select 1 from storage.buckets
    where id in ('documents', 'branding', 'caepi-base') and public = true
  ) then
    v_problem := v_problem || 'bucket público remanescente';
  end if;

  for pol in
    select policyname, qual, with_check
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    if coalesce(pol.qual, '') ~* '(documents|branding|caepi-base)'
       or coalesce(pol.with_check, '') ~* '(documents|branding|caepi-base)' then
      v_problem := v_problem || format('policy %s ainda alcança os buckets isolados', pol.policyname);
    end if;
  end loop;

  if exists (
    select 1 from pg_trigger
    where not tgisinternal
      and tgname in (
        'documents_validate_storage_reference',
        'medical_certificates_validate_file_reference',
        'internal_regulations_validate_storage_reference',
        'company_settings_validate_branding_reference'
      )
  ) then
    v_problem := v_problem || 'gatilho de validação de referência remanescente';
  end if;

  if array_length(v_problem, 1) is not null then
    raise exception 'Recuperação falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;

commit;

-- ---------------------------------------------------------------------
-- LEITURA EMERGENCIAL — NÃO faz parte da recuperação padrão.
-- Use só se precisar restabelecer leitura autenticada por empresa enquanto
-- corrige a migração. Nunca com papel public/anon, nunca using (true).
-- Depende de helper recriado manualmente.
-- ---------------------------------------------------------------------
-- create policy documents_read_emergency on storage.objects
--   for select to authenticated
--   using (
--     bucket_id = 'documents'
--     and public.current_company_id() is not null
--     and coalesce(storage.foldername(name), '') <> ''
--   );