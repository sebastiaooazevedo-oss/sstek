-- Foto do EPI antigo devolvido no atendimento da substituição.
-- Guardada no próprio pedido para compor o dossiê anexado em Documentos
-- (foto do equipamento devolvido + nova Ficha de EPI + histórico do pedido).
alter table public.epi_replacement_requests
  add column if not exists return_photo text;

comment on column public.epi_replacement_requests.return_photo is
  'Foto (data URL) do EPI antigo devolvido pelo colaborador no atendimento da substituição.';