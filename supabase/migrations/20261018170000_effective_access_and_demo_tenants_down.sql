-- Reversão: remove os tenants de demonstração e a função de acesso efetivo.
-- Empresas, domínios, licenças, cobranças e colaboradores de demonstração saem
-- em cascata a partir de `companies`.

delete from public.platform_audit_logs
where action = 'company_created'
  and detail ->> 'source' = 'seed_demo';

delete from public.companies
where subdomain in ('logprime', 'horizonte', 'bemviver', 'andrade');

drop function if exists public.tenant_effective_access();