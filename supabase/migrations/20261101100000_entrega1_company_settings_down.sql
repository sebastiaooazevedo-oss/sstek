-- =====================================================================
-- Reversão da Entrega 1 — Configuração por empresa — PLANO SEGURO
-- =====================================================================
--
-- Regra: reverter o COMPORTAMENTO sem destruir dados e sem reabrir a
-- leitura pública de `system_settings`.
--
-- O que esta reversão faz:
--   * restaura a leitura pública de `system_settings`? NÃO.
--     `system_settings` volta a ser lida pela aplicação por outro caminho
--     (ver abaixo), mas nunca com `using (true)` para `anon`.
--   * apaga `company_settings`? NÃO, por padrão. Os dados permanecem.
--   * remove os helpers? NÃO, por padrão — eles são usados pelas policies
--     de Storage e por código já publicado.
--
-- Como voltar o app a ler configuração global, mantendo o banco fechado:
--   `system_settings` continua com a policy system_settings_platform_read
--   (apenas super usuário). Para o app ler a configuração global sem abrir
--   a tabela, exponha um RPC somente-leitura autenticado (padrão de
--   platform_enabled_modules) em vez de reabrir a tabela.
--
-- Este arquivo é intencionalmente conservador. As instruções destrutivas
-- estão comentadas e exigem decisão explícita + exportação prévia.
-- =====================================================================

begin;

-- 1) Policies de company_settings (mantém a tabela e os dados) ----------
drop policy if exists company_settings_insert on public.company_settings;
drop policy if exists company_settings_update on public.company_settings;
drop policy if exists company_settings_read on public.company_settings;

-- Com as policies acima removidas, a tabela fica fechada para leitura e
-- escrita do app (fail-closed). Nenhuma linha é apagada.

-- 2) NÃO reabrir system_settings ---------------------------------------
-- Mantida a policy system_settings_platform_read (somente super usuário).
-- Nenhum grant para anon.
revoke all on public.system_settings from anon;

commit;

-- =====================================================================
-- OPCIONAL / DESTRUTIVO — não executar como procedimento padrão
-- =====================================================================
-- 1) Exporte antes:  copy (select * from public.company_settings) to stdout csv header;
-- 2) Confirme que nenhum código em produção lê a tabela;
-- 3) Só então:
--
-- drop table if exists public.company_settings;
--
-- 4) Remover os helpers só depois de remover as policies de Storage que os usam:
--
-- drop function if exists public.current_company_subdomain();
-- drop function if exists public.platform_enabled_modules();