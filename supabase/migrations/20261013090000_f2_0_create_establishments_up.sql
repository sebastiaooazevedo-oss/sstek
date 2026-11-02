-- ============================================================================
-- SSTEK · Migração F2.0 (UP) — Catálogo de Estabelecimentos
-- Arquivo: 20261013090000_f2_0_create_establishments_up.sql
-- Fase:    F2.0a / F2.0b / F2.0c
-- ----------------------------------------------------------------------------
-- ADITIVA E REVERSÍVEL.
-- NÃO altera nenhuma tabela, coluna ou registro existente.
-- NÃO toca em: documentos, assinaturas, CIPA, urna, DDS, APR, EPI.
-- ----------------------------------------------------------------------------
-- Pré-requisitos CONFIRMADOS no banco (verificação prévia, somente leitura):
--   * public.companies(id) existe.
--   * public.company_collaborators tem UNIQUE (company_id, ref)   <-- base da FK composta.
--   * public.establishments e public.collaborator_establishments AINDA NÃO existem.
-- ----------------------------------------------------------------------------
-- STATUS: PREPARADA — NÃO EXECUTAR sem autorização expressa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- F2.0a — Tabela establishments (catálogo por empresa)
-- ----------------------------------------------------------------------------
create table if not exists public.establishments (
  id              uuid        primary key default gen_random_uuid(),
  company_id      uuid        not null references public.companies(id),
  code            text        not null,                  -- código interno (MATRIZ, CAMPINAS, RECIFE)
  name            text        not null,                  -- nome de exibição
  cnpj            text,                                  -- OPCIONAL (não inventar no seed)
  address         text,                                  -- OPCIONAL (não inventar no seed)
  city            text,                                  -- OPCIONAL (não inventar no seed)
  state           text,                                  -- OPCIONAL (não inventar no seed)
  status          text        not null default 'active', -- ativa/inativa
  risk_grade      text,                                  -- grau de risco (NR-4), OPCIONAL
  manager_ref     text,                                  -- responsável (ref), OPCIONAL
  responsible_ref text,                                  -- responsável técnico (ref), OPCIONAL
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Unicidade do código DENTRO da empresa (tenant):
  constraint establishments_company_code_key unique (company_id, code),

  -- Habilita a FK composta de isolamento por empresa (usada em §collaborator_establishments):
  constraint establishments_id_company_key unique (id, company_id)
);

-- Índice de apoio para consultas por empresa (o UNIQUE acima já cobre company_id, code):
create index if not exists idx_establishments_company on public.establishments (company_id);

-- ----------------------------------------------------------------------------
-- F2.0b — Tabela collaborator_establishments (vínculo N:N colaborador x unidade)
-- ----------------------------------------------------------------------------
create table if not exists public.collaborator_establishments (
  id               uuid        primary key default gen_random_uuid(),
  company_id       uuid        not null references public.companies(id),
  collaborator_ref text        not null,                 -- CHAVE REAL do colaborador (text, = company_collaborators.ref)
  collaborator_id  uuid        references public.company_collaborators(id), -- OPCIONAL, join interno por PK
  establishment_id uuid        not null,
  is_primary       boolean     not null default false,
  role_in_unit     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- ISOLAMENTO POR EMPRESA (FK composta 1): o colaborador deve pertencer à MESMA empresa da linha.
  -- Casa com o UNIQUE (company_id, ref) já existente em company_collaborators.
  constraint collab_est_collab_fkey
    foreign key (company_id, collaborator_ref)
    references public.company_collaborators (company_id, ref),

  -- ISOLAMENTO POR EMPRESA (FK composta 2): o estabelecimento deve pertencer à MESMA empresa da linha.
  constraint collab_est_est_fkey
    foreign key (establishment_id, company_id)
    references public.establishments (id, company_id),

  -- Um colaborador não se vincula duas vezes à mesma unidade:
  constraint collab_est_unique
    unique (company_id, collaborator_ref, establishment_id)
);

-- Índice de apoio por estabelecimento:
create index if not exists idx_collab_est_establishment
  on public.collaborator_establishments (establishment_id);

-- No máximo UMA unidade principal por colaborador (índice parcial):
create unique index if not exists collab_est_one_primary
  on public.collaborator_establishments (company_id, collaborator_ref)
  where is_primary;

-- ----------------------------------------------------------------------------
-- F2.0c — Segurança: RLS LIGADA e SEM policy = default DENY
-- (mais restritivo que as tabelas atuais; NÃO amplia a exposição da chave pública)
-- Nenhuma policy permissiva para anon/public é criada aqui.
-- ----------------------------------------------------------------------------
alter table public.establishments             enable row level security;
alter table public.collaborator_establishments enable row level security;

-- ============================================================================
-- Fim do UP — F2.0 (estrutura). Seeds ficam em 20261013090100_..._up.sql
-- ============================================================================