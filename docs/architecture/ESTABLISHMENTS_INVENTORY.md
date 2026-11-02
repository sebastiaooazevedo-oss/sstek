# SSTEK — Inventário Técnico de Estabelecimentos

> **Documento técnico oficial de referência.**
> Elaborado na **DIRETRIZ 005** (auditoria de banco — somente leitura) e oficializado no repositório pela **DIRETRIZ 006**.
> **Versão:** 1.0
> **Data de oficialização:** 2026-10-13
> **Status:** inventário e planejamento aprovados — **nenhuma implementação nesta fase**.
> **Documento correlato:** [`SAAS_MULTI_TENANT.md`](./SAAS_MULTI_TENANT.md) (Arquitetura Alvo Multi-Tenant v1.0).
> **Plano da fase:** [`F2_0_ESTABLISHMENTS_PLAN.md`](./F2_0_ESTABLISHMENTS_PLAN.md) (F2.0 — Plano Técnico Executável do Catálogo de Estabelecimentos v1.0).

---

## Legenda de evidência (obrigatória em todo o documento)

| Marca | Significado |
|---|---|
| ✅ **CONFIRMADO** | Observado diretamente no código e/ou no banco de dados do projeto (SaaS Supabase). |
| 💡 **PROPOSTA** | Arquitetura/recomendação proposta. **Ainda não existe** no sistema. |
| ⛔ **PENDENTE** | Requisito obrigatório **antes da produção/comercialização**. Não resolvido hoje. |

> **Regra de leitura:** nada é declarado implementado sem evidência. As seções 1 a 3 são **✅ confirmadas no banco**; a partir da seção 4 são **💡 proposta**.

---

## 1. Inventário completo das tabelas e colunas ✅

Busca realizada por **todos** os nomes alternativos conhecidos (`establishment`, `unit`, `branch`, `location`, `site`, `local`, `place`, `filial`, `unidade`). Resultado: **18 colunas em 14 tabelas**.

| # | Tabela . Coluna | Tipo | Vínculo empresa | Registros | Valores distintos | Natureza real |
|---|---|---|---|---|---|---|
| 1 | `company_collaborators.establishment` | text | `company_id` | 12 | **1** (`Unidade Matriz — São Bernardo do Campo`) | ✅ estabelecimento |
| 2 | `dds_records.establishment` | text | `company_id` + `company_ref` | 6 | **1** (`Unidade Matriz — São Bernardo do Campo`) | ✅ estabelecimento |
| 3 | `epi_deliveries.establishment` | text | `company_id` + `company_ref` | 7 | **1** (`Unidade Matriz — São Bernardo do Campo`) | ✅ estabelecimento |
| 4 | `apr_records.establishment` | text | `company_id` + `company_ref` | 4 | **2** (Matriz ×3, `Filial Campinas` ×1) | ✅ estabelecimento |
| 5 | `cipa_committees.unit` | text | `company_id` + `company_ref` | 3 | **3** (Matriz, `Filial Campinas`, `Filial Recife`) | ✅ estabelecimento (nome alternativo!) |
| 6 | `cipa_meetings.location` | text | `company_id` + `company_ref` | 5 | **4** (`Sala de Treinamento 1 — Matriz`, `Auditório — Filial Campinas`, `Pátio central — Matriz`, `Sala de Reuniões — Filial Recife`) | ⚠️ **local físico** (embute a unidade no texto) |
| 7 | `apr_records.location` | text | `company_id` + `company_ref` | 4 | 4 (`Galpão A — Caldeiraria`, `Galpão B — Linha de pintura`, `Pátio de expedição`, `Subestação — Painel QGBT`) | ⚠️ local físico |
| 8 | `dds_records.location` | text | `company_id` + `company_ref` | 6 | 6 (`Área de Expedição`, `Box de Solda 03`, `Galpão de Produção 01`, `Linha de Estamparia`, `Pátio Industrial A`, `Subestação 02`) | ⚠️ local físico |
| 9 | `documents.establishment` | text | `company_id` + `company_ref` | 26 | **0** (vazio em 100% dos registros) | ✅ estabelecimento (não preenchido) |
| 10 | `attendance_sheets.establishment` | text | `company_id` + `company_ref` | 0 | 0 | ✅ estabelecimento |
| 11 | `attendance_sheets.place` | text | `company_id` + `company_ref` | 0 | 0 | ⚠️ local físico |
| 12 | `cipa_ballot_config.establishment` | text | **só `company_ref`** | 0 | 0 | ✅ estabelecimento |
| 13 | `cipa_elections.establishment` | text | **só `company_ref`** | 0 | 0 | ✅ estabelecimento |
| 14 | `cipa_inspections.establishment` | text | `company_id` + `company_ref` | 0 | 0 | ✅ estabelecimento |
| 15 | `cipa_inspections.location` | text | `company_id` + `company_ref` | 0 | 0 | ⚠️ local físico |
| 16 | `cipa_voter_rolls.establishment` | text | **só `company_ref`** | 0 | 0 | ✅ estabelecimento |
| 17 | `field_inspections.establishment` | text | `company_id` + `company_ref` | 0 | 0 | ✅ estabelecimento |
| 18 | `field_inspections.location` | text | `company_id` + `company_ref` | 0 | 0 | ⚠️ local físico |

