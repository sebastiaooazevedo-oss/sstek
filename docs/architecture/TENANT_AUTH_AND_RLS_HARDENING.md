# Autenticação real de empresas e blindagem de autorização

Documento da fase executada em **2026-10-18**. Complementa
`PLATFORM_ADMIN_AND_CENTRAL_CAEPI.md` (painel global e catálogo central).

---

## 1. Inventário da tabela pública sem RLS

Antes desta fase existia **exatamente uma** tabela pública com RLS desativada.

| Item | Situação encontrada |
| --- | --- |
| Tabela | `public.company_domains` |
| Finalidade | Registro dos domínios/subdomínios de cada empresa (tenant), com status de DNS e HTTPS, domínio principal e observações. É a fonte usada pelo painel global de subdomínios. |
| Dados | 1 linha (`vega.sstek.com`), `dns_status = pending`, `https_status = pending`. |
| RLS | `relrowsecurity = false`, `relforcerowsecurity = false` |
| Policies | nenhuma aplicada (havia `tenant_domains_read` criada, mas sem efeito porque a RLS estava desligada) |
| Privilégios efetivos | `anon` com **SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER**; `authenticated` com os mesmos privilégios; `service_role` idem |

**Risco real:** com a chave anônima (presente no bundle do site) qualquer
visitante podia inserir ou alterar o registro de subdomínios — sequestro de
subdomínio e redirecionamento de tenant.

### Correção aplicada

- `enable row level security` + `force row level security` em `company_domains`.
- Policy única `tenant_domains_read`: `SELECT` para `authenticated` quando
  `is_company_member(company_id)`.
- **Nenhuma policy de escrita** para `anon`/`authenticated`: escrita negada por
  padrão. O Superadministrador escreve via edge function `platform-admin`
  (service role, com validação de vínculo e auditoria).
- Dados preservados: a linha existente continua intacta e não foi marcada como
  verificada.

### Pendência de privilégio (não aplicada por limitação da ferramenta)

O executor deste ambiente recusa `REVOKE`. A migration
`supabase/migrations/20261018140000_tenant_authz_and_domain_hardening_up.sql`
contém os comandos exatos:

```sql
revoke insert, update, delete, truncate, references, trigger
  on public.company_domains from anon;
```

A RLS já impede a operação na prática; o `REVOKE` é defesa em profundidade e
deve ser aplicado no ambiente.

---

## 2. Autenticação real das empresas

### Fluxo implementado

1. `supabase.auth.signInWithPassword` cria a sessão.
2. O app chama `session_context()` (RPC) — nunca envia e-mail, empresa ou papel.
3. `session_context()` resolve tudo a partir de `auth.uid()`:
   - lê o e-mail de `auth.users` e exige `email_confirmed_at`;
   - vincula automaticamente apenas perfil **pré-autorizado**
     (`auth_user_id is null`, `status = 'active'`, mesmo e-mail);
   - falha fechado em ambiguidade/duplicidade/concorrência.
4. O app aplica o resultado: `linked` + `company_status = active` libera;
   qualquer outro retorno bloqueia com mensagem específica.

### Arquivos

| Arquivo | Papel |
| --- | --- |
| `src/pages/app/auth/authProvider.tsx` | Provider de sessão, login, logout, recuperação e redefinição de senha, mapeamento de todos os retornos de `session_context()`. |
| `src/pages/app/components/SessionGate.tsx` | Guarda de rota com quatro estados: carregando, sem sessão (redireciona), sem permissão (motivo do banco), erro de conexão (com nova tentativa). |
| `src/pages/app/layout.tsx` | Casca do app usando apenas a sessão real; remove qualquer leitura de `localStorage`. |
| `src/pages/app/context.ts` | Contexto de exibição com padrões **neutros** (sem identidade demonstrativa). |
| `src/pages/login/page.tsx` | Login real, mensagem de sessão expirada e fluxo de "esqueci minha senha". |
| `src/pages/redefinir-senha/page.tsx` | Definição de nova senha pelo link do e-mail; trata link expirado. |

### Retornos de `session_context()` tratados

`unauthenticated`, `no_email`, `email_unverified`, `no_link`, `ambiguous`,
`concurrent`, `multiple_links`, `no_company`, `profile_inactive`, `linked`
(com `company_status` `suspended` e demais valores não-ativos bloqueados).

