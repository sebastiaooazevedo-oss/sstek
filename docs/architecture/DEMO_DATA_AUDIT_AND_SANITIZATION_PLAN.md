# SSTEK — Auditoria de Dados Demonstrativos e Plano de Saneamento

> **Documento técnico de planejamento e auditoria.**
> Elaborado na **DIRETRIZ 011** (após o bloqueio de execução da DIRETRIZ 010).
> **Versão:** 1.0
> **Data:** 2026-10-13
> **Status:** **PLANO — NÃO executado.** Nenhum dado foi alterado.
> **Documento correlato:** [`F2_0_ESTABLISHMENTS_PLAN.md`](./F2_0_ESTABLISHMENTS_PLAN.md) (ver §15 — bloqueio por backup).

---

## Legenda de evidência (obrigatória)

| Marca | Significado |
|---|---|
| ✅ **CONFIRMADO** | Observado diretamente no banco do projeto (SaaS Supabase), por leitura somente-seleção. |
| 💡 **PROPOSTA** | Estratégia/roteiro sugerido. **Ainda não executado.** |
| ⛔ **PENDENTE** | Condição obrigatória em aberto. |

> **Restrição da DIRETRIZ 011:** nenhum `UPDATE`/`DELETE`/`INSERT` foi executado; nenhum CPF foi alterado; nenhuma migration, teste comportamental, autenticação, RLS ou interface foi tocada. **Somente leituras (`SELECT`).**
> **Privacidade:** este relatório **não exibe CPFs completos** — apenas estatísticas agregadas.

---

## 1. Diagnóstico dos 12 registros (✅ CONFIRMADO, somente leitura)

Escopo: todos os colaboradores da empresa fictícia **Metalúrgica Vega**
(`company_id = faac11b2-e4d7-45c4-8989-b98658910ff1`).

### 1.1 Quantidade e preenchimento

| Métrica | Valor |
|---|---|
| Total de colaboradores | **12** |
| CPF preenchidos | **12** (100%) |
| CPF distintos | **12** (sem duplicidade) |
| CPF vazios / nulos | **0** |
| Grupos de CPF repetidos | **0** |

### 1.2 Formato do CPF

| Métrica | Valor | Leitura |
|---|---|---|
| Comprimento | 14 caracteres em **todos** | formato mascarado `nnn.nnn.nnn-nn` |
| Contém ponto e hífen | 12 / 12 | ✅ máscara consistente |
| Quantidade de dígitos | 11 dígitos em **todos** | ✅ padrão de CPF |

> **Correção honesta de leitura inicial:** a primeira consulta acusou "12 CPFs fora de 11 dígitos" — isso era **falso alarme causado pela máscara** (pontos/hífen), não por valor inválido. Depois de normalizar (remover não-dígitos), **todos têm exatamente 11 dígitos**. Registro isto para não deixar um falso positivo no histórico.

### 1.3 Validade matemática (dígitos verificadores)

| Resultado | Quantidade |
|---|---|
| **Dígitos verificadores VÁLIDOS** | **1 de 12** |
| **Dígitos verificadores INVÁLIDOS** | **11 de 12** |
| Todos os dígitos iguais (ex.: `111.111.111-11`) | **0** |

> ⚠️ **Ressalva obrigatória (consta na própria diretriz):** um CPF **matematicamente válido não comprova** que pertence a uma pessoa real; um CPF **matematicamente inválido** também **não comprova** que todo o restante do cadastro seja fictício. Ou seja: os dígitos verificadores são **um sinal**, não uma prova de ficcionalidade nem de autenticidade. O sinal aqui (11/12 inválidos) é **compatível** com valores fabricados/digitados à mão, mas **não é conclusivo**.

### 1.4 Outros campos pessoais — o CPF não é o único PII

| Campo | Preenchidos (de 12) |
|---|---|
| `rg` | **12** |
| `pis` | **12** |
| `ctps` | **12** |
| `birth_date` | **12** |
| `phone` | **12** |
| `email` | **12** |
| `matricula` | **12** |

> 📌 **Ponto que o escopo estrito do CPF esconderia:** o ambiente demonstrativo tem **superfície de dados pessoais bem mais ampla que o CPF**. RG, PIS, CTPS, data de nascimento, telefone e e-mail estão **todos 100% preenchidos**. Qualquer saneamento que olhe só o CPF deixa esses campos de fora.

### 1.5 Distribuição operacional

| Estabelecimento (`establishment`) | Situação | Qtd |
|---|---|---|
| `Unidade Matriz — São Bernardo do Campo` | `active = true` | 10 |
| `Unidade Matriz — São Bernardo do Campo` | `active = false` | 2 |

---

## 2. Dependências identificadas (✅ CONFIRMADO)

### 2.1 Onde o CPF do colaborador é usado

