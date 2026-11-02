-- =====================================================================
-- Entrega 1 — Isolamento de Storage + propriedade de referências
-- Versão: 20261101100300 (única)  |  Ordem de aplicação: 3 de 4 pendentes
-- =====================================================================
--
-- ⚠️  NÃO EXECUTADO PELO AGENTE. Alterar o schema `storage` exige o
--     proprietário do projeto no SQL Editor, com exportação prévia feita.
--
-- ESTE ARQUIVO NÃO TEM begin;/commit; PRÓPRIOS (a transação vem de fora).
--
-- Pré-requisitos: 20261101100000_entrega1_company_settings_up.sql (já
-- aplicada) e as migrations 20261101100100 / 20261101100200.
--
-- Modelo real (confirmado por leitura do schema):
--   documents.company_id (uuid, NULL) / documents.company_ref (text, NOT NULL)
--   medical_certificates.company_id (uuid, NULL) / company_ref (NOT NULL)
--   internal_regulations.company_ref (text, NOT NULL)
--   company_settings.company_id (uuid PK) + logo_path / letterhead_path
--
-- Convenções reais de caminho no app:
--   documents:   <subdominio>/<timestamp>-<n>-<arquivo>
--   regulamento: <subdominio>/regulamento-interno/<timestamp>-<arquivo>
--   atestado:    <subdominio>/atestados/<ref-do-colaborador>/<timestamp>-<arquivo>
--   branding:    <subdominio>/<logo|letterhead>/<kind>-<timestamp>.<ext>
--
-- PRINCÍPIO DESTA VERSÃO (revisão externa, item 1):
--   O CAMINHO identifica a empresa. O REGISTRO não é prova de propriedade:
--   um cliente pode inserir uma linha apontando para o arquivo de outra
--   empresa. Por isso toda referência é validada NO SERVIDOR, em gatilho,
--   contra: bucket esperado, prefixo de pasta da empresa, EXISTÊNCIA real do
--   objeto em storage.objects, vínculo com o colaborador e conflito entre
--   tabelas. Chamada direta à API passa pelo mesmo gatilho.
--
--   Os helpers agora recebem BUCKET + CAMINHO. O mesmo `name` em buckets
--   diferentes não é o mesmo arquivo (storage.objects é único por
--   (bucket_id, name)) — a versão anterior tratava só o caminho.
--
-- current_company_role() devolve apenas 'admin' ou 'collaborator'. Nenhuma
-- regra aqui usa 'super'. platform_admins só administra caepi-base.
--
-- PRIVILÉGIOS EXECUTE (revisão externa, item 5): verificado em
-- pg_proc.proacl que current_collaborator_ref() tinha o grant implícito
-- `=X/postgres` (PUBLIC) MAIS um grant explícito a anon, e que
-- current_company_subdomain() tinha grant explícito a anon. Revogar somente
-- de anon deixaria o acesso por PUBLIC de pé. A seção 2.1 revoga de PUBLIC e
-- de anon e reconcede apenas a authenticated; o $check$ falha se o direito
-- voltar ou se authenticated perder o acesso.
--
-- Recuperação: supabase/recovery/20261101100300_entrega1_storage_tenant_isolation_recovery.sql
--              (fail-closed: buckets privados e SEM policy)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Pré-condições
-- ---------------------------------------------------------------------
do $pre$
begin
  if to_regprocedure('public.current_company_id()') is null
     or to_regprocedure('public.current_company_role()') is null
     or to_regprocedure('public.current_collaborator_ref()') is null
     or to_regprocedure('public.current_company_subdomain()') is null
     or to_regprocedure('public.is_platform_admin()') is null then
    raise exception 'Pré-requisitos ausentes: aplique 20261101100000_entrega1_company_settings_up.sql antes desta migração.';
  end if;

  if to_regclass('public.company_settings') is null then
    raise exception 'Pré-requisito ausente: tabela public.company_settings não existe.';
  end if;

  if to_regclass('public.documents') is null
     or to_regclass('public.medical_certificates') is null
     or to_regclass('public.internal_regulations') is null then
    raise exception 'Pré-requisitos ausentes: documents/medical_certificates/internal_regulations.';
  end if;

  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'Pré-requisito ausente: schema storage indisponível (execute como proprietário do projeto).';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'medical_certificates' and column_name = 'replaces_id'
  ) then
    raise exception 'Pré-requisito ausente: aplique 20261101100200 (versionamento de atestados) antes deste arquivo.';
  end if;
end
$pre$;

