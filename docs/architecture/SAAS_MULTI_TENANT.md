# SSTEK — Arquitetura Alvo Multi-Tenant

> **Documento técnico oficial de referência.**
> Elaborado na **DIRETRIZ 003** (documento arquitetural alvo) e oficializado no repositório pela **DIRETRIZ 004**.
> **Versão:** 1.0
> **Data de oficialização:** 2026-10-13
> **Status:** aprovado como referência arquitetural — **sem implementação nesta fase**.
> **Documento correlato:** [`ESTABLISHMENTS_INVENTORY.md`](./ESTABLISHMENTS_INVENTORY.md) (Inventário Técnico de Estabelecimentos v1.0 — detalha a coluna `establishment`/`unit` e a Fase F2).

---

## Legenda de evidência (obrigatória em todo o documento)

| Marca | Significado |
|---|---|
| ✅ **CONFIRMADO** | Observado diretamente no código e/ou no banco de dados do projeto (SaaS Supabase, versão 74). |
| 💡 **PLANEJADO** | Arquitetura/recomendação proposta. **Ainda não existe** no sistema. |
| ⛔ **PENDENTE** | Requisito obrigatório **antes da produção/comercialização**. Não resolvido hoje. |

> **Regra de leitura:** nada é declarado implementado sem evidência. Os nomes de tabelas da diretriz (`tenants`, `tenant_users`, `establishments`, etc.) são **referências arquiteturais**; o SSTEK **reaproveita** entidades existentes e **não renomeia** tabelas nesta fase.

---

## 1. Modelo conceitual Multi-Tenant

O SSTEK é uma **aplicação SaaS Multi-Tenant com código compartilhado (single codebase)** que atende **muitas empresas contratantes (tenants)** com dados isolados logicamente.

### 1.1 Padronização conceitual (equivalências)

| Conceito SaaS | O que já existe no SSTEK | Decisão |
|---|---|---|
| `tenants` (empresa contratante) | **`companies`** ✅ | `companies` **é** o tenant. Não renomear. |
| `tenant_users` (vínculo usuário↔empresa) | **`profiles`** ✅ | `profiles` **é** a identidade + vínculo empresarial atual. |
| `company_id` (identificador canônico) | `company_id (uuid)` ✅ | **UUID canônico** do tenant. Preferir `company_id` sobre `company_ref (text)`. |
| `establishments` (estabelecimentos) | coluna `text establishment` ✅ | ⚠️ Ainda **não é entidade**; hoje é texto livre. |
| `tenant_domains` (domínios/subdomínios) | `companies.subdomain` ✅ | ⚠️ Atributo da empresa, ainda não é tabela. |
| `subscriptions` (licenças comerciais) | inexistente ✅ (planos só em `src/mocks/site.ts`) | A criar na fase comercial. 💡 |

### 1.2 Estruturas de identidade e configuração — estado atual (✅ CONFIRMADO)

- **`companies`**: `id, name, subdomain, legal_name, cnpj, status, created_at`.
- **`profiles`**: `id, company_id, auth_user_id, role, collaborator_ref, name, email, email_verified_at, phone, phone_verified_at, status, sessions_invalidated_at, created_at, updated_at`.
- **`company_collaborators`**: possui `company_id` **e** `establishment (text)`, além de `manager_ref` e dados cadastrais.
- **`system_settings`**: **linha única global** (`id integer = 1`) com `logo_url, letterhead_url, company_legal_name, company_cnpj, technical_responsible, technical_registration, validar_ca_ativo_no_epi`.
- **Base atual:** 43 tabelas, 1 empresa, 1 perfil (ambiente demonstrativo).

### 1.3 Premissa crítica para o futuro

Hoje `profiles` tem **`company_id` singular** (1 perfil → 1 empresa). A arquitetura **deverá permitir um usuário vinculado a mais de uma empresa**, **sem presumir** que a estrutura atual já suporta isso. → Tratado como **requisito de migração** (§8). 💡

