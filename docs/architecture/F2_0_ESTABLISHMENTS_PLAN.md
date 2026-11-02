# SSTEK — F2.0 · Plano Técnico Executável do Catálogo de Estabelecimentos

> **Documento técnico oficial de planejamento.**
> Elaborado na **DIRETRIZ 007** · migrations versionadas adicionadas na **DIRETRIZ 008** · testes de aceitação na **DIRETRIZ 009**.
> **Versão:** 1.3
> **Data:** 2026-10-13
> **Status:** **plano preparado — NÃO executado. EXECUÇÃO BLOQUEADA por pendência de backup (§15).** Aguarda autorização expressa.
> **Arquivos versionados:** `supabase/migrations/` (UP/DOWN + seeds) — ver §13.
> **Testes de aceitação:** `supabase/tests/` (verificação + comportamental) — ver §14.
> **Documentos correlatos:**
> - [`SAAS_MULTI_TENANT.md`](./SAAS_MULTI_TENANT.md) — Arquitetura Alvo Multi-Tenant v1.0.
> - [`ESTABLISHMENTS_INVENTORY.md`](./ESTABLISHMENTS_INVENTORY.md) — Inventário Técnico de Estabelecimentos v1.0.
> - [`DEMO_DATA_AUDIT_AND_SANITIZATION_PLAN.md`](./DEMO_DATA_AUDIT_AND_SANITIZATION_PLAN.md) — Auditoria dos dados demonstrativos (DIRETRIZ 011).
> - [`../../supabase/migrations/README.md`](../../supabase/migrations/README.md) — Convenção de migrations.
> - [`../../supabase/tests/README.md`](../../supabase/tests/README.md) — Testes da F2.0 (verificação + comportamental).

---

## Legenda de evidência (obrigatória)

| Marca | Significado |
|---|---|
| ✅ **CONFIRMADO** | Observado diretamente no banco de dados do projeto (SaaS Supabase). |
| 💡 **PROPOSTA** | Arquitetura/SQL proposto. **Ainda não existe** no sistema. |
| ⛔ **PENDENTE** | Requisito obrigatório antes de produção/comercialização. |

> **Restrição desta diretriz:** nenhum SQL foi executado, nenhuma tabela criada, nenhum registro inserido, nenhum código/RLS/Storage/Edge Function/interface alterado. Este documento **apenas planeja**.

---

## 0. Verificação prévia obrigatória (✅ CONFIRMADO)

Antes de propor o SQL, os tipos reais de identificador foram **verificados no banco** (não presumidos), conforme exigido:

**`company_collaborators`** ✅ — colunas relevantes:

| Coluna | Tipo | Nulo | Observação |
|---|---|---|---|
| `id` | `uuid` | NO | **PK** (`gen_random_uuid()`). |
| `company_id` | `uuid` | NO | **FK → `companies(id)`**. |
| `ref` | `text` | NO | **Chave de negócio do colaborador** (é o que o app usa). |
| `cpf` | `text` | NO | UNIQUE por empresa. |
| `establishment` | `text` | YES | Coluna de texto livre (o objeto deste plano). |
| `manager_ref` | `text` | YES | Referência textual de gestor. |
| `created_at` | `timestamptz` | NO | `now()`. |

**Constraints confirmadas em `company_collaborators`:**
- `company_collaborators_pkey` → PRIMARY KEY (`id`).
- `company_collaborators_company_id_fkey` → FK (`company_id`) → `companies(id)`.
- `company_collaborators_company_id_ref_key` → **UNIQUE (`company_id`, `ref`)**.
- `company_collaborators_company_id_cpf_key` → **UNIQUE (`company_id`, `cpf`)**.

**Empresa fictícia existente** ✅: `Metalúrgica Vega` · `subdomain = vega` · `id = faac11b2-e4d7-45c4-8989-b98658910ff1` · CNPJ cadastrado `12.345.678/0001-90`.

> ⚠️ **Decisão-chave derivada (importante):** o identificador canônico do colaborador **NÃO é UUID** — é **`ref` (text)**. Portanto `collaborator_establishments` deve usar **`collaborator_ref (text)`** como chave, e **não** presumir UUID. O `id (uuid)` fica como referência interna opcional.

---

## 1. SQL proposto 💡 (não executar nesta diretriz)

### 1.1 Tabela `establishments`

