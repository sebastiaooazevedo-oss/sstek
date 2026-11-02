-- Tabelas do núcleo com as colunas usadas pelas migrations (recorte do banco real).
-- Substituir pelo export completo do banco (supabase/tools/exportar_estrutura.sql) quando houver.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null, subdomain text not null, legal_name text, cnpj text,
  plan text default 'S2', status text not null default 'active', notes text,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id), auth_user_id uuid, name text, email text,
  role text, status text default 'active', is_primary_admin boolean default false, collaborator_ref text
);
create table if not exists public.platform_admins (auth_user_id uuid primary key, name text, email text, status text default 'active');
create table if not exists public.system_settings (id int primary key, enabled_modules jsonb default '{}'::jsonb, updated_at timestamptz);
create table if not exists public.company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  domain text not null, kind text not null default 'subdomain', is_primary boolean not null default false,
  dns_status text not null default 'pending', https_status text not null default 'pending',
  dns_checked_at timestamptz, notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
