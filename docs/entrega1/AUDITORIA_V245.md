# AUDITORIA PREVENTIVA — ENTREGA 1 | v245

> **Regra da rodada:** nenhuma migration, policy, GRANT, REVOKE ou escrita foi
> executada. Todas as afirmações abaixo vêm de leitura (`pg_policies`,
> `pg_proc`, `pg_class`, `pg_constraint`) ou de avaliação direta de função
> **sem claims de JWT** — condição idêntica à de `anon`.
> **A ficha pública continua bloqueada (503).**

---

## 1. Integridade documental (Etapa 1)

| Item | Resultado |
|---|---|
| `verify_package.py` disponível no repositório | **sim** (leitura do arquivo) |
| Ambiente de execução Python nesta sessão | **não** |
| Verificador executado | **não** |
| 17 blocos presentes | **sim** — 17 marcadores, ordem de dependência correta |
| SHA-256 calculado | **não** |
| Manifesto gerado | **não** — registrado como impedimento |

**Integridade: NÃO COMPROVADA.** Detalhe em `MANIFESTO_INTEGRIDADE.txt`.
Nenhum hash foi estimado.

---

## 2. Matriz de risco das nove policies com `'super'` (Etapa 2)

Fonte: `pg_policies` (schema `public`), lido agora.

| # | Tabela | Policy | cmd | Papéis | Isolamento por empresa | `'super'` muda algo? |
|---|---|---|---|---|---|---|
| 1 | `apr_records` | `apr_records_collaborator_insert` | INSERT | `authenticated` | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 2 | `apr_records` | `apr_records_collaborator_update` | UPDATE | `authenticated` | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 3 | `medical_certificate_followups` | `medical_certificate_followups_insert` | INSERT | **`public`** | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 4 | `medical_certificate_followups` | `medical_certificate_followups_read` | SELECT | **`public`** | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 5 | `medical_certificate_followups` | `medical_certificate_followups_update` | UPDATE | **`public`** | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 6 | `medical_certificates` | `medical_certificates_insert` | INSERT | `authenticated` | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 7 | `medical_certificates` | `medical_certificates_read` | SELECT | `authenticated` | `is_current_company_ref(company_ref)` | **não** (ramo morto) |
| 8 | `mood_followups` | `mood_followups_update` | UPDATE | **`public`** | `is_current_company_name(company)` | **não** (ramo morto) |
| 9 | `mood_followups` | `mood_followups_write` | INSERT | **`public`** | `is_current_company_name(company)` | **não** (ramo morto) |

Todas são **PERMISSIVE** (somam por OR). Nenhuma é RESTRICTIVE.

### 2.1 Por que o ramo `'super'` é código morto — prova

| Verificação | Resultado lido |
|---|---|
| `profiles_role_check` | `CHECK (role = ANY (ARRAY['admin','collaborator']))` |
| `current_company_role()` | devolve `profiles.role` do vínculo único ativo |
| Portanto `current_company_role() = 'super'` | **impossível** — o CHECK vale para todo papel, inclusive `service_role` |

**Consequência:** remover `'super'` dessas expressões é **no-op semântico**.
Não há perda de funcionalidade, não há ganho de segurança imediato — o valor é
eliminar uma condição enganosa que induz erro em auditoria futura.

### 2.2 Concessão a `anon` / `PUBLIC`

