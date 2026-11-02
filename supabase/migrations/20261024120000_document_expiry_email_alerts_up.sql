-- Aviso de vencimento de documentos por e-mail.
--
-- 1) `document_expiry_alert_settings`: parametrização por empresa (janela de
--    antecedência em dias, e-mail do SESMT e e-mails adicionais).
-- 2) `document_expiry_notifications`: controle dos avisos já enviados, para que
--    o mesmo documento não gere e-mail repetido na mesma validade.

create table if not exists public.document_expiry_alert_settings (
  company_id uuid primary key default current_company_id(),
  enabled boolean not null default true,
  days_before integer not null default 60
    constraint document_expiry_alert_days_range check (days_before between 1 and 365),
  sesmt_email text not null default '',
  extra_emails text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

comment on table public.document_expiry_alert_settings is
  'Parametrização do aviso de vencimento de documentos por e-mail (janela em dias e destinatários).';

alter table public.document_expiry_alert_settings enable row level security;

drop policy if exists document_expiry_alert_settings_read on public.document_expiry_alert_settings;
create policy document_expiry_alert_settings_read
  on public.document_expiry_alert_settings
  for select to authenticated
  using (company_id = current_company_id());

drop policy if exists document_expiry_alert_settings_insert on public.document_expiry_alert_settings;
create policy document_expiry_alert_settings_insert
  on public.document_expiry_alert_settings
  for insert to authenticated
  with check (company_id = current_company_id() and current_company_role() = 'admin');

drop policy if exists document_expiry_alert_settings_update on public.document_expiry_alert_settings;
create policy document_expiry_alert_settings_update
  on public.document_expiry_alert_settings
  for update to authenticated
  using (company_id = current_company_id() and current_company_role() = 'admin')
  with check (company_id = current_company_id() and current_company_role() = 'admin');

create table if not exists public.document_expiry_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid default current_company_id(),
  document_ref text not null,
  expires_at text not null,
  days_before integer not null default 0,
  recipients text not null default '',
  sent_at timestamptz not null default now(),
  constraint document_expiry_notifications_unique unique (document_ref, expires_at)
);

comment on table public.document_expiry_notifications is
  'Registro dos avisos de vencimento já enviados por e-mail (documento + validade).';

alter table public.document_expiry_notifications enable row level security;

drop policy if exists document_expiry_notifications_read on public.document_expiry_notifications;
create policy document_expiry_notifications_read
  on public.document_expiry_notifications
  for select to authenticated
  using (company_id = current_company_id());

drop policy if exists document_expiry_notifications_insert on public.document_expiry_notifications;
create policy document_expiry_notifications_insert
  on public.document_expiry_notifications
  for insert to authenticated
  with check (company_id = current_company_id());

create index if not exists document_expiry_notifications_company_idx
  on public.document_expiry_notifications (company_id, sent_at desc);