```sql
-- F2.0 — Catálogo de estabelecimentos (ADITIVO E REVERSÍVEL)
-- NÃO altera nenhuma estrutura, coluna ou registro existente.

create table if not exists public.establishments (
  id              uuid        primary key default gen_random_uuid(),
  company_id      uuid        not null references public.companies(id),
  code            text        not null,                 -- código interno (MATRIZ, CAMPINAS, RECIFE)
  name            text        not null,                 -- nome de exibição
  cnpj            text,                                 -- opcional (não inventar)
  address         text,                                 -- opcional (não inventar)
  city            text,                                 -- opcional (não inventar)
  state           text,                                 -- opcional (não inventar)
  status          text        not null default 'active',-- ativa/inativa
  risk_grade      text,                                 -- grau de risco (NR-4), opcional
  manager_ref     text,                                 -- responsável (ref), opcional
  responsible_ref text,                                 -- responsável técnico (ref), opcional
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Unicidade de código DENTRO da empresa:
  constraint establishments_company_code_key unique (company_id, code),

  -- Habilita FK composta (isolamento por empresa) — ver §1.2:
  constraint establishments_id_company_key unique (id, company_id)
);
```

### 1.2 Tabela `collaborator_establishments` (vínculo multi-unidade)

```sql
create table if not exists public.collaborator_establishments (
  id               uuid        primary key default gen_random_uuid(),
  company_id       uuid        not null references public.companies(id),
  collaborator_ref text        not null,                 -- CHAVE REAL do colaborador (text)
  collaborator_id  uuid        references public.company_collaborators(id), -- opcional, join interno
  establishment_id uuid        not null,
  is_primary       boolean     not null default false,
  role_in_unit     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- ISOLAMENTO POR EMPRESA (duas FKs compostas): o colaborador e o estabelecimento
  -- precisam pertencer à MESMA company_id da linha. Impede vínculo cruzado entre empresas.
  constraint collab_est_collab_fkey
    foreign key (company_id, collaborator_ref)
    references public.company_collaborators (company_id, ref),

  constraint collab_est_est_fkey
    foreign key (establishment_id, company_id)
    references public.establishments (id, company_id),

  -- Um colaborador não se vincula duas vezes à mesma unidade:
  constraint collab_est_unique
    unique (company_id, collaborator_ref, establishment_id)
);

-- No máximo UMA unidade principal por colaborador (índice parcial):
create unique index if not exists collab_est_one_primary
  on public.collaborator_establishments (company_id, collaborator_ref)
  where is_primary;
```

> **Por que FKs compostas?** O `company_id` aparece nas duas pontas das FKs. Como `establishments` e `company_collaborators` têm UNIQUE em (`id`,`company_id`) e (`company_id`,`ref`) respectivamente, o banco **rejeita** qualquer linha em que o estabelecimento ou o colaborador seja de **outra empresa**. Isso implementa a decisão **E5** (nenhuma associação entre empresas diferentes) **no nível do banco**, não só no app.

### 1.3 Restrições: o que entra na F2.0 × o que fica para depois

| Restrição | Fase | Motivo |
|---|---|---|
| `establishments` PK, FK `company_id`, UNIQUE(`company_id`,`code`), UNIQUE(`id`,`company_id`) | **F2.0** ✅ pode | Aditivo, não toca dados existentes. |
| `collaborator_establishments` FKs compostas + UNIQUE(`company_id`,`collaborator_ref`,`establishment_id`) | **F2.0** ✅ pode | Depende só das 2 tabelas novas + UNIQUE já existente em `company_collaborators`. |
| Índice parcial "uma primária" | **F2.0** ✅ pode | Independente. |
| `establishment_id` (FK) **dentro** de `documents`, `dds_records`, `epi_deliveries`, `apr_records`, `cipa_*` etc. | **F2.2–F2.5** 💡 depois | Exige backfill e validação; só na migração. |
| Tornar `establishment_id` NOT NULL nas tabelas operacionais | **F2.5** ⛔ depois | Só após 100% de backfill validado. |
| RLS restritiva por identidade real | **F0/F1** ⛔ | Depende de autenticação real (ver §6). |

---

## 2. Modelo de relacionamentos 💡

```
companies (TENANT)  ── faac11b2-…  (Metalúrgica Vega)
   │ 1:N
   ▼
establishments (id uuid, company_id)
   ▲                              ▲
   │ establishment_id (FK composta)│ company_id
   │                               │
collaborator_establishments  ─── company_collaborators (id uuid, ref text)
   (company_id, collaborator_ref, establishment_id, is_primary, role_in_unit)
        │ colaborador pode ter N linhas (N unidades)
        └ no máximo 1 com is_primary = true
```

