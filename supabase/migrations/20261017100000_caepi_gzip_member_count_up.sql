-- Registra quantos membros gzip concatenados foram encontrados na descompactação da base
-- oficial do CAEPI. Como os relatórios oficiais são gzip com múltiplos membros, guardar essa
-- contagem permite conferir se a leitura percorreu todos os membros do arquivo.
ALTER TABLE caepi_import_batches
  ADD COLUMN IF NOT EXISTS gzip_member_count integer;