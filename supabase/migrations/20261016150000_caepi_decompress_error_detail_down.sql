ALTER TABLE public.caepi_import_batches
  DROP COLUMN IF EXISTS decompress_error_code,
  DROP COLUMN IF EXISTS decompress_error_offset,
  DROP COLUMN IF EXISTS decompress_error_bytes_out;