**Leitura:**
- `establishments` pertence **sempre** a um `companies` (tenant). ✅ decisão **E4**.
- O vínculo colaborador↔unidade é **N:N** (`collaborator_establishments`), sem duplicar a identidade do colaborador (§4 do inventário).
- O `establishment` **texto** original **permanece intacto** nas tabelas existentes durante toda a F2.0 (§5).
- `location`/`place` **não** entram aqui — são **locais físicos** (decisão **E2**).

---

## 3. Seeds fictícios 💡 (3 unidades)

Empresa: **Metalúrgica Vega** (`faac11b2-e4d7-45c4-8989-b98658910ff1`) — a empresa fictícia **já existente**. **Não** criar nova empresa.

```sql
insert into public.establishments (company_id, code, name, status)
values
  ('faac11b2-e4d7-45c4-8989-b98658910ff1', 'MATRIZ',   'Unidade Matriz — São Bernardo do Campo', 'active'),
  ('faac11b2-e4d7-45c4-8989-b98658910ff1', 'CAMPINAS', 'Filial Campinas',                        'active'),
  ('faac11b2-e4d7-45c4-8989-b98658910ff1', 'RECIFE',   'Filial Recife',                          'active')
on conflict (company_id, code) do nothing;
```

**Campos deliberadamente vazios (não inventar):** `cnpj`, `address`, `city`, `state`, `risk_grade`, `manager_ref`, `responsible_ref` ficam **NULL** em todas as três. Motivo: a diretriz proíbe inventar CNPJ/endereço/responsáveis. ⚠️ Observação: o CNPJ `12.345.678/0001-90` pertence à **empresa** (não ao estabelecimento) — não o copiamos para a unidade.

**Identificação dos registros demonstrativos (para rollback):** os 3 seeds são identificáveis por `company_id = 'faac11b2-…' AND code in ('MATRIZ','CAMPINAS','RECIFE')`.

---

## 4. Mapa de normalização 💡

Objetivo: converter os **textos livres** existentes em referência aos **novos UUIDs**, sempre **dentro do contexto da empresa**.

### 4.1 Valores reais observados ✅

| Valor distinto no banco | Tabelas onde aparece | Unidade alvo |
|---|---|---|
| `Unidade Matriz — São Bernardo do Campo` | `company_collaborators` (12), `dds_records` (6), `epi_deliveries` (7), `apr_records` (3), `cipa_committees.unit` (1) | **MATRIZ** |
| `Filial Campinas` | `apr_records` (1), `cipa_committees.unit` (1) | **CAMPINAS** |
| `Filial Recife` | `cipa_committees.unit` (1) | **RECIFE** |

### 4.2 Regras de normalização (chave canônica de comparação)

A função de normalização gera uma **chave comparável** (não altera o valor original):

1. **Trim** e colapso de **espaços duplicados**.
2. **Minúsculas** (case-insensitive).
3. **Remoção de acentuação** (ex.: `São` → `sao`, `Unidade` → `unidade`).
4. **Unificação de travessões/hífens**: `—` (em dash), `–` (en dash), `-` (hífen) → um separador único.
5. **Expansão de abreviações**: `un.`, `unid.`, `u.` → `unidade`; `fil.` → `filial`.
6. **Valores vazios / NULL** → **não mapeiam** (permanecem sem vínculo).

### 4.3 Tabela de equivalência (empresa `vega`)

| Chave normalizada (exemplos) | establishment.code |
|---|---|
| `unidade matriz sao bernardo do campo` · `matriz` · `unidade matriz` | **MATRIZ** |
| `filial campinas` · `campinas` | **CAMPINAS** |
| `filial recife` · `recife` | **RECIFE** |

### 4.4 Regras de segurança do mapa

- **Contexto obrigatório:** a resolução usa **`company_id`** da própria linha. O mesmo texto em empresas diferentes pode apontar para unidades diferentes — **jamais** resolver cross-tenant.
- **Valores ambíguos NÃO são associados automaticamente** — vão para uma **lista de pendências para revisão manual**.
- **Valor desconhecido** → **não** cria unidade e **não** vincula; registra pendência.
- **Valor original é preservado** na coluna de texto (auditoria + reversão).
- O mapa é **gerado e revisado** antes de qualquer backfill (F2.1/F2.3).