### 1.1 Achados-chave

- **Só existem 3 unidades reais** em toda a base: **Matriz — São Bernardo do Campo**, **Filial Campinas**, **Filial Recife**.
- As colunas **`location` / `place` NÃO são estabelecimentos** — são **locais físicos** (galpões, boxes, salas, subestações) *dentro* de uma unidade. Migrá-las para `establishments` seria um erro conceitual. Elas pedem um conceito separado (sub-local).
- **`company_collaborators.establishment` é o de maior peso** (12 registros, a "verdade" operacional do vínculo).
- **`documents.establishment` está vazio** mesmo com 26 documentos → hoje os documentos **não têm escopo de unidade** de fato.

---

## 2. Relacionamentos atuais identificados ✅

- **Chaves estrangeiras existentes (schema `public`):** apenas `company_id → companies(id)` em `profiles`, `company_collaborators`, `document_signatures`, `signature_audit_log`, `signature_representations` — e algumas internas (`document_signatures → profiles`, `cipa_voter_entries → cipa_voter_rolls`, etc.).
- **As tabelas de conteúdo NÃO têm FK para `companies`:** `documents`, `dds_records`, `epi_deliveries`, `apr_records`, `cipa_*` ligam-se à empresa por **`company_ref` (texto)** e/ou `company_id` (uuid), **sem FK**.
- **Índices:** só existe **um** índice ligado a estabelecimento → `idx_company_collaborators_establishment (company_id, establishment)`. As demais colunas de estabelecimento **não têm índice próprio**; o padrão é `(company_ref, ref)` único.
- **Nenhuma FK, nenhuma constraint de unicidade e nenhum catálogo** valida os textos de estabelecimento.

---

## 3. Problemas de consistência encontrados ✅

1. **Texto livre sem contrato** → a mesma unidade pode ser escrita de N formas. Ex.: só a "Matriz" aparece como `Unidade Matriz — São Bernardo do Campo` (colaboradores/DDS/EPI), e a CIPA/APR usa variações; não há normalização de dash (`—`).
2. **Unidade embutida dentro de outro texto** → `cipa_meetings.location` = `"Sala … — Filial Campinas"` mistura **local físico + unidade** numa única string.
3. **`documents.establishment` 100% vazio** → impossível filtrar/relatar documentos por unidade hoje.
4. **Mistura `company_ref` (texto) × `company_id` (uuid):** `cipa_ballot_config`, `cipa_elections`, `cipa_voter_rolls` só têm `company_ref` (sem `company_id`) → qualquer FK de estabelecimento precisará resolver o tenant por duas chaves diferentes.
5. **Sem integridade referencial** → um estabelecimento pode ser digitado errado e nenhum processo eleitoral/CIPA quebra (dados ficam órfãos de unidade sem aviso).
6. **Risco de tenant errado** (herdado da Diretriz 001/003): com apenas 1 empresa o problema ainda não aparece, mas o fallback "primeira empresa" continua ativo — e é exatamente o que precisa ser eliminado antes de dados reais.

---

## 4. Proposta de modelo de dados 💡

Entidade central **`establishments`** (**a criar na Fase F2 — não nesta diretriz**):

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | Identificador canônico. |
| `company_id` | uuid FK → companies | Empresa proprietária. **Obrigatório.** |
| `code` | text | Código interno da unidade (ex.: `MATRIZ`, `CAMPINAS`, `RECIFE`). Único por empresa. |
| `name` | text | Nome de exibição (ex.: `Unidade Matriz — São Bernardo do Campo`). |
| `cnpj` | text | CNPJ do estabelecimento, quando aplicável. |
| `address` / `city` / `state` | text | Endereço, município, UF. |
| `status` | text | Situação cadastral (ativa/inativa). |
| `risk_grade` | text | Grau de risco (NR-4), quando aplicável. |
| `manager_ref` / `responsible_ref` | text | Responsáveis vinculados. |
| `created_at` / `updated_at` | timestamptz | Auditoria. |

**Apoio para multi-unidade por colaborador** 💡: tabela de associação **`collaborator_establishments`** (`collaborator_id`, `establishment_id`, `is_primary`, `role_in_unit`) — assim um colaborador atua em mais de um estabelecimento **sem duplicar a identidade**.

