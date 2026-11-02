-- Detalhe do erro na fase de DESCOMPACTAÇÃO da base do CAEPI.
--
-- O zlib do Node no runtime do Deno lançava um erro genérico ("Zlib error"), SEM o código
-- zlib (Z_DATA_ERROR, Z_BUF_ERROR etc.) e SEM indicar em que ponto do arquivo falhou, o que
-- impedia diagnosticar a causa. Estas colunas guardam o detalhe real da falha capturado pelo
-- descompactador, para saber se o problema é no início ou mais pra frente do arquivo:
--   decompress_error_code       -> código/identificador do erro de descompactação (quando houver).
--   decompress_error_offset     -> quantos bytes COMPACTADOS foram consumidos antes de falhar.
--   decompress_error_bytes_out  -> quantos bytes DESCOMPACTADOS já tinham sido produzidos.
ALTER TABLE public.caepi_import_batches
  ADD COLUMN IF NOT EXISTS decompress_error_code text,
  ADD COLUMN IF NOT EXISTS decompress_error_offset bigint,
  ADD COLUMN IF NOT EXISTS decompress_error_bytes_out bigint;