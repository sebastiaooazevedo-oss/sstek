-- Avisos de vencimento de documentos: gestor/líder, PDF por unidade e resumo semanal.
--
-- 1) document_expiry_alert_settings ganha as chaves que ligam/desligam cada
--    serviço complementar (aviso ao gestor, anexo em PDF e resumo semanal).
-- 2) document_expiry_notifications passa a registrar o destinatário, para que
--    o mesmo documento possa ser avisado uma vez para o SESMT e outra vez para
--    o gestor responsável, sem duplicar para o mesmo destinatário.

alter table public.document_expiry_alert_settings
  add column if not exists notify_managers boolean not null default true,
  add column if not exists attach_pdf boolean not null default false,
  add column if not exists weekly_summary boolean not null default false,
  add column if not exists weekly_weekday integer not null default 1,
  add column if not exists weekly_last_sent_at timestamptz;

alter table public.document_expiry_notifications
  add column if not exists recipient text not null default '';

alter table public.document_expiry_notifications
  drop constraint if exists document_expiry_notifications_unique;

alter table public.document_expiry_notifications
  add constraint document_expiry_notifications_unique unique (document_ref, expires_at, recipient);

-- O upsert do controle de avisos passa a atualizar registros existentes.
drop policy if exists document_expiry_notifications_update on public.document_expiry_notifications;
create policy document_expiry_notifications_update on public.document_expiry_notifications
  for update using (company_id = current_company_id())
  with check (company_id = current_company_id());