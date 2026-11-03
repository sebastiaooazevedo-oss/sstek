-- Testes do check-in de segurança v2 (colunas novas, reparos e isolamento entre empresas).
\set ON_ERROR_STOP on
begin;
insert into public.companies (id, name, subdomain) values
  ('a0000000-0000-4000-8000-0000000000a1', 'Frota A', 'frota-a'),
  ('b0000000-0000-4000-8000-0000000000b2', 'Frota B', 'frota-b');
insert into public.profiles (company_id, auth_user_id, name, role) values
  ('a0000000-0000-4000-8000-0000000000a1', 'a1111111-1111-4111-8111-111111111111', 'Admin A', 'admin'),
  ('a0000000-0000-4000-8000-0000000000a1', 'a2222222-2222-4222-8222-222222222222', 'Colab A', 'collaborator'),
  ('b0000000-0000-4000-8000-0000000000b2', 'b1111111-1111-4111-8111-111111111111', 'Admin B', 'admin');

-- Check-in com avarias e reparos (como a função de servidor grava)
insert into public.vehicle_checkins (company_id, company_ref, ref, vehicle_ref, kind, status, vehicle_category, plate_confirmed, damages, repair_requests)
values ('a0000000-0000-4000-8000-0000000000a1', 'frota-a', 'ck1', 'v1', 'entrega', 'aberta', 'Leve', true,
        '[{"id":"av-1","zone":"porta_de","type":"risco","severity":"leve"}]', '[{"id":"rp-1","title":"Pintar porta"}]');

do $$ begin
  begin
    insert into public.vehicle_checkins (company_ref, ref, vehicle_ref, kind, status, damages)
    values ('frota-a', 'ck-x', 'v1', 'entrega', 'aberta', '{"nao":"lista"}');
    raise exception 'FALHA: damages precisa ser lista';
  exception when check_violation then null; end;
end $$;

insert into public.vehicle_repair_requests (company_id, company_ref, ref, vehicle_ref, checkin_ref, damage_id, title, photos)
values ('a0000000-0000-4000-8000-0000000000a1', 'frota-a', 'rp1', 'v1', 'ck1', 'av-1', 'Pintar porta', '["frota-a/veiculos/x.jpg"]'),
       ('b0000000-0000-4000-8000-0000000000b2', 'frota-b', 'rp1', 'v9', 'ck9', null, 'Trocar pneu', '["frota-b/veiculos/y.jpg"]');

do $$ begin
  begin
    insert into public.vehicle_repair_requests (company_id, company_ref, ref, vehicle_ref, checkin_ref, title, photos)
    values ('a0000000-0000-4000-8000-0000000000a1', 'frota-a', 'rp2', 'v1', 'ck1', 'Sem foto', '[]');
    raise exception 'FALHA: reparo sem foto foi aceito';
  exception when check_violation then null; end;
  begin
    update public.vehicle_repair_requests set status = 'concluida' where ref = 'rp1' and company_ref = 'frota-a';
    raise exception 'FALHA: concluir sem resolução foi aceito';
  exception when check_violation then null; end;
end $$;

-- Admin A vê só os reparos da empresa A e não consegue gravar direto
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
do $$ begin
  assert (select count(*) from public.vehicle_repair_requests) = 1, 'Admin A deveria ver 1 reparo';
  assert (select company_ref from public.vehicle_repair_requests) = 'frota-a', 'Admin A viu reparo de outra empresa';
  begin
    update public.vehicle_repair_requests set title = 'invasão' where ref = 'rp1';
    raise exception 'FALHA: usuário gravou direto na tabela';
  exception when insufficient_privilege then null; end;
end $$;

-- Colaborador não lê o painel de reparos
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
do $$ begin
  assert (select count(*) from public.vehicle_repair_requests) = 0, 'Colaborador não deveria ver reparos';
end $$;
reset role;

-- Visitante sem login não lê nada
set local role anon;
do $$ begin
  begin
    perform 1 from public.vehicle_repair_requests;
    raise exception 'FALHA: anon leu a tabela';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'OK: check-in de segurança v2'