-- ---------------------------------------------------------------------
-- 1) Inventário OBRIGATÓRIO com reconhecimento explícito
-- ---------------------------------------------------------------------
-- * Toda policy de storage.objects fora da lista conhecida é listada e o md5
--   do conjunto é exigido em `app.storage_policy_ack`. Sem o hash, aborta
--   ANTES de qualquer drop — inclusive quando o conjunto está VAZIO
--   (hash de string vazia d41d8cd98f00b204e9800998ecf8427e).
-- * Bloqueios duros, apenas para policies PERMISSIVAS (restritiva só estreita
--   e não pode conceder nada por OR):
--     (i)   desconhecida que cita documents|branding|caepi-base;
--     (ii)  desconhecida sem filtro de bucket_id;
--     (iii) desconhecida com expressão literalmente null/true.
-- * Não existe verificação automática de "expressão permissiva" (ex.:
--   bucket_id <> 'avatars'). A cobertura é revisão humana do inventário.
do $inventory$
declare
  pol record;
  v_known text[] := array[
    'documents_read','documents_insert','documents_update','documents_delete',
    'branding_read','branding_insert','branding_update','branding_delete',
    'caepi_base_all','caepi_base_platform_all'
  ];
  v_others text[] := array[]::text[];
  v_issues text[] := array[]::text[];
  v_hash text;
  v_ack text := coalesce(current_setting('app.storage_policy_ack', true), '');
  v_qual_free boolean;
  v_check_free boolean;
begin
  for pol in
    select p.policyname, p.permissive, p.cmd, p.roles::text[] as roles, p.qual, p.with_check
    from pg_policies p
    where p.schemaname = 'storage' and p.tablename = 'objects'
    order by p.policyname
  loop
    if pol.policyname = any (v_known) then
      continue;
    end if;

    v_others := v_others || format(
      E'\n  - %s | cmd=%s | roles=%s | using=%s | check=%s',
      pol.policyname,
      pol.cmd,
      array_to_string(pol.roles, ','),
      coalesce(nullif(btrim(pol.qual), ''), '<null>'),
      coalesce(nullif(btrim(pol.with_check), ''), '<null>')
    );

    if pol.permissive <> 'PERMISSIVE' then
      continue;  -- restritiva não amplia acesso
    end if;

    if coalesce(pol.qual, '') ~* '(documents|branding|caepi-base)'
       or coalesce(pol.with_check, '') ~* '(documents|branding|caepi-base)' then
      v_issues := v_issues || format('%s cita bucket isolado e não é conhecida (cmd %s)', pol.policyname, pol.cmd);
      continue;
    end if;

    if coalesce(pol.qual, '') !~* 'bucket_id'
       and coalesce(pol.with_check, '') !~* 'bucket_id' then
      v_issues := v_issues || format('%s não restringe por bucket_id (cmd %s)', pol.policyname, pol.cmd);
      continue;
    end if;

    v_qual_free := pol.qual is null or btrim(pol.qual) in ('true', '(true)');
    v_check_free := pol.with_check is null or btrim(pol.with_check) in ('true', '(true)');

    if (pol.cmd in ('SELECT', 'DELETE') and v_qual_free)
       or (pol.cmd = 'INSERT' and v_check_free)
       or (pol.cmd = 'UPDATE' and v_qual_free and v_check_free)
       or (pol.cmd = 'ALL' and (v_qual_free or v_check_free)) then
      v_issues := v_issues || format('%s tem expressão literalmente irrestrita (cmd %s)', pol.policyname, pol.cmd);
    end if;
  end loop;

  v_hash := md5(coalesce(array_to_string(v_others, ''), ''));

  if array_length(v_issues, 1) is not null then
    raise exception
      E'Migração interrompida. NENHUMA permissão foi alterada.\nProblemas que exigem decisão humana:\n  - %\nInventário de storage.objects fora da lista conhecida:%',
      array_to_string(v_issues, E'\n  - '),
      coalesce(array_to_string(v_others, ''), E'\n  (vazio)');
  end if;

  if v_ack <> v_hash then
    raise exception
      E'Revisão explícita do inventário pendente. NENHUMA permissão foi alterada.\nPolicies de storage.objects fora da lista conhecida:%\n\nHash do conjunto: %\n\nRevise cada linha acima e reexecute com:\n  select set_config(''app.storage_policy_ack'', ''%'', true);',
      coalesce(array_to_string(v_others, ''), E'\n  (nenhuma)'),
      v_hash,
      v_hash;
  end if;

  raise notice 'Inventário reconhecido (hash %).', v_hash;
end
$inventory$;

