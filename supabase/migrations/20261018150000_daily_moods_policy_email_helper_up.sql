-- ============================================================================
-- Correção: policy de escrita do humor diário consultava auth.users diretamente
-- Data: 2026-10-18
--
-- Sintoma:
--   Ao registrar o "sentimento do dia" o app exibia apenas
--   "Não foi possível registrar o sentimento agora." O SELECT funcionava
--   (tenant_read não toca em auth.users), mas todo INSERT/UPDATE falhava.
--
-- Causa raiz:
--   A policy `tenant_write` em `public.daily_moods` continha a subconsulta
--   `(select u.email from auth.users u where u.id = auth.uid())`.
--   O papel `authenticated` NÃO tem SELECT em `auth.users` (concedido apenas a
--   postgres/service_role), então a avaliação da policy levantava
--   "permission denied for table users". Como a subconsulta é um InitPlan
--   (não correlacionada com a linha), ela era inicializada antes da avaliação
--   do OR — inclusive para administradores, que passariam pela primeira
--   condição. Resultado: nenhuma escrita era aceita.
--
-- Correção:
--   A identidade passa a vir de `public.current_user_email()`, função
--   SECURITY DEFINER que resolve o e-mail a partir de auth.uid() com os
--   privilégios do owner. A regra de negócio permanece idêntica:
--   admin da empresa OU o próprio e-mail OU o próprio collaborator_ref,
--   sempre dentro da empresa atual (`is_current_company_name`).
--
-- Compatível com reexecução.
-- ============================================================================

begin;

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$fn$;

revoke all on function public.current_user_email() from public;
revoke all on function public.current_user_email() from anon;
grant execute on function public.current_user_email() to authenticated;
grant execute on function public.current_user_email() to service_role;

alter policy tenant_write on public.daily_moods
  to authenticated
  using (
    public.is_current_company_name(company)
    and (
      public.current_company_role() = 'admin'
      or lower(user_key) = public.current_user_email()
      or user_key = public.current_collaborator_ref()
    )
  )
  with check (
    public.is_current_company_name(company)
    and (
      public.current_company_role() = 'admin'
      or lower(user_key) = public.current_user_email()
      or user_key = public.current_collaborator_ref()
    )
  );

commit;