Nenhum desses casos usa fallback: não existe "entrar como admin" por padrão.

### Remoções

- `localStorage` (`sstek_role`, `sstek_email`, `sstek_subdomain`,
  `sstek_name`, `sstek_company`) não é mais lido em lugar algum.
- Seletor de perfil de demonstração removido da tela de login.
- Cartão "Modo demonstração" da barra lateral substituído pelo estado real da
  sessão.
- Sessão expirada: `SIGNED_OUT` limpa o estado e o `SessionGate` redireciona ao
  login com o aviso "Sua sessão expirou".

### Dados: fim dos fallbacks demonstrativos

- `regulationStore`: falha de leitura mostra erro (não injeta regulamento de
  demonstração) e não semeia conteúdo fictício.
- `documentsStore`: lista vazia é "sem registros"; o seed de documentos
  demonstrativos não roda mais.
- `epiStore` / `documentsStore`: resolução da empresa por subdomínio da sessão,
  **sem** fallback para "primeira empresa".

---

## 3. Ações legítimas do colaborador

O bloqueio genérico "somente admin escreve" impedia dois fluxos legítimos.
A solução não abre escrita direta em tabela: usa funções que derivam a
identidade no banco.

| Fluxo | Antes | Agora |
| --- | --- | --- |
| Aceite da ficha de EPI | `UPDATE` direto em `epi_deliveries` (negado pela RLS) | `epi_acknowledge_delivery(p_ref, p_signature)` — valida empresa + vínculo, grava **somente** `signature`, `status` e `updated_at`, exige assinatura ainda vazia. |
| Ciência do Regulamento | `UPSERT` direto em `internal_regulation_signatures` (negado) | `regulation_acknowledge(p_regulation_ref, p_pages_read, p_declaration)` — resolve `collaborator_id` pelo perfil, confere que a versão está `vigente`, grava nome/e-mail/função a partir de `company_collaborators`. |
| Participação em pesquisas | tabela sem nenhuma policy (impossível responder) | `survey_responses_insert` (própria resposta ou anônima) e `survey_responses_read` (própria, ou tudo para admin). |
| Humor diário | qualquer membro alterava o humor de colegas | escrita restrita ao próprio `user_key`; admin mantém acesso. |

`current_collaborator_ref()` deriva o colaborador de
`profiles.auth_user_id + company_id` — nunca de parâmetro enviado pelo cliente.

**Assinatura de documentos** já passava pela edge function `signature-engine`
(execução no servidor), portanto não depende de escrita direta do navegador.

---

## 4. Verificações executadas neste ambiente

| # | Verificação | Resultado |
| --- | --- | --- |
| 1 | Tabelas públicas com `relrowsecurity = false` | **0** |
| 2 | `company_domains` com RLS habilitada e forçada | OK |
| 3 | Policies de `company_domains` | apenas `tenant_domains_read` (SELECT/authenticated) |
| 4 | `session_context()` sem JWT | `unauthenticated` |
| 5 | Claims forjadas (`sub` inexistente + e-mail de colaborador real) | `no_email` — o e-mail do cliente foi **ignorado** |
| 6 | `current_company_id()` sem sessão | `null` (falha fechada) |
| 7 | `epi_acknowledge_delivery()` sem sessão | `{ok:false, reason:no_company}` |
| 8 | `regulation_acknowledge()` sem sessão | `{ok:false, reason:no_company}` |
| 9 | `caepi_active_catalog` | **42.033** registros (preservado) |
| 10 | `caepi_catalog_entries` | 78.033 registros históricos (preservado) |
| 11 | `platform_admins` | 0 (nenhum Superadministrador provisionado) |
| 12 | Empresas / perfis / domínios | 1 / 2 / 1 (sem resíduo de teste) |
| 13 | Build do projeto | sucesso |

## 5. Testes **não** executados (limitação concreta)

1. **`SET ROLE` bloqueado.** O executor recusa `set role`, `set local role` e
   `revoke`. Ele também roda como `postgres`, que tem `bypassrls`. Portanto
   **não é possível**, por esta ferramenta, executar consultas "como anon",
   "como colaborador" ou "como admin". Por isso a bateria com troca de papel
   ficou versionada em `supabase/tests/tenant_authorization.sql`.
