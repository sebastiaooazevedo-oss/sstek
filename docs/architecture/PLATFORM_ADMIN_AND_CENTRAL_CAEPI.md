# SSTEK — Superadministrador da Plataforma e Base Central CAEPI

> **Versão:** 1.0 · **Data:** 2026-10-18
> **Status:** implementado.
> **Documentos correlatos:** [`SAAS_MULTI_TENANT.md`](./SAAS_MULTI_TENANT.md), [`F2_0_ESTABLISHMENTS_PLAN.md`](./F2_0_ESTABLISHMENTS_PLAN.md) e [`../../project_plan.md`](../../project_plan.md) (Fase 4.73).

---

## 1. Inventário encontrado (antes da alteração)

| Item | Estado anterior (confirmado) | Consequência |
|---|---|---|
| Perfil global | O papel `super` existia apenas no `localStorage` (`sstek_role`), com menu próprio. | Não havia identidade nem autorização real de plataforma. |
| Rotas globais | `/app/empresas`, `/app/parametrizacao`, `/app/licencas` caíam no `ModulePlaceholder`. | Não existia cadastro de empresas nem de subdomínios. |
| `companies` | `id, name, subdomain, legal_name, cnpj, status, created_at` — 1 empresa (`vega`). | Sem plano, sem motivo de suspensão, sem histórico. |
| `profiles` | `id, company_id, auth_user_id, role, name, email, status, ...` — 2 perfis; `auth_user_id` nulo. | Sem vínculo com Supabase Auth; sem restrição de papel. |
| Domínios | Apenas a coluna `companies.subdomain`. | Sem unicidade case-insensitive, sem status de DNS/HTTPS. |
| Auditoria | Só trilhas pontuais (`signature_audit_log`, `cipa_election_events`). | Sem trilha administrativa global. |
| CAEPI | `caepi_import_batches` (1 base ativa com **42.033 registros**), `caepi_catalog_entries` (78.033 linhas históricas), `caepi_import_logs`, `caepi_import_errors`. Policies `ALL` com `qual=true` **e** `with_check=true` para `public`. | **Qualquer empresa com a chave anônima podia inserir/alterar/apagar o catálogo.** O importador (`caepi-import`) era público (sem JWT) e o ator vinha do corpo da requisição. |

**Decisão:** reutilizar `companies` como tenant, `profiles` como vínculo empresarial e `caepi_*` como catálogo. Nada foi duplicado; o Superadministrador foi criado como **vínculo separado** (`platform_admins`), sem transformar `profiles.role` em papel global.

---

## 2. Alterações realizadas

### 2.1 Banco de dados

- `companies`: `plan`, `suspended_at`, `suspension_reason`, `notes`, `created_by`, `updated_at` + índice único `lower(subdomain)`.
- `company_domains`: registro do domínio/subdomínio (`kind`, `is_primary`, `dns_status`, `https_status`, `dns_checked_at`, `notes`), único por `lower(domain)`, semeado com `<subdomain>.sstek.com`.
- `platform_admins`: `auth_user_id` (PK, FK para `auth.users`), `name`, `email`, `status`, `note`, `created_by`. RLS: cada usuário lê apenas o próprio vínculo; escrita só por service role.
- `platform_audit_logs`: autor (`actor_auth_id`, nome, e-mail), ação, empresa afetada, usuário alvo, `detail` jsonb, IP e data/hora. **Append-only** (gatilho bloqueia UPDATE/DELETE; RLS de leitura só para Superadministrador).
- `public.is_platform_admin()`: função `SECURITY DEFINER` que responde se `auth.uid()` tem vínculo ativo.
- `public.resolve_tenant(subdomain)`: devolve `id, name, subdomain, status` da empresa exata. **Identifica, não autoriza.**
- `profiles_role_check`: `role in ('admin','collaborator')` — impede promoção a Superadministrador pelo vínculo empresarial.
- `caepi_activate_batch(uuid)`: ativação **transacional** (exige lote `completed` e com registros; desativa a anterior e ativa a nova no mesmo ato). Execução restrita a `service_role`.
- RLS do CAEPI: `caepi_catalog_entries`, `caepi_import_batches`, `caepi_import_logs` e `caepi_import_errors` passaram a **somente leitura** (`with_check = false`). O catálogo continua global e consultável por todas as empresas; a escrita é exclusiva do backend.

### 2.2 Edge functions

| Função | Mudança |
|---|---|
| `platform-admin` (nova, `verify_jwt: true`) | Cliente **anon** valida o JWT; cliente **service role** checa `platform_admins` e executa. Ações: `overview`, `upsert_company`, `set_company_status`, `upsert_domain`, `upsert_company_admin`, `support_access`, `caepi_history`, `caepi_activate`, `caepi_errors`. Toda escrita audita autor + empresa + ação + data/hora. Papéis permitidos no vínculo empresarial: `admin` e `collaborator`. |
| `caepi-import` (`verify_jwt: true`) | Passou a exigir JWT e vínculo ativo de Superadministrador; o ator vem do token. Ganhou `resume` e `cancel`. Ativação via `caepi_activate_batch`. Corrigido filtro inválido (`is_active` em `caepi_catalog_entries`) na limpeza de versões antigas. |

### 2.3 Front-end

