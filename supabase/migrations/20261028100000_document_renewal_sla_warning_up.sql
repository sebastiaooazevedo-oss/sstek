-- Aviso antecipado do prazo (SLA) de renovação de documentos.
--
-- Quantos dias antes da data-limite a tratativa passa a aparecer no sino de
-- notificações e no atalho "Vencendo" da fila. Zero desliga o aviso
-- antecipado (o alerta de SLA estourado continua funcionando normalmente).

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS document_renewal_sla_warning_days integer NOT NULL DEFAULT 3;

ALTER TABLE public.system_settings
  DROP CONSTRAINT IF EXISTS system_settings_renewal_sla_warning_range;

ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_renewal_sla_warning_range
  CHECK (document_renewal_sla_warning_days >= 0 AND document_renewal_sla_warning_days <= 60);

COMMENT ON COLUMN public.system_settings.document_renewal_sla_warning_days IS
  'Dias de antecedência para avisar no sino que o prazo (SLA) da renovação está próximo. Zero desliga o aviso antecipado.';