| Dependência | Como usa o CPF | Tabela / arquivo | Risco de alterar |
|---|---|---|---|
| **Votação CIPA** | **CPF é o identificador do eleitor** (`findByCpf`) | `supabase/functions/cipa-vote/index.ts` | **ALTO** — é a chave de identificação na urna |
| **Comissão eleitoral** | coluna `cpf` | `cipa_election_committee` (0 linhas) | Médio |
| **Indicações de mandato** | coluna `cpf` | `cipa_mandate_indications` (0 linhas) | Médio |
| **Documentos/Fichas** | CPF exibido em relatórios HTML/PDF gerados na hora | `attendanceStore`, `FieldInspectionModal`, `fieldInspectionStore`, `InspectedCollaboratorsField` | Médio (texto gerado, não armazena CPF à parte) |
| **Cadastro de colaboradores** | campo editável | `colaboradores/*`, `collaboratorsStore.ts` | Alto (é a origem) |
| **Mocks do frontend** | 12 CPFs **hardcoded** | `src/mocks/collaborators.ts` | Baixo (só demonstração) |

### 2.2 Onde o CPF **NÃO** é usado diretamente (importante)

| Módulo | Chave usada | Observação |
|---|---|---|
| **Assinaturas eletrônicas** | `collaborator_ref` (text) | `document_signatures`, `signature_document_signatories`, `signature_audit_log`, `signature_divergences` referenciam **`ref`**, não CPF. ✅ O CPF **não** é chave de assinatura. |
| **EPI** | `collaborator_ref` | `epi_deliveries.collaborator_ref` |
| **Profiles** | `collaborator_ref` | `profiles.collaborator_ref` |

> ✅ **Boa notícia estrutural:** as **evidências de assinatura** são ancoradas por **`ref`** e pelo **conteúdo congelado** do documento — **não** pelo CPF. Isso significa que trocar o CPF **não quebra** a corrente de assinaturas.

### 2.3 Volumetria atual das tabelas dependentes (✅ CONFIRMADO)

| Tabela | Linhas | Relevância para o CPF |
|---|---|---|
| `company_collaborators` | 12 | **origem do CPF** |
| `documents` | 26 | usa `collaborator_id`/`collaborator_name`, **não** CPF |
| `epi_deliveries` | 7 | usa `collaborator_ref` |
| `document_signatures` | 2 | usa `collaborator_ref` |
| `signature_audit_log` | 4 | usa `collaborator_ref` |
| `collaborator_signatures` | 1 | usa `collaborator_id` |
| `profiles` | 1 | usa `collaborator_ref` |
| `cipa_voter_entries` | **0** | snapshot eleitoral — **vazio** |
| `cipa_voter_participation` | **0** | participação eleitoral — **vazio** |
| `cipa_ballot_term_acceptances` | **0** | aceite de termo — **vazio** |
| `cipa_election_committee` | **0** | comissão (tem coluna `cpf`) |
| `cipa_mandate_indications` | **0** | indicações (tem coluna `cpf`) |
| `signature_document_signatories` | **0** | por `collaborator_ref` |
| `signature_divergences` | **0** | por `collaborator_ref` |

> 🔑 **Leitura-chave:** **não existe nenhuma evidência eleitoral/CIPA gravada** (tudo em 0). Isso **reduz muito** o risco de qualquer saneamento agora — ainda **não há** urna, voto, ata ou snapshot com CPF a preservar.

---

## 3. Riscos de alteração (💡 avaliação)

| # | Risco | Gravidade | Comentário |
|---|---|---|---|
| R1 | Quebrar **identificação do eleitor** na votação | **Alto** | O CPF é a chave de match. Se houver eleição em andamento/aberta, o eleitor deixaria de ser reconhecido com o CPF novo. **Hoje: 0 urnas/votos → risco latente, não ativo.** |
| R2 | Dessincronizar **CPF no app × snapshot de votação** | Alto | Só ocorre se existirem snapshots — **hoje não existem**. |
| R3 | Quebrar **UNIQUE `(company_id, cpf)`** se o novo valor colidir | Médio | Substituição deve garantir unicidade dentro da empresa. |
| R4 | **Perda de reversibilidade** sem backup | Alto ⛔ | Ver §5. |
| R5 | Alterar **evidência histórica** (assinatura/voto/ata) | **Alto — evitável** | Assinaturas ancoram em `ref`, **não** em CPF. **Não tocar** em snapshots/CIPA. |
| R6 | Focar só no CPF e **ignorar RG/PIS/CTPS/telefone/e-mail** | Médio | PII residual permanece (§1.4). |
| R7 | Usar **números de pessoas reais** como substitutos | Alto | Proibido pela diretriz. |
| R8 | Tratamento como **migração automática** | Médio | Deve ser script **versionado e manual**, com aprovação. |

