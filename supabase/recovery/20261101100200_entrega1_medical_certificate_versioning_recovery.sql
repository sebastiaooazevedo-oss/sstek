-- =====================================================================
-- RECUPERAÇÃO (não é migration) — atestados médicos
-- Par da versão: 20261101100200
-- =====================================================================
--
-- ⚠️  Fica FORA de supabase/migrations/ de propósito.
--
-- O QUE É: recuperação com ACESSO FECHADO e PRESERVAÇÃO DE DADOS.
-- Não é rollback exato — de propósito.
--
-- REMOVE (tudo o que este par introduziu como barreira):
--   * medical_certificates_block_mutation      (UPDATE/DELETE)
--   * medical_certificates_block_truncate      (TRUNCATE)  <-- faltava no DOWN antigo
--   * medical_certificates_before_insert       (validação/revisão)
--   * medical_certificates_audit_insert        (auditoria)
--   * documents_block_certificate_path         (caminho de atestado em documents)
--   * view medical_certificates_current
--   * view medical_certificates_without_file
--   * constraint medical_certificates_requires_file
--
-- MANTÉM de propósito (rastreabilidade; não atrapalha nenhuma operação):
--   * colunas replaces_id e revision
--   * índice medical_certificates_replaces_id_idx
--   * índices únicos medical_certificates_replaces_id_uidx e
--     medical_certificates_storage_path_uidx
--
-- NENHUM atestado é apagado, alterado ou reatribuído por este arquivo.
-- NENHUMA linha sem arquivo é "corrigida" por suposição.
--
-- Se você realmente quiser o rollback exato (destrutivo de histórico),
-- descomente o bloco final — ele NÃO será executado por padrão.
-- =====================================================================

begin;

drop trigger if exists documents_block_certificate_path on public.documents;
drop function if exists public.documents_block_certificate_path();

drop trigger if exists medical_certificates_audit_insert on public.medical_certificates;
drop function if exists public.medical_certificates_audit_insert();

drop trigger if exists medical_certificates_before_insert on public.medical_certificates;
drop function if exists public.medical_certificates_before_insert();

drop trigger if exists medical_certificates_block_truncate on public.medical_certificates;
drop function if exists public.medical_certificates_block_truncate();

drop trigger if exists medical_certificates_block_mutation on public.medical_certificates;
drop function if exists public.medical_certificates_block_mutation();

drop view if exists public.medical_certificates_without_file;
drop view if exists public.medical_certificates_current;

alter table public.medical_certificates
  drop constraint if exists medical_certificates_requires_file;

do $check$
declare
  v_problem text[] := array[]::text[];
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.medical_certificates'::regclass
      and tgname in ('medical_certificates_block_mutation','medical_certificates_block_truncate')
      and not tgisinternal
  ) then
    v_problem := v_problem || 'gatilho de imutabilidade ainda ativo';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'medical_certificates'
      and column_name = 'replaces_id'
  ) then
    v_problem := v_problem || 'coluna replaces_id desapareceu (não deveria)';
  end if;

  if array_length(v_problem, 1) is not null then
    raise exception 'Recuperação falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;

commit;

-- ---------------------------------------------------------------------
-- ROLLBACK EXATO (DESTRUTIVO DE HISTÓRICO) — descomente só com decisão
-- explícita e exportação prévia. Apaga a coluna e, com ela, o vínculo
-- entre versões. Não apaga linhas de atestado.
-- ---------------------------------------------------------------------
-- begin;
-- drop index if exists public.medical_certificates_storage_path_uidx;
-- drop index if exists public.medical_certificates_replaces_id_uidx;
-- drop index if exists public.medical_certificates_replaces_id_idx;
-- alter table public.medical_certificates
--   drop constraint if exists medical_certificates_replaces_id_fkey;
-- alter table public.medical_certificates
--   drop column if exists replaces_id,
--   drop column if exists revision;
-- commit;