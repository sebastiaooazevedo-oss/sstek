-- Escalonamento dos avisos de prazo da renovação de documentos.
--
-- 1) `document_renewal_escalation_days`: quantos dias depois de um aviso de
--    prazo, SEM nenhuma movimentação na tratativa, o gestor é avisado
--    novamente. Zero desliga o escalonamento.
-- 2) O público do controle de e-mails passa a aceitar `escalonamento`, para que
--    o reaviso ao gestor não seja confundido (nem bloqueado) pelo aviso
--    original do mesmo público.

alter table public.system_settings
  add column if not exists document_renewal_escalation_days integer not null default 5;

alter table public.system_settings
  drop constraint if exists system_settings_renewal_escalation_range;

alter table public.system_settings
  add constraint system_settings_renewal_escalation_range
  check (
    document_renewal_escalation_days >= 0
    and document_renewal_escalation_days <= 60
  );

comment on column public.system_settings.document_renewal_escalation_days is
  'Dias após um aviso de prazo, sem movimentação na tratativa, para reavisar o gestor (escalonamento). Zero desliga.';

alter table public.document_renewal_deadline_notifications
  drop constraint if exists document_renewal_deadline_audience;

alter table public.document_renewal_deadline_notifications
  add constraint document_renewal_deadline_audience
  check (audience in ('gestor', 'responsavel', 'escalonamento'));

comment on column public.document_renewal_deadline_notifications.audience is
  'Público do aviso: gestor, responsavel (da tratativa) ou escalonamento (reaviso ao gestor por falta de movimentação).';