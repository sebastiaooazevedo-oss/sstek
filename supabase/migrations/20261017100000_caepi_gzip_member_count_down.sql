-- Reverte a coluna de contagem de membros gzip.
ALTER TABLE caepi_import_batches
  DROP COLUMN IF EXISTS gzip_member_count;