---

## 2. Hierarquia das entidades (SaaS)

```
SSTEK (plataforma global)
 └── Empresa contratante / Tenant ................ companies
      └── Estabelecimento ........................ establishments (futuro) / establishment (texto hoje)
           └── Colaborador ........................ company_collaborators
                └── Módulos, documentos e processos
                     ├── Documentos & assinaturas ... documents, signature_*
                     ├── EPI ........................ epi_deliveries
                     ├── DDS / APR ................. dds_records, apr_records
                     ├── CIPA ...................... cipa_* (comitês, eleições, urna, atas)
                     ├── Inspeções ................. field_inspections, cipa_inspections
                     └── Clima / Sentimento ........ daily_moods
```

**Permissões deverão considerar três dimensões** 💡: **empresa** (tenant) × **estabelecimento** × **perfil do usuário**. Um mesmo perfil pode ter escopos diferentes por estabelecimento.

**Princípios obrigatórios de arquitetura:**
- Aplicação SaaS Multi-Tenant com **código compartilhado**.
- `companies` como **entidade empresarial principal**.
- `company_id` como **identificador canônico do tenant**.
- **Isolamento** de informações por empresa e estabelecimento.
- **Administração global separada** da administração empresarial.
- Preparação para **subdomínios individuais**.
- **Licenciamento e planos comerciais centralizados**.
- **Independência planejada** da infraestrutura atual de desenvolvimento.

---

## 3. Mapeamento entre tabelas atuais e arquitetura futura

✅ A arquitetura alvo **não recria** o que existe; mapeia e promove.

| Alvo (diretriz) | Estado atual (confirmado) | Ação futura |
|---|---|---|
| `tenants` | `companies` ✅ | **Reaproveitar** (alias conceitual). |
| `tenant_users` | `profiles` ✅ | **Reaproveitar**; evoluir para N empresas por usuário na fase de identidade. 💡 |
| `establishments` | coluna `text` em ~8 tabelas ✅ | **Criar** entidade e **migrar as strings** para FK (preservando histórico). 💡 |
| `roles_permissions` | papel em `profiles.role` (texto) ✅ | **Criar** catálogo de perfis + permissões. 💡 |
| `subscription_plans` | inexistente (só mocks) ✅ | **Criar**. 💡 |
| `subscriptions` | inexistente ✅ | **Criar**. 💡 |
| `tenant_domains` | `companies.subdomain` ✅ | **Criar** tabela (1..N domínios por tenant). 💡 |
| `audit_logs` | só auditorias pontuais (`signature_audit_log`, `cipa_election_events`) ✅ | **Criar** log global append-only. 💡 |

**Tabela central de configuração — ponto crítico:** `system_settings` é **global (linha única)** ✅. Hoje **branding, razão social, CNPJ e responsável técnico são únicos para toda a plataforma** — fere o isolamento por tenant. **Alvo:** `system_settings` por `company_id`. 💡 ⛔

**Chave de tenant observada:** a maioria das tabelas tem `company_ref (text)` e/ou `company_id (uuid)` ✅. **Alvo:** `company_id` como chave canônica obrigatória e indexada; `company_ref` tratado como legado (deprecação gradual). 💡

> **Regra:** não criar estruturas duplicadas quando já existir entidade equivalente. Antes de implementar qualquer novo módulo, verificar os relacionamentos entre empresa, estabelecimento, colaborador, perfil e permissões.

---

## 4. Relacionamentos empresariais e por estabelecimento

