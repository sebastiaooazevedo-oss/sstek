# SSTEK — Convenção de Migrations (versionadas)

> Pasta criada na **DIRETRIZ 008** para hospedar as migrations SQL do SSTEK.
> O projeto **não possuía** convenção de migrations antes disso — esta é a proposta oficial.

## Estrutura

```
supabase/migrations/
  README.md                                   # este arquivo (convenção)
  <timestamp>_<fase>_<descricao>_up.sql        # aplicação (forward)
  <timestamp>_<fase>_<descricao>_down.sql      # reversão (rollback)
```

### Regras de nomenclatura

- **`<timestamp>`**: `YYYYMMDDHHMMSS` — define a **ordem** de execução (lexicográfica).
- **`<fase>`**: identificador da fase/época (ex.: `f2_0`, `f2_1`, `f0`).
- **`<descricao>`**: curto, minúsculo, com `_`.
- **`_up.sql`** = cria/altera. **`_down.sql`** = reverte **somente** o que o respectivo `_up` criou.

### Regras de conteúdo

1. **Toda migration tem UP e DOWN.** O par usa o **mesmo timestamp e prefixo**.
2. **Idempotência:** usar `if not exists` / `on conflict ... do nothing` sempre que possível.
3. **Aditivo e reversível:** um `_down` nunca deve remover objetos que **não** foram criados pelo seu `_up`.
4. **Guardas de segurança:** o `_down` deve **abortar** (via `raise exception`) se detectar dependências
   posteriores ou dados que não pertençam à própria migration — nada de exclusão silenciosa.
5. **Não misturar escopos:** seeds ficam em arquivos próprios, separados da criação de estrutura.
6. **Preservação:** migrações do SSTEK **não** alteram dados históricos, assinaturas ou processos
   eleitorais da CIPA sem etapa explícita, validada e com backup.

### Como aplicar (quando autorizado)

As migrations **não** são executadas automaticamente pelo app. A aplicação é feita de forma
**controlada e autorizada** (SQL editor do Supabase / ferramenta administrativa com *service role*),
sempre em par **UP → verificação → (DOWN, se necessário)**, com backup prévio.

> ⚠️ Os arquivos daqui são a **fonte versionada** do SQL. Eles **não** rodam sozinhos.

---

## Índice de migrations

| Ordem | Arquivo (UP / DOWN) | Fase | Descrição |
|---|---|---|---|
| 1 | `20261013090000_f2_0_create_establishments_{up,down}.sql` | F2.0 | Cria o catálogo `establishments` + vínculo `collaborator_establishments` + RLS default deny. |
| 2 | `20261013090100_f2_0_seed_establishments_{up,down}.sql` | F2.0 | Seeds das 3 unidades fictícias da Metalúrgica Vega (idempotentes). |

> **Status atual:** todos os arquivos acima estão **preparados e NÃO executados** (aguardando autorização
> expressa para a F2.0). Ver `docs/architecture/F2_0_ESTABLISHMENTS_PLAN.md`.

### Entrega 1 — versões únicas e recuperação fora da pasta

As migrations da Entrega 1 usam **versões únicas e crescentes**, com prefixo comum
`2026110110` para manter o grupo identificável:

| Versão | Arquivo (UP) | Estado |
|---|---|---|
| `20261101100000` | `20261101100000_entrega1_company_settings_up.sql` | **já aplicada** (não renomear — perderia a rastreabilidade) |
| `20261101100100` | `20261101100100_entrega1_documents_scope_policy_up.sql` | pendente |
| `20261101100200` | `20261101100200_entrega1_medical_certificate_versioning_up.sql` | pendente |
| `20261101100300` | `20261101100300_entrega1_storage_tenant_isolation_up.sql` | pendente |
| `20261101100400` | `20261101100400_entrega1_subdomain_immutability_up.sql` | pendente |


**Scripts de recuperação (`_down`) ficam em `supabase/recovery/`**, nunca aqui:

1. um executor que varra a pasta em ordem alfabética roda `_down` antes de `_up`
   (`d` < `u`);
2. ferramenta de migration aplica tudo o que está na pasta, e reversão não é
   migration — é ato humano, com exportação prévia.

Pacote completo (SQL, ordem, testes e recuperação): `docs/entrega1/README.md` e
`docs/entrega1/ENTREGA1_PACOTE_COMPLETO.txt`.

---

## Testes (fora desta pasta)

Os **scripts de verificação manual** da F2.0 ficam em **`supabase/tests/`** — **de propósito fora**
de `supabase/migrations/`, para não serem executados por ferramenta automática de migrations:

| Arquivo | Tipo |
|---|---|
| `supabase/tests/f2_0_verify.sql` | Verificação **somente leitura** (T1–T7, T12). |
| `supabase/tests/f2_0_acceptance_transactional.sql` | Testes **comportamentais** com `ROLLBACK` (C1–C5). |
| `supabase/tests/README.md` | Convenção, cobertura e ordem de execução dos testes. |