drop policy if exists documents_read on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;
drop policy if exists branding_read on storage.objects;
drop policy if exists branding_insert on storage.objects;
drop policy if exists branding_update on storage.objects;
drop policy if exists branding_delete on storage.objects;
drop policy if exists caepi_base_all on storage.objects;
drop policy if exists caepi_base_platform_all on storage.objects;

-- ---------------------------------------------------------------------
-- 2) Os três buckets deixam de ser públicos
-- ---------------------------------------------------------------------
update storage.buckets
   set public = false
 where id in ('documents', 'branding', 'caepi-base');

-- ---------------------------------------------------------------------
-- 2.1) Privilégios EXECUTE efetivos dos helpers de sessão
-- ---------------------------------------------------------------------
-- Achado real (pg_proc.proacl, lido antes desta revisão):
--   current_collaborator_ref()  -> `=X/postgres` (= PUBLIC) + anon EXPLÍCITO
--   current_company_subdomain() -> anon EXPLÍCITO
-- Revogar só de `anon` NÃO basta: o grant a PUBLIC (`=X/...`) continua
-- concedendo execução a qualquer papel, inclusive anon e futuros papéis.
-- É preciso revogar de PUBLIC e reconceder apenas a quem realmente chama.
--
-- Quem chama de verdade:
--   * policies `to authenticated` (documents, company_settings, Storage);
--   * funções SECURITY DEFINER cujo dono é `postgres` (o dono sempre pode);
--   * o service_role (grant explícito preservado — não é afetado por
--     `revoke ... from public`).
-- Nada legítimo é executado por `anon`.
revoke all on function public.current_collaborator_ref() from public;
revoke all on function public.current_collaborator_ref() from anon;
grant execute on function public.current_collaborator_ref() to authenticated;

revoke all on function public.current_company_subdomain() from public;
revoke all on function public.current_company_subdomain() from anon;
grant execute on function public.current_company_subdomain() to authenticated;

revoke all on function public.current_company_id() from public;
revoke all on function public.current_company_id() from anon;
grant execute on function public.current_company_id() to authenticated;

revoke all on function public.current_company_role() from public;
revoke all on function public.current_company_role() from anon;
grant execute on function public.current_company_role() to authenticated;

revoke all on function public.is_current_company_ref(text) from public;
grant execute on function public.is_current_company_ref(text) to authenticated;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.is_company_admin(uuid) from public;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Helpers de caminho (bucket-aware)
-- ---------------------------------------------------------------------

