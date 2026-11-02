-- Chancela de autenticidade (QR-Code no rodape) para documentos assinados
-- eletronicamente. Cada selo guarda o hash do conteudo impresso, os
-- signatarios e um token publico aleatorio (nao enumeravel) usado no QR-Code.
-- A escrita acontece somente no servidor (edge function signature-engine);
-- o cliente autenticado consegue apenas ler os selos da propria empresa.

create table if not exists public.document_seals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scope text not null,
  reference_ref text not null,
  reference_label text,
  content_hash text not null,
  signer_count integer not null default 0,
  signers jsonb not null default '[]'::jsonb,
  validation_token text not null unique,
  sealed_at timestamptz not null default now(),
  created_by_profile_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists document_seals_fingerprint_idx
  on public.document_seals (company_id, scope, reference_ref, content_hash);

create index if not exists document_seals_company_idx
  on public.document_seals (company_id, sealed_at desc);

create index if not exists document_seals_token_idx
  on public.document_seals (validation_token);

alter table public.document_seals enable row level security;

drop policy if exists document_seals_read_same_company on public.document_seals;
create policy document_seals_read_same_company on public.document_seals
  for select to authenticated
  using (company_id = public.current_company_id());

grant select on public.document_seals to authenticated;
grant all on public.document_seals to service_role;

comment on table public.document_seals is
  'Chancela de autenticidade impressa no rodape de documentos assinados eletronicamente. Guarda o hash do conteudo, os signatarios e um token publico nao enumeravel para validacao via QR-Code. Escrita somente pelo servidor (signature-engine).';