- **Empresa → estabelecimento:** 1..N. Hoje "estabelecimento" é apenas o **mesmo valor de texto** repetido em `company_collaborators.establishment`, `documents`, `epi_deliveries`, `cipa_committees.unit`, etc. ✅ → risco de inconsistência. **Alvo:** entidade `establishments (tenant_id, nome, cnpj, cidade, grau de risco)` referenciada por FK. 💡
- **Estabelecimento → colaborador:** hoje `company_collaborators` pertence ao `company_id`; a filial é derivada do campo `establishment` ✅. **Alvo:** `company_collaborators.establishment_id (FK)`. 💡
- **Estabelecimento → documentos/processos:** CIPA já organiza por `unit` (`cipa_committees.unit`) ✅. **Alvo:** `unit` passa a referenciar `establishments`. 💡
- **Gestão/liderança:** `company_collaborators.manager_ref` indica liderança por ref ✅. **Alvo:** resolver liderança/permissão também por estabelecimento. 💡

**Regra:** todo registro operacional deriva seu tenant por **relacionamento seguro** (direto por `company_id`, ou via colaborador/estabelecimento do mesmo tenant) — nunca por um valor enviado livremente pelo cliente.

---

## 5. Estratégia de identificação por subdomínio

**Estado atual** ✅: a empresa é resolvida por um **`subdomain` de texto** vindo do `localStorage` / `location.state`, com **default `"vega"`**; o resolver cai para **"primeira empresa"** (`limit(1)`) quando o subdomínio não corresponde.

**Modelo alvo** 💡:

```
https://empresa.sstek.com.br      → hostname identifica o tenant (resolução → company)
https://admin.sstek.com.br        → administração global (cross-tenant)
https://sstek.com.br              → site institucional
```

**Princípios obrigatórios:**
1. **O subdomínio identifica o tenant — nunca autoriza.** Ele indica *qual* empresa; a **autorização definitiva vem da identidade autenticada + permissões**.
2. **Fim do fallback silencioso para "primeira empresa":** subdomínio inválido/desconhecido → **erro explícito**, nunca gravar/ler em tenant aleatório. ⛔
3. **Tabela `tenant_domains`** (1..N domínios por tenant) como fonte de verdade hostname → company, permitindo domínio próprio no futuro. 💡
4. **Proibido** confiar em `tenant_id`/`subdomain` embutido em URL ou payload para autorizar — validar sempre no backend/RLS. ⛔
5. **Nesta fase:** **não implementar** DNS, certificados ou roteamento real.

---

## 6. Modelo futuro de perfis e permissões

**Hoje** ✅: `profiles.role` é `text`; existe `auth_user_id` (nunca usado); não há catálogo de permissões; não existe separação entre admin global e empresarial.

**Alvo** 💡 — modelo em três níveis, separando **identidade** de **permissão**:
- **Identidade global:** `auth.users` (Supabase Auth) ↔ `profiles` (por usuário).
- **Vínculo multi-empresa:** associação `tenant_users`/`memberships` (usuário ↔ empresa ↔ perfil), permitindo **N empresas por usuário**.
- **Perfil & permissão:** `roles_permissions` com papéis (ex.: `super_admin` global, `tenant_admin`, `sst_engineer`, `supervisor`, `reader`) e escopo por **estabelecimento**.
- **Administração global × empresarial:** `super_admin` (cross-tenant) é **diferente** de `tenant_admin` (só a própria empresa). Hoje essa separação **não existe**. ⛔

Dimensões de permissão: **tenant scope + establishment scope + role/permission**.

---

## 7. Separação entre demonstração e produção

**Preservar integralmente nesta fase** (ambiente demonstrativo):
- Autenticação simplificada (`localStorage`: `sstek_role`, `sstek_email`, `sstek_subdomain`).
- Alternância rápida entre perfis.
- Dados simulados.
- Funcionalidades e telas existentes.
- Banco Supabase atual de desenvolvimento.

**Alvo** 💡 — separação **explícita** entre os dois modos:
- **Modo demonstração:** sessão de simulação claramente sinalizada; permissões *podem* ser afrouxadas **apenas** para navegação de interface. Funciona **somente** em dev/teste.
- **Modo produção:** autenticação real obrigatória; o modo demonstração **não pode** existir/ativo.
- **Regra dura:** o modo demonstração **jamais** pode ser usado para **contornar permissões**. Não é um bypass de autorização — é uma camada separada, com flag de ambiente que **trava** em produção. ⛔