| Fato | Valor lido |
|---|---|
| Policies entre as 9 concedidas a `public` (inclui `anon`) | **5** (#3, #4, #5, #8, #9) |
| Privilégios de **tabela** de `anon` nas 4 tabelas | `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` |
| Privilégios de `anon` nos helpers usados | `current_company_id`, `current_company_ref`, `current_company_role`, `is_current_company_ref`, `is_current_company_name` → **sem** `anon`, **sem** PUBLIC |
| Exceções | `current_collaborator_ref` (PUBLIC + `anon`), `current_company_subdomain` (`anon`) — ver §3 |

**Avaliação:** o único obstáculo entre `anon` e essas 4 tabelas é a RLS. As
funções de escopo devolvem `null` sem claims (comprovado em §3.2), e o
`CHECK`/`USING` falha com `null` → negação. **Não é exploração aberta**, mas é
uma pilha de defesa com uma camada só. `TRUNCATE` merece nota: **não é filtrado
por RLS** — não é alcançável pelo PostgREST, porém é privilégio desnecessário
para `anon` (defesa em profundidade, não bloqueante).

### 2.3 Caminhos de acesso alternativos (não é `'super'`, mas fica registrado)

| Caminho | Fato lido | Avaliação |
|---|---|---|
| `resolve_tenant(p_subdomain)` | `SECURITY DEFINER`, dono `postgres`, `search_path=public`, **executável por `anon`**, devolve `companies(id,name,subdomain,status)` para qualquer subdomínio | Enumeração de tenants por anônimo. **Intencional** (login por subdomínio). Risco: coleta de nomes de clientes. Candidato a rate-limit; fora de escopo |
| `tenant_effective_access()` | `SECURITY DEFINER`, executável por `anon` | Avaliado sem claims: devolve `{"role":null,"permissions":,"fullAccess":false,...}` — **sem vazamento** |
| `mood_followups_read` | `to public`, `qual = is_current_company_name(company)` | **Fora do escopo de `'super'`**: qualquer membro da empresa (inclusive colaborador) lê **todos** os acompanhamentos de humor da empresa. Leitura ampla; registrar para a próxima entrega |
| `apr_records_collaborator_insert` | exige `role = ANY('colaborador','admin','super')` | **`'colaborador'` também é morto** (valor real: `'collaborator'`). Na prática essa policy só serve `admin`; colaborador entra por `..._insert_v2` |

### 2.4 Proposta de correção mínima (NÃO EXECUTADA)

Usar `ALTER POLICY` — preserva tudo, sem janela sem policy e sem recriar nada:

```sql
-- NÃO EXECUTAR NESTA ETAPA. Somente proposta para revisão.
begin;

alter policy apr_records_collaborator_insert on public.apr_records
  with check (
    is_current_company_ref(company_ref)
    and current_company_role() = any (array['colaborador','admin'])
    and (created_by_ref is null
         or created_by_ref = current_collaborator_ref()
         or current_company_role() = 'admin')
  );

alter policy apr_records_collaborator_update on public.apr_records
  using (is_current_company_ref(company_ref)
         and (current_company_role() = 'admin' or created_by_ref = current_collaborator_ref()))
  with check (is_current_company_ref(company_ref)
         and (current_company_role() = 'admin' or created_by_ref = current_collaborator_ref()));

alter policy medical_certificate_followups_insert on public.medical_certificate_followups
  to authenticated
  with check (is_current_company_ref(company_ref) and current_company_role() = 'admin');

alter policy medical_certificate_followups_read on public.medical_certificate_followups
  to authenticated
  using (is_current_company_ref(company_ref)
         and (current_company_role() = 'admin' or collaborator_ref = current_collaborator_ref()));

alter policy medical_certificate_followups_update on public.medical_certificate_followups
  to authenticated
  using (is_current_company_ref(company_ref) and current_company_role() = 'admin')
  with check (is_current_company_ref(company_ref) and current_company_role() = 'admin');

alter policy medical_certificates_insert on public.medical_certificates
  with check (is_current_company_ref(company_ref)
         and (current_company_role() = 'admin' or collaborator_ref = current_collaborator_ref()));

alter policy medical_certificates_read on public.medical_certificates
  using (is_current_company_ref(company_ref)
         and (current_company_role() = 'admin' or collaborator_ref = current_collaborator_ref()));

alter policy mood_followups_update on public.mood_followups
  to authenticated
  using (is_current_company_name(company) and current_company_role() = 'admin')
  with check (is_current_company_name(company) and current_company_role() = 'admin');

alter policy mood_followups_write on public.mood_followups
  to authenticated
  with check (is_current_company_name(company) and current_company_role() = 'admin');

commit;
```

Ganho: remove a condição morta **e** fecha `anon` nas 5 policies `to public`.
Custo funcional esperado: **zero** (as mesmas identidades continuam
autorizadas, porque `anon` nunca passava). Precisa de teste antes de aplicar.

Fora do escopo desta proposta: `mood_followups_read`, `'colaborador'`,
revogar `TRUNCATE` de `anon`.

---

## 3. Diagnóstico dos dois helpers (Etapa 3)

### 3.1 Estado real (`pg_proc` + `aclexplode`)

| Função | Assinatura | Schema | Dono | Modo | `search_path` | `anon` | PUBLIC | ACL |
|---|---|---|---|---|---|---|---|---|
| `current_collaborator_ref` | `()` → `text` | `public` | `postgres` | **SECURITY DEFINER** | `''` (vazio) | **`true`** | **`true`** (`=X/postgres`) | `=X/postgres, postgres=X, anon=X, authenticated=X, service_role=X` |
| `current_company_subdomain` | `()` → `text` | `public` | `postgres` | **SECURITY DEFINER** | `''` (vazio) | **`true`** | `false` | `postgres=X, anon=X, authenticated=X, service_role=X` |

Sem `SECURITY INVOKER` em nenhum dos dois. Ambos são expostos como RPC no schema
`public` (que o PostgREST publica), portanto alcançáveis por
`POST /rest/v1/rpc/<nome>` com a anon key.

### 3.2 Comportamento sem claims (equivalente a `anon`) — avaliado agora

Execução direta das funções na condição "sem JWT" (`auth.uid() is null` = `true`):

| Expressão | Resultado |
|---|---|
| `current_collaborator_ref()` | `null` |
| `current_company_subdomain()` | `null` |
| `current_company_id()` | `null` |
| `resolve_tenant('subdominio-inexistente-probe')` | `0` linhas |
| `tenant_effective_access()` | `{role:null, permissions:{}}` |

### 3.3 Veredito — privilégio indevido, **não** vulnerabilidade explorável hoje

- **Exposição de dados:** não. Sem `auth.uid()`, as duas funções devolvem
  `null`; com claims de um usuário A, devolvem **o próprio** ref e o **próprio**
  subdomínio — dado que A já conhece e que a interface precisa.
- **Execução indevida:** não há efeito colateral — são `STABLE`, `sql`, sem
  escrita.
- **Contorno de isolamento:** não. Elas são **entrada** do isolamento; devolver
  `null` faz as policies negarem (fail-closed).
- **Risco real:** **higiiene de privilégio + superfície desnecessária**.
  `PUBLIC` em `current_collaborator_ref()` é herdado por qualquer papel criado
  no futuro, inclusive papéis que nunca deveriam alcançar funções de tenant. Se
  a assinatura um dia ganhar parâmetro (ex.: `p_uid`), o grant vira incidente.
- **Não foi testado por HTTP.** A conclusão vem da avaliação da função na
  condição sem claims, não de uma chamada `POST /rest/v1/rpc/...`. Registro isso
  porque a diferença importa.

Correção já existe no pacote (migration 3, seção 2.1) — **não aplicada**.

### 3.4 Lacuna encontrada agora: 2 helpers ficaram fora da seção 2.1

A seção 2.1 (`20261101100300_..._up.sql`, linhas 204–242) cobre **7** funções:
`current_collaborator_ref`, `current_company_subdomain`, `current_company_id`,
`current_company_role`, `is_current_company_ref`, `is_company_member`,
`is_company_admin`.

`SESSION_HELPERS_APPLIED.sql` documenta **10** (as 7 + `is_current_company_name`,
`is_platform_admin`) e concede `authenticated` nas 10.

Também fora da 2.1: `is_current_company_name(text)` e `is_platform_admin()`.
Hoje o ACL delas está correto (sem `anon`, sem PUBLIC), **mas** em um ambiente
novo criado pela baseline elas nasceriam com `EXECUTE` para `PUBLIC` (padrão do
PostgreSQL para funções novas) e a migration 3 **não** as corrigiria.

**Correção proposta:** a baseline (§4) já revoga `PUBLIC`/`anon` e concede
`authenticated` nas **10**. Adicionalmente, ao aplicar o pacote no ambiente
atual, incluir:

```sql
-- complemento da seção 2.1 (NÃO EXECUTAR AGORA)
revoke all on function public.is_current_company_name(text) from public;
revoke all on function public.is_current_company_name(text) from anon;
grant execute on function public.is_current_company_name(text) to authenticated;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_platform_admin() from anon;
grant execute on function public.is_platform_admin() to authenticated;
```

**Não editei a migration 3 nesta rodada de propósito:** alterá-la quebraria a
correspondência do bloco 4 do TXT (§1). O ajuste entra como complemento, e o
TXT só muda quando o verificador estiver rodando e o manifesto for regerado.

---

## 4. Reprodutibilidade — baseline dos helpers (Etapa 4)

### 4.1 Dependências reais das 10 funções

| Dependência | Uso | Versionada no repositório? |
|---|---|---|
| `public.profiles(auth_user_id, company_id, role, status, collaborator_ref)` | id, role, subdomain, collaborator_ref | **NÃO** |
| `public.companies(id, subdomain, name, status)` | id, ref, nome, status | **NÃO** |
| `public.platform_admins(auth_user_id, status)` | `is_platform_admin()` | sim (`20261018120000`) |
| `auth.uid()` | todas | runtime do Supabase |
| `pgcrypto` (`gen_random_uuid`) | não usada por estas funções | — |

**Achado bloqueante:** `companies`, `profiles`, `documents`,
`medical_certificates` e `internal_regulations` **não têm `CREATE TABLE` em
nenhum arquivo de `supabase/migrations/`** (varredura por `create table`: 11
arquivos, nenhum desses). Elas existem apenas no banco.

Isso significa que **um projeto novo não é reconstruível a partir do
repositório**, nem com a baseline dos helpers. O passo 3 do §0.1 do README
("aplicar o schema de base") pressupõe algo que o repositório não contém.

### 4.2 Proposta de baseline

Arquivo: `docs/entrega1/BASELINE_SESSION_HELPERS_PROPOSED.sql` (em `docs/`, **não**
em `supabase/migrations/`, para nenhum runner aplicá-lo por acidente).

| Requisito | Como foi atendido |
|---|---|
| Não sobrescrever definição existente | guarda inicial **aborta** se qualquer uma das 10 já existir; usa `create function`, nunca `create or replace` |
| Reproduzível | corpos idênticos aos efetivos (`search_path=''`, `STABLE`, `SECURITY DEFINER`, dono = quem executa) |
| Sem efeito colateral no ambiente atual | aborta antes de qualquer `CREATE`/`GRANT` |
| Fecha `PUBLIC`/`anon` | 10 × `revoke ... from public`, `revoke ... from anon`, `grant ... to authenticated` |
| Numeração | proposta `20261101090000_baseline_session_helpers_up.sql` — ordena **antes** de `20261101100000` |
| Pré-requisito | exige `companies`, `profiles`, `platform_admins`; falha alto se faltarem |

**Adoção:** só depois de resolver §4.1. Aplicar a baseline sozinha em um banco
vazio falha (correto: falha alto em vez de criar um ambiente meio pronto).

---

## 5. Homologação isolada — checklist atualizado (Etapa 5)

| # | Requisito | Estado |
|---|---|---|
| 1 | Projeto Supabase descartável, independente do atual | **pendente** |
| 2 | Credenciais próprias (`URL`, `anon`, `service_role`) do projeto isolado | pendente (nunca no chat) |
| 3 | Sem conexão de escrita com o ambiente atual | pendente |
| 4 | Identificação verificável do projeto (ref do projeto conferido antes de cada passo) | **procedimento inexistente — adicionar** |
| 5 | `pgcrypto` habilitado | pendente |
| 6 | **Schema de base aplicável a partir do repositório** | **BLOQUEADO (§4.1)** |
| 7 | `20261101100000_company_settings` aplicada antes (pré-requisito) | pendente |
| 8 | Baseline dos 10 helpers (`20261101090000`) | proposta pronta, não adotada |
| 9 | 4 usuários + vínculos da fixture (`A-admin`, `A-colab`, `B-admin`, `B-colab`) | script pronto, não executado |
| 10 | 4 sessões `authenticated` + 1 cliente `anon` | pendente |
| 11 | Inventário + hash de `storage.objects` capturados **no isolado** | pendente |
| 12 | Script mestre aplicado em transação externa | pendente |
| 13 | Testes base 1–28, P1–P12, C1–C4, E1–E9, S1–S2, EX1–EX2 | **nenhum executado** |
| 14 | Evidência por teste (código de erro + horário) | pendente |
| 15 | Confirmação do EXECUTE efetivo pós-pacote (§10.4 do README) | pendente |
| 16 | Nenhuma prova baseada em consulta como `postgres` (`rolbypassrls = true`) | regra respeitada nesta rodada |
| 17 | Teardown executado ao final | script pronto, não executado |

**Item 4 (identificação verificável) — procedimento proposto:** antes de cada
passo, conferir
`select current_setting('supabase.project_ref', true)` **ou** comparar
`supabase/config.toml`/`.env` local com o ref do projeto descartável, e registrar
o ref no cabeçalho do arquivo de evidências. Se o ref bater com o projeto de
produção, **abortar**.

---

## 6. Pendências

### Bloqueantes (impedem declarar o pacote validado)

| ID | Pendência |
|---|---|
| B1 | Ambiente isolado não provisionado — nenhum teste executado |
| B2 | **Schema de base não versionado** (§4.1): ambiente novo não é reconstruível só com o repositório |
| B3 | Integridade sem SHA-256 (§1) — verificador não executável nesta sessão |
| B4 | `is_current_company_name(text)` e `is_platform_admin()` fora da seção 2.1 (§3.4) |
| B5 | Testes do §12 do README sem execução e sem evidência |

### Não bloqueantes (registrar, corrigir na próxima entrega)

| ID | Pendência |
|---|---|
| N1 | `'super'` morto em 9 policies — proposta pronta (§2.4) |
| N2 | 5 dessas policies `to public` (inclui `anon`) |
| N3 | `mood_followups_read` amplo para qualquer membro |
| N4 | `'colaborador'` morto em `apr_records_collaborator_insert` |
| N5 | `anon` com `TRUNCATE/REFERENCES/TRIGGER` nas 4 tabelas (padrão da plataforma) |
| N6 | `resolve_tenant` permite enumeração de subdomínios por `anon` (intencional) |
| N7 | `system_audit_logs` com `relforcerowsecurity = false` (documentado no README §7) |
| N8 | `PUBLIC`/`anon` nos 2 helpers — corrigido **no código**, ativo no banco até aplicar |

---

## 7. Nada foi alterado no banco

* migrations executadas: **0**
* policies criadas/alteradas: **0**
* `GRANT`/`REVOKE`: **0**
* escritas em dados: **0**
* ficha pública: **bloqueada (503)**