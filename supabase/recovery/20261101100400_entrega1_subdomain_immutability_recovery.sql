-- =====================================================================
-- RECUPERAÇÃO (não é migration) — subdomínio imutável
-- Par da versão: 20261101100400
-- =====================================================================
--
-- Este é o único do pacote que É um rollback exato: o UP só criou o gatilho
-- e a função, e nada mais depende deles.
--
-- Nenhum dado de empresa é alterado por este arquivo. Tornar o subdomínio
-- editável de novo é consequência do desenho, não deste script.
-- =====================================================================

begin;

drop trigger if exists companies_block_subdomain_change on public.companies;
drop function if exists public.companies_block_subdomain_change();

commit;