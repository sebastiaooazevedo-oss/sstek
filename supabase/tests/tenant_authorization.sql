-- ============================================================================
-- Bateria comportamental de autorização multi-tenant
-- Executar no SQL Editor do Supabase, conectado como postgres (owner).
--
-- IMPORTANTE
--  * Cada cenário troca de papel (`set local role`) e injeta as claims do
--    usuário de teste — é o mais próximo de uma sessão real que o SQL Editor
--    permite. Nenhuma chamada usa service role.
--  * A bateria cria empresas/usuários/perfis temporários com prefixo `qa-` e
--    remove tudo no final (bloco 9).
--  * Falha = mensagem "FALHOU: ...". Sucesso = "OK: ..." (NOTICE).
--  * Complemento obrigatório: repetir os cenários de leitura via API REST com
--    sessões reais (ver docs/architecture/TENANT_AUTH_AND_RLS_HARDENING.md).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Preparação (executa como postgres)
-- ---------------------------------------------------------------------------
do $$
declare
  v_company_a uuid;
  v_company_b uuid;
  v_user_a uuid := '11111111-1111-4111-8111-111111111111';
  v_user_b uuid := '22222222-2222-4222-8222-222222222222';
  v_user_admin_a uuid := '33333333-3333-4333-8333-333333333333';
