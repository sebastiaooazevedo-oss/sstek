-- =====================================================================
-- ENTREGA 1 — BASE MÍNIMA REPRODUTÍVEL (SOMENTE AMBIENTE ISOLADO)
-- =====================================================================
--
-- ⛔ NÃO EXECUTE ISTO NO AMBIENTE ATUAL. Este arquivo cria empresas, vínculos,
--    documentos, atestados e objetos de Storage fictícios. Ele se recusa a
--    rodar sem dois marcadores explícitos:
--
--       set app.entrega1_environment = 'isolated';
--       set app.entrega1_seed_ack    = 'EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL';
--
--    e aborta se já existir empresa com subdomínio 'empresa-a' ou
--    'empresa-b'. Nenhum dado pessoal, documento, credencial ou segredo do
--    ambiente atual é copiado por este arquivo: todos os valores são fictícios
--    e inventados aqui.
--
-- ORDEM DE USO NO AMBIENTE ISOLADO
--   1. Provisione um projeto descartável (§1 do README).
--   2. Aplique o schema de base do projeto (todas as migrations JÁ APLICADAS,
--      incluindo 20261101100000_entrega1_company_settings_up.sql).
--      NÃO aplique 20261101100100/100200/100300/100400 antes do seed.
--   3. FASE 1 (manual, sem senha neste chat): crie 4 usuários no projeto
--      isolado — Dashboard > Authentication > Add user (com confirmação de
--      e-mail), ou Admin API. E-mails obrigatórios:
--         a-admin@fixture.invalid
--         a-colab@fixture.invalid
--         b-admin@fixture.invalid
--         b-colab@fixture.invalid
--      As senhas são definidas por você no projeto isolado e nunca aparecem
--      aqui. Nenhum desses e-mails existe no ambiente atual.
--   4. FASE 2 (este arquivo): cria empresas, vínculos, configurações,
--      documentos, atestados e objetos de Storage fictícios.
--   5. Só então capture o inventário/hash e rode o script mestre.
--
-- O QUE FICA DISPONÍVEL PARA OS TESTES
--   Empresa A ('empresa-a')              Empresa B ('empresa-b')
--     A-admin  -> profiles.role=admin      B-admin -> profiles.role=admin
--     A-colab  -> collaborator_ref=A001    B-colab -> collaborator_ref=B001
--     A-alvo   -> collaborator_ref=A002 (sem login, só para “documento de
--                 outro colaborador” e “atestado de outra pessoa”)
--
--   documents (A): geral publicado, interno (não publicado), individual de
--                  A001, individual de A002
--   documents (B): geral publicado, individual de B001
--   internal_regulations (A): 1 regulamento vigente com arquivo
--   medical_certificates: A001 com arquivo, A002 com arquivo, B001 com
--                  arquivo e 1 registro legado SEM arquivo (A001)
--   company_settings: 1 linha por empresa, com valores DIFERENTES em cada uma
--   branding: 1 logo por empresa
--
-- Este arquivo é idempotente apenas no sentido de “aborta se já houver
-- fixture”. Ele NÃO apaga nada.
-- =====================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- 0) Travas de segurança
-- ---------------------------------------------------------------------
do $guard$
begin
  if coalesce(current_setting('app.entrega1_environment', true), '') <> 'isolated' then
    raise exception
      E'Seed abortado: este arquivo só pode rodar em ambiente isolado.\nExecute antes:\n  set app.entrega1_environment = ''isolated'';';
  end if;

  if coalesce(current_setting('app.entrega1_seed_ack', true), '') <> 'EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL' then
    raise exception
      E'Seed abortado: falta o reconhecimento explícito.\nExecute antes:\n  set app.entrega1_seed_ack = ''EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL'';';
  end if;

  if exists (select 1 from public.companies where lower(subdomain) in ('empresa-a', 'empresa-b')) then
    raise exception 'Seed abortado: já existe empresa com subdomínio empresa-a/empresa-b. Este arquivo não sobrescreve fixture.';
  end if;

  if to_regclass('public.company_settings') is null then
    raise exception 'Seed abortado: company_settings não existe. Aplique o schema de base (inclui 20261101100000) antes.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'medical_certificates'
      and column_name = 'replaces_id'
  ) then
    raise exception 'Seed abortado: as migrations pendentes já foram aplicadas neste banco. O seed precisa rodar ANTES do script mestre, na base limpa.';
  end if;