---

## 4. Plano de anonimização 💡 (preparado, **não** executado)

> Só será necessário **se** o responsável considerar os dados demonstrativos inadequados. A diretriz condiciona a execução à autorização expressa.

### 4.1 Princípios (obrigatórios)

1. **Identificadores demonstrativos claramente sinalizados** — nada de números que pareçam reais.
2. **Preservar chaves internas e relacionamentos** — **NÃO** alterar `id` (uuid) nem `ref` (text). Somente o valor do CPF (e demais PII, se decidido).
3. **Não alterar evidências históricas** — não tocar em assinaturas, votos, atas, snapshots CIPA/urna. (Confirmado: essas tabelas ancoram em `ref`/`id`, não em CPF.)
4. **Não modificar votos, atas ou registros eleitorais.**
5. **Nunca** substituir por CPF de pessoa real.
6. **Reversível** mediante backup autorizado.
7. **Idempotente** — reexecução não deve corromper nem duplicar.

### 4.2 Estratégia recomendada

**Alvo mínimo (somente CPF):**
- Substituir `company_collaborators.cpf` por valores **matematicamente válidos** porém **pertencentes a faixas explicitamente reservadas para demonstração** (valores documentados no próprio script), OU por um marcador inequívoco do tipo `DEMO-<ref>` — a escolha precisa de **aprovação** (ver §4.4).
- Garantir `UNIQUE (company_id, cpf)` após a troca.
- **Não** tocar em `id`, `ref`, `matricula`, `establishment`, assinaturas, documentos, EPI.

**Alvo ampliado (PII completo) — recomendado registrar como decisão:**
- Como RG/PIS/CTPS/telefone/e-mail/nascimento também estão 100% preenchidos, avaliar substituir **o conjunto** por valores demonstrativos consistentes:
  - `rg`, `pis`, `ctps` → valores mascarados/demonstrativos documentados.
  - `birth_date` → datas fictícias plausíveis.
  - `phone` → faixa reservada de ficção (ex.: números claramente não reais).
  - `email` → domínio demonstrativo (ex.: `@exemplo.demo`).
- Manter **consistência** com eventuais referências (o e-mail é usado no fluxo de votação).

### 4.3 Forma de entrega (quando autorizado)

- Script **versionado** em `supabase/` (padrão do projeto), com UP/DOWN:
  - UP idempotente (só atualiza quando o valor atual **não** é já demonstrativo).
  - DOWN capaz de restaurar **apenas** se as condições documentadas forem atendidas (na prática: reversão real = **restore do backup**).
- **Nada de `TRUNCATE`/exclusão** de registros.
- Execução **somente** após backup confirmado + aprovação.

### 4.4 Decisões que dependem do responsável

1. **Escopo:** só CPF ou **todo** o PII (RG/PIS/CTPS/nascimento/telefone/e-mail)?
2. **Formato do CPF demonstrativo:** faixa reservada válida **versus** marcador textual inequívoco?
3. **Mocks do frontend** (`src/mocks/collaborators.ts`, 12 CPFs hardcoded): alinhar com a mesma política?

---

## 5. Condições pendentes para executar a F2.0 (⛔)

A execução da F2.0 (e de qualquer saneamento) permanece **BLOQUEADA** até:

- [ ] ⛔ **Backup recuperável confirmado pelo responsável** — condição **obrigatória**; a DIRETRIZ 010 proíbe prosseguir por presunção. Registrada também em `F2_0_ESTABLISHMENTS_PLAN.md` §15.
- [ ] **Decisão** sobre o saneamento de PII (§4.4).
- [ ] Se houver saneamento: **script versionado aprovado** + backup antes da execução.
- [ ] Autorização expressa para iniciar a sequência F2.0 (ver plano §9 e §11).

> Enquanto o backup não for confirmado, **nada** de F2.0 nem de saneamento será executado.

---

## 6. Registro da execução desta diretriz (DIRETRIZ 011)

- **Arquivo criado:** `docs/architecture/DEMO_DATA_AUDIT_AND_SANITIZATION_PLAN.md` (este documento).
- **Documento atualizado:** `F2_0_ESTABLISHMENTS_PLAN.md` → v1.3 (§15 — bloqueio por backup + referência a esta auditoria).
- **SQL executado:** **apenas `SELECT`** (auditoria somente leitura).
- **O que NÃO foi feito:** nenhum `UPDATE`/`DELETE`/`INSERT`; nenhum CPF alterado; nenhuma migration; nenhum teste comportamental; nenhuma alteração de autenticação, RLS ou interfaces; nenhum arquivo UP/DOWN modificado.

---

*Fim do documento — SSTEK · Auditoria de Dados Demonstrativos e Plano de Saneamento · v1.0*