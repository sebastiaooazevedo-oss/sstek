-- Reversão do administrador principal da empresa.
drop trigger if exists profiles_guard_primary_admin_trg on public.profiles;
drop function if exists public.profiles_guard_primary_admin();
drop index if exists public.profiles_one_primary_admin_per_company_idx;
alter table public.profiles drop column if exists is_primary_admin;