**Regra de escopo (decisão de arquitetura):** *local físico* (galpão/sala/pátio) **não** vira estabelecimento — permanece como atributo do registro (`location`) ou, no futuro, uma entidade `establishment_locations` (uma unidade tem N locais).

---

## 5. Diagrama conceitual 💡

```
                         companies (TENANT)
                                │ 1:N
                                ▼
                        establishments ───────────────► (futuro) establishment_locations
                       /     │      \  \  \  \  \  \  \        (galpão, sala, pátio…)
             1:N      /      │       \  \  \  \  \  \   \
                     ▼       ▼        ▼  ▼  ▼  ▼  ▼    ▼    ▼
   collaborator_   company_  documents dds epi apr cipa_ cipa_ field_ attendance
   establishments  collabo…            _rec _rec… _committees elections inspect _sheets
        │N:1           │N:1                          │N:1
        ▼              ▼                             ▼
  company_collaborators ◄──────────────────── cipa_voter_rolls / cipa_ballot_config
        (colaborador, identidade única)
```

Leitura: `establishments` pertence **sempre** a um `companies`; os módulos operacionais apontam para a **unidade**; `location` fica como sub-atributo, não como unidade.

---

## 6. Relacionamentos: o que é da unidade × o que é da empresa 💡

| Escopo | Registros que **pertencem ao estabelecimento** | Registros **da empresa inteira** |
|---|---|---|
| Colaboradores | `company_collaborators` (unidade principal) + `collaborator_establishments` (multi) | identidade do colaborador (`ref`, `cpf`) |
| Gestão | `manager_ref` / responsável **por unidade** | perfis administrativos (`profiles`) |
| Documentos & assinatura | `documents.establishment` (quando aplicável) | `signature_policies`, `signature_terms`, `signature_retention_policies`, `system_settings` |
| EPI | `epi_deliveries` | catálogo de EPI/CA |
| DDS / APR | `dds_records`, `apr_records` | — |
| CIPA / eleição | `cipa_committees` (**unidade**), `cipa_elections`, `cipa_ballot_config`, `cipa_voter_rolls` (**unidade**) | `cipa_mandate_indications`, `cipa_election_committee` (nível empresa/processo) |
| Inspeções | `cipa_inspections`, `field_inspections`, `attendance_sheets` | — |
| Clima | `daily_moods` (pode ser por unidade) | — |
| Local físico | `location` / `place` = sub-atributo da unidade | — |

> Ponto crítico de integridade: a **CIPA e a urna são por unidade** (`cipa_committees.unit`, `cipa_voter_rolls.establishment`). Migrar isso **não pode** alterar votos, atas ou evidências de assinatura — só trocar a *referência* de texto por FK, preservando o registro original.

---

## 7. Impacto nos módulos e interfaces 💡

| Módulo (caminho) | Precisa de… |
|---|---|
| **Colaboradores** (`modules/colaboradores`) | Seletor de unidade no cadastro/edição; filtro por unidade; vínculo multi-unidade. |
| **CIPA** (`modules/cipa` — comitês, eleições, urna, relatório por unidade) | `unit` → seletor de estabelecimento; filtro por unidade (o relatório consolidado já tem filtro, mas ainda em texto). |
| **Documentos & Assinaturas** (`modules/documentos`, `assinaturas`) | `establishment` como seletor; relatórios por unidade; passa a preencher o campo (hoje vazio). |
| **EPI / DDS / APR** | Seletor de unidade + filtro nos relatórios mensais. |
| **Inspeções** (`cipa_inspections`, `field_inspections`, `attendance_sheets`) | Vínculo por unidade + local físico separado. |
| **Config / Branding** (`modules/config`) | Gestão de unidades (CRUD) + branding por empresa (não por unidade, nesta fase). |
| **Relatórios** | Consolidado por empresa **e** individual por estabelecimento. |
| **Permissões** (futuro) | Escopo por estabelecimento (Fase F1 da Diretriz 003). |

---

## 8. Plano de migração (Fase 2) — por etapas 💡

- **F2.0 — Catálogo (sem migrar dado):** criar `establishments` + `collaborator_establishments`, **sem tocar** nas tabelas existentes; importar as **3 unidades reais** como sementes.
- **F2.1 — Carga inicial controlada:** inserir Matriz/Campinas/Recife por tenant; gerar mapa `texto → uuid` (com normalização de dash/caixa).
- **F2.2 — Coluna aditiva:** adicionar `establishment_id uuid` (nullable) em cada tabela do inventário, mantendo o campo texto.
- **F2.3 — Backfill + validação:** preencher `establishment_id` via mapa; **conferir 100%** dos registros; registrar os que não casarem para revisão manual.
- **F2.4 — Compatibilidade temporária:** código lê `establishment_id` com *fallback* para o texto; UI migra para o seletor.
- **F2.5 — Corte:** promover `establishment_id` a NOT NULL/FK onde couber; manter o texto como legado **read-only** por um ciclo.
- **F2.6 — Limpeza:** só após validação e aprovação, depreciar/arquivar as colunas texto (nunca remoção destrutiva sem backup).