begin
  -- Empresas de teste
  insert into public.companies (name, subdomain, status)
  values ('QA Tenant A', 'qa-tenant-a', 'active')
  on conflict do nothing;

  insert into public.companies (name, subdomain, status)
  values ('QA Tenant B', 'qa-tenant-b', 'active')
  on conflict do nothing;

  select id into v_company_a from public.companies where subdomain = 'qa-tenant-a';
  select id into v_company_b from public.companies where subdomain = 'qa-tenant-b';

  -- Usuários de teste no Auth (apenas para as claims; não há senha)
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-collab-a@example.invalid', now(), now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-collab-b@example.invalid', now(), now(), now()),
    (v_user_admin_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-admin-a@example.invalid', now(), now(), now())
  on conflict (id) do nothing;

  -- Perfis já vinculados (vínculo autorizado previamente)
  insert into public.profiles (id, company_id, auth_user_id, role, collaborator_ref, name, email, status)
  values
    (gen_random_uuid(), v_company_a, v_user_a, 'collaborator', 'qa-c-a1', 'QA Colab A', 'qa-collab-a@example.invalid', 'active'),
    (gen_random_uuid(), v_company_b, v_user_b, 'collaborator', 'qa-c-b1', 'QA Colab B', 'qa-collab-b@example.invalid', 'active'),
    (gen_random_uuid(), v_company_a, v_user_admin_a, 'admin', 'qa-adm-a', 'QA Admin A', 'qa-admin-a@example.invalid', 'active')
  on conflict do nothing;

  -- Dados privados de cada empresa
  insert into public.company_collaborators (company_id, ref, name, email, role_function, active, status)
  values
    (v_company_a, 'qa-c-a1', 'QA Colab A', 'qa-collab-a@example.invalid', 'Operador', true, 'Ativo'),
    (v_company_a, 'qa-c-a2', 'QA Colab A2', 'qa-collab-a2@example.invalid', 'Operador', true, 'Ativo'),
    (v_company_b, 'qa-c-b1', 'QA Colab B', 'qa-collab-b@example.invalid', 'Operador', true, 'Ativo')
  on conflict do nothing;

  insert into public.documents (company_id, company_ref, ref, name, type_id, type_name, scope, issued_at, expires_at, status, size, file_type)
  values
    (v_company_a, 'qa-tenant-a', 'qa-doc-a', 'Documento privado A', 'qa', 'QA', 'empresa', '01/01/2026', '01/01/2027', 'Em dia', '1 KB', 'pdf'),
    (v_company_b, 'qa-tenant-b', 'qa-doc-b', 'Documento privado B', 'qa', 'QA', 'empresa', '01/01/2026', '01/01/2027', 'Em dia', '1 KB', 'pdf')
  on conflict do nothing;

  insert into public.epi_deliveries (company_id, company_ref, ref, collaborator_ref, collaborator_name, status, items)
  values
    (v_company_a, 'qa-tenant-a', 'qa-epi-a1', 'qa-c-a1', 'QA Colab A', 'Pendente', '[]'::jsonb),
    (v_company_a, 'qa-tenant-a', 'qa-epi-a2', 'qa-c-a2', 'QA Colab A2', 'Pendente', '[]'::jsonb),
    (v_company_b, 'qa-tenant-b', 'qa-epi-b1', 'qa-c-b1', 'QA Colab B', 'Pendente', '[]'::jsonb)
  on conflict do nothing;

  insert into public.internal_regulations (company_ref, ref, version, title, summary, page_count, status, published_at)
  values ('qa-tenant-a', 'qa-reg-a', 1, 'Regulamento QA', 'Teste', 1, 'vigente', now())
  on conflict do nothing;

  insert into public.company_domains (company_id, domain, kind, is_primary)
  values
    (v_company_a, 'qa-tenant-a.sstek.test', 'subdomain', true),
    (v_company_b, 'qa-tenant-b.sstek.test', 'subdomain', true)
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 1. anon: sem sessão não lê nem escreve nada
-- ---------------------------------------------------------------------------
begin;
set local role anon;
do $$
declare v_rows int;
begin
  select count(*) into v_rows from public.companies;
  if v_rows <> 0 then raise exception 'FALHOU: anon leu % empresa(s)', v_rows; end if;
  raise notice 'OK: anon não lê o cadastro de empresas';

  select count(*) into v_rows from public.company_domains;
  if v_rows <> 0 then raise exception 'FALHOU: anon leu % domínio(s)', v_rows; end if;
  raise notice 'OK: anon não lê o registro de subdomínios';

  begin
    insert into public.company_domains (company_id, domain) values (gen_random_uuid(), 'qa-hijack.sstek.test');
    raise exception 'FALHOU: anon inseriu domínio';
  exception when insufficient_privilege then
    raise notice 'OK: anon bloqueado no INSERT de company_domains';
  end;

  begin
    delete from public.caepi_catalog_entries where false;
    raise notice 'OK: anon não alcança linhas do CAEPI no DELETE';
  exception when insufficient_privilege then
    raise notice 'OK: anon bloqueado no DELETE do CAEPI';
  end;

  begin
    update public.caepi_catalog_entries set ca = ca where false;
    raise notice 'OK: anon não alcança linhas do CAEPI no UPDATE';
  exception when insufficient_privilege then
    raise notice 'OK: anon bloqueado no UPDATE do CAEPI';
  end;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2. Colaborador da empresa A: isolamento entre empresas
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  select count(*) into v_rows from public.documents where ref in ('qa-doc-a','qa-doc-b');
  if v_rows <> 1 then raise exception 'FALHOU: colaborador A enxergou % documentos (esperado 1)', v_rows; end if;
  raise notice 'OK: colaborador A vê apenas o documento da própria empresa';

  begin
    update public.documents set name = 'invasão' where ref = 'qa-doc-b';
    if found then raise exception 'FALHOU: colaborador A alterou documento da empresa B'; end if;
    raise notice 'OK: colaborador A não altera documento da empresa B (0 linhas)';
  exception when insufficient_privilege then
    raise notice 'OK: colaborador A bloqueado ao alterar documento da empresa B';
  end;

  -- Escrita administrativa continua bloqueada para colaborador
  begin
    update public.documents set name = 'invasão' where ref = 'qa-doc-a';
    if found then raise exception 'FALHOU: colaborador A alterou o conteúdo de um documento'; end if;
    raise notice 'OK: colaborador A não altera conteúdo de documento (somente admin)';
  exception when insufficient_privilege then
    raise notice 'OK: colaborador A bloqueado na escrita de documentos';
  end;

  -- Ação legítima: aceite da própria ficha de EPI
  if (public.epi_acknowledge_delivery('qa-epi-a1', 'assinatura valida')).ok is not true then
    raise exception 'FALHOU: colaborador A não conseguiu assinar a própria ficha de EPI';
  end if;
  raise notice 'OK: colaborador A assinou a própria ficha de EPI';

  -- Ação indevida: aceite da ficha de outro colaborador / de outra empresa
  if (public.epi_acknowledge_delivery('qa-epi-a2', 'assinatura valida')).ok is not false then
    raise exception 'FALHOU: colaborador A assinou a ficha de outro colaborador';
  end if;
  raise notice 'OK: colaborador A não assina ficha de colega';

  if (public.epi_acknowledge_delivery('qa-epi-b1', 'assinatura valida')).ok is not false then
    raise exception 'FALHOU: colaborador A assinou ficha da empresa B';
  end if;
  raise notice 'OK: colaborador A não assina ficha da empresa B';

  -- Ciência do regulamento
  if (public.regulation_acknowledge('qa-reg-a', 1, 'Li e concordo')).ok is not true then
    raise exception 'FALHOU: colaborador A não registrou ciência do regulamento';
  end if;
  raise notice 'OK: colaborador A registrou ciência do regulamento';

  -- CAEPI: consulta global liberada, escrita proibida
  select count(*) into v_rows from public.caepi_active_catalog;
  if v_rows < 1 then raise exception 'FALHOU: catálogo CAEPI não acessível para consulta'; end if;
  raise notice 'OK: colaborador A consulta o catálogo global (% registros)', v_rows;

  begin
    insert into public.caepi_catalog_entries (batch_id, ca, ca_normalized)
    values (gen_random_uuid(), 'qa-hack', 'QA-HACK');
    raise exception 'FALHOU: colaborador A inseriu no CAEPI';
  exception when insufficient_privilege then
    raise notice 'OK: colaborador A bloqueado no INSERT do CAEPI';
  end;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3. Administrador da empresa A: escreve na própria, não na B, não é global
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  update public.documents set notes = 'editado pelo admin A' where ref = 'qa-doc-a';
  if not found then raise exception 'FALHOU: admin A não conseguiu editar documento da própria empresa'; end if;
  raise notice 'OK: admin A edita documento da própria empresa';

  begin
    update public.documents set notes = 'invasão' where ref = 'qa-doc-b';
    if found then raise exception 'FALHOU: admin A alterou documento da empresa B'; end if;
    raise notice 'OK: admin A não alcança dados da empresa B';
  exception when insufficient_privilege then
    raise notice 'OK: admin A bloqueado ao alterar documento da empresa B';
  end;

  begin
    insert into public.platform_admins (auth_user_id, name, email)
    values ('33333333-3333-4333-8333-333333333333', 'Auto promoção', 'qa-admin-a@example.invalid');
    raise exception 'FALHOU: admin empresarial se promoveu a Superadministrador';
  exception when insufficient_privilege then
    raise notice 'OK: admin empresarial bloqueado ao criar vínculo global';
  end;

  begin
    insert into public.caepi_catalog_entries (batch_id, ca, ca_normalized)
    values (gen_random_uuid(), 'qa-hack-2', 'QA-HACK-2');
    raise exception 'FALHOU: admin A inseriu no CAEPI';
  exception when insufficient_privilege then
    raise notice 'OK: admin A bloqueado no INSERT do CAEPI';
  end;

  select count(*) into v_rows from public.company_domains;
  if v_rows <> 1 then raise exception 'FALHOU: admin A viu % domínios (esperado 1)', v_rows; end if;
  raise notice 'OK: admin A vê apenas os domínios da própria empresa';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4. Promoção indevida de papel no próprio perfil
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  begin
    update public.profiles set role = 'super_admin' where auth_user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FALHOU: colaborador elevou o próprio papel';
  exception when check_violation then
    raise notice 'OK: constraint recusa papel super_admin';
  when insufficient_privilege then
    raise notice 'OK: RLS bloqueia alteração do próprio perfil';
  end;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5. Empresa suspensa: perde acesso efetivo no banco
-- ---------------------------------------------------------------------------
update public.companies set status = 'suspended' where subdomain = 'qa-tenant-b';

begin;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_company uuid; v_rows int; v_role text;
begin
  v_company := public.current_company_id();
  if v_company is not null then raise exception 'FALHOU: empresa suspensa ainda resolve contexto'; end if;
  raise notice 'OK: empresa suspensa retorna contexto nulo';

  v_role := public.current_company_role();
  if v_role is not null then raise exception 'FALHOU: papel resolvido com empresa suspensa'; end if;
  raise notice 'OK: papel nulo com empresa suspensa';

  select count(*) into v_rows from public.documents where ref = 'qa-doc-b';
  if v_rows <> 0 then raise exception 'FALHOU: empresa suspensa continua lendo % documento(s)', v_rows; end if;
  raise notice 'OK: empresa suspensa não lê documentos';

  if (public.epi_acknowledge_delivery('qa-epi-b1', 'assinatura valida')).ok is not false then
    raise exception 'FALHOU: empresa suspensa conseguiu assinar ficha';
  end if;
  raise notice 'OK: empresa suspensa não consegue assinar ficha';
end $$;
rollback;

update public.companies set status = 'active' where subdomain = 'qa-tenant-b';

-- ---------------------------------------------------------------------------
-- 6. Catálogo CAEPI permanece íntegro
-- ---------------------------------------------------------------------------
do $$
declare v_total int;
begin
  select count(*) into v_total from public.caepi_active_catalog;
  if v_total <> 42033 then
    raise exception 'FALHOU: catálogo ativo com % registros (esperado 42033)', v_total;
  end if;
  raise notice 'OK: catálogo CAEPI ativo preservado com % registros', v_total;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Limpeza dos registros de teste
-- ---------------------------------------------------------------------------
do $$
declare
  v_company_a uuid;
  v_company_b uuid;
begin
  select id into v_company_a from public.companies where subdomain = 'qa-tenant-a';
  select id into v_company_b from public.companies where subdomain = 'qa-tenant-b';

  delete from public.survey_responses where company_ref in ('qa-tenant-a','qa-tenant-b');
  delete from public.internal_regulation_signatures where company_ref in ('qa-tenant-a','qa-tenant-b');
  delete from public.epi_deliveries where company_ref in ('qa-tenant-a','qa-tenant-b');
  delete from public.documents where company_ref in ('qa-tenant-a','qa-tenant-b');
  delete from public.internal_regulations where company_ref in ('qa-tenant-a','qa-tenant-b');
  delete from public.company_collaborators where company_id in (v_company_a, v_company_b);
  delete from public.company_domains where company_id in (v_company_a, v_company_b);
  delete from public.profiles where email like 'qa-%@example.invalid';
  delete from public.companies where subdomain in ('qa-tenant-a','qa-tenant-b');
  delete from auth.users where email like 'qa-%@example.invalid';

  raise notice 'OK: registros de teste removidos';
end $$;