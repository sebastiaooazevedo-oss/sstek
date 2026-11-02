drop index if exists public.company_collaborators_one_technical_responsible;

alter table public.company_collaborators
  drop column if exists is_technical_responsible;