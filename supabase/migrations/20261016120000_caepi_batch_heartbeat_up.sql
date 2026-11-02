-- Adiciona o batimento (heartbeat) do processamento da base do CAEPI.
-- A função caepi-import atualiza essa coluna a cada fatia processada. Assim, um lote
-- que ficou em "processing" com o batimento antigo é reconhecido como órfão (a função
-- foi interrompida por limite de tempo) e pode ser encerrado automaticamente, em vez de
-- ficar travado para sempre sem mensagem de erro.
ALTER TABLE public.caepi_import_batches
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamp with time zone NOT NULL DEFAULT now();