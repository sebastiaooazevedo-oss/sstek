ALTER TABLE public.system_settings
  DROP CONSTRAINT IF EXISTS system_settings_renewal_sla_warning_range;

ALTER TABLE public.system_settings
  DROP COLUMN IF EXISTS document_renewal_sla_warning_days;