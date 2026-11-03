-- ============================================================================
-- Check-in de segurança de veículos (retirada e devolução) — versão 2
--
-- * vehicle_checkins ganha: categoria do veículo no momento do check-in, placa
--   conferida pelo condutor, avarias marcadas no mapa (jsonb) e pedidos de
--   reparo informados no check-in (jsonb).
-- * vehicle_repair_requests: solicitações de reparo acompanhadas pela gestão
--   da frota (aberta → em andamento → concluída/cancelada).
--
-- Escrita somente pela função de servidor `veiculos` (service role), que
-- valida permissões (`vehicles.checkin`, `vehicles.edit`) e regras.
-- Leitura: administradores da própria empresa (o painel exige ainda a
-- permissão `vehicles.checkinReport` na interface).
-- ============================================================================

alter table if exists public.vehicle_checkins
  add column if not exists vehicle_category text,
  add column if not exists plate_confirmed boolean not null default false,
  add column if not exists damages jsonb not null default '[]'::jsonb,
  add column if not exists repair_requests jsonb not null default '[]'::jsonb;

do $$
begin
  if to_regclass('public.vehicle_checkins') is not null then
    alter table public.vehicle_checkins drop constraint if exists vehicle_checkins_damages_array;
    alter table public.vehicle_checkins
      add constraint vehicle_checkins_damages_array check (
        jsonb_typeof(damages) = 'array' and jsonb_array_length(damages) <= 40
      );
    alter table public.vehicle_checkins drop constraint if exists vehicle_checkins_repairs_array;
    alter table public.vehicle_checkins
      add constraint vehicle_checkins_repairs_array check (
        jsonb_typeof(repair_requests) = 'array' and jsonb_array_length(repair_requests) <= 20
      );
    create index if not exists vehicle_checkins_report_idx
      on public.vehicle_checkins (company_ref, performed_at desc);
  end if;
end $$;

create table if not exists public.vehicle_repair_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_ref text not null,
  ref text not null,
  vehicle_ref text not null,
  checkin_ref text not null,
  damage_id text,
  plate_snapshot text,
  title text not null,
  description text,
  priority text not null default 'media',
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'aberta',
  requested_by uuid,
  requested_by_name text,
  resolution text,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_repair_unique unique (company_ref, ref),
  constraint vehicle_repair_title_check check (length(btrim(title)) >= 3),
  constraint vehicle_repair_priority_check check (priority in ('baixa', 'media', 'alta', 'urgente')),
  constraint vehicle_repair_status_check check (status in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  constraint vehicle_repair_photos_check check (
    jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) between 1 and 4
  ),
  constraint vehicle_repair_resolution_check check (
    status not in ('concluida', 'cancelada') or length(btrim(coalesce(resolution, ''))) >= 5
  )
);

create index if not exists vehicle_repair_company_idx
  on public.vehicle_repair_requests (company_ref, status, created_at desc);
create index if not exists vehicle_repair_vehicle_idx
  on public.vehicle_repair_requests (company_ref, vehicle_ref);

create or replace function public.touch_vehicle_repair_request()
returns trigger
language plpgsql
set search_path to ''
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists vehicle_repair_touch on public.vehicle_repair_requests;
create trigger vehicle_repair_touch
  before update on public.vehicle_repair_requests
  for each row
  execute function public.touch_vehicle_repair_request();

alter table public.vehicle_repair_requests enable row level security;
revoke all on public.vehicle_repair_requests from anon;
revoke insert, update, delete on public.vehicle_repair_requests from authenticated;
grant select on public.vehicle_repair_requests to authenticated;

drop policy if exists vehicle_repair_read on public.vehicle_repair_requests;
create policy vehicle_repair_read on public.vehicle_repair_requests
  for select to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and public.current_company_role() = 'admin'
  );