---

## 8. Dependências e requisitos de migração

### 8.1 Dependências confirmadas do fornecedor atual (SaaS Supabase) — travam migração ✅
- **Client JS** `@supabase/supabase-js` (anon) no front; **service role** nas edges.
- **Storage:** buckets `branding` (público) e `documents` (privado, link assinado).
- **Edge Functions:** `signature-engine`, `cipa-vote` (`verify_jwt: false` no modo demo).
- **RPC/PLpgSQL:** `cipa_cast_ballot`, funções `sg_*` do motor de assinatura + **triggers de guarda** (inviolabilidade da urna/base eleitoral).
- **Auth:** `profiles.auth_user_id` existe, porém **sem uso real**.

### 8.2 Requisitos de migração 💡 (não executar nesta diretriz)
- Backup + **migrações versionadas** em SQL, **reversíveis**.
- Migrar `establishment` (texto) → FK, **preservando histórico e evidências de assinatura**.
- `system_settings` global → **por tenant**, com branding em `branding/<tenant_id>/...`.
- Introduzir **chave de tenant obrigatória + índice** em toda tabela operacional.
- **Camada de adapters** (`dataSource` / `storageAdapter` / `identityProvider`) para independência de fornecedor.
- Prioridade de compatibilidade com **PostgreSQL**.

---

## 9. Sequência recomendada das próximas implementações

💡 Ordenada por risco/benefício e menor *blast radius*. Nenhuma etapa inicia sem aprovação explícita.

| Fase | Escopo | Objetivo |
|---|---|---|
| **F0 — Blindagem** | RLS real por identidade; fim do fallback "primeira empresa"; `system_settings` por tenant | Atacar o risco crítico de segurança **sem migrar dados** |
| **F1 — Identidade real** | Supabase Auth; `auth.getUser()` nas edges; tenant via `profiles`; invalidar sessões; separar admin global × empresarial | Autorização efetiva no backend |
| **F2 — Entidades de tenancy** | `establishments`, `tenant_domains`, `audit_logs`; migrar strings → FK | Formalizar tenant e estabelecimento |
| **F3 — Comercial** | `subscription_plans`, `subscriptions`; bloqueio por inadimplência; domínio/subdomínio por tenant | Licenciamento centralizado |
| **F4 — Persistência do demonstrativo** | Tirar de memória o que ainda é mock (ex.: partes da composição/votos de exibição da CIPA) | Consolidar dados sem quebrar contratos |
| **F5 — Independência de infraestrutura** | Adapters + migrações versionadas + relatório de dependências | Reduzir acoplamento ao fornecedor |

> ⚠️ **Registro de risco (F0):** hoje o banco tem **RLS "ligado" mas aberto** (policies `QUAL = true` / `WITH CHECK = true` para `{public}`). Com a `ANON_KEY` (pública, no bundle), qualquer pessoa pode ler/escrever dados de **todas** as empresas. É a **pendência nº 1**. ⛔

> 📎 **Detalhamento da F2 (estabelecimentos):** o levantamento completo das **18 colunas em 14 tabelas** que hoje guardam estabelecimento como texto livre, suas inconsistências, o modelo proposto de `establishments`, o plano de migração por etapas (F2.0–F2.6) e as decisões E1–E5 estão em [`ESTABLISHMENTS_INVENTORY.md`](./ESTABLISHMENTS_INVENTORY.md). O **plano técnico executável da F2.0** (SQL proposto, seeds, normalização, RLS, rollback e checklist) está em [`F2_0_ESTABLISHMENTS_PLAN.md`](./F2_0_ESTABLISHMENTS_PLAN.md). Esses documentos **não alteram** nenhuma decisão desta arquitetura — apenas a detalham.