---

## 5. Compatibilidade 💡 (F2.0 é aditiva)

- **Não exclui** colunas existentes.
- **Não altera** registros históricos (nenhum UPDATE em tabelas existentes na F2.0).
- **Não substitui** os campos textuais (`establishment`/`unit` continuam sendo a fonte durante a transição).
- **Não modifica** fluxos de CIPA, urna, assinaturas, DDS, APR ou EPI.
- **Não exige** mudanças no login demonstrativo (`localStorage`).
- **Não depende** da ativação imediata da autenticação real.
- O catálogo pode ser **testado isoladamente** (SQL/dashboard) antes de qualquer integração aos módulos.

---

## 6. Segurança e isolamento 💡⛔

### 6.1 Risco explícito de novas tabelas
Hoje a `ANON_KEY` (pública, no bundle) tem acesso aberto (RLS "ligado mas aberto"). **Criar tabelas sem RLS as tornaria automaticamente expostas pela chave pública.** Portanto a F2.0 **não pode** criar tabelas "soltas".

### 6.2 Estratégia recomendada para as tabelas novas

```sql
alter table public.establishments            enable row level security;
alter table public.collaborator_establishments enable row level security;
-- NENHUMA policy permissiva para anon/public é criada na F2.0 → default DENY.
```

- **RLS ligada + nenhuma policy = negar tudo** (default deny). As tabelas novas ficam **mais restritas** que as atuais, e **não ampliam** a exposição.
- **Proibido** propor RLS baseada em `localStorage`/`subdomain` como mecanismo de segurança — identidade simulada **não é** autorização. ⛔
- Validação isolada do catálogo é feita por **SQL/dashboard (service role)** — nunca pela chave anônima.
- Quando **F1 (identidade real)** existir, adiciona-se policy por identidade + `company_id`:
  ```sql
  -- Referência futura (NÃO executar na F2.0):
  -- using (company_id = (select company_id from profiles where auth_user_id = auth.uid()))
  ```

### 6.3 Isolamento já garantido na F2.0 (sem depender de RLS)
As **FKs compostas** (§1.2) garantem **no banco** que:
- um vínculo só existe se `establishment.company_id = company_id = collaborator.company_id`;
- **não há** vínculo possível entre empresas diferentes.

### 6.4 O que **não** pode acontecer
- ❌ Ampliar a superfície acessível pela chave pública.
- ❌ Criar policy `true` para `public`.
- ❌ Confiar em autorização vinda do cliente (subdomínio/localStorage).

---

## 7. Plano de rollback 💡

Como a F2.0 é **100% aditiva** e **não toca** nenhum objeto existente, o rollback é trivial e seguro:

**7.1 Objetos criados por esta fase (únicos removíveis):**
- tabela `public.establishments`
- tabela `public.collaborator_establishments`
- índice `collab_est_one_primary`

**7.2 Scripts**

```sql
-- (A) Verificação antes de reverter
select count(*) from public.establishments;
select count(*) from public.collaborator_establishments;
select count(*) from public.establishments
  where company_id = 'faac11b2-e4d7-45c4-8989-b98658910ff1'
    and code in ('MATRIZ','CAMPINAS','RECIFE');

-- (B) Reversão — remove SOMENTE os objetos novos
drop index if exists public.collab_est_one_primary;
drop table if exists public.collaborator_establishments;
drop table if exists public.establishments;
```

**7.3 Critérios de reversão**
- Reverter se: seed inconsistente, código duplicado dentro da empresa, falha de FK composta, ou necessidade de replanejar o modelo.
- **Nunca** remover colunas existentes nem tocar registros históricos.

**7.4 Garantias**
- Nenhuma tabela/registro anterior é afetado.
- `company_collaborators.establishment` (texto) permanece **intacto**.
- Votos/evidências de assinatura/CIPA **não são tocados** (a F2.0 nem os referencia).
- Backup recomendado antes da execução (padrão do projeto).

---

## 8. Critérios de aceitação (testes) 💡

