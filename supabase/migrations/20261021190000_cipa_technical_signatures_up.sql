-- ============================================================================
-- Assinaturas eletrônicas do Responsável Técnico (RT) em documentos técnicos
--
-- Até aqui o RT assinava apenas as atas da CIPA (aprovações da ata). Esta
-- tabela estende o mesmo ato de assinatura para os demais documentos técnicos
-- que exigem responsabilidade técnica antes da emissão definitiva:
--
--   * ficha-cipa      → Ficha de Cadastro da CIPA (por comissão)
--   * inspecao-cipa   → Inspeção de segurança da CIPA
--   * dossie-eleicao  → Dossiê do processo eleitoral
--   * ata-cipa        → Reservado para o espelho da aprovação da ata
--
-- Regra: um único ato por documento (escopo + referência). Reemitir o
-- documento depois da assinatura reaproveita o registro, sem duplicar.
-- ============================================================================

create table if not exists public.cipa_technical_signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_ref text not null,
  scope text not null,
  reference_ref text not null,
  reference_label text not null,
  signer_name text not null,
  signer_collaborator_ref text,
  signature_uid text not null,
  signature_image text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint cipa_technical_signature_unique unique (company_ref, scope, reference_ref),
  constraint cipa_technical_signature_scope_check
    check (scope in ('ata-cipa', 'ficha-cipa', 'inspecao-cipa', 'dossie-eleicao')),
  constraint cipa_technical_signature_signer_check
    check (length(btrim(signer_name)) > 0)
);

create index if not exists cipa_technical_signature_company_idx
  on public.cipa_technical_signatures (company_ref, scope, signed_at desc);

create index if not exists cipa_technical_signature_reference_idx
  on public.cipa_technical_signatures (company_ref, reference_ref);

alter table public.cipa_technical_signatures enable row level security;

drop policy if exists cipa_technical_signature_read on public.cipa_technical_signatures;
drop policy if exists cipa_technical_signature_insert on public.cipa_technical_signatures;
drop policy if exists cipa_technical_signature_update on public.cipa_technical_signatures;
drop policy if exists cipa_technical_signature_delete on public.cipa_technical_signatures;

-- Leitura: toda a empresa enxerga as assinaturas técnicas dos documentos.
create policy cipa_technical_signature_read on public.cipa_technical_signatures
  for select to authenticated
  using (public.is_current_company_ref(company_ref));

-- Assinatura: administrador ou o próprio Responsável Técnico designado.
create policy cipa_technical_signature_insert on public.cipa_technical_signatures
  for insert to authenticated
  with check (
    public.is_current_company_ref(company_ref)
    and public.current_company_id() is not null
    and (
      public.current_company_role() = 'admin'
      or (
        signer_collaborator_ref is not null
        and signer_collaborator_ref = public.current_collaborator_ref()
      )
    )
  );

-- Reassinatura: o administrador ou o próprio RT pode refazer o ato (ex.:
-- assinatura substituída por uma nova representação).
create policy cipa_technical_signature_update on public.cipa_technical_signatures
  for update to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and (
      public.current_company_role() = 'admin'
      or (
        signer_collaborator_ref is not null
        and signer_collaborator_ref = public.current_collaborator_ref()
      )
    )
  )
  with check (
    public.is_current_company_ref(company_ref)
    and (
      public.current_company_role() = 'admin'
      or (
        signer_collaborator_ref is not null
        and signer_collaborator_ref = public.current_collaborator_ref()
      )
    )
  );

-- Remoção: somente administrador (ex.: documento cancelado).
create policy cipa_technical_signature_delete on public.cipa_technical_signatures
  for delete to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and public.current_company_role() = 'admin'
  );

comment on table public.cipa_technical_signatures is
  'Assinatura eletrônica do Responsável Técnico de Segurança do Trabalho em documentos técnicos da CIPA (ficha, inspeções e dossiê eleitoral).';