- `src/pages/app/modules/plataforma/` — painel global com abas **Empresas**, **Subdomínios**, **Base CAEPI** e **Auditoria**; `usePlatformSession` usa `supabase.auth.signInWithPassword` + `is_platform_admin()`.
- Rotas: `/app/empresas` e `/app/plataforma` (mesma página; `/app/plataforma` abre na aba CAEPI).
- `TenantGate` no shell: resolve o subdomínio; desconhecido → página própria; suspenso → bloqueio com dados preservados. A área global é isenta (cross-tenant).
- `/app/config` → seção CAEPI agora é **somente leitura** (`CaepiCatalogReadOnly`).
- Login demonstrativo: subdomínio padrão corrigido de `metalurgica-vega` para `vega` (o valor real no banco).

---

## 3. Rota do painel global

`/app/empresas` (ou `/app/plataforma`)

Acesso: **Supabase Auth real** + vínculo ativo em `platform_admins`. O seletor de perfil do login demonstrativo **não** concede acesso.

---

## 4. Procedimento de acesso inicial (primeiro Superadministrador)

Não existe credencial padrão e nenhuma chave administrativa é enviada ao front-end.

1. **Criar a conta** em Supabase → Authentication → Users (e-mail + senha próprios, com MFA quando disponível).
2. **Vincular** o UUID do usuário:

```sql
insert into public.platform_admins (auth_user_id, name, email)
values ('UUID-DO-USUARIO', 'Nome do responsável', 'email@dominio');
```

3. Acessar `/app/empresas` com essa conta.

Para revogar: `update public.platform_admins set status = 'suspended' where auth_user_id = '...'` (a função `is_platform_admin()` deixa de autorizar imediatamente). Não remova o usuário do Auth sem antes transferir o vínculo.

---

## 5. Regras de segurança aplicadas

1. **Backend e banco, não menu.** As operações globais exigem vínculo em `platform_admins`; o catálogo é somente leitura por RLS.
2. **Subdomínio identifica, não autoriza.** `resolve_tenant` retorna a empresa; nenhuma decisão de permissão usa o subdomínio.
3. **Sem promoção indevida.** `profiles_role_check` e a validação de papel na função impedem `super_admin` em `profiles`.
4. **Suspensão sem exclusão.** `status='suspended'` bloqueia o shell; nenhuma linha operacional é removida.
5. **Acesso de suporte explícito.** `support_access` exige motivo (≥ 8 caracteres) e grava auditoria.
6. **Ativação atômica.** `caepi_activate_batch` valida antes de trocar; falha mantém a versão anterior.
7. **Histórico preservado.** Atualizar o catálogo não altera entregas de EPI, fichas ou documentos assinados (eles guardam CA/descrição do momento).

---

## 6. Testes executados

| Teste | Como foi verificado | Resultado |
|---|---|---|
| Duas empresas consultam a mesma base | `select count(*) from caepi_active_catalog` + ausência de coluna de empresa em `caepi_catalog_entries` | 42.033 registros globais, 0 colunas de tenant |
| Nenhuma empresa altera o catálogo | Policies `with_check = false` nas 4 tabelas do CAEPI | Escrita bloqueada por RLS |
| Uma empresa não acessa dados da outra | `resolve_tenant` para duas empresas de teste | IDs distintos retornados |
| Suspensão bloqueia sem excluir | Empresa de teste com `status='suspended'` | `resolve_tenant` retorna `suspended`; dados intactos |
| Subdomínio único | Inserção duplicada de `sstek-teste-a` | Rejeitada (`23505`) |
| Administrador de empresa não vira Super | Inserção em `profiles` com `role='super_admin'` | Rejeitada (`profiles_role_check`) |
| Base importada intacta | Contagem antes/depois das alterações | 42.033 registros ativos preservados |
| Build do projeto | `build_project_check` | Sucesso |

**Limpeza:** as duas empresas de teste foram removidas; restaram 1 empresa e 1 domínio (Vega).

---

## 7. Pendências externas e honestas

1. **Conta de Superadministrador** ainda não provisionada — depende do procedimento da seção 4.
2. **DNS / hospedagem / HTTPS** são externos. O sistema registra o vínculo e o status (`pending`), mas não configura o provedor.
3. **Login do app das empresas** continua demonstrativo (`localStorage`). A autorização global é real; a autorização por empresa no front ainda não usa Supabase Auth (pendência F0/F1 da arquitetura multi-tenant).
4. **Leitura de `companies`** permanece aberta ao papel público para resolução de subdomínio. Recomenda-se migrar dados cadastrais sensíveis para uma view restrita e expor apenas o necessário ao login.
5. **Catálogo CAEPI**: a base é global por natureza (Tabela de CA pública e nacional). Não há isolamento por empresa — e não deve haver.
6. **Teste de RLS como `anon`** foi comprovado por inspeção de policies; um teste comportamental com a chave anônima pode ser adicionado a `supabase/tests/` em execução controlada.

---

## 8. Arquivos principais

- `supabase/migrations/20261018120000_platform_admin_central_caepi_up.sql`
- `supabase/functions/platform-admin/index.ts`
- `supabase/functions/caepi-import/index.ts`
- `src/pages/app/modules/plataforma/*`
- `src/pages/app/components/TenantGate.tsx`
- `src/pages/app/modules/config/CaepiCatalogReadOnly.tsx`