| # | Teste | Como verificar | Esperado |
|---|---|---|---|
| T1 | Cadastro de estabelecimentos por empresa | `select * from establishments where company_id=…` | 3 linhas (MATRIZ, CAMPINAS, RECIFE) da Vega |
| T2 | **Código único dentro da mesma empresa** | Inserir `('vega','MATRIZ',…)` de novo | **Rejeitado** (`establishments_company_code_key`) |
| T3 | Mesmo código em empresa diferente | Inserir `('outra','MATRIZ',…)` | **Aceito** (unicidade é por empresa) |
| T4 | Vínculo de colaborador a múltiplas unidades | Inserir 2 linhas p/ mesmo `collaborator_ref` | **Aceito** |
| T5 | **Uma única unidade principal** | Inserir 2ª linha `is_primary=true` p/ mesmo `(company_id, collaborator_ref)` | **Rejeitado** (`collab_est_one_primary`) |
| T6 | **Prevenção de vínculo entre empresas** | Inserir linha com `collaborator_ref` da Vega + `establishment_id` de outra empresa | **Rejeitado** (FK composta) |
| T7 | Prevenção de vínculo entre empresas (2) | `company_id` de A + `establishment_id` de B | **Rejeitado** (FK composta) |
| T8 | Normalização de nomes | Aplicar regras §4.2 nos 3 textos | Chaves `matriz`/`campinas`/`recife` corretas |
| T9 | Valores ambíguos/vazios | Rodar mapa em `documents.establishment` (vazio) | **Nenhum** vínculo; vão p/ pendências |
| T10 | Compatibilidade com módulos atuais | Abrir Documentos, Colaboradores, EPI, DDS, APR, CIPA/urna | **Todos** operam sem alteração |
| T11 | Preservação do modo demonstração | Trocar perfis / login simplificado | Funciona igual |
| T12 | Exposição pela chave pública | Tentar `select` via anon | **Bloqueado** (RLS default deny) |

---

## 9. Sequência de implementação 💡 (quando autorizada)

1. **Backup** do banco.
2. **F2.0a** — `create table establishments` + constraints (§1.1).
3. **F2.0b** — `create table collaborator_establishments` + constraints + índice (§1.2).
4. **F2.0c** — `enable row level security` nas 2 tabelas, **sem policy** (§6.2).
5. **F2.0d** — seeds das 3 unidades (§3).
6. **Verificação** — rodar testes T1–T7, T11, T12.
7. **F2.1** (próxima fase) — montar/revisar o mapa de normalização (§4) — **sem** alterar colunas existentes.
8. **Só depois** — coluna aditiva `establishment_id` nas tabelas operacionais (F2.2+).

> Cada sub-etapa é **independente e reversível**; a tabela pode ser criada e testada **isoladamente** antes de qualquer integração.

---

## 10. Riscos e dependências 💡

| Risco / Dependência | Impacto | Mitigação |
|---|---|---|
| **Exposição pela chave pública** de tabela sem RLS | Alto ⛔ | RLS default deny na F2.0 (§6.2). |
| Colaborador identificado por **`ref` (text)**, não UUID | Médio | Usar `collaborator_ref` como chave (§0/§1.2); `collaborator_id` opcional. |
| Textos ambíguos (`Matriz` × `Unidade Matriz — …`) | Médio | Mapa com revisão manual; **nada** associado automaticamente (§4.4). |
| Mistura `company_ref` × `company_id` em tabelas futuras | Médio | Resolver tenant por `company_id`; tratar na F2.2+. |
| Migrar `location` como unidade (erro conceitual) | Alto | Fora do escopo — `location`/`place` são locais físicos (E2). |
| Presumir UUID de colaborador | Médio | ✅ Já corrigido: verificação prévia (§0). |
| RLS permissiva atual (`true`) nas tabelas existentes | Alto ⛔ | Fora do escopo da F2.0 — pertence à **F0** (blindagem). Antes de produção. |
| Ausência de autenticação real | Alto ⛔ | F1. A F2.0 **não depende** dela (é aditiva e isolada). |

---

## 11. Checklist para autorização da execução ⛔

- [ ] Confirmado que `location`/`place` **não** viram estabelecimentos (decisão **E2**).
- [ ] Confirmado o uso de **`collaborator_ref` (text)** como chave de vínculo (§0).
- [ ] Aprovado o uso de **FKs compostas** para isolamento por empresa (§1.2 / §6.3).
- [ ] Aprovado o SQL de **RLS default deny** nas tabelas novas (§6.2).
- [ ] Aprovados os **3 seeds fictícios** sem CNPJ/endereço/responsáveis inventados (§3).
- [ ] Ciente de que a F2.0 **não** altera nenhuma tabela/registro existente (§5).
- [ ] Ciente de que a **F0 (blindagem RLS)** continua pendente e é o passo de maior risco de segurança ⛔.
- [ ] Backup planejado antes da execução.
- [ ] Autorização expressa registrada para iniciar a F2.0a.

