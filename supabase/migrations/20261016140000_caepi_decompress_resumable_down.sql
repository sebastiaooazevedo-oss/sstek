ALTER TABLE public.caepi_import_batches
  DROP COLUMN IF EXISTS source_is_gzip,
  DROP COLUMN IF EXISTS decompress_upload_url,
  DROP COLUMN IF EXISTS decompress_total_bytes,
  DROP COLUMN IF EXISTS decompress_uploaded_bytes;