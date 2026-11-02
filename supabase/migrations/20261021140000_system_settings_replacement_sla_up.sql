-- Prazo de atendimento dos pedidos de substituição de EPI, por motivo (em horas).
-- Ex.: {"CA vencido": 24, "Perda": 24, "Dano": 48, "Desgaste": 72}
-- Coluna nula/vazia = usar os prazos padrão do sistema (24h para CA vencido e perda).
alter table public.system_settings
  add column if not exists replacement_sla_hours jsonb;

comment on column public.system_settings.replacement_sla_hours is
  'Prazo de atendimento (horas) dos pedidos de substituição de EPI por motivo. Chave ausente usa o padrão do sistema.';