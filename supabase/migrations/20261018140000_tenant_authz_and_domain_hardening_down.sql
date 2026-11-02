-- Reversão do hardening de autorização multi-tenant (2026-10-18).
-- ATENÇÃO: ao reverter, `company_domains` volta a ficar exposta ao papel `anon`
-- e os fluxos de aceite de EPI / ciência de regulamento voltam a depender de
-- escrita direta nas tabelas (bloqueada por RLS). Use apenas em rollback.

begin;

drop policy if exists survey_responses_read on public.survey_responses;
drop policy if exists survey_responses_insert on public.survey_responses;

alter policy tenant_write on public.daily_moods
  to authenticated
  using (public.is_current_company_name(company))
  with check (public.is_current_company_name(company));

drop function if exists public.regulation_acknowledge(text, integer, text);
drop function if exists public.epi_acknowledge_delivery(text, text);
drop function if exists public.current_collaborator_ref();

drop policy if exists tenant_domains_read on public.company_domains;
alter table public.company_domains no force row level security;
alter table public.company_domains disable row level security;

commit;