create or replace function public.storage_path_in_current_company(p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    coalesce(p_name, '') <> ''
    and p_name !~* '^(data:|https?:|blob:)'
    and position('..' in p_name) = 0
    and left(p_name, 1) <> '/'
    and public.current_company_subdomain() is not null
    and lower(split_part(p_name, '/', 1)) = public.current_company_subdomain()
$$;

create or replace function public.storage_path_is_own_certificate_folder(p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    public.storage_path_in_current_company(p_name)
    and public.current_collaborator_ref() is not null
    and split_part(p_name, '/', 2) = 'atestados'
    and split_part(p_name, '/', 3) = public.current_collaborator_ref()
    and array_length(string_to_array(p_name, '/'), 1) >= 4
$$;

-- O objeto existe MESMO no bucket informado? (bucket + caminho)
create or replace function public.storage_object_exists(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from storage.objects o
    where o.bucket_id = p_bucket and o.name = p_name
  )
$$;

-- O caminho pertence a um atestado da empresa do chamador?
create or replace function public.storage_path_is_medical_certificate(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    p_bucket = 'documents'
    and public.current_company_subdomain() is not null
    and public.storage_path_in_current_company(p_name)
    and exists (
      select 1 from public.medical_certificates m
      where m.storage_path = p_name
    )
$$;

-- Escopo do objeto, resolvido por REGISTRO **e** por bucket/caminho reais.
create or replace function public.storage_object_scope(p_bucket text, p_name text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  with me as (
    select
      public.current_company_id()        as company_id,
      public.current_company_subdomain() as subdomain,
      public.current_collaborator_ref()  as collaborator_ref
  )
  select case
    when me.company_id is null or me.subdomain is null then null
    -- O registro sozinho não autoriza: o objeto precisa existir no bucket
    -- informado e o caminho precisa estar na pasta da empresa atual.
    when not public.storage_object_exists(p_bucket, p_name) then null
    when not public.storage_path_in_current_company(p_name) then null

    -- Branding só existe no bucket branding.
    when p_bucket = 'branding' then
      case
        when exists (
          select 1 from public.company_settings s
          where s.company_id = me.company_id
            and (s.logo_path = p_name or s.letterhead_path = p_name)
        ) then 'branding'
        else null
      end

    when p_bucket = 'documents' then
      case
        -- 1) Atestado médico (precedência máxima)
        when exists (
          select 1 from public.medical_certificates m
          where m.storage_path = p_name
            and (m.company_id = me.company_id or lower(m.company_ref) = me.subdomain)
        ) then
          case
            when me.collaborator_ref is not null
              and exists (
                select 1 from public.medical_certificates m
                where m.storage_path = p_name
                  and (m.company_id = me.company_id or lower(m.company_ref) = me.subdomain)
                  and m.collaborator_ref = me.collaborator_ref
              )
            then 'cert_self'
            else 'cert_other'
          end

        -- 2) Documento individual do próprio colaborador
        when exists (
          select 1 from public.documents d
          where d.storage_path = p_name
            and (d.company_id = me.company_id or lower(d.company_ref) = me.subdomain)
            and d.scope = 'colaborador'
            and me.collaborator_ref is not null
            and d.collaborator_id = me.collaborator_ref
        ) then 'doc_self'

        -- 3) Documento individual de OUTRA pessoa
        when exists (
          select 1 from public.documents d
          where d.storage_path = p_name
            and (d.company_id = me.company_id or lower(d.company_ref) = me.subdomain)
            and d.scope = 'colaborador'
        ) then 'doc_other'

        -- 4) Material geral publicado para colaboradores
        when exists (
          select 1 from public.documents d
          where d.storage_path = p_name
            and (d.company_id = me.company_id or lower(d.company_ref) = me.subdomain)
            and coalesce(d.scope, 'empresa') <> 'colaborador'
            and d.visible_to_collaborator is true
        ) then 'doc_general'

        -- 5) Material interno da empresa (só administração)
        when exists (
          select 1 from public.documents d
          where d.storage_path = p_name
            and (d.company_id = me.company_id or lower(d.company_ref) = me.subdomain)
        ) then 'doc_internal'

        -- 6) Regulamento interno
        when exists (
          select 1 from public.internal_regulations r
          where r.storage_path = p_name
            and lower(r.company_ref) = me.subdomain
        ) then 'regulation'

        else null
      end

    else null
  end
  from me
$$;

-- ---------------------------------------------------------------------
-- 4) Validação de propriedade de referências (usada por gatilhos)
--    Devolve NULL quando está tudo certo, ou o motivo da recusa.
-- ---------------------------------------------------------------------
create or replace function public.storage_reference_problem(
  p_bucket text,
  p_name text,
  p_company_id uuid,
  p_company_ref text,
  p_collaborator_ref text,
  p_kind text
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_subdomain text;
  v_company_id uuid;
  v_expected_bucket text;
  v_parts text[];
begin
  if p_name is null or btrim(p_name) = '' then
    return 'caminho de arquivo vazio';
  end if;

  if p_name ~* '^(data:|https?:|blob:)' then
    return 'referência não é um caminho de Storage';
  end if;

  if left(p_name, 1) = '/' or p_name ~ '(^|/)\.\.(/|$)' then
    return 'caminho de arquivo inválido';
  end if;

  v_expected_bucket := case when p_kind = 'branding' then 'branding' else 'documents' end;
  if p_bucket is distinct from v_expected_bucket then
    return format('bucket %s incompatível com a referência %s', coalesce(p_bucket, '<null>'), p_kind);
  end if;

  -- Resolve a empresa do REGISTRO e confere company_id x company_ref.
  if p_company_id is not null then
    select c.id, lower(c.subdomain)
      into v_company_id, v_subdomain
    from public.companies c
    where c.id = p_company_id;

    if v_company_id is null then
      return 'empresa do registro não existe';
    end if;

    if p_company_ref is not null and lower(btrim(p_company_ref)) <> v_subdomain then
      return 'company_ref não corresponde ao company_id do registro';
    end if;
  elsif p_company_ref is not null and btrim(p_company_ref) <> '' then
    select c.id, lower(c.subdomain)
      into v_company_id, v_subdomain
    from public.companies c
    where lower(c.subdomain) = lower(btrim(p_company_ref));

    if v_company_id is null then
      return 'company_ref do registro não corresponde a nenhuma empresa';
    end if;
  else
    return 'registro sem empresa identificada';
  end if;

  v_parts := string_to_array(p_name, '/');

  -- O caminho é a prova de empresa; o registro não é.
  if lower(coalesce(v_parts[1], '')) <> v_subdomain then
    return 'arquivo não pertence à pasta da empresa do registro';
  end if;

  -- Existência real do objeto no bucket esperado.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = v_expected_bucket and o.name = p_name
  ) then
    return format('arquivo não existe no bucket %s', v_expected_bucket);
  end if;

  if p_kind = 'certificate' then
    if coalesce(btrim(p_collaborator_ref), '') = '' then
      return 'atestado sem colaborador identificado';
    end if;
    if coalesce(v_parts[2], '') <> 'atestados' then
      return 'atestado precisa estar em <empresa>/atestados/<colaborador>/';
    end if;
    if coalesce(v_parts[3], '') <> p_collaborator_ref then
      return 'atestado aponta para a pasta de outro colaborador';
    end if;
    if array_length(v_parts, 1) < 4 then
      return 'caminho de atestado incompleto';
    end if;
    if exists (select 1 from public.documents d where d.storage_path = p_name)
       or exists (select 1 from public.internal_regulations r where r.storage_path = p_name) then
      return 'caminho já usado por documento ou regulamento';
    end if;

  elsif p_kind in ('document', 'regulation') then
    if exists (select 1 from public.medical_certificates m where m.storage_path = p_name) then
      return 'caminho já pertence a um atestado médico';
    end if;

  elsif p_kind = 'branding' then
    if coalesce(v_parts[2], '') not in ('logo', 'letterhead') then
      return 'branding precisa estar em <empresa>/logo/ ou <empresa>/letterhead/';
    end if;

  else
    return format('tipo de referência desconhecido: %s', coalesce(p_kind, '<null>'));
  end if;

  return null;