> **Enquanto este checklist não estiver completo, a F2.0 permanece apenas planejada.**

---

## 12. Registro da execução desta diretriz

- **Arquivo criado:** `docs/architecture/F2_0_ESTABLISHMENTS_PLAN.md`
- **Versão do documento:** 1.0
- **Diretriz de origem:** DIRETRIZ 007.
- **Alterações funcionais nesta diretriz:** **nenhuma.**
  - Nenhum SQL executado; nenhuma tabela criada/alterada/removida.
  - Nenhum registro inserido/alterado.
  - Nenhuma autenticação, RLS, Storage, Edge Function, interface ou funcionalidade alterada.
- **Verificações de leitura realizadas:** tipos de `company_collaborators` / `companies` / `profiles`, constraints/FKs e valores distintos de estabelecimento.
- **Escopo desta diretriz:** criação exclusiva deste documento de planejamento.

---

## 13. Arquivos de migration versionados (DIRETRIZ 008) 💡 — preparados, NÃO executados

O SQL das seções §1 (estrutura) e §3 (seeds) foi materializado em **migrations versionadas** na
pasta `supabase/migrations/` (convenção nova — o projeto não possuía uma; ver
[`../../supabase/migrations/README.md`](../../supabase/migrations/README.md)).

| Ordem | Arquivo | Conteúdo |
|---|---|---|
| 1 | `supabase/migrations/20261013090000_f2_0_create_establishments_up.sql` | Cria `establishments` (§1.1), `collaborator_establishments` + índice parcial (§1.2) e liga **RLS default deny** (§6.2). |
| 2 | `supabase/migrations/20261013090000_f2_0_create_establishments_down.sql` | Reverte **somente** os objetos do UP 1, com **guarda** que aborta se houver FKs externas (dependências posteriores). |
| 3 | `supabase/migrations/20261013090100_f2_0_seed_establishments_up.sql` | Seeds **idempotentes** das 3 unidades (MATRIZ/CAMPINAS/RECIFE) da Metalúrgica Vega; resolve a empresa por `subdomain='vega'` e **aborta** se ausente/ambígua. |
| 4 | `supabase/migrations/20261013090100_f2_0_seed_establishments_down.sql` | Remove **somente** os 3 seeds demonstrativos (por empresa `vega` + `code`), sem tocar na estrutura. |

**Compatibilidade verificada (somente leitura, ✅ CONFIRMADO):** a FK composta
`(company_id, collaborator_ref) → company_collaborators (company_id, ref)` é compatível com o UNIQUE
`company_collaborators_company_id_ref_key` já existente.

**O que NÃO foi feito:** nenhum arquivo foi executado; nenhuma tabela criada; nenhum dado inserido;
nenhuma RLS existente alterada. Os 4 arquivos são **fonte versionada** para execução controlada futura.

---

## 14. Testes de aceitação (DIRETRIZ 009) 💡 — preparados, NÃO executados

Os critérios da §8 foram materializados em **scripts de verificação manual**, hospedados em
`supabase/tests/` (ver [`../../supabase/tests/README.md`](../../supabase/tests/README.md)) — **separados**
de `supabase/migrations/` para **evitar execução automática** por ferramenta de migrations.

| Arquivo | Tipo | Escreve? | Cobre |
|---|---|---|---|
| `supabase/tests/f2_0_verify.sql` | Verificação **somente leitura** | Não | **T1–T7** e **T12** (inspeção de catálogo/dados) |
| `supabase/tests/f2_0_acceptance_transactional.sql` | Teste **comportamental** | Sim, com `ROLLBACK` | **C1–C5** (rejeições reais e idempotência) |

### 14.1 Cobertura × tipo de prova

