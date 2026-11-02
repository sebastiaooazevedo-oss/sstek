-- Descompactação RETOMÁVEL da base do CAEPI (upload resumável no Storage).
--
-- A gravação do ".csv" descompactado no Storage era feita como UMA ÚNICA requisição de
-- streaming do arquivo inteiro. Para arquivos grandes isso quebrava no meio com
-- "http2 error: stream error sent by user: unexpected internal error encountered".
-- Agora o ".csv" descompactado é enviado em BLOCOS de 6 MB via TUS (upload resumável do
-- Supabase Storage), retomável: se uma rodada não concluir, a próxima continua do byte
-- exato onde parou (Upload-Offset). Estas colunas guardam esse estado:
--   source_is_gzip              -> o arquivo enviado é .gz e precisa ser descompactado.
--   decompress_upload_url       -> endereço da sessão de upload resumável (TUS) em andamento.
--   decompress_total_bytes      -> tamanho total do ".csv" descompactado (Upload-Length do TUS).
--   decompress_uploaded_bytes   -> quantos bytes do ".csv" já foram enviados (progresso).
ALTER TABLE public.caepi_import_batches
  ADD COLUMN IF NOT EXISTS source_is_gzip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decompress_upload_url text,
  ADD COLUMN IF NOT EXISTS decompress_total_bytes bigint,
  ADD COLUMN IF NOT EXISTS decompress_uploaded_bytes bigint NOT NULL DEFAULT 0;