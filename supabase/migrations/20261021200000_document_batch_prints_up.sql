-- ============================================================================
-- Auditoria da Impressão em Lote de documentos (Documentos › Impressão em lote)
--
-- Cada dossiê gerado por colaborador registra QUEM gerou, QUAIS documentos e
-- QUAIS versões foram usados e QUANDO. O PDF reunido NÃO é armazenado aqui:
-- ele é montado no navegador e permanece privado, na sessão de quem gerou.
-- Esta tabela guarda apenas o rastro auditável (metadados), o que também
-- impede que cópias de documentos circulem pelo banco sem controle.
-- ============================================================================

create table if not exists public.document_batch_prints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_ref text not null,
  batch_ref text not null,
  collaborator_ref text not null,
  collaborator_name text not null,
  file_name text not null,
  page_count integer not null default 0,
  status text not null default 'gerado',
  -- Itens incluídos no dossiê, na ordem em que foram impressos.
  items jsonb not null default '[]'::jsonb,
  -- Documentos ausentes/pendências informadas antes da geração.
  pendencies jsonb not null default '[]'::jsonb,
  generated_by_email text,
  generated_by_name text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint document_batch_print_status_check check (status in ('gerado', 'falha')),
  constraint document_batch_print_page_count_check check (page_count >= 0),
  constraint document_batch_print_collaborator_check check (length(btrim(collaborator_name)) > 0)
);

create unique index if not exists document_batch_print_unique
  on public.document_batch_prints (company_ref, batch_ref, collaborator_ref);

create index if not exists document_batch_print_company_idx
  on public.document_batch_prints (company_ref, generated_at desc);

create index if not exists document_batch_print_collaborator_idx
  on public.document_batch_prints (company_ref, collaborator_ref, generated_at desc);

alter table public.document_batch_prints enable row level security;

create policy document_batch_print_read on public.document_batch_prints
  for select to authenticated
  using (public.is_current_company_ref(company_ref));

create policy document_batch_print_insert on public.document_batch_prints
  for insert to authenticated
  with check (
    public.is_current_company_ref(company_ref)
    and public.current_company_id() is not null
    and company_id = public.current_company_id()
  );

-- Regerar o lote do mesmo colaborador (mesmo batch_ref) atualiza o rastro,
-- sem criar duplicidades.
create policy document_batch_print_update on public.document_batch_prints
  for update to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and company_id = public.current_company_id()
  )
  with check (
    public.is_current_company_ref(company_ref)
    and company_id = public.current_company_id()
  );

create policy document_batch_print_delete on public.document_batch_prints
  for delete to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and public.current_company_role() = 'admin'
  );

comment on table public.document_batch_prints is
  'Rastro auditável da Impressão em Lote de documentos: quem gerou cada dossiê por colaborador, quais documentos/versões entraram e quando. Os PDFs não são armazenados.';