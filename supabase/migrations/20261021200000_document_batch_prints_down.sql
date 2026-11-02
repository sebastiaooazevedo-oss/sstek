-- Reversão da auditoria da Impressão em Lote de documentos.

drop policy if exists document_batch_print_delete on public.document_batch_prints;
drop policy if exists document_batch_print_update on public.document_batch_prints;
drop policy if exists document_batch_print_insert on public.document_batch_prints;
drop policy if exists document_batch_print_read on public.document_batch_prints;

drop index if exists public.document_batch_print_collaborator_idx;
drop index if exists public.document_batch_print_company_idx;
drop index if exists public.document_batch_print_unique;

drop table if exists public.document_batch_prints;