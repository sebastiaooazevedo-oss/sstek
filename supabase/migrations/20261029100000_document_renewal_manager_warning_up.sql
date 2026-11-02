-- Segundo aviso de prazo da renovação de documentos + controle de e-mails.
--
-- 1) `document_renewal_manager_warning_days`: janela (dias antes do
--    vencimento) em que o GESTOR é avisado. O responsável da tratativa
--    continua sendo avisado por `document_renewal_sla_warning_days`, então a
--    empresa pode usar prazos diferentes para cada público.
-- 2) `document_renewal_deadline_notifications`: registro dos e-mails
--    automáticos já enviados no início de cada janela, para que a mesma
--    tratativa não gere e-mail repetido na mesma data-limite.

alter table public.system_settings
  add column if not exists document_renewal_manager_warning_days integer not null default 7;

alter table public.system_settings
  drop constraint if exists system_settings_renewal_manager_warning_range;

alter table public.system_settings
  add constraint system_settings_renewal_manager_warning_range
  check (
    document_renewal_manager_warning_days >= 0
    and document_renewal_manager_warning_days <= 60
  );

comment on column public.system_settings.document_renewal_manager_warning_days is
  'Dias de antecedência para avisar o gestor que o prazo (SLA) da renovação está próximo. Zero desliga o aviso ao gestor.';

create table if not exists public.document_renewal_deadline_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default current_company_id(),
  request_ref text not null,
  due_at text not null,
  audience text not null
    constraint document_renewal_deadline_audience check (audience in ('gestor', 'responsavel')),
  recipient text not null,
  remaining_days integer not null default 0,
  sent_at timestamptz not null default now(),
  constraint document_renewal_deadline_notifications_unique
    unique (request_ref, due_at, audience, recipient)
);

comment on table public.document_renewal_deadline_notifications is
  'Registro dos e-mails automáticos de prazo de renovação já enviados (solicitação + data-limite + público + destinatário).';

create index if not exists document_renewal_deadline_notifications_company_idx
  on public.document_renewal_deadline_notifications (company_id, sent_at desc);

alter table public.document_renewal_deadline_notifications enable row level security;

drop policy if exists document_renewal_deadline_notifications_read
  on public.document_renewal_deadline_notifications;
create policy document_renewal_deadline_notifications_read
  on public.document_renewal_deadline_notifications
  for select to authenticated
  using (company_id = current_company_id());

drop policy if exists document_renewal_deadline_notifications_insert
  on public.document_renewal_deadline_notifications;
create policy document_renewal_deadline_notifications_insert
  on public.document_renewal_deadline_notifications
  for insert to authenticated
  with check (company_id = current_company_id());

grant select, insert on public.document_renewal_deadline_notifications to authenticated;