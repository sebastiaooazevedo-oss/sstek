-- ============================================================================
-- Pedidos de substituição de EPI
--
-- Fluxo:
--   * Administrador abre o pedido direto da linha do colaborador com CA vencido
--     (equipamento pré-preenchido) ou o próprio colaborador solicita a troca no
--     portal.
--   * Todo pedido exige foto do EPI (registro fotográfico obrigatório).
--   * Motivo "Perda" exige o registro de perda (data, local e descrição).
--
-- Leitura: membros da empresa; colaborador vê apenas os próprios pedidos.
-- Escrita: administrador da empresa ou o próprio colaborador (novo pedido).
-- Atualização de situação: somente administrador.
-- ============================================================================

create table if not exists public.epi_replacement_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_ref text not null,
  ref text not null,
  collaborator_ref text,
  collaborator_name text not null,
  collaborator_role text,
  area text,
  establishment text,
  epi_name text not null,
  ca text,
  validity text,
  reason text not null,
  loss_detail text,
  photo text not null,
  notes text,
  status text not null default 'Pendente',
  origin text not null default 'admin',
  requested_by text,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint epi_replacement_unique unique (company_ref, ref),
  constraint epi_replacement_status_check
    check (status in ('Pendente', 'Em andamento', 'Concluída', 'Recusada')),
  constraint epi_replacement_origin_check
    check (origin in ('admin', 'colaborador')),
  constraint epi_replacement_photo_check
    check (length(btrim(photo)) > 20),
  constraint epi_replacement_loss_check
    check (reason <> 'Perda' or (loss_detail is not null and length(btrim(loss_detail)) >= 10))
);

create index if not exists epi_replacement_company_idx
  on public.epi_replacement_requests (company_ref, created_at desc);

create index if not exists epi_replacement_status_idx
  on public.epi_replacement_requests (company_ref, status);

create index if not exists epi_replacement_collaborator_idx
  on public.epi_replacement_requests (company_ref, collaborator_ref);

create or replace function public.touch_epi_replacement_request()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists epi_replacement_touch on public.epi_replacement_requests;
create trigger epi_replacement_touch
  before update on public.epi_replacement_requests
  for each row
  execute function public.touch_epi_replacement_request();

alter table public.epi_replacement_requests enable row level security;

drop policy if exists epi_replacement_read on public.epi_replacement_requests;
drop policy if exists epi_replacement_insert on public.epi_replacement_requests;
drop policy if exists epi_replacement_update on public.epi_replacement_requests;
drop policy if exists epi_replacement_delete on public.epi_replacement_requests;

-- Leitura: administrador vê todos os pedidos da empresa; colaborador vê os seus.
create policy epi_replacement_read on public.epi_replacement_requests
  for select to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and (
      public.current_company_role() = 'admin'
      or (collaborator_ref is not null and collaborator_ref = public.current_collaborator_ref())
    )
  );

-- Abertura: administrador em nome de qualquer colaborador; colaborador só em seu nome.
create policy epi_replacement_insert on public.epi_replacement_requests
  for insert to authenticated
  with check (
    public.is_current_company_ref(company_ref)
    and public.current_company_id() is not null
    and (
      public.current_company_role() = 'admin'
      or (collaborator_ref is not null and collaborator_ref = public.current_collaborator_ref())
    )
  );

-- Atualização de situação: somente administrador (triagem/atendimento).
create policy epi_replacement_update on public.epi_replacement_requests
  for update to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and public.current_company_role() = 'admin'
  )
  with check (
    public.is_current_company_ref(company_ref)
    and public.current_company_role() = 'admin'
  );

create policy epi_replacement_delete on public.epi_replacement_requests
  for delete to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and public.current_company_role() = 'admin'
  );