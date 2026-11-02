-- Reversão: avisos de vencimento de documentos (gestor, PDF e resumo semanal).

drop policy if exists document_expiry_notifications_update on public.document_expiry_notifications;

alter table public.document_expiry_notifications
  drop constraint if exists document_expiry_notifications_unique;

alter table public.document_expiry_notifications
  add constraint document_expiry_notifications_unique unique (document_ref, expires_at);

alter table public.document_expiry_notifications
  drop column if exists recipient;

alter table public.document_expiry_alert_settings
  drop column if exists weekly_last_sent_at,
  drop column if exists weekly_weekday,
  drop column if exists weekly_summary,
  drop column if exists attach_pdf,
  drop column if exists notify_managers;