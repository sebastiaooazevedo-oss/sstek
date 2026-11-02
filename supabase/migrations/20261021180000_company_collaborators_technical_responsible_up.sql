-- Identifica, no cadastro de colaboradores, quem responde tecnicamente pela
-- segurança do trabalho da empresa. Esse colaborador passa a ser o signatário
-- eletrônico obrigatório das atas da CIPA (rodapé "Responsável Técnico").

alter table public.company_collaborators
  add column if not exists is_technical_responsible boolean not null default false;

-- Garante no máximo um responsável técnico ativo por empresa.
create unique index if not exists company_collaborators_one_technical_responsible
  on public.company_collaborators (company_id)
  where is_technical_responsible = true;

comment on column public.company_collaborators.is_technical_responsible is
  'Colaborador designado como Responsável Técnico de Segurança do Trabalho (assinatura eletrônica das atas/documentos).';