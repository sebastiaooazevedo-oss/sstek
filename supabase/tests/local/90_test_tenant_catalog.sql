-- Testes do catálogo de empresas, executados como usuários reais (papel authenticated/anon).
\set ON_ERROR_STOP on
begin;
insert into public.companies (id, name, subdomain) values
  ('a0000000-0000-4000-8000-000000000001', 'Empresa A', 'empresa-a'),
  ('b0000000-0000-4000-8000-000000000002', 'Empresa B', 'empresa-b');
update public.companies set enabled_modules = '{"cipa": false}' where subdomain = 'empresa-a';
insert into public.profiles (company_id, auth_user_id, name, role) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Admin A', 'admin'),
  ('b0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Admin B', 'admin');
insert into public.system_settings (id, enabled_modules) values (1, '{"veiculos": false}')
  on conflict (id) do update set enabled_modules = excluded.enabled_modules;
insert into public.company_domains (company_id, domain, kind, dns_status) values
  ('b0000000-0000-4000-8000-000000000002', 'sst.empresab.com.br', 'custom', 'verified'),
  ('a0000000-0000-4000-8000-000000000001', 'sst.pendente.com.br', 'custom', 'pending');

-- Usuário da empresa A
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ declare m jsonb := public.platform_enabled_modules(); begin
  assert m = '{"cipa": false, "veiculos": false}'::jsonb, 'A: módulos efetivos errados: ' || m::text;
  assert public.company_module_enabled('cipa') = false, 'A: CIPA deveria estar desligada';
  assert public.company_module_enabled('dds') = true, 'A: DDS deveria estar ligado (ausência = ligado)';
  assert public.company_module_enabled('veiculos') = false, 'A: desligado na plataforma vale para todos';
end $$;

-- Usuário da empresa B não herda o desligamento da empresa A
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  assert public.platform_enabled_modules() = '{"veiculos": false}'::jsonb, 'B: não pode herdar módulos de A';
  assert public.company_module_enabled('cipa') = true, 'B: CIPA ligada';
end $$;
reset role;

-- Empresa que liga um módulo desligado na plataforma continua desligada (plataforma manda)
update public.companies set enabled_modules = '{"veiculos": true}' where subdomain = 'empresa-b';
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  assert public.company_module_enabled('veiculos') = false, 'B: chave global desligada deve prevalecer';
end $$;
reset role;

-- Visitante anônimo resolve a empresa pelo endereço, mas não lê módulos
set local role anon;
do $$ declare r record; begin
  select * into r from public.resolve_tenant_address('EMPRESA-A', null);
  assert r.name = 'Empresa A' and r.data_plane = 'shared', 'resolução por subdomínio';
  select * into r from public.resolve_tenant_address(null, 'SST.EmpresaB.com.br');
  assert r.subdomain = 'empresa-b', 'resolução por domínio próprio verificado';
  select * into r from public.resolve_tenant_address(null, 'sst.pendente.com.br');
  assert r.id is null, 'domínio pendente não pode resolver';
  select * into r from public.resolve_tenant_address('nao-existe', null);
  assert r.id is null, 'subdomínio inexistente';
end $$;
do $$ begin
  perform public.platform_enabled_modules();
  raise exception 'anon não deveria executar platform_enabled_modules';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Regras de integridade do catálogo
do $$ begin
  update public.companies set data_plane = 'dedicated' where subdomain = 'empresa-a';
  raise exception 'dedicado sem URL deveria falhar';
exception when check_violation then null; end $$;
update public.companies set data_plane = 'dedicated', dedicated_api_url = 'https://abc.supabase.co' where subdomain = 'empresa-a';
do $$ begin
  update public.companies set enabled_modules = '["cipa"]' where subdomain = 'empresa-a';
  raise exception 'módulos precisam ser objeto';
exception when check_violation then null; end $$;

rollback;
\echo 'OK: catálogo de empresas — todos os testes passaram'
