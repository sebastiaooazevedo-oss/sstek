-- =====================================================================
-- ENTREGA 1 — DESMONTE DA FIXTURE (SOMENTE AMBIENTE ISOLADO)
-- =====================================================================
--
-- Remove APENAS o que supabase/tests/entrega1_isolated_seed.sql criou.
-- Não toca em nada do projeto real. Mesmas travas de segurança do seed.
--
--   set app.entrega1_environment = 'isolated';
--   set app.entrega1_seed_ack    = 'EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL';
--
-- Use preferencialmente DESCARTAR o projeto isolado inteiro. Este arquivo
-- existe para o caso de você querer repetir os testes no mesmo projeto.
-- =====================================================================

\set ON_ERROR_STOP on

do $guard$
begin
  if coalesce(current_setting('app.entrega1_environment', true), '') <> 'isolated'
     or coalesce(current_setting('app.entrega1_seed_ack', true), '') <> 'EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL' then
    raise exception 'Desmonte abortado: marcadores de ambiente isolado ausentes.';
  end if;
end
$guard$;

begin;

-- Objetos de Storage da fixture (metadados; o conteúdo é fictício).
delete from storage.objects
 where bucket_id in ('documents', 'branding')
   and (name like 'empresa-a/%' or name like 'empresa-b/%');

-- Atestados: os gatilhos de imutabilidade bloqueiam DELETE. O desmonte é a
-- única exceção planejada e ele desativa os gatilhos DENTRO desta transação,
-- apenas no banco isolado.
alter table public.medical_certificates disable trigger medical_certificates_block_mutation;

delete from public.medical_certificates
 where company_ref in ('empresa-a', 'empresa-b');

alter table public.medical_certificates enable trigger medical_certificates_block_mutation;

delete from public.internal_regulations where company_ref in ('empresa-a', 'empresa-b');
delete from public.documents where company_ref in ('empresa-a', 'empresa-b');
delete from public.company_settings
 where company_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
delete from public.profiles where email like '%@fixture.invalid';
delete from public.company_collaborators
 where company_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
delete from public.companies
 where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

commit;

-- Os 4 usuários de auth.users NÃO são apagados por SQL: remova-os pelo
-- Dashboard do projeto isolado, ou descarte o projeto inteiro.