Cada etapa com **backup + script reversível** e **feature flag**.

---

## 9. Riscos e critérios de aceitação 💡

**Riscos:** (a) associar registro à **empresa errada** ao resolver por `company_ref` × `company_id`; (b) **quebrar evidências de assinatura / processos eleitorais**; (c) valores duplicados sem mapa (ex.: `Matriz` × `Unidade Matriz — …`); (d) migrar `location` como se fosse unidade (erro conceitual); (e) generalizar a partir de uma empresa só.

**Critérios de aceitação:**
1. Todo registro migrado aponta para **o estabelecimento correto da própria empresa** (prova no banco).
2. **Zero perda** de registros; contagem antes = depois.
3. **Nenhuma** alteração em `cipa_ballots`, `cipa_voter_*`, `document_signatures`, `signature_*` (votos/evidências intactos).
4. Valores não mapeados **listados**, nunca adivinhados.
5. Reversão testada (rollback volta ao estado anterior).
6. Módulos existentes (Documentos, Colaboradores, EPI, DDS, APR, Assinaturas, CIPA/urna) **seguem operando** após cada etapa.

---

## 10. Decisões arquiteturais formalizadas (DIRETRIZ 006)

As decisões abaixo ficam **oficializadas** neste documento:

| # | Decisão |
|---|---|
| E1 | `establishment` e `unit`, **quando representarem unidades empresariais**, deverão futuramente referenciar a entidade `establishments`. |
| E2 | `location` e `place`, **quando representarem salas, galpões, pátios ou outros espaços internos**, são **locais físicos** e **não** estabelecimentos. |
| E3 | A migração deverá **preservar os textos originais** para histórico e auditoria. |
| E4 | O vínculo entre estabelecimento e empresa deverá utilizar **`company_id`**. |
| E5 | **Nenhuma associação** poderá permitir que registros sejam vinculados a estabelecimentos de **outra empresa**. |

> **Consequência direta (E4 + E5):** todo relacionamento com `establishments` deve ser resolvido dentro do tenant (`establishments.company_id = registro.company_id`), nunca por valor enviado livremente pelo cliente. Alinhado a §4 e §10 do `SAAS_MULTI_TENANT.md`.

---

## 11. Preparação da Fase F2.0 (próxima implementação candidata)

Registrada como **candidata**, **não executada** nesta diretriz:

- Criar o catálogo `establishments`.
- Cadastrar as **três unidades fictícias** identificadas (Matriz — São Bernardo do Campo, Filial Campinas, Filial Recife).
- Preservar **compatibilidade** com os campos textuais atuais.
- Preparar **seleção de estabelecimentos** nas interfaces.
- Manter o **modo demonstração** e a **troca rápida de perfis**.

**Ordem segura sugerida:** F2.0 + F2.1 (criar catálogo + semear as 3 unidades + mapa de normalização), **sem alterar nenhuma coluna existente** — passo de menor risco e maior ganho.

> **Antes de iniciar a F2.0, uma decisão de arquitetura sua:** confirmar que `location`/`place` **não** viram estabelecimentos (ficam como local físico). Se concordar, o modelo acima está fechado.

> 📎 **Plano técnico executável da F2.0:** o SQL proposto, as seeds fictícias, o mapa de normalização, a estratégia de segurança/RLS, o rollback e o checklist de autorização estão em [`F2_0_ESTABLISHMENTS_PLAN.md`](./F2_0_ESTABLISHMENTS_PLAN.md). Esse plano **não altera** nenhuma decisão deste inventário — apenas a operacionaliza.

---

## 12. Registro da execução desta diretriz

- **Arquivo criado:** `docs/architecture/ESTABLISHMENTS_INVENTORY.md`
- **Versão do documento:** 1.0
- **Diretriz de origem:** DIRETRIZ 005 (auditoria — inventário) — DIRETRIZ 006 (oficialização no repositório).
- **Alterações funcionais nesta diretriz:** **nenhuma.**
  - Nenhuma tabela criada, alterada ou removida.
  - Nenhum registro (dados simulados) modificado.
  - Nenhuma autenticação, política RLS, Storage, Edge Function, interface ou funcionalidade alterada.
  - Nenhuma migração executada.
- **Escopo desta diretriz:** criação deste documento + referência cruzada no documento principal.

---

*Fim do documento — SSTEK · Inventário Técnico de Estabelecimentos · v1.0*