end
$guard$;

-- ---------------------------------------------------------------------
-- 1) Usuários da fixture (criados na FASE 1 — nenhuma senha aqui)
-- ---------------------------------------------------------------------
create temp table if not exists fixture_user (
  email text primary key,
  uid uuid not null
) on commit drop;

delete from fixture_user;

insert into fixture_user (email, uid)
select lower(u.email), u.id
from auth.users u
where lower(u.email) in (
  'a-admin@fixture.invalid',
  'a-colab@fixture.invalid',
  'b-admin@fixture.invalid',
  'b-colab@fixture.invalid'
);

do $users$
declare
  v_count integer;
begin
  select count(*) into v_count from fixture_user;

  if v_count <> 4 then
    raise exception
      E'Seed abortado: encontrei % de 4 usuários da fixture em auth.users.\nCrie na FASE 1 (Dashboard > Authentication > Add user), com e-mail confirmado:\n  a-admin@fixture.invalid\n  a-colab@fixture.invalid\n  b-admin@fixture.invalid\n  b-colab@fixture.invalid\nNenhuma senha deve ser enviada por chat.',
      v_count;
  end if;
end
$users$;

-- ---------------------------------------------------------------------
-- 2) Empresas, vínculos e configurações
-- ---------------------------------------------------------------------
insert into public.companies (id, name, subdomain, legal_name, cnpj, status, plan)
values
  ('11111111-1111-4111-8111-111111111111', 'Fixture Alfa Ltda', 'empresa-a', 'Fixture Alfa Ltda', '00.000.000/0001-11', 'active', 'S2'),
  ('22222222-2222-4222-8222-222222222222', 'Fixture Beta Ltda', 'empresa-b', 'Fixture Beta Ltda', '00.000000/0001-22', 'active', 'S2');

insert into public.profiles (company_id, auth_user_id, role, collaborator_ref, name, email, status)
select
  case when f.email like 'a-%' then '11111111-1111-4111-8111-111111111111'::uuid
       else '22222222-2222-4222-8222-222222222222'::uuid end,
  f.uid,
  case when f.email like '%-admin@%' then 'admin' else 'collaborator' end,
  case
    when f.email = 'a-colab@fixture.invalid' then 'A001'
    when f.email = 'b-colab@fixture.invalid' then 'B001'
    else null
  end,
  case f.email
    when 'a-admin@fixture.invalid' then 'Admin Alfa (fixture)'
    when 'a-colab@fixture.invalid' then 'Colaborador Alfa (fixture)'
    when 'b-admin@fixture.invalid' then 'Admin Beta (fixture)'
    else 'Colaborador Beta (fixture)'
  end,
  f.email,
  'active'
from fixture_user f;

insert into public.company_collaborators (company_id, ref, name, cpf, area, role_function, establishment, email, status, active)
values
  ('11111111-1111-4111-8111-111111111111', 'A001', 'Colaborador Alfa (fixture)', '00000000101', 'Produção', 'Operador', 'Unidade Alfa 1', 'a-colab@fixture.invalid', 'Ativo', true),
  ('11111111-1111-4111-8111-111111111111', 'A002', 'Alvo Alfa (fixture)',       '00000000102', 'Produção', 'Operador', 'Unidade Alfa 1', 'a-alvo@fixture.invalid', 'Ativo', true),
  ('22222222-2222-4222-8222-222222222222', 'B001', 'Colaborador Beta (fixture)', '00000000201', 'Logística', 'Auxiliar', 'Unidade Beta 1', 'b-colab@fixture.invalid', 'Ativo', true);

-- Configurações independentes: valores DIFERENTES por empresa, de propósito.
insert into public.company_settings (
  company_id, company_legal_name, company_cnpj, technical_responsible,
  technical_registration, sesmt_phone, public_base_url,
  permitir_ca_vencido, certificate_leave_alert_days
) values
  ('11111111-1111-4111-8111-111111111111', 'Fixture Alfa Ltda', '00.000.000/0001-11',
   'RT Alfa (fixture)', 'CREA-ALFA-0001', '+55 11 0000-0001', 'https://alfa.fixture.invalid',
   false, 3),
  ('22222222-2222-4222-8222-222222222222', 'Fixture Beta Ltda', '00.000000/0001-22',
   'RT Beta (fixture)', 'CREA-BETA-0002', '+55 21 0000-0002', 'https://beta.fixture.invalid',
   true, 7);

