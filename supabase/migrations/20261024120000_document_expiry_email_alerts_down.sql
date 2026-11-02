-- Reverte o aviso de vencimento de documentos por e-mail.

drop table if exists public.document_expiry_notifications;
drop table if exists public.document_expiry_alert_settings;