| Critério (diretriz 009) | O que prova | Onde |
|---|---|---|
| **T1** Estrutura (tabelas/colunas) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T2** Estabelecimentos da Vega | `SELECT` de dados | `f2_0_verify.sql` |
| **T3** UNIQUE (company_id, code) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T4** FKs compostas existem | Inspeção de catálogo | `f2_0_verify.sql` |
| **T5** Índice único parcial (principal) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T6** RLS ligada + sem policies | Inspeção de catálogo | `f2_0_verify.sql` |
| **T7** Isolamento (FKs com company_id) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T12** Compatibilidade | Inspeção de catálogo | `f2_0_verify.sql` |
| **C1** Código duplicado | Comportamental (escrita) | `f2_0_acceptance_transactional.sql` |
| **C2** Vínculo entre empresas | Comportamental (escrita) | `f2_0_acceptance_transactional.sql` |
| **C3** 2ª unidade principal | Comportamental (escrita) | `f2_0_acceptance_transactional.sql` |
| **C4** Leitura/escrita anônima | Comportamental (papel `anon`) | `f2_0_acceptance_transactional.sql` |
| **C5** Idempotência dos seeds | Comportamental (escrita) | `f2_0_acceptance_transactional.sql` |

> ⚠️ **Mapeamento de identificadores:** a DIRETRIZ 009 renumerou os critérios em relação à tabela da
> §8 (ex.: aqui **T2 = presença das 3 unidades** e **T3 = UNIQUE**; na §8 o T2 era o teste de
> duplicidade). O documento segue a **numeração da DIRETRIZ 009**. A §8 permanece como referência
> histórica de intenção.

### 14.2 Limitação registrada (obrigatória)

`SELECT`s de catálogo comprovam **existência e definição** das estruturas, **não** o seu
**comportamento** em execução. A rejeição real (isolamento entre empresas, código duplicado,
2ª principal, bloqueio anônimo) só é comprovada pelos testes **comportamentais** — que exigem
**execução** em ambiente controlado, em transação com `ROLLBACK`.

### 14.3 Ordem segura de execução futura

1. Backup → 2. UP estrutura → 3. UP seeds → 4. `f2_0_verify.sql` (leitura) → 5. `f2_0_acceptance_transactional.sql`
(comportamental, termina em `ROLLBACK`) → 6. se falhar, reverter com os `_down.sql` da F2.0 (§7).

**O que NÃO foi feito (DIRETRIZ 009):** nenhum SQL executado; nenhum teste rodado; nenhuma tabela
criada/alterada; nenhum registro inserido; nenhuma RLS existente alterada; nenhum arquivo UP/DOWN
modificado. Apenas **criação de scripts de teste + atualização de documentação**.

---

## 15. Bloqueio por pendência de backup e auditoria de dados demonstrativos (DIRETRIZ 011) ⛔

> **Status da execução da F2.0: BLOQUEADA.** Na **DIRETRIZ 010**, a execução foi interrompida no **portão de pré-execução (§1)** porque **não havia confirmação de backup recuperável**. A F2.0 permanece **preparada e inerte**.

### 15.1 Condição de desbloqueio (obrigatória)

- [ ] ⛔ **Backup recuperável confirmado pelo responsável.** Sem essa confirmação, **nenhuma** migration ou teste será executado — a diretriz proíbe prosseguir por presunção. **Não** considerar o backup concluído sem confirmação explícita.

### 15.2 Auditoria dos dados demonstrativos (somente leitura)

Auditoria **read-only** dos 12 colaboradores da Metalúrgica Vega — detalhes em
[`DEMO_DATA_AUDIT_AND_SANITIZATION_PLAN.md`](./DEMO_DATA_AUDIT_AND_SANITIZATION_PLAN.md).

Resumo: **12 CPFs** preenchidos e distintos (sem duplicidade); **11 de 12 reprovam nos dígitos verificadores**; e — além do CPF — **RG, PIS, CTPS, data de nascimento, telefone e e-mail estão todos 100% preenchidos**, indicando superfície de PII **mais ampla que o CPF** no ambiente demonstrativo. As evidências de assinatura/EPI/votação ancoram em **`ref`/`id`**, **não** em CPF; e **não há** nenhuma eleição/voto/ata CIPA gravada (tudo em 0 linhas).

### 15.3 Sanemamento de PII — pendente de decisão (não executado)

Há um **plano de anonimização preparado (§4 do documento de auditoria)**, condicionado a aprovação.
**Nada foi executado:** nenhum `UPDATE`/`DELETE`/`INSERT`, nenhum CPF alterado, nenhuma migration,
nenhum teste comportamental, nenhum ajuste de auth/RLS/interface.

---

*Fim do documento — SSTEK · F2.0 Plano Técnico do Catálogo de Estabelecimentos · v1.3*