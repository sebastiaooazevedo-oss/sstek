drop table if exists public.document_renewal_deadline_notifications;

alter table public.system_settings
  drop constraint if exists system_settings_renewal_manager_warning_range;

alter table public.system_settings
  drop column if exists document_renewal_manager_warning_days;