end
$$;

-- ---------------------------------------------------------------------
-- 5) Gatilhos que impõem a validação no servidor
-- ---------------------------------------------------------------------

create or replace function public.documents_validate_storage_reference()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_problem text;
begin
  if new.storage_path is null or btrim(new.storage_path) = '' then
    return new;
  end if;

  v_problem := public.storage_reference_problem(
    'documents', new.storage_path, new.company_id, new.company_ref, null, 'document'
  );

  if v_problem is not null then
    raise exception 'Referência de arquivo recusada em documents: %', v_problem
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists documents_validate_storage_reference on public.documents;
create trigger documents_validate_storage_reference
  before insert or update of storage_path, company_id, company_ref on public.documents
  for each row execute function public.documents_validate_storage_reference();

create or replace function public.medical_certificates_validate_file_reference()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_problem text;
begin
  if new.storage_path is null or btrim(new.storage_path) = '' then
    raise exception 'Atestado só é finalizado com arquivo confirmado. Envie o arquivo antes de registrar.'
      using errcode = 'check_violation';
  end if;

  v_problem := public.storage_reference_problem(
    'documents', new.storage_path, new.company_id, new.company_ref, new.collaborator_ref, 'certificate'
  );

  if v_problem is not null then
    raise exception 'Finalização do atestado recusada: %', v_problem
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists medical_certificates_validate_file_reference on public.medical_certificates;
create trigger medical_certificates_validate_file_reference
  before insert on public.medical_certificates
  for each row execute function public.medical_certificates_validate_file_reference();

create or replace function public.internal_regulations_validate_storage_reference()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_problem text;
begin
  if new.storage_path is null or btrim(new.storage_path) = '' then
    return new;
  end if;

  v_problem := public.storage_reference_problem(
    'documents', new.storage_path, null, new.company_ref, null, 'regulation'
  );

  if v_problem is not null then
    raise exception 'Referência de arquivo recusada em internal_regulations: %', v_problem
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

drop trigger if exists internal_regulations_validate_storage_reference on public.internal_regulations;
create trigger internal_regulations_validate_storage_reference
  before insert or update of storage_path, company_ref on public.internal_regulations
  for each row execute function public.internal_regulations_validate_storage_reference();

create or replace function public.company_settings_validate_branding_reference()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_problem text;
begin
  if new.logo_path is not null and btrim(new.logo_path) <> '' then
    v_problem := public.storage_reference_problem(
      'branding', new.logo_path, new.company_id, null, null, 'branding'
    );
    if v_problem is not null then
      raise exception 'Referência de logo recusada: %', v_problem using errcode = 'check_violation';
    end if;
  end if;

  if new.letterhead_path is not null and btrim(new.letterhead_path) <> '' then
    v_problem := public.storage_reference_problem(
      'branding', new.letterhead_path, new.company_id, null, null, 'branding'
    );
    if v_problem is not null then
      raise exception 'Referência de papel timbrado recusada: %', v_problem using errcode = 'check_violation';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists company_settings_validate_branding_reference on public.company_settings;
