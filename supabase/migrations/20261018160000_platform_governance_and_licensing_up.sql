-- Governança da plataforma: parametrização por perfil, perfis & permissões,
-- licenças por empresa e cobranças recorrentes.
--
-- Escrita: somente pela edge function `platform-admin` (service role).
-- Leitura: apenas Superadministrador da plataforma (`is_platform_admin()`).

create table if not exists public.platform_settings (
  id integer primary key default 1,
  parameters jsonb not null default jsonb_build_object(),
  role_permissions jsonb not null default jsonb_build_object(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint platform_settings_single_row check (id = 1)
);

alter table public.platform_settings enable row level security;

create policy platform_settings_read on public.platform_settings
  for select to authenticated
  using (public.is_platform_admin());

create table if not exists public.company_licenses (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan text not null default 'S2',
  seats integer not null default 0,
  monthly_value numeric(12,2) not null default 0,
  billing_cycle text not null default 'monthly',
  status text not null default 'active',
  started_at date not null default current_date,
  next_due_date date,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.company_licenses enable row level security;

create policy company_licenses_read on public.company_licenses
  for select to authenticated
  using (public.is_platform_admin());

create table if not exists public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reference_month text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  due_date date not null,
  paid_at timestamptz,
  method text,
  notes text,
  created_at timestamptz not null default now(),
  constraint platform_invoices_unique_month unique (company_id, reference_month)
);

create index if not exists platform_invoices_company_idx on public.platform_invoices (company_id);
create index if not exists platform_invoices_status_idx on public.platform_invoices (status);

alter table public.platform_invoices enable row level security;

create policy platform_invoices_read on public.platform_invoices
  for select to authenticated
  using (public.is_platform_admin());

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

-- Licença inicial derivada do plano já cadastrado em `companies`.
insert into public.company_licenses (company_id, plan, seats, monthly_value, billing_cycle, status, started_at, next_due_date)
select c.id,
       c.plan,
       coalesce((select count(*) from public.company_collaborators cc where cc.company_id = c.id), 0),
       case c.plan when 'S1' then 149.00 when 'S2' then 449.00 when 'S3' then 1290.00 else 449.00 end,
       'monthly',
       case c.status when 'active' then 'active' when 'suspended' then 'suspended' else 'trial' end,
       c.created_at::date,
       (date_trunc('month', current_date) + interval '9 days')::date
from public.companies c
where not exists (select 1 from public.company_licenses l where l.company_id = c.id);

-- Histórico de cobranças (6 competências) para conciliação inicial.
insert into public.platform_invoices (company_id, reference_month, amount, status, due_date, paid_at, method)
select c.id,
       to_char(m.month, 'YYYY-MM'),
       case c.plan when 'S1' then 149.00 when 'S2' then 449.00 when 'S3' then 1290.00 else 449.00 end,
       case
         when m.month = date_trunc('month', current_date) then 'pending'
         when m.month = date_trunc('month', current_date) - interval '1 month' and c.status <> 'active' then 'overdue'
         else 'paid'
       end,
       (m.month + interval '9 days')::date,
       case
         when m.month = date_trunc('month', current_date) then null
         when m.month = date_trunc('month', current_date) - interval '1 month' and c.status <> 'active' then null
         else (m.month + interval '7 days')
       end,
       case
         when m.month = date_trunc('month', current_date) then null
         when m.month = date_trunc('month', current_date) - interval '1 month' and c.status <> 'active' then null
         else 'pix'
       end
from public.companies c
cross join (
  select generate_series(
    date_trunc('month', current_date) - interval '5 months',
    date_trunc('month', current_date),
    interval '1 month'
  ) as month
) m
where not exists (
  select 1 from public.platform_invoices i
  where i.company_id = c.id and i.reference_month = to_char(m.month, 'YYYY-MM')
);