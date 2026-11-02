-- ============================================================================
-- Rollback de 20261018150000_daily_moods_policy_email_helper_up.sql
--
-- Restaura a policy anterior (que consulta auth.users diretamente e falha para
-- o papel `authenticated`). Existia apenas como referência de estado; reaplicar
-- este rollback reintroduz o bug de escrita do humor diário.
-- ============================================================================

begin;

alter policy tenant_write on public.daily_moods
  to authenticated
  using (
    public.is_current_company_name(company)
    and (
      public.current_company_role() = 'admin'
      or lower(user_key) = lower((select u.email from auth.users u where u.id = auth.uid()))
      or user_key = public.current_collaborator_ref()
    )
  )
  with check (
    public.is_current_company_name(company)
    and (
      public.current_company_role() = 'admin'
      or lower(user_key) = lower((select u.email from auth.users u where u.id = auth.uid()))
      or user_key = public.current_collaborator_ref()
    )
  );

drop function if exists public.current_user_email();

commit;