-- =====================================================================
-- Entrega 1 — Versionamento e imutabilidade de atestados médicos
-- Versão: 20261101100200 (única)  |  Ordem de aplicação: 2 de 4 pendentes
-- =====================================================================
--
-- ⚠️  NÃO EXECUTADO PELO AGENTE. Aplicar manualmente ou pelo script mestre
--     supabase/scripts/entrega1_apply_all_transactional.sql.
--
-- ESTE ARQUIVO NÃO TEM begin;/commit; PRÓPRIOS (a transação vem de fora).
--
-- CONTEXTO (estado real confirmado por leitura):
--   * medical_certificates NÃO tem coluna de status: não existe rascunho.
--   * company_id é NULLABLE; company_ref é NOT NULL (subdomínio).
--   * O app (medicalCertificateStore.ts) só faz SELECT e INSERT.
--
-- PROBLEMA CORRIGIDO AQUI:
--   O fluxo anterior aceitava inserir o registro mesmo quando o upload
--   falhava (caía em preview_data_url) e o atestado nascia sem arquivo para
--   sempre. Correção em três frentes:
--     1. APP: upload confirmado ANTES do INSERT; falha → nenhum registro.
--     2. BANCO (aqui): constraint requires_file (NOT VALID) + gatilho que
--        recusa INSERT sem caminho. Linhas antigas sem arquivo continuam
--        existindo e são listadas por medical_certificates_without_file.
--     3. BANCO (arquivo 3): validação de FINALIZAÇÃO no servidor — o caminho
--        precisa existir no bucket `documents`, pertencer à pasta da empresa
--        do registro e à pasta do próprio colaborador. Chamada direta à API
--        (PostgREST) passa pelo mesmo gatilho.
--
-- CORREÇÃO LEGÍTIMA = NOVA VERSÃO (o original nunca é alterado):
--   replaces_id + revision; índice único parcial em replaces_id;
--   pg_advisory_xact_lock serializa revisões simultâneas do mesmo original;
--   mesmo company_id E mesmo collaborator_ref; arquivo novo obrigatório.
--
-- LIMITE HONESTO SOBRE "ARQUIVO NOVO":
--   O índice único em storage_path impede que DOIS registros apontem para o
--   mesmo caminho. Ele NÃO impede, sozinho, que o conteúdo do objeto seja
--   sobrescrito no Storage por quem tenha permissão de escrita. Quem impede
--   isso é a policy storage_can_update/storage_can_insert (arquivo 3), que
--   nega UPDATE e nega gravar em caminho já registrado como atestado.
--
-- Recuperação: supabase/recovery/20261101100200_entrega1_medical_certificate_versioning_recovery.sql
--              (remove gatilhos/constraint/views; PRESERVA colunas e dados)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Pré-condições
-- ---------------------------------------------------------------------
do $pre$
begin
  if to_regclass('public.medical_certificates') is null then
    raise exception 'Pré-requisito ausente: public.medical_certificates não existe.';
  end if;
  if to_regclass('public.documents') is null then
    raise exception 'Pré-requisito ausente: public.documents não existe.';
  end if;
  if to_regclass('public.system_audit_logs') is null then
    raise exception 'Pré-requisito ausente: public.system_audit_logs não existe.';
  end if;
  if to_regprocedure('public.current_company_id()') is null then
    raise exception 'Pré-requisitos ausentes: helpers de sessão da company_settings não foram aplicados.';
  end if;
end
$pre$;

-- ---------------------------------------------------------------------
-- 1) Colunas de versionamento (aditivas)
-- ---------------------------------------------------------------------
alter table public.medical_certificates
  add column if not exists replaces_id uuid,
  add column if not exists revision integer not null default 1;

do $fk$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_certificates'::regclass
      and conname = 'medical_certificates_replaces_id_fkey'
  ) then
    alter table public.medical_certificates
      add constraint medical_certificates_replaces_id_fkey
      foreign key (replaces_id) references public.medical_certificates(id)
      on delete restrict;
  end if;
end
$fk$;

create index if not exists medical_certificates_replaces_id_idx
  on public.medical_certificates(replaces_id);

create unique index if not exists medical_certificates_replaces_id_uidx
  on public.medical_certificates(replaces_id)
  where replaces_id is not null;

do $dup$
declare
  v_dups text[];