-- ---------------------------------------------------------------------
-- 3) Buckets privados e objetos fictícios (metadados apenas)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false), ('branding', 'branding', false)
on conflict (id) do update set public = false;

insert into storage.objects (bucket_id, name, metadata)
values
  ('documents', 'empresa-a/doc-geral.pdf',                              '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-a/interno/regra-interna.pdf',                  '{"size":256,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-a/colaborador/A001/exame-a001.pdf',            '{"size":512,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-a/colaborador/A002/exame-a002.pdf',            '{"size":512,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-a/atestados/A001/1700000000001-atestado.pdf',  '{"size":1024,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-a/atestados/A002/1700000000002-atestado.pdf',  '{"size":1024,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-a/regulamento-interno/1700000000003-ri.pdf',   '{"size":2048,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-b/doc-geral.pdf',                              '{"size":128,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-b/colaborador/B001/exame-b001.pdf',            '{"size":512,"mimetype":"application/pdf"}'::jsonb),
  ('documents', 'empresa-b/atestados/B001/1700000000004-atestado.pdf',  '{"size":1024,"mimetype":"application/pdf"}'::jsonb),
  ('branding',  'empresa-a/logo/logo-1700000000005.png',                '{"size":64,"mimetype":"image/png"}'::jsonb),
  ('branding',  'empresa-b/logo/logo-1700000000006.png',                '{"size":64,"mimetype":"image/png"}'::jsonb);

-- ---------------------------------------------------------------------
-- 4) Documentos: geral publicado, interno e individuais
-- ---------------------------------------------------------------------
insert into public.documents (
  company_id, company_ref, ref, name, type_id, type_name, scope,
  collaborator_id, collaborator_name, visible_to_collaborator,
  storage_path, status, issued_at
) values
  -- A: material geral publicado para colaboradores
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'DOC-A-GERAL', 'Política de Segurança (fixture)',
   'politica', 'Política', 'empresa', null, null, true,
   'empresa-a/doc-geral.pdf', 'Vigente', '2026-01-10'),
  -- A: material interno NÃO publicado (só administração)
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'DOC-A-INTERNO', 'Ata interna (fixture)',
   'ata', 'Ata', 'empresa', null, null, false,
   'empresa-a/interno/regra-interna.pdf', 'Vigente', '2026-01-11'),
  -- A: documento individual de A001
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'DOC-A-A001', 'ASO A001 (fixture)',
   'aso', 'ASO', 'colaborador', 'A001', 'Colaborador Alfa (fixture)', true,
   'empresa-a/colaborador/A001/exame-a001.pdf', 'Vigente', '2026-01-12'),
  -- A: documento individual de A002 (outro colaborador)
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'DOC-A-A002', 'ASO A002 (fixture)',
   'aso', 'ASO', 'colaborador', 'A002', 'Alvo Alfa (fixture)', true,
   'empresa-a/colaborador/A002/exame-a002.pdf', 'Vigente', '2026-01-13'),
  -- B: material geral publicado
  ('22222222-2222-4222-8222-222222222222', 'empresa-b', 'DOC-B-GERAL', 'Política de Segurança (fixture)',
   'politica', 'Política', 'empresa', null, null, true,
   'empresa-b/doc-geral.pdf', 'Vigente', '2026-01-14'),
  -- B: documento individual de B001
  ('22222222-2222-4222-8222-222222222222', 'empresa-b', 'DOC-B-B001', 'ASO B001 (fixture)',
   'aso', 'ASO', 'colaborador', 'B001', 'Colaborador Beta (fixture)', true,
   'empresa-b/colaborador/B001/exame-b001.pdf', 'Vigente', '2026-01-15');

-- ---------------------------------------------------------------------
-- 5) Regulamento interno (A) com arquivo
-- ---------------------------------------------------------------------
insert into public.internal_regulations (company_ref, ref, version, title, summary, storage_path, file_size, page_count, status)
values ('empresa-a', 'RI-A-001', 1, 'Regulamento Interno (fixture)',
        'Documento fictício para testes de referência.', 'empresa-a/regulamento-interno/1700000000003-ri.pdf',
        '2 KB', 1, 'vigente');