create trigger company_settings_validate_branding_reference
  before insert or update of logo_path, letterhead_path, company_id on public.company_settings
  for each row execute function public.company_settings_validate_branding_reference();

-- ---------------------------------------------------------------------
-- 6) Autorização de acesso aos objetos (policies)
-- ---------------------------------------------------------------------

create or replace function public.storage_can_read(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_bucket = 'documents' then (
      public.current_company_subdomain() is not null
      and public.storage_object_exists(p_bucket, p_name)
      and case
        when public.current_company_role() = 'admin' then
          public.storage_object_scope(p_bucket, p_name) is not null
          or public.storage_path_in_current_company(p_name)
        else
          public.storage_object_scope(p_bucket, p_name) in ('cert_self', 'doc_self', 'doc_general', 'regulation')
          -- Permite confirmar o upload na PRÓPRIA pasta de atestados antes de
          -- o registro existir (fluxo: upload -> confirmação -> INSERT).
          or public.storage_path_is_own_certificate_folder(p_name)
      end
    )
    when p_bucket = 'branding' then (
      public.current_company_subdomain() is not null
      and public.storage_object_exists(p_bucket, p_name)
      and (
        public.storage_object_scope(p_bucket, p_name) = 'branding'
        or (
          public.storage_object_scope(p_bucket, p_name) is null
          and public.storage_path_in_current_company(p_name)
        )
      )
    )
    when p_bucket = 'caepi-base' then public.is_platform_admin()
    else false
  end
$$;

create or replace function public.storage_can_insert(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_bucket = 'documents' then (
      public.storage_path_in_current_company(p_name)
      and public.current_company_role() is not null
      and (
        public.current_company_role() = 'admin'
        or public.storage_path_is_own_certificate_folder(p_name)
      )
      -- Nunca gravar por cima de um caminho já registrado como atestado.
      and not exists (
        select 1 from public.medical_certificates m where m.storage_path = p_name
      )
    )
    when p_bucket = 'branding' then (
      public.storage_path_in_current_company(p_name)
      and public.current_company_role() = 'admin'
    )
    when p_bucket = 'caepi-base' then public.is_platform_admin()
    else false
  end
$$;

create or replace function public.storage_can_update(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_bucket in ('documents', 'branding') then (
      public.current_company_subdomain() is not null
      and public.current_company_role() = 'admin'
      and public.storage_object_exists(p_bucket, p_name)
      and public.storage_path_in_current_company(p_name)
      and not public.storage_path_is_medical_certificate(p_bucket, p_name)
    )
    when p_bucket = 'caepi-base' then public.is_platform_admin()
    else false
  end
$$;

create or replace function public.storage_can_delete(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_bucket in ('documents', 'branding') then (
      public.current_company_subdomain() is not null
      and public.current_company_role() = 'admin'
      and public.storage_object_exists(p_bucket, p_name)
      and public.storage_path_in_current_company(p_name)
      and not public.storage_path_is_medical_certificate(p_bucket, p_name)
    )
    when p_bucket = 'caepi-base' then public.is_platform_admin()
    else false
  end
$$;

revoke all on function public.storage_path_in_current_company(text) from public;
revoke all on function public.storage_path_is_own_certificate_folder(text) from public;
revoke all on function public.storage_object_exists(text, text) from public;
revoke all on function public.storage_path_is_medical_certificate(text, text) from public;
revoke all on function public.storage_object_scope(text, text) from public;
revoke all on function public.storage_can_read(text, text) from public;
revoke all on function public.storage_can_insert(text, text) from public;
revoke all on function public.storage_can_update(text, text) from public;
revoke all on function public.storage_can_delete(text, text) from public;
revoke all on function public.storage_reference_problem(text, text, uuid, text, text, text) from public;

revoke all on function public.documents_validate_storage_reference() from public;
revoke all on function public.medical_certificates_validate_file_reference() from public;
revoke all on function public.internal_regulations_validate_storage_reference() from public;
revoke all on function public.company_settings_validate_branding_reference() from public;

grant execute on function public.storage_path_in_current_company(text) to authenticated;
grant execute on function public.storage_path_is_own_certificate_folder(text) to authenticated;
grant execute on function public.storage_object_exists(text, text) to authenticated;
grant execute on function public.storage_path_is_medical_certificate(text, text) to authenticated;
grant execute on function public.storage_object_scope(text, text) to authenticated;
grant execute on function public.storage_can_read(text, text) to authenticated;
grant execute on function public.storage_can_insert(text, text) to authenticated;
grant execute on function public.storage_can_update(text, text) to authenticated;
grant execute on function public.storage_can_delete(text, text) to authenticated;
grant execute on function public.storage_reference_problem(text, text, uuid, text, text, text) to authenticated;

create policy documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.storage_can_read(bucket_id, name));

create policy documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.storage_can_insert(bucket_id, name));

create policy documents_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.storage_can_update(bucket_id, name))
  with check (bucket_id = 'documents' and public.storage_can_insert(bucket_id, name));

create policy documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.storage_can_delete(bucket_id, name));

