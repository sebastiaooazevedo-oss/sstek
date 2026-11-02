-- Reverte a parametrização de módulos habilitados por empresa.
ALTER TABLE system_settings
  DROP COLUMN IF EXISTS enabled_modules;