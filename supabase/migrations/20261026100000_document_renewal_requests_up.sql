-- Solicitações de renovação de documentos persistidas por empresa.
-- Antes viviam apenas no navegador; agora a equipe acompanha de qualquer
-- dispositivo. O objeto completo (tarefas, exames, anexos, histórico) fica no
-- payload jsonb; as colunas denormalizadas existem para relatórios e SLA.

create table if not exists public.document_renewal_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default current_company_id(),
  company_ref text not null default current_company_ref(),
  document_ref text not null,
  document_name text,
  document_type_id text,
  document_type_name text,
  collaborator_name text,
  unit text,
  status text not null default 'aberta',
  owner_name text,
  delegated_from_name text,
  sla_days integer not null default 30,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists document_renewal_requests_company_idx
  on public.document_renewal_requests (company_id, status);

create index if not exists document_renewal_requests_unit_idx
  on public.document_renewal_requests (company_id, unit);

create index if not exists document_renewal_requests_document_idx
  on public.document_renewal_requests (company_id, document_ref);

alter table public.document_renewal_requests enable row level security;

drop policy if exists document_renewal_requests_read on public.document_renewal_requests;
create policy document_renewal_requests_read on public.document_renewal_requests
  for select using (company_id = current_company_id());

drop policy if exists document_renewal_requests_insert on public.document_renewal_requests;
create policy document_renewal_requests_insert on public.document_renewal_requests
  for insert with check (company_id = current_company_id());

drop policy if exists document_renewal_requests_update on public.document_renewal_requests;
create policy document_renewal_requests_update on public.document_renewal_requests
  for update using (company_id = current_company_id())
  with check (company_id = current_company_id());

drop policy if exists document_renewal_requests_delete on public.document_renewal_requests;
create policy document_renewal_requests_delete on public.document_renewal_requests
  for delete using (company_id = current_company_id() and current_company_role() = 'admin');

grant select, insert, update, delete on public.document_renewal_requests to authenticated;

-- Prazo (SLA) de renovação por tipo de documento, em dias.
-- Chave ausente = prazo padrão do sistema (30 dias).
alter table public.system_settings
  add column if not exists document_renewal_sla_days jsonb not null default '{}'::jsonb;