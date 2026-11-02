-- Alerta de tratativa paralisada.
--
-- A partir de quantos dias sem nenhuma movimentação (tarefa concluída, e-mail
-- enviado, anexo recebido, delegação...) a solicitação de renovação passa a
-- aparecer como parada no sino de notificações e na fila de tratativas.

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS document_renewal_idle_days integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.system_settings.document_renewal_idle_days IS
  'Dias sem movimentação para uma solicitação de renovação ser sinalizada como parada (sino e fila de tratativas).';