create policy branding_read on storage.objects
  for select to authenticated
  using (bucket_id = 'branding' and public.storage_can_read(bucket_id, name));

create policy branding_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and public.storage_can_insert(bucket_id, name));

create policy branding_update on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and public.storage_can_update(bucket_id, name))
  with check (bucket_id = 'branding' and public.storage_can_insert(bucket_id, name));

create policy branding_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and public.storage_can_delete(bucket_id, name));

create policy caepi_base_platform_all on storage.objects
  for all to authenticated
  using (bucket_id = 'caepi-base' and public.is_platform_admin())
  with check (bucket_id = 'caepi-base' and public.is_platform_admin());

-- ---------------------------------------------------------------------
-- 7) Módulos da plataforma — leitura continua GLOBAL
-- ---------------------------------------------------------------------
do $modules$
begin
  if to_regprocedure('public.platform_enabled_modules()') is not null then
    execute 'revoke all on function public.platform_enabled_modules() from anon';
    execute 'grant execute on function public.platform_enabled_modules() to authenticated';
  end if;
end
$modules$;

-- ---------------------------------------------------------------------
-- 8) Conferência final por REGRA e PAPEL
-- ---------------------------------------------------------------------
do $check$
declare
  r record;
  v_problem text[] := array[]::text[];
  v_expected text[] := array[
    'documents_read','documents_insert','documents_update','documents_delete',
    'branding_read','branding_insert','branding_update','branding_delete',
    'caepi_base_platform_all'
  ];
