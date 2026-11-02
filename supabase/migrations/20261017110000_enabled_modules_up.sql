-- Módulos contratados por empresa. Cada chave do JSON representa um módulo
-- (ex.: "cipa") e o valor indica se ele está habilitado. A ausência da chave
-- significa módulo habilitado, mantendo o comportamento atual (tudo ativo).
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb NOT NULL DEFAULT jsonb_build_object();

COMMENT ON COLUMN system_settings.enabled_modules IS
  'Mapa de módulos habilitados por empresa. Chave ausente = módulo habilitado.';