-- ---------------------------------------------------------------------
-- 6) Atestados (inclui 1 legado SEM arquivo, preservado de propósito)
-- ---------------------------------------------------------------------
insert into public.medical_certificates (
  company_id, company_ref, collaborator_ref, collaborator_name, area, establishment,
  certificate_type, issued_on, leave_days, cid, notes, storage_path, file_name, created_by
) values
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'A001', 'Colaborador Alfa (fixture)', 'Produção', 'Unidade Alfa 1',
   'Atestado médico', '2026-02-01', 2, 'M54.5', 'Atestado fictício com arquivo.',
   'empresa-a/atestados/A001/1700000000001-atestado.pdf', 'atestado-a001.pdf', 'a-colab@fixture.invalid'),
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'A001', 'Colaborador Alfa (fixture)', 'Produção', 'Unidade Alfa 1',
   'Atestado médico', '2026-01-05', 1, 'J06.9', 'Registro legado fictício SEM arquivo (preservação).',
   null, null, 'a-colab@fixture.invalid'),
  ('11111111-1111-4111-8111-111111111111', 'empresa-a', 'A002', 'Alvo Alfa (fixture)', 'Produção', 'Unidade Alfa 1',
   'Atestado médico', '2026-02-03', 1, 'R51', 'Atestado fictício de OUTRO colaborador.',
   'empresa-a/atestados/A002/1700000000002-atestado.pdf', 'atestado-a002.pdf', 'a-admin@fixture.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'empresa-b', 'B001', 'Colaborador Beta (fixture)', 'Logística', 'Unidade Beta 1',
   'Atestado médico', '2026-02-04', 3, 'S93.4', 'Atestado fictício da empresa B.',
   'empresa-b/atestados/B001/1700000000004-atestado.pdf', 'atestado-b001.pdf', 'b-colab@fixture.invalid');

-- ---------------------------------------------------------------------
-- 7) Conferência da fixture
-- ---------------------------------------------------------------------
do $verify$
declare
  v_a_docs integer;
  v_b_docs integer;
  v_certs integer;
  v_sem_arquivo integer;
  v_objs integer;
  v_problem text[] := array[]::text[];
begin
  select count(*) into v_a_docs from public.documents where company_ref = 'empresa-a';
  select count(*) into v_b_docs from public.documents where company_ref = 'empresa-b';
  select count(*) into v_certs  from public.medical_certificates;
  select count(*) into v_sem_arquivo from public.medical_certificates where storage_path is null;
  select count(*) into v_objs from storage.objects
   where bucket_id in ('documents', 'branding')
     and (name like 'empresa-a/%' or name like 'empresa-b/%');

  if v_a_docs <> 4 then v_problem := v_problem || format('documents A = %s (esperado 4)', v_a_docs); end if;
  if v_b_docs <> 2 then v_problem := v_problem || format('documents B = %s (esperado 2)', v_b_docs); end if;
  if v_certs <> 4 then v_problem := v_problem || format('medical_certificates = %s (esperado 4)', v_certs); end if;
  if v_sem_arquivo <> 1 then v_problem := v_problem || format('atestados sem arquivo = %s (esperado 1)', v_sem_arquivo); end if;
  if v_objs < 12 then v_problem := v_problem || format('objetos de Storage = %s (esperado >= 12)', v_objs); end if;

  if not exists (select 1 from public.profiles where role = 'admin' and company_id = '11111111-1111-4111-8111-111111111111') then
    v_problem := v_problem || 'A-admin sem profiles.role=admin';
  end if;
  if not exists (select 1 from public.profiles where collaborator_ref = 'A001') then
    v_problem := v_problem || 'A-colab sem collaborator_ref=A001 em profiles';
  end if;
  if not exists (select 1 from public.profiles where collaborator_ref = 'B001') then
    v_problem := v_problem || 'B-colab sem collaborator_ref=B001 em profiles';
  end if;

  if array_length(v_problem, 1) is not null then
    raise exception 'Fixture inconsistente: %', array_to_string(v_problem, ' | ');
  end if;

  raise notice 'Fixture pronta: documents A=% / B=%, atestados=% (1 sem arquivo), objetos=%',
    v_a_docs, v_b_docs, v_certs, v_objs;
end
$verify$;