begin
  for r in
    select e.policyname as expected_name, e.cmd as expected_cmd,
           p.policyname, p.cmd, p.roles::text[] as roles
    from (values
      ('documents_read', 'SELECT'),
      ('documents_insert', 'INSERT'),
      ('documents_update', 'UPDATE'),
      ('documents_delete', 'DELETE'),
      ('branding_read', 'SELECT'),
      ('branding_insert', 'INSERT'),
      ('branding_update', 'UPDATE'),
      ('branding_delete', 'DELETE'),
      ('caepi_base_platform_all', 'ALL')
    ) as e(policyname, cmd)
    left join pg_policies p
      on p.schemaname = 'storage'
     and p.tablename = 'objects'
     and p.policyname = e.policyname
  loop
    if r.policyname is null then
      v_problem := v_problem || format('faltando policy %s', r.expected_name);
      continue;
    end if;

    if r.cmd is distinct from r.expected_cmd then
      v_problem := v_problem || format('%s com cmd %s (esperado %s)', r.expected_name, r.cmd, r.expected_cmd);
    end if;

    if r.roles is distinct from array['authenticated']::text[] then
      v_problem := v_problem || format('%s com papéis %s (esperado authenticated)', r.expected_name, array_to_string(r.roles, ','));
    end if;
  end loop;

  for r in
    select policyname, permissive, qual, with_check
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    if r.policyname = any (v_expected) then
      continue;
    end if;

    if r.permissive <> 'PERMISSIVE' then
      continue;
    end if;

    if coalesce(r.qual, '') ~* '(documents|branding|caepi-base)'
       or coalesce(r.with_check, '') ~* '(documents|branding|caepi-base)' then
      v_problem := v_problem || format('policy extra %s cita bucket isolado', r.policyname);
    elsif coalesce(r.qual, '') !~* 'bucket_id'
       and coalesce(r.with_check, '') !~* 'bucket_id' then
      v_problem := v_problem || format('policy extra %s não restringe por bucket_id', r.policyname);
    end if;
  end loop;

  if exists (
    select 1 from storage.buckets
    where id in ('documents', 'branding', 'caepi-base') and public = true
  ) then
    v_problem := v_problem || 'bucket público remanescente';
  end if;

  for r in
    select f.sig
    from (values
      ('public.storage_path_in_current_company(text)'),
      ('public.storage_path_is_own_certificate_folder(text)'),
      ('public.storage_object_exists(text,text)'),
      ('public.storage_path_is_medical_certificate(text,text)'),
      ('public.storage_object_scope(text,text)'),
      ('public.storage_can_read(text,text)'),
      ('public.storage_can_insert(text,text)'),
      ('public.storage_can_update(text,text)'),
      ('public.storage_can_delete(text,text)'),
      ('public.storage_reference_problem(text,text,uuid,text,text,text)')
    ) as f(sig)
  loop
    if not exists (
      select 1 from pg_proc p
      where p.oid = to_regprocedure(r.sig)
        and p.prosecdef = true
        and p.proconfig is not null
        and array_to_string(p.proconfig, ',') ~ 'search_path='
    ) then
      v_problem := v_problem || format('%s ausente, sem SECURITY DEFINER ou sem search_path fixo', r.sig);
    end if;

    if has_function_privilege('anon', r.sig, 'EXECUTE') then
      v_problem := v_problem || format('%s executável por anon', r.sig);
    end if;
  end loop;

  -- Helpers de sessão: nenhum EXECUTE herdado de PUBLIC, nenhum grant a anon,
  -- e authenticated preservado. `has_function_privilege('anon', …)` já é
  -- verdadeiro quando o direito vem de PUBLIC, mas a checagem explícita de
  -- PUBLIC evita depender dessa semântica.
  for r in
    select f.sig
    from (values
      ('public.current_collaborator_ref()'),
      ('public.current_company_subdomain()'),
      ('public.current_company_id()'),
      ('public.current_company_role()'),
      ('public.is_current_company_ref(text)'),
      ('public.is_company_member(uuid)'),
      ('public.is_company_admin(uuid)')
    ) as f(sig)
  loop
    if has_function_privilege('anon', r.sig, 'EXECUTE') then
      v_problem := v_problem || format('%s executável por anon (grant direto ou herdado de PUBLIC)', r.sig);
    end if;

    if exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = to_regprocedure(r.sig)
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE'
    ) then
      v_problem := v_problem || format('%s ainda concede EXECUTE a PUBLIC', r.sig);
    end if;

    if not has_function_privilege('authenticated', r.sig, 'EXECUTE') then
      v_problem := v_problem || format('%s perdeu EXECUTE para authenticated (chamada legítima quebraria)', r.sig);
    end if;
  end loop;

  -- Gatilhos precisam existir e NÃO podem ser executáveis pelo cliente.
  for r in
    select t.tgname, t.tgrelid::regclass::text as tbl, t.tgfoid::regprocedure::text as fnsig
    from pg_trigger t
    where not t.tgisinternal
      and t.tgname in (
        'documents_validate_storage_reference',
        'medical_certificates_validate_file_reference',
        'internal_regulations_validate_storage_reference',
        'company_settings_validate_branding_reference'
      )
  loop
    if has_function_privilege('anon', r.fnsig, 'EXECUTE')
       or has_function_privilege('authenticated', r.fnsig, 'EXECUTE') then
      v_problem := v_problem || format('função de gatilho %s executável por cliente', r.fnsig);
    end if;
  end loop;

  if not exists (select 1 from pg_trigger where tgname = 'documents_validate_storage_reference' and not tgisinternal) then
    v_problem := v_problem || 'gatilho documents_validate_storage_reference ausente';
  end if;  if not exists (select 1 from pg_trigger where tgname = 'medical_certificates_validate_file_reference' and not tgisinternal) then
    v_problem := v_problem || 'gatilho medical_certificates_validate_file_reference ausente';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'internal_regulations_validate_storage_reference' and not tgisinternal) then
    v_problem := v_problem || 'gatilho internal_regulations_validate_storage_reference ausente';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'company_settings_validate_branding_reference' and not tgisinternal) then
    v_problem := v_problem || 'gatilho company_settings_validate_branding_reference ausente';
  end if;

  -- A checagem de existência lê storage.objects, cujo dono é
  -- supabase_storage_admin (RLS habilitada, FORCE desligada). O dono destas
  -- funções precisa de BYPASSRLS; sem isso as policies `to authenticated`
  -- escondem as linhas e tudo seria negado. Verificado no banco atual:
  -- executor `postgres` com rolbypassrls = true.
  if not exists (
    select 1
    from pg_proc p
    join pg_roles r on r.rolname = pg_get_userbyid(p.proowner)
    where p.oid = to_regprocedure('public.storage_reference_problem(text,text,uuid,text,text,text)')
      and r.rolbypassrls
  ) then
    v_problem := v_problem || 'dono das funções de Storage sem BYPASSRLS: a checagem de existência pode negar tudo';
  end if;

  if array_length(v_problem, 1) is not null then
    raise exception 'Conferência final falhou: %', array_to_string(v_problem, ' | ');
  end if;
end
$check$;