2. **Teste de API com sessões reais.** Seria o complemento correto: criar
   usuários de teste no Auth, autenticar via `signInWithPassword` e repetir as
   chamadas com o token do usuário (sem service role). Isso depende de uma
   senha definida por você (ou pelo painel do Supabase) — não há como criar
   senha pelo SQL Editor, e o ambiente não expõe a service role para esta
   ferramenta. O roteiro está no item 6.
3. **`REVOKE` de privilégios de tabela** — bloqueado; migration entregue.

> Consequência: a camada de banco **não deve ser declarada "fechada"** até a
> bateria acima rodar no seu ambiente. O que está provado aqui é a configuração
> (RLS ligada, policies corretas, funções falhando fechado, catálogo intacto) e
> os testes de claims forjadas.

---

## 6. Roteiro do teste por API (sem service role)

Para cada usuário de teste (colaborador A, admin A, colaborador B):

```bash
# 1. autenticar
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"COLAB_A_EMAIL","password":"SENHA_DO_USUARIO"}'
# guardar access_token; NUNCA colar token em documento/relatório

# 2. chamar o contexto
curl -s "$SUPABASE_URL/rest/v1/rpc/session_context" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d ''

# 3. tentar ler dados da outra empresa
curl -s "$SUPABASE_URL/rest/v1/documents?select=ref,company_ref" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN"
# esperado: apenas registros da própria empresa

# 4. tentar escrever no catálogo
curl -s -X POST "$SUPABASE_URL/rest/v1/caepi_catalog_entries" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batch_id":"<uuid>","ca":"qa","ca_normalized":"QA"}'
# esperado: 42501 / row-level security policy

# 5. assinar ficha de EPI de outro colaborador
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/epi_acknowledge_delivery" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_ref":"REF_DE_OUTRO_COLABORADOR","p_signature":"teste"}'
# esperado: {"ok":false,"reason":"not_own_or_already_signed"}
```

Registrar no relatório apenas **resultado por cenário**, nunca tokens, senhas
ou chaves.

---

## 7. Provisionar o primeiro Superadministrador

Não existe credencial padrão, senha fictícia ou chave administrativa no front.

1. **Supabase → Authentication → Users → Add user**: informe seu e-mail e
   defina a senha você mesmo. Marque o e-mail como confirmado.
2. Copie o **UUID** do usuário na lista do Auth.
3. No SQL Editor, execute:

```sql
insert into public.platform_admins (auth_user_id, name, email)
values ('UUID-DO-USUARIO', 'Seu nome', 'seu@email.com');
```

4. Acesse `/app/empresas`, autentique com essa conta e confirme o painel.
5. Para revogar o vínculo (teste de revogação):

```sql
update public.platform_admins
   set status = 'suspended'
 where auth_user_id = 'UUID-DO-USUARIO';
```

Depois de revogar, o painel deve recusar o acesso mesmo com a sessão ativa
(o backend valida o vínculo em cada chamada; a tela não é a barreira).

**Estado atual:** `platform_admins` está vazio — o painel global permanece
inacessível até você executar os passos 1–3. Nenhuma conta foi criada por mim.

---

## 8. Pendências reais

1. Aplicar a migration `20261018140000_..._up.sql` no ambiente (contém os
   `REVOKE`s que a ferramenta não executa).
2. Rodar `supabase/tests/tenant_authorization.sql` no SQL Editor.
3. Rodar o roteiro de API do item 6 com usuários reais de teste.
4. Provisionar o primeiro Superadministrador (item 7).
5. **DNS e HTTPS de `vega` continuam `pending`.** O cadastro do subdomínio no
   sistema é independente da configuração em DNS, hospedagem e HTTPS — nada foi
   marcado como verificado.
6. `profiles` está com 2 registros sem `auth_user_id`; cada colaborador real
   precisa de um perfil pré-autorizado (e-mail igual ao do Auth) para entrar.
7. Alguns módulos ainda leem/gravam via stores com dados de referência em
   `src/mocks` (lista de colaboradores para exibição). A autorização é real,
   mas a fonte de verdade desses cadastros ainda precisa migrar para
   `company_collaborators`.