begin
  select array_agg(storage_path) into v_dups
  from (
    select storage_path
    from public.medical_certificates
    where storage_path is not null
    group by storage_path
    having count(*) > 1
  ) d;

  if v_dups is not null then
    raise exception
      'Existem storage_path duplicados em medical_certificates: %. Corrija manualmente (nada foi alterado) antes de aplicar o índice único.',
      array_to_string(v_dups, ', ');
  end if;
end
$dup$;

create unique index if not exists medical_certificates_storage_path_uidx
  on public.medical_certificates(storage_path)
  where storage_path is not null;

-- ---------------------------------------------------------------------
-- 2) Novo registro só é finalizado com arquivo (NOT VALID)
-- ---------------------------------------------------------------------
do $chk$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_certificates'::regclass
      and conname = 'medical_certificates_requires_file'
  ) then
    alter table public.medical_certificates
      add constraint medical_certificates_requires_file
      check (storage_path is not null) not valid;
  end if;
end
$chk$;

-- ---------------------------------------------------------------------
-- 3) Bloqueio de UPDATE / DELETE / TRUNCATE
-- ---------------------------------------------------------------------
create or replace function public.medical_certificates_block_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Atestado médico é imutável: exclusão bloqueada. Para corrigir, registre uma nova versão informando replaces_id.'
      using errcode = 'check_violation';
  end if;

  raise exception
    'Atestado médico é imutável: alteração bloqueada. Para corrigir, registre uma nova versão informando replaces_id.'
    using errcode = 'check_violation';
end
$$;

drop trigger if exists medical_certificates_block_mutation on public.medical_certificates;
create trigger medical_certificates_block_mutation
  before update or delete on public.medical_certificates
  for each row execute function public.medical_certificates_block_mutation();

create or replace function public.medical_certificates_block_truncate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  raise exception
    'TRUNCATE em medical_certificates é bloqueado: os atestados são imutáveis.'
    using errcode = 'check_violation';
end
$$;

drop trigger if exists medical_certificates_block_truncate on public.medical_certificates;
create trigger medical_certificates_block_truncate
  before truncate on public.medical_certificates
  execute function public.medical_certificates_block_truncate();

-- ---------------------------------------------------------------------
-- 4) Nova versão: validação do original e cálculo da revisão
-- ---------------------------------------------------------------------
create or replace function public.medical_certificates_before_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  parent public.medical_certificates%rowtype;
begin
  if new.replaces_id is null then
    new.revision := 1;
    return new;
  end if;

  if new.replaces_id = new.id then
    raise exception 'Um atestado não pode substituir a si mesmo.'
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('medical_certificates:revision:' || new.replaces_id::text));

  select * into parent
  from public.medical_certificates m
  where m.id = new.replaces_id;

  if parent.id is null then
    raise exception 'replaces_id não corresponde a nenhum atestado existente.'
      using errcode = 'check_violation';
  end if;

  if parent.company_id is distinct from new.company_id
     or parent.collaborator_ref is distinct from new.collaborator_ref then
    raise exception 'A correção precisa pertencer à mesma empresa e ao mesmo colaborador do atestado original.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.medical_certificates c where c.replaces_id = parent.id
  ) then
    raise exception 'Este atestado já foi substituído por outra versão. Corrija a versão vigente.'
      using errcode = 'check_violation';
  end if;

  if parent.storage_path is not null and parent.storage_path = new.storage_path then
    raise exception 'A nova versão precisa apontar para um arquivo novo (o original é preservado).'
      using errcode = 'check_violation';
  end if;

  new.revision := coalesce(parent.revision, 1) + 1;
  return new;
end
$$;

drop trigger if exists medical_certificates_before_insert on public.medical_certificates;
create trigger medical_certificates_before_insert
  before insert on public.medical_certificates
  for each row execute function public.medical_certificates_before_insert();

-- ---------------------------------------------------------------------
-- 5) Auditoria de criação/revisão
--    Verificado por leitura: system_audit_logs com relrowsecurity = true e
--    relforcerowsecurity = false, dono postgres; a função é SECURITY DEFINER
--    com esse dono, então o INSERT da auditoria funciona. Consulta de
--    reconferência em docs/entrega1/README.md §7.
-- ---------------------------------------------------------------------
create or replace function public.medical_certificates_audit_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.system_audit_logs (
    company_id, module, area, action, entity, entity_id, field, old_value, new_value, detail, actor_id, actor_name
  ) values (
    new.company_id,
    'atestados',
    'saude',
    case when new.replaces_id is null then 'medical_certificate_created' else 'medical_certificate_revised' end,
    'medical_certificate',
    new.id::text,
    'storage_path',
    null,
    new.storage_path,
    case
      when new.replaces_id is null then 'Atestado registrado.'
      else format('Nova versão (revisão %s) do atestado %s.', new.revision, new.replaces_id)
    end,
    auth.uid(),
    null
  );
  return new;
