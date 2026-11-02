-- Fase 4.73 — Superadministrador da plataforma e base central CAEPI
-- Executado no Supabase em 2026-10-18. Idempotente e aditivo.
-- Não remove nenhuma estrutura ou registro existente e não altera a base ativa do CAEPI.

-- 1. Empresas (tenant) -----------------------------------------------------------------
alter table public.companies add column if not exists plan text not null default 'S2';
alter table public.companies add column if not exists suspended_at timestamptz;
alter table public.companies add column if not exists suspension_reason text;
alter table public.companies add column if not exists notes text;
alter table public.companies add column if not exists created_by uuid;
alter table public.companies add column if not exists updated_at timestamptz not null default now();
create unique index if not exists companies_subdomain_lower_key on public.companies (lower(subdomain));

-- 2. Domínios / subdomínios ------------------------------------------------------------
create table if not exists public.company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  domain text not null,
  kind text not null default 'subdomain',
  is_primary boolean not null default false,
  dns_status text not null default 'pending',
  https_status text not null default 'pending',
  dns_checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists company_domains_domain_lower_key on public.company_domains (lower(domain));
create index if not exists company_domains_company_idx on public.company_domains (company_id);

insert into public.company_domains (company_id, domain, kind, is_primary, dns_status, https_status, notes)
select c.id, lower(c.subdomain) || '.sstek.com', 'subdomain', true, 'pending', 'pending',
       'Registro criado a partir do subdomínio atual. A configuração real de DNS/HTTPS é externa.'
from public.companies c
where not exists (
  select 1 from public.company_domains d where lower(d.domain) = lower(c.subdomain) || '.sstek.com'
);

-- 3. Superadministradores da plataforma ------------------------------------------------
create table if not exists public.platform_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  status text not null default 'active',
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy platform_admins_self_read on public.platform_admins
  for select to authenticated using (auth_user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where auth_user_id = auth.uid() and status = 'active'
  );
$$;
grant execute on function public.is_platform_admin() to authenticated, anon;

-- 4. Auditoria administrativa append-only ----------------------------------------------
create table if not exists public.platform_audit_logs (
  id bigserial primary key,
  actor_auth_id uuid,
  actor_name text,
  actor_email text,
  action text not null,
  target_company_id uuid,
  target_company_name text,
  target_user_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.platform_audit_logs enable row level security;
create policy platform_audit_read on public.platform_audit_logs
  for select to authenticated using (public.is_platform_admin());
create policy platform_audit_insert on public.platform_audit_logs
  for insert to authenticated with check (public.is_platform_admin());
create index if not exists platform_audit_created_idx on public.platform_audit_logs (created_at desc);
create index if not exists platform_audit_company_idx on public.platform_audit_logs (target_company_id);

create or replace function public.platform_audit_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'A trilha de auditoria da plataforma e append-only: alteracao e exclusao proibidas.';
end;
$$;
create or replace trigger platform_audit_no_change before update or delete on public.platform_audit_logs
  for each row execute function public.platform_audit_block_change();

-- 5. Resolução de tenant (identifica, não autoriza) ------------------------------------
create or replace function public.resolve_tenant(p_subdomain text)
returns table(id uuid, name text, subdomain text, status text)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, c.subdomain, c.status
  from public.companies c
  where lower(c.subdomain) = lower(btrim(p_subdomain))
  limit 1;
$$;
grant execute on function public.resolve_tenant(text) to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create or replace trigger companies_touch_updated_at before update on public.companies
  for each row execute function public.touch_updated_at();

-- 6. Papéis do vínculo empresarial (sem Superadministrador) ----------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'collaborator'));
  end if;
end $$;

-- 7. Catálogo CAEPI: leitura global, escrita apenas no backend --------------------------
alter policy caepi_catalog_entries_all on public.caepi_catalog_entries using (true) with check (false);
alter policy caepi_import_batches_all on public.caepi_import_batches using (true) with check (false);
alter policy caepi_import_logs_all on public.caepi_import_logs using (true) with check (false);
alter policy caepi_import_errors_all on public.caepi_import_errors using (true) with check (false);

create or replace function public.caepi_activate_batch(p_batch_id uuid)
returns table(activated_id uuid, records integer, previous_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
  v_previous uuid;
begin
  select count(*) into v_count from public.caepi_catalog_entries where batch_id = p_batch_id;
  if v_count = 0 then
    raise exception 'BATCH_EMPTY: o lote nao tem registros gravados; a base ativa anterior foi mantida.';
  end if;
  if not exists (select 1 from public.caepi_import_batches where id = p_batch_id and status = 'completed') then
    raise exception 'BATCH_NOT_COMPLETED: apenas lotes concluidos e validados podem ser ativados.';
  end if;
  select id into v_previous from public.caepi_import_batches where is_active and id <> p_batch_id limit 1;
  update public.caepi_import_batches set is_active = false where is_active and id <> p_batch_id;
  update public.caepi_import_batches set is_active = true where id = p_batch_id;
  return query select p_batch_id, v_count, v_previous;
end;
$$;
revoke all on function public.caepi_activate_batch(uuid) from public;
revoke all on function public.caepi_activate_batch(uuid) from anon;
revoke all on function public.caepi_activate_batch(uuid) from authenticated;