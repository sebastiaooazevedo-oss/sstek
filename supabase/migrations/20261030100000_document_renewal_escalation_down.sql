-- Reversão do escalonamento dos avisos de prazo da renovação.

delete from public.document_renewal_deadline_notifications
where audience = 'escalonamento';

alter table public.document_renewal_deadline_notifications
  drop constraint if exists document_renewal_deadline_audience;

alter table public.document_renewal_deadline_notifications
  add constraint document_renewal_deadline_audience
  check (audience in ('gestor', 'responsavel'));

alter table public.system_settings
  drop constraint if exists system_settings_renewal_escalation_range;

alter table public.system_settings
  drop column if exists document_renewal_escalation_days;