-- Reversao dos selos de autenticidade (chancela com QR-Code).

drop policy if exists document_seals_read_same_company on public.document_seals;
drop index if exists public.document_seals_token_idx;
drop index if exists public.document_seals_company_idx;
drop index if exists public.document_seals_fingerprint_idx;
drop table if exists public.document_seals;