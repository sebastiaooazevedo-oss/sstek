alter table public.system_settings drop column if exists document_renewal_sla_days;

drop policy if exists document_renewal_requests_delete on public.document_renewal_requests;
drop policy if exists document_renewal_requests_update on public.document_renewal_requests;
drop policy if exists document_renewal_requests_insert on public.document_renewal_requests;
drop policy if exists document_renewal_requests_read on public.document_renewal_requests;

drop table if exists public.document_renewal_requests;