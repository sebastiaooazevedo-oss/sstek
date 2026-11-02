-- Reversão da Fase 4.73 (Superadministrador da plataforma e base central CAEPI).
-- ATENÇÃO: reverter remove o vínculo de Superadministrador e os domínios cadastrados.
-- A base do CAEPI permanece intacta. A leitura/escrita do catálogo volta às policies
-- anteriores apenas se você recriá-las manualmente (este DOWN não recria policy permissiva).

-- 1. Devolve a escrita do catálogo ao comportamento anterior apenas se desejar:
--    (deliberadamente omitido — recriar policy permissiva é um risco de segurança)

drop function if exists public.caepi_activate_batch(uuid);

alter policy caepi_catalog_entries_all on public.caepi_catalog_entries using (true) with check (true);
alter policy caepi_import_batches_all on public.caepi_import_batches using (true) with check (true);
alter policy caepi_import_logs_all on public.caepi_import_logs using (true) with check (true);
alter policy caepi_import_errors_all on public.caepi_import_errors using (true) with check (true);

alter table public.profiles drop constraint if exists profiles_role_check;

drop function if exists public.resolve_tenant(text);
drop function if exists public.is_platform_admin();
drop trigger if exists platform_audit_no_change on public.platform_audit_logs;
drop function if exists public.platform_audit_block_change();
drop table if exists public.platform_audit_logs;
drop table if exists public.platform_admins;

drop trigger if exists companies_touch_updated_at on public.companies;
drop function if exists public.touch_updated_at();

drop table if exists public.company_domains;
drop index if exists public.companies_subdomain_lower_key;
alter table public.companies drop column if exists plan;
alter table public.companies drop column if exists suspended_at;
alter table public.companies drop column if exists suspension_reason;
alter table public.companies drop column if exists notes;
alter table public.companies drop column if exists created_by;
alter table public.companies drop column if exists updated_at;