---

## 10. Segurança e produção — pendências obrigatórias antes da comercialização ⛔

1. Autenticação real e autorização no backend.
2. RLS efetiva por empresa (por identidade, nunca por subdomínio).
3. Eliminação do fallback para a primeira empresa.
4. Configurações empresariais segregadas (`system_settings` por tenant).
5. Proteção de documentos e evidências de assinatura.
6. Segurança e sigilo das eleições CIPA.
7. Auditoria de acessos e operações (`audit_logs` append-only).
8. Testes de isolamento entre empresas.
9. Desativação segura do modo demonstração em produção.

> **Enquanto essas pendências não forem resolvidas, o sistema NÃO deve ser considerado seguro para dados reais.** O ambiente atual continua **exclusivamente com dados fictícios**, acesso restrito e **sem exposição pública de informações sensíveis**.

### Critérios de aceitação (testes de isolamento)
- Usuário do tenant A **não** lê/escreve nenhum registro do tenant B (SELECT/INSERT/UPDATE/DELETE — provado **no banco**, não na tela).
- Subdomínio forjado **não** concede acesso.
- Branding/settings de A **não** aparecem em B.
- Operações críticas geram `audit_logs` append-only.
- Regressão funcional: os módulos existentes (Documentos, Colaboradores, EPI, DDS, APR, Assinaturas, CIPA/urna) continuam operando após cada fase.

---

## 11. Registro de decisões arquiteturais (ADR resumido)

| # | Decisão | Evidência | Status |
|---|---|---|---|
| D1 | `companies` é o tenant; `company_id` é a chave canônica. | `companies`, `profiles` ✅ | Aprovado |
| D2 | Não renomear tabelas existentes; mapear equivalências. | Diretriz 003 §1 | Aprovado |
| D3 | `profiles` é a identidade + vínculo atual; multi-empresa por usuário é evolução futura. | `profiles.company_id` singular ✅ | Aprovado |
| D4 | `establishments` deve virar entidade; hoje é texto livre. | coluna `establishment (text)` ✅ | Planejado 💡 |
| D5 | Subdomínio identifica, mas **não autoriza**; eliminar fallback. | resolver com `limit(1)` ✅ | Pendente ⛔ |
| D6 | `system_settings` deve ser segregado por tenant. | linha única global `id=1` ✅ | Pendente ⛔ |
| D7 | Separar administração global × empresarial. | só `profiles.role (text)` ✅ | Planejado 💡 |
| D8 | Separar explicitamente modo demonstração × produção. | login simplificado ✅ | Planejado 💡 |
| D9 | Não criar estruturas duplicadas a entidades existentes. | Diretriz 003/004 | Aprovado |
| D10 | Independência de infraestrutura via adapters + migrações versionadas. | dependências Supabase ✅ | Planejado 💡 |

---

## 12. Registro da execução desta diretriz

- **Arquivo criado:** `docs/architecture/SAAS_MULTI_TENANT.md`
- **Versão do documento:** 1.0
- **Diretriz de origem:** DIRETRIZ 003 (conteúdo arquitetural) — DIRETRIZ 004 (oficialização no repositório).
- **Atualização posterior (DIRETRIZ 006):** adicionada **referência cruzada** a [`ESTABLISHMENTS_INVENTORY.md`](./ESTABLISHMENTS_INVENTORY.md) no cabeçalho e na §9. **Nenhuma decisão arquitetural aprovada foi alterada.**
- **Alterações funcionais nesta diretriz:** **nenhuma.**
  - Nenhuma tabela criada, alterada ou removida.
  - Nenhum registro modificado.
  - Nenhuma autenticação, política RLS, Storage, Edge Function ou funcionalidade alterada.
  - Nenhuma migração executada.
- **Escopo desta diretriz:** criação exclusiva deste documento técnico.

---

*Fim do documento — SSTEK · Arquitetura Alvo Multi-Tenant · v1.0*