drop trigger if exists audit_surveys on public.surveys;
drop trigger if exists audit_apr_records on public.apr_records;
drop trigger if exists audit_documents on public.documents;
drop trigger if exists audit_company_collaborators on public.company_collaborators;
drop trigger if exists set_company_on_audit on public.system_audit_logs;

-- Restaura a funcao compartilhada sem o escopo de empresa.
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
    INSERT INTO public.system_audit_logs (module, area, action, entity, entity_id, detail, actor_id, actor_name)
    VALUES (v_module, v_area, 'created', v_label, v_entity_id, v_label || ' registrado: ' || COALESCE(v_entity_name, v_entity_id), v_actor, v_actor_name);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := v_old->>v_id_col;
    v_entity_name := COALESCE(v_old->>'title', v_old->>'name', v_old->>'collaborator_name', v_old->>'signer_name', v_entity_id);
    INSERT INTO public.system_audit_logs (module, area, action, entity, entity_id, detail, actor_id, actor_name)
    VALUES (v_module, v_area, 'deleted', v_label, v_entity_id, v_label || ' removido: ' || COALESCE(v_entity_name, v_entity_id), v_actor, v_actor_name);
    RETURN OLD;
  ELSE
    v_entity_id := v_new->>v_id_col;
    v_entity_name := COALESCE(v_new->>'title', v_new->>'name', v_new->>'collaborator_name', v_new->>'signer_name', v_entity_id);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN v_key = ANY (v_skip);
      v_old_txt := v_old->>v_key;
      v_new_txt := v_new->>v_key;
      IF v_old_txt IS DISTINCT FROM v_new_txt THEN
        INSERT INTO public.system_audit_logs (module, area, action, entity, entity_id, field, old_value, new_value, detail, actor_id, actor_name)
        VALUES (
          v_module, v_area,
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

drop function if exists public.system_audit_logs_set_company();
drop index if exists public.system_audit_logs_company_created_idx;
alter table public.system_audit_logs drop column if exists company_id;