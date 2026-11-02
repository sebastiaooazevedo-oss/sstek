-- ============================================================================
-- Hardening de autorização multi-tenant + registro de domínios
-- Data: 2026-10-18
--
-- Contexto:
--   * `company_domains` era a ÚNICA tabela pública com RLS desativada e sem
--     policy aplicada — o papel `anon` podia ler/inserir/alterar/apagar o
--     registro de subdomínios (sequestro de subdomínio).
--   * O bloqueio genérico "somente admin escreve" impedia ações legítimas do
--     colaborador: aceite da ficha de EPI e ciência do Regulamento Interno.
--   * `survey_responses` estava sem nenhuma policy (participação impossível).
--   * `daily_moods` permitia que qualquer membro alterasse o humor de colegas.
--
-- Compatível com reexecução: usa IF EXISTS / CREATE OR REPLACE / ALTER POLICY.
-- Requer execução por um papel com privilégio de owner (postgres).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. company_domains: fecha leitura/escrita pública, mantém leitura da empresa
-- ----------------------------------------------------------------------------
alter table public.company_domains enable row level security;
alter table public.company_domains force row level security;

drop policy if exists tenant_domains_write on public.company_domains;
drop policy if exists tenant_domains_read on public.company_domains;

-- Somente membros da própria empresa enxergam o registro de domínios.
-- Escrita: nenhuma policy para anon/authenticated => negada por padrão.
-- O Superadministrador opera via service role (edge function `platform-admin`).
create policy tenant_domains_read on public.company_domains
  for select to authenticated
  using (public.is_company_member(company_id));

revoke insert, update, delete, truncate, references, trigger
  on public.company_domains from anon;

-- ----------------------------------------------------------------------------
-- 2. Identidade do colaborador derivada do vínculo (nunca do corpo da chamada)
-- ----------------------------------------------------------------------------
create or replace function public.current_collaborator_ref()
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.collaborator_ref
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.company_id = public.current_company_id()
    and p.status = 'active'
  limit 1;
$fn$;

