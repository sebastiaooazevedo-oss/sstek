-- Empresas de demonstração + acesso efetivo do perfil logado.
--
-- 1) `tenant_effective_access()` devolve, para o usuário autenticado, o perfil
--    (`admin`/`colaborador`) e a matriz de permissões salva pela plataforma.
--    A função é SECURITY DEFINER porque `platform_settings` só é legível por
--    Superadministrador; o perfil é sempre resolvido por `auth.uid()`, nunca
--    por dado enviado pelo navegador.
-- 2) Quatro tenants de demonstração para popular licenças e cobranças, criados
--    com a mesma estrutura usada pela tela "Empresas" (empresa, domínio,
--    licença, colaboradores e 6 competências de cobrança).

create or replace function public.tenant_effective_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_key text;
  v_permissions jsonb;
  v_parameters jsonb;
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if auth.uid() is null then
    return jsonb_build_object('role', null::text, 'permissions', jsonb_build_object(), 'parameters', jsonb_build_object());
  end if;

  select case when p.role = 'admin' then 'admin' else 'colaborador' end
    into v_profile_key
  from public.profiles p
  where p.status = 'active'
    and p.company_id is not null
    and (
      p.auth_user_id = auth.uid()
      or (p.auth_user_id is null and v_email <> '' and lower(btrim(p.email)) = v_email)
    )
  order by p.created_at
  limit 1;

  if v_profile_key is null then
    return jsonb_build_object('role', null::text, 'permissions', jsonb_build_object(), 'parameters', jsonb_build_object());
  end if;

  select ps.role_permissions -> v_profile_key,
         ps.parameters -> 'profiles' -> v_profile_key
    into v_permissions, v_parameters
  from public.platform_settings ps
  where ps.id = 1;

  return jsonb_build_object(
    'role', v_profile_key,
    'permissions', coalesce(v_permissions, jsonb_build_object()),
    'parameters', coalesce(v_parameters, jsonb_build_object())
  );
end;
$$;

revoke all on function public.tenant_effective_access() from public;
grant execute on function public.tenant_effective_access() to authenticated;

-- ------------------------------------------------------------------ --
-- Empresas de demonstração                                            --
-- ------------------------------------------------------------------ --

insert into public.companies (name, legal_name, cnpj, subdomain, plan, status, notes, created_at, updated_at)
select v.name, v.legal_name, v.cnpj, v.subdomain, v.plan, v.status, v.notes,
       now() - (v.months || ' months')::interval, now()
from (values
  ('LogPrime Transportes', 'LogPrime Transportes e Logística Ltda.', '12.345.678/0001-20', 'logprime', 'S3', 'active', 'Empresa de demonstração — contrato S3 sob consulta, frota e centros de distribuição.', 14),
  ('Construtora Horizonte', 'Horizonte Engenharia e Construções S.A.', '23.456.789/0001-31', 'horizonte', 'S2', 'active', 'Empresa de demonstração — obras e canteiros com equipe de campo.', 8),
  ('Alimentos BemViver', 'BemViver Indústria de Alimentos Ltda.', '34.567.890/0001-42', 'bemviver', 'S1', 'active', 'Empresa de demonstração — indústria alimentícia, plano de entrada.', 5),
  ('Química Andrade', 'Andrade Química do Brasil Ltda.', '45.678.901/0001-53', 'andrade', 'S2', 'trial', 'Empresa de demonstração em período de teste do plano S2.', 2)
) as v(name, legal_name, cnpj, subdomain, plan, status, notes, months)
where not exists (select 1 from public.companies c where c.subdomain = v.subdomain);

insert into public.company_domains (company_id, domain, kind, is_primary, dns_status, https_status, notes)
select c.id, c.subdomain || '.sstek.com', 'subdomain', true, 'verified', 'verified', 'Domínio de demonstração já propagado.'
from public.companies c
where c.subdomain in ('logprime', 'horizonte', 'bemviver', 'andrade')
  and not exists (select 1 from public.company_domains d where d.domain = c.subdomain || '.sstek.com');

insert into public.company_licenses (company_id, plan, seats, monthly_value, billing_cycle, status, started_at, next_due_date, notes)
select c.id,
       c.plan,
       case c.plan when 'S1' then 10 when 'S2' then 60 else 250 end,
       case c.plan when 'S1' then 149.00 when 'S2' then 449.00 else 1290.00 end,
       'monthly',
       case c.status when 'trial' then 'trial' when 'suspended' then 'suspended' else 'active' end,
       c.created_at::date,
       (date_trunc('month', current_date) + interval '9 days')::date,
       'Contrato de demonstração criado junto ao cadastro da empresa.'
from public.companies c
where c.subdomain in ('logprime', 'horizonte', 'bemviver', 'andrade')
  and not exists (select 1 from public.company_licenses l where l.company_id = c.id);

