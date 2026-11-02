# SSTEK — Testes da F2.0 (Estabelecimentos)

> Pasta criada na **DIRETRIZ 009** para hospedar **scripts de verificação MANUAL** da F2.0.
> **Isto NÃO é pasta de migrations.** Os arquivos aqui **não** devem ser executados por
> nenhuma ferramenta automática de migrations.

## Por que esta pasta existe (e não `supabase/migrations/`)

A DIRETRIZ 009 pediu o arquivo `20261013090200_f2_0_verify.sql`, mas autorizou movê-lo para
um diretório separado de testes caso a ferramenta de migrations execute **todos** os `.sql`
da pasta automaticamente.

**Decisão tomada:** manter os testes em `supabase/tests/`, porque:

1. Um runner de migrations (ex.: Supabase CLI `supabase db push`) executa **todos** os `.sql`
   de `supabase/migrations/`. Um script de verificação **não é** migration (não tem UP/DOWN).
2. O script comportamental faz **escritas** (dentro de transação com `ROLLBACK`); colocá-lo
   onde execução automática é possível seria um risco desnecessário.
3. A própria diretriz exige que o arquivo seja **classificado expressamente como verificação
   manual**, e não como migration de implantação.

> Se no futuro for confirmado que a ferramenta usada **nunca** executa a pasta `migrations/`
> automaticamente, o script de leitura (`f2_0_verify.sql`) pode ser **relocado** para
> `supabase/migrations/20261013090200_f2_0_verify.sql` — sem qualquer mudança de conteúdo.

## Arquivos

| Arquivo | Tipo | Escreve dados? | Descrição |
|---|---|---|---|
| `f2_0_verify.sql` | Verificação **somente leitura** | **Não** | Consultas de catálogo/`SELECT` que checam os critérios **T1–T7** e **T12**. |
| `f2_0_acceptance_transactional.sql` | Teste **comportamental** | Sim, em transação | Escritas em transação com `ROLLBACK` no final. Testa rejeições reais (C1–C5). |

## Classificação por critério (o que é estático × comportamental)

| Critério | O que comprova | Onde |
|---|---|---|
| **T1** Estrutura (tabelas/colunas) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T2** Estabelecimentos da Vega | `SELECT` de dados | `f2_0_verify.sql` |
| **T3** UNIQUE (company_id, code) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T4** FKs compostas existem | Inspeção de catálogo | `f2_0_verify.sql` |
| **T5** Índice único parcial (principal) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T6** RLS ligada + sem policies | Inspeção de catálogo | `f2_0_verify.sql` |
| **T7** Isolamento (FKs com company_id) | Inspeção de catálogo | `f2_0_verify.sql` |
| **T12** Compatibilidade (estruturas anteriores) | Inspeção de catálogo | `f2_0_verify.sql` |
| **C1** Código duplicado rejeitado | **Comportamental** (escrita) | `f2_0_acceptance_transactional.sql` |
| **C2** Vínculo entre empresas rejeitado | **Comportamental** (escrita) | `f2_0_acceptance_transactional.sql` |
| **C3** Segunda unidade principal rejeitada | **Comportamental** (escrita) | `f2_0_acceptance_transactional.sql` |
| **C4** Leitura/escrita anônima bloqueada | **Comportamental** (papel `anon`) | `f2_0_acceptance_transactional.sql` |
| **C5** Seeds idempotentes | **Comportamental** (escrita) | `f2_0_acceptance_transactional.sql` |

## ⚠️ Limitação dos testes somente leitura (obrigatório registrar)

`SELECT`s de catálogo (`pg_constraint`, `pg_indexes`, `pg_class`, `pg_policies`,
`information_schema`) provam **existência e definição** das estruturas — **não** provam o
**comportamento** em tempo de execução. Ou seja:

- **T1–T7 e T12** comprovam que as **estruturas estão corretas**, mas **não** comprovam que o
  banco **realmente rejeita** operações inválidas.
- A rejeição **real** (isolamento entre empresas, código duplicado, segunda principal,
  bloqueio anônimo) só é comprovada pelos testes **comportamentais** (`C1–C5`), que precisam
  de **execução**.

## Ordem segura de execução futura (quando autorizado)

1. **Backup** do banco.
2. Rodar `supabase/migrations/20261013090000_f2_0_create_establishments_up.sql`.
3. Rodar `supabase/migrations/20261013090100_f2_0_seed_establishments_up.sql`.
4. Rodar **`f2_0_verify.sql`** (somente leitura) → conferir T1–T7 e T12 = **PASSOU**.
5. Rodar **`f2_0_acceptance_transactional.sql`** (comportamental) → conferir C1–C5 = **PASSOU**.
   - Termina sempre com `ROLLBACK` → **nenhum dado dos testes persiste**.
   - Executar **apenas** em ambiente controlado (dev), com autorização expressa.
6. Se algo falhar → reverter com os `_down.sql` da F2.0 (ver plano §7).

> Enquanto não houver autorização expressa, **nada é executado**.