end
$$;

drop trigger if exists medical_certificates_audit_insert on public.medical_certificates;
create trigger medical_certificates_audit_insert
  after insert on public.medical_certificates
  for each row execute function public.medical_certificates_audit_insert();

-- ---------------------------------------------------------------------
-- 6) Fecha o truque de "órfão": documents não pode usar caminho de atestado
--    Compara o caminho em QUALQUER empresa (o prefixo já impede caminho de
--    outra empresa; esta checagem impede reutilizar caminho de atestado).
-- ---------------------------------------------------------------------
create or replace function public.documents_block_certificate_path()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.storage_path is not null and btrim(new.storage_path) <> '' and exists (
    select 1 from public.medical_certificates m
    where m.storage_path = new.storage_path
  ) then
    raise exception 'Este caminho pertence a um atestado médico e não pode ser usado por um documento comum.'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

drop trigger if exists documents_block_certificate_path on public.documents;
create trigger documents_block_certificate_path
  before insert or update of storage_path on public.documents
  for each row execute function public.documents_block_certificate_path();

-- ---------------------------------------------------------------------
-- 7) Views de leitura (security_invoker: RLS do chamador é aplicada)
-- ---------------------------------------------------------------------
create or replace view public.medical_certificates_current
with (security_invoker = true)
as
select m.*
from public.medical_certificates m
where not exists (
  select 1 from public.medical_certificates c where c.replaces_id = m.id
);

create or replace view public.medical_certificates_without_file
with (security_invoker = true)
as
select m.*
from public.medical_certificates m
where m.storage_path is null;

revoke all on public.medical_certificates_current from public;
revoke all on public.medical_certificates_without_file from public;
grant select on public.medical_certificates_current to authenticated;
grant select on public.medical_certificates_without_file to authenticated;

revoke all on function public.medical_certificates_block_mutation() from public;
revoke all on function public.medical_certificates_block_truncate() from public;
revoke all on function public.medical_certificates_before_insert() from public;
revoke all on function public.medical_certificates_audit_insert() from public;
revoke all on function public.documents_block_certificate_path() from public;

-- ---------------------------------------------------------------------
-- 8) Conferência
-- ---------------------------------------------------------------------
do $check$
declare
  v_problem text[] := array[]::text[];
  pol record;
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.medical_certificates'::regclass
      and tgname = 'medical_certificates_block_mutation' and not tgisinternal
  ) then
    v_problem := v_problem || 'gatilho de UPDATE/DELETE ausente';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.medical_certificates'::regclass
      and tgname = 'medical_certificates_block_truncate' and not tgisinternal
  ) then
    v_problem := v_problem || 'gatilho de TRUNCATE ausente';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'documents_block_certificate_path' and not tgisinternal
  ) then
    v_problem := v_problem || 'gatilho documents_block_certificate_path ausente';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'medical_certificates'
      and indexname = 'medical_certificates_replaces_id_uidx'
  ) then
    v_problem := v_problem || 'índice único de replaces_id ausente';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'medical_certificates'
      and indexname = 'medical_certificates_storage_path_uidx'
  ) then
    v_problem := v_problem || 'índice único de storage_path ausente';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_certificates'::regclass
      and conname = 'medical_certificates_requires_file'
  ) then
    v_problem := v_problem || 'constraint medical_certificates_requires_file ausente';
  end if;

  for pol in
    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'medical_certificates'
      and cmd in ('UPDATE', 'DELETE', 'ALL')
  loop
    if coalesce(pol.qual, 'false') not in ('false', '(false)')
       or (pol.cmd = 'ALL' and coalesce(pol.with_check, 'false') not in ('false', '(false)')) then
      v_problem := v_problem || format('policy %s permite escrita (cmd %s)', pol.policyname, pol.cmd);
    end if;
  end loop;

  if array_length(v_problem, 1) is not null then
    raise exception 'Conferência final falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;