revoke all on function public.current_collaborator_ref() from public;
revoke all on function public.current_collaborator_ref() from anon;
grant execute on function public.current_collaborator_ref() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Aceite da ficha de EPI pelo próprio colaborador (somente assinatura/status)
-- ----------------------------------------------------------------------------
create or replace function public.epi_acknowledge_delivery(p_ref text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_company uuid := public.current_company_id();
  v_updated integer := 0;
  v_own text := public.current_collaborator_ref();
  v_role text := public.current_company_role();
begin
  if v_company is null then
    return jsonb_build_object('ok', false, 'reason', 'no_company');
  end if;
  if p_ref is null or length(btrim(p_ref)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_ref');
  end if;
  if p_signature is null or length(btrim(p_signature)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_signature');
  end if;
  if v_role <> 'admin' and v_own is null then
    return jsonb_build_object('ok', false, 'reason', 'no_collaborator_link');
  end if;

  update public.epi_deliveries d
     set signature = p_signature,
         status = 'Assinada',
         updated_at = now()
   where d.company_id = v_company
     and d.ref = p_ref
     and (d.signature is null or btrim(d.signature) = '')
     and (v_role = 'admin' or d.collaborator_ref = v_own);

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_own_or_already_signed');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.epi_acknowledge_delivery(text, text) from public;
revoke all on function public.epi_acknowledge_delivery(text, text) from anon;
grant execute on function public.epi_acknowledge_delivery(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Ciência do Regulamento Interno pelo próprio colaborador
-- ----------------------------------------------------------------------------
create or replace function public.regulation_acknowledge(
  p_regulation_ref text,
  p_pages_read integer,
  p_declaration text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_company uuid := public.current_company_id();
  v_company_ref text := public.current_company_ref();
  v_own text := public.current_collaborator_ref();
  v_role text := public.current_company_role();
  v_name text;
  v_email text;
  v_function text;
  v_version integer;
  v_updated integer := 0;
begin
  if v_company is null or v_company_ref is null then
    return jsonb_build_object('ok', false, 'reason', 'no_company');
  end if;
  if v_own is null then
    return jsonb_build_object('ok', false, 'reason', 'no_collaborator_link');
  end if;

  select r.version into v_version
  from public.internal_regulations r
  where r.company_ref = v_company_ref
    and r.ref = p_regulation_ref
    and r.status = 'vigente'
  limit 1;

  if v_version is null then
    return jsonb_build_object('ok', false, 'reason', 'regulation_not_active');
  end if;

  select cc.name, cc.email, cc.role_function
    into v_name, v_email, v_function
  from public.company_collaborators cc
  where cc.company_id = v_company and cc.ref = v_own
  limit 1;

  update public.internal_regulation_signatures s
     set regulation_version = v_version,
         collaborator_name = coalesce(v_name, s.collaborator_name),
         collaborator_email = coalesce(v_email, s.collaborator_email),
         collaborator_role = coalesce(v_function, s.collaborator_role),
         pages_read = greatest(coalesce(p_pages_read, 0), 0),
         declaration = coalesce(nullif(btrim(p_declaration), ''), s.declaration),
         signed_at = now()
   where s.company_ref = v_company_ref
     and s.regulation_ref = p_regulation_ref
     and s.collaborator_id = v_own;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into public.internal_regulation_signatures (
      company_ref, regulation_ref, regulation_version, collaborator_id,
      collaborator_name, collaborator_email, collaborator_role,
      pages_read, declaration, signed_at
    ) values (
      v_company_ref, p_regulation_ref, v_version, v_own,
      coalesce(v_name, 'Colaborador'), v_email, v_function,
      greatest(coalesce(p_pages_read, 0), 0),
      coalesce(nullif(btrim(p_declaration), ''), 'Declaro ciência do regulamento vigente.'),
      now()
    );
  end if;

  return jsonb_build_object('ok', true, 'version', v_version, 'role', v_role);
end;
$fn$;

revoke all on function public.regulation_acknowledge(text, integer, text) from public;
revoke all on function public.regulation_acknowledge(text, integer, text) from anon;
grant execute on function public.regulation_acknowledge(text, integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Participação em pesquisas (tabela estava sem nenhuma policy)
-- ----------------------------------------------------------------------------
drop policy if exists survey_responses_read on public.survey_responses;
drop policy if exists survey_responses_insert on public.survey_responses;

create policy survey_responses_read on public.survey_responses
  for select to authenticated
  using (
    public.is_current_company_ref(company_ref)
    and (
      public.current_company_role() = 'admin'
      or (anonymous = false and collaborator_ref = public.current_collaborator_ref())
    )
  );

create policy survey_responses_insert on public.survey_responses
  for insert to authenticated
  with check (
    public.is_current_company_ref(company_ref)
    and public.current_company_id() is not null
    and (
      public.current_company_role() = 'admin'
      or collaborator_ref = public.current_collaborator_ref()
      or (anonymous = true and collaborator_ref is null)
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Humor diário: colaborador só registra/edita o próprio registro
-- ----------------------------------------------------------------------------
alter policy tenant_write on public.daily_moods
  to authenticated
  using (
    public.is_current_company_name(company)
    and (
      public.current_company_role() = 'admin'
      or lower(user_key) = lower((select u.email from auth.users u where u.id = auth.uid()))
      or user_key = public.current_collaborator_ref()
    )
  )
  with check (
    public.is_current_company_name(company)
    and (
      public.current_company_role() = 'admin'
      or lower(user_key) = lower((select u.email from auth.users u where u.id = auth.uid()))
      or user_key = public.current_collaborator_ref()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Catálogo CAEPI é global e somente leitura para os clientes
--    (as policies já são apenas SELECT; garantia extra nos privilégios)
-- ----------------------------------------------------------------------------
revoke insert, update, delete, truncate
  on public.caepi_catalog_entries from anon, authenticated;
revoke insert, update, delete, truncate
  on public.caepi_active_catalog from anon, authenticated;
revoke insert, update, delete, truncate
  on public.caepi_import_batches from anon, authenticated;
revoke insert, update, delete, truncate
  on public.caepi_import_errors from anon, authenticated;
revoke insert, update, delete, truncate
  on public.caepi_import_logs from anon, authenticated;

revoke all on function public.caepi_upsert_entries(uuid, jsonb) from public;
revoke all on function public.caepi_upsert_entries(uuid, jsonb) from anon;
revoke all on function public.caepi_upsert_entries(uuid, jsonb) from authenticated;
revoke all on function public.caepi_activate_batch(uuid) from public;
revoke all on function public.caepi_activate_batch(uuid) from anon;
revoke all on function public.caepi_activate_batch(uuid) from authenticated;

-- ----------------------------------------------------------------------------
-- 8. Funções administrativas da plataforma: nunca executáveis pelo cliente
-- ----------------------------------------------------------------------------
revoke all on function public.session_context() from public;
revoke all on function public.session_context() from anon;
grant execute on function public.session_context() to authenticated;

commit;