insert into public.platform_invoices (company_id, reference_month, amount, status, due_date, paid_at, method, notes)
select c.id,
       to_char(m.month, 'YYYY-MM'),
       case c.plan when 'S1' then 149.00 when 'S2' then 449.00 else 1290.00 end,
       case
         when m.month = date_trunc('month', current_date) then 'pending'
         when c.subdomain = 'bemviver' and m.month = date_trunc('month', current_date) - interval '1 month' then 'overdue'
         else 'paid'
       end,
       (m.month + interval '9 days')::date,
       case
         when m.month = date_trunc('month', current_date) then null
         when c.subdomain = 'bemviver' and m.month = date_trunc('month', current_date) - interval '1 month' then null
         else m.month + interval '7 days'
       end,
       case
         when m.month = date_trunc('month', current_date) then null
         when c.subdomain = 'bemviver' and m.month = date_trunc('month', current_date) - interval '1 month' then null
         else 'pix'
       end,
       'Cobrança de demonstração.'
from public.companies c
cross join (
  select generate_series(
    date_trunc('month', current_date) - interval '5 months',
    date_trunc('month', current_date),
    interval '1 month'
  ) as month
) m
where c.subdomain in ('logprime', 'horizonte', 'bemviver', 'andrade')
  and not exists (
    select 1 from public.platform_invoices i
    where i.company_id = c.id and i.reference_month = to_char(m.month, 'YYYY-MM')
  );

insert into public.company_collaborators (company_id, ref, name, cpf, role_function, area, status, active)
select c.id, v.ref, v.name, v.cpf, v.role_function, v.area, 'Ativo', true
from public.companies c
join (values
  ('logprime', 'LP-0001', 'Ana Paula Ribeiro', '301.114.220-11', 'Motorista', 'Logística'),
  ('logprime', 'LP-0002', 'Marcos Vinícius Alves', '301.114.220-22', 'Motorista', 'Logística'),
  ('logprime', 'LP-0003', 'Fernanda Souza Lima', '301.114.220-33', 'Analista de Tráfego', 'Operações'),
  ('logprime', 'LP-0004', 'Gilberto Nunes', '301.114.220-44', 'Mecânico', 'Manutenção'),
  ('logprime', 'LP-0005', 'Tatiane Moraes', '301.114.220-55', 'Auxiliar Administrativo', 'Administrativo'),
  ('horizonte', 'CH-0001', 'Rafael Teixeira', '302.225.331-11', 'Encarregado de Obra', 'Produção'),
  ('horizonte', 'CH-0002', 'Bruno Cardoso', '302.225.331-22', 'Pedreiro', 'Produção'),
  ('horizonte', 'CH-0003', 'Simone Barreto', '302.225.331-33', 'Técnica de Segurança', 'SESMT'),
  ('horizonte', 'CH-0004', 'Douglas Prado', '302.225.331-44', 'Operador de Guindaste', 'Produção'),
  ('bemviver', 'BV-0001', 'Carla Menezes', '303.336.442-11', 'Operadora de Produção', 'Produção'),
  ('bemviver', 'BV-0002', 'Elias Fontes', '303.336.442-22', 'Auxiliar de Qualidade', 'Qualidade'),
  ('bemviver', 'BV-0003', 'Rosana Duarte', '303.336.442-33', 'Encarregada de Linha', 'Produção'),
  ('andrade', 'QA-0001', 'Henrique Vasques', '304.447.553-11', 'Operador Químico', 'Produção'),
  ('andrade', 'QA-0002', 'Priscila Andrade', '304.447.553-22', 'Analista de Laboratório', 'Qualidade'),
  ('andrade', 'QA-0003', 'Lucas Bittencourt', '304.447.553-33', 'Técnico de Manutenção', 'Manutenção'),
  ('andrade', 'QA-0004', 'Márcia Rezende', '304.447.553-44', 'Coordenadora de SESMT', 'SESMT')
) as v(subdomain, ref, name, cpf, role_function, area) on v.subdomain = c.subdomain
where not exists (
  select 1 from public.company_collaborators cc where cc.company_id = c.id and cc.ref = v.ref
);

insert into public.platform_audit_logs (actor_auth_id, actor_name, actor_email, action, target_company_id, target_company_name, detail)
select pa.auth_user_id, pa.name, pa.email, 'company_created', c.id, c.name,
       jsonb_build_object('source', 'seed_demo', 'subdomain', c.subdomain, 'plan', c.plan)
from public.companies c
join public.platform_admins pa on pa.status = 'active'
where c.subdomain in ('logprime', 'horizonte', 'bemviver', 'andrade')
  and not exists (
    select 1 from public.platform_audit_logs l
    where l.target_company_id = c.id and l.action = 'company_created' and l.detail ->> 'source' = 'seed_demo'
  );