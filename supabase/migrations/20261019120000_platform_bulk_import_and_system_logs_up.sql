-- =====================================================================
-- Importacao em lote de colaboradores por empresa + logs de sistema
-- com escopo de empresa (para o painel global do Superadministrador).
-- =====================================================================

-- 1) A trilha de auditoria passa a saber a qual empresa cada linha pertence.
alter table public.system_audit_logs add column if not exists company_id uuid;

create index if not exists system_audit_logs_company_created_idx
  on public.system_audit_logs (company_id, created_at desc);

update public.system_audit_logs a
set company_id = p.company_id
from public.profiles p
where a.company_id is null
  and p.company_id is not null
  and (p.auth_user_id = a.actor_id or p.id = a.actor_id);

create or replace function public.system_audit_logs_set_company()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.company_id is null and new.actor_id is not null then
    begin
      select p.company_id into new.company_id
      from public.profiles p
      where p.company_id is not null
        and (p.auth_user_id = new.actor_id or p.id = new.actor_id)
      limit 1;
    exception when others then
      new.company_id := null;
    end;
  end if;
  return new;
end;
$function$;

create or replace trigger set_company_on_audit
before insert on public.system_audit_logs
for each row execute function public.system_audit_logs_set_company();

-- 2) Inclusao, alteracao e remocao passam a ser registradas automaticamente
--    nas tabelas centrais de cada empresa. A funcao compartilhada passa a
--    gravar tambem a empresa do proprio registro (company_id/company_ref).
create or replace function public.log_row_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
DECLARE
  v_module text := TG_ARGV[0];
  v_area text := TG_ARGV[1];
  v_label text := TG_ARGV[2];
  v_id_col text := TG_ARGV[3];
  v_profile_col text := CASE WHEN array_length(TG_ARGV, 1) >= 5 THEN TG_ARGV[4] ELSE NULL END;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_entity_id text;
  v_entity_name text;
  v_new jsonb;
  v_old jsonb;
  v_key text;
  v_old_txt text;
  v_new_txt text;
  v_company uuid;
  v_company_ref text;
  v_skip text[] := ARRAY[
    'updated_at','created_at','id','company_id','company_ref',
    'content_hash','base_pdf_hash','final_pdf_hash','evidence_report_hash','signature_hash',
    'content','payload','evidence','representation_snapshot','signature',
    'photo','photos','cover','items','members','agenda',
    'participant_ids','participant_names','topics'
  ];
BEGIN
  IF TG_OP <> 'DELETE' THEN
    v_new := to_jsonb(NEW);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    v_old := to_jsonb(OLD);
  END IF;

  BEGIN
    IF v_new IS NOT NULL THEN
      v_company := NULLIF(v_new->>'company_id', '')::uuid;
      v_company_ref := v_new->>'company_ref';
    ELSE
      v_company := NULLIF(v_old->>'company_id', '')::uuid;
      v_company_ref := v_old->>'company_ref';
    END IF;
    IF v_company IS NULL AND v_company_ref IS NOT NULL AND v_company_ref <> '' THEN
      SELECT c.id INTO v_company FROM public.companies c WHERE c.subdomain = v_company_ref LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_company := NULL;
  END;

  IF v_actor IS NULL AND v_profile_col IS NOT NULL AND v_new IS NOT NULL THEN
    v_actor := NULLIF(v_new->>v_profile_col, '')::uuid;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT name INTO v_actor_name FROM public.profiles WHERE auth_user_id = v_actor LIMIT 1;
    IF v_actor_name IS NULL THEN
      SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor LIMIT 1;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := v_new->>v_id_col;
    v_entity_name := COALESCE(v_new->>'title', v_new->>'name', v_new->>'collaborator_name', v_new->>'signer_name', v_entity_id);
    INSERT INTO public.system_audit_logs (company_id, module, area, action, entity, entity_id, detail, actor_id, actor_name)
    VALUES (v_company, v_module, v_area, 'created', v_label, v_entity_id, v_label || ' registrado: ' || COALESCE(v_entity_name, v_entity_id), v_actor, v_actor_name);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := v_old->>v_id_col;
    v_entity_name := COALESCE(v_old->>'title', v_old->>'name', v_old->>'collaborator_name', v_old->>'signer_name', v_entity_id);
    INSERT INTO public.system_audit_logs (company_id, module, area, action, entity, entity_id, detail, actor_id, actor_name)
    VALUES (v_company, v_module, v_area, 'deleted', v_label, v_entity_id, v_label || ' removido: ' || COALESCE(v_entity_name, v_entity_id), v_actor, v_actor_name);
    RETURN OLD;
  ELSE
    v_entity_id := v_new->>v_id_col;
    v_entity_name := COALESCE(v_new->>'title', v_new->>'name', v_new->>'collaborator_name', v_new->>'signer_name', v_entity_id);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN v_key = ANY (v_skip);
      v_old_txt := v_old->>v_key;
      v_new_txt := v_new->>v_key;
      IF v_old_txt IS DISTINCT FROM v_new_txt THEN
        INSERT INTO public.system_audit_logs (company_id, module, area, action, entity, entity_id, field, old_value, new_value, detail, actor_id, actor_name)
        VALUES (
          v_company, v_module, v_area,
          CASE WHEN v_new_txt IS NULL OR v_new_txt = '' THEN 'deleted' ELSE 'updated' END,
          v_label, v_entity_id, v_key,
          NULLIF(LEFT(COALESCE(v_old_txt, ''), 280), ''),
          NULLIF(LEFT(COALESCE(v_new_txt, ''), 280), ''),
          v_label || COALESCE(' · ' || v_entity_name, '') || ' · ' || v_key,
          v_actor, v_actor_name
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
END;
$function$;

create or replace trigger audit_company_collaborators
after insert or update or delete on public.company_collaborators
for each row execute function public.log_row_audit('colaboradores', 'collaborators', 'Colaborador', 'ref');

create or replace trigger audit_documents
after insert or update or delete on public.documents
for each row execute function public.log_row_audit('documentos', 'documents', 'Documento', 'ref');

create or replace trigger audit_apr_records
after insert or update or delete on public.apr_records
for each row execute function public.log_row_audit('apr', 'apr', 'APR', 'ref');

create or replace trigger audit_surveys
after insert or update or delete on public.surveys
for each row execute function public.log_row_audit('pesquisas', 'surveys', 'Pesquisa', 'ref');

-- 3) Registros de demonstracao para os tenants de exemplo (idempotente).
insert into public.system_audit_logs
  (company_id, module, area, action, entity, entity_id, detail, actor_name, created_at)
select c.id, v.module, v.area, v.action, v.entity, v.entity_id, v.detail, v.actor_name, now() - v.age
from (values
  ('logprime', 'colaboradores', 'collaborators', 'created', 'Colaborador', 'colab-883721', 'Colaborador registrado: Marcos Aurélio Ferraz', 'Renata Lopes (Administrador)', interval '3 hours'),
  ('logprime', 'colaboradores', 'collaborators', 'created', 'Colaborador', 'colab-883722', 'Colaborador registrado: Tatiane Souza Braga', 'Renata Lopes (Administrador)', interval '3 hours'),
  ('logprime', 'colaboradores', 'collaborators', 'deleted', 'Colaborador', 'colab-883650', 'Colaborador removido: Jorge Nascimento', 'Renata Lopes (Administrador)', interval '1 day 2 hours'),
  ('horizonte', 'documentos', 'documents', 'created', 'Documento', 'doc-nr18-os', 'Documento registrado: Ordem de Serviço NR-18', 'Paulo Menezes (Administrador)', interval '5 hours'),
  ('horizonte', 'epi', 'epi', 'created', 'Entrega de EPI', 'epi-4471', 'Entrega de EPI registrada: Capacete classe B', 'Paulo Menezes (Administrador)', interval '1 day 4 hours'),
  ('bemviver', 'pesquisas', 'surveys', 'created', 'Pesquisa', 'survey-clima-out', 'Pesquisa registrada: Clima organizacional — outubro', 'Camila Duarte (Administrador)', interval '2 days'),
  ('bemviver', 'config', 'company_data', 'updated', 'Dados da empresa', 'company', 'Dados da empresa · Telefone', 'Camila Duarte (Administrador)', interval '2 days 1 hour'),
  ('andrade', 'cipa', 'cipa', 'created', 'Comissão da CIPA', 'cipa-2026', 'Comissão da CIPA registrada: CIPA 2026/2027', 'André Salles (Administrador)', interval '4 days'),
  ('andrade', 'colaboradores', 'collaborators', 'created', 'Colaborador', 'colab-771120', 'Colaborador registrado: Denise Barros', 'André Salles (Administrador)', interval '4 days 2 hours'),
  ('vega', 'colaboradores', 'collaborators', 'deleted', 'Colaborador', 'c-0312', 'Colaborador removido: Rafael Antunes', 'Carlos Menezes (Administrador)', interval '6 days')
) as v(subdomain, module, area, action, entity, entity_id, detail, actor_name, age)
join public.companies c on c.subdomain = v.subdomain
where not exists (
  select 1 from public.system_audit_logs s where s.entity_id = v.entity_id
);