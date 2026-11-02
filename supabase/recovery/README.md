# supabase/recovery — scripts de recuperação (execução manual)

> **Esta pasta não é executada por ferramenta de migration.** Ela existe
> justamente para que reversão nunca aconteça por acidente: `supabase/migrations/`
> é aplicada automaticamente por ferramenta, e um `_down` varrido em ordem
> alfabética rodaria **antes** do `_up` (`d` < `u`).

## Regras

1. Rode **um arquivo por vez**, manualmente, no SQL Editor, com exportação prévia
   (ver `docs/entrega1/README.md` §5).
2. Ordem: **do último para o primeiro** (pareado com as versões de
   `supabase/migrations/`).
3. Nenhum script aqui apaga linha de dado, move objeto ou reabre acesso público.
4. Só `20261101100400_..._recovery.sql` é **rollback exato**. Os outros são
   **recuperação com acesso fechado / preservação de dados** — a diferença está
   documentada no cabeçalho de cada arquivo.

## Arquivos

| Versão par | Arquivo | Tipo |
|---|---|---|
| `20261101100100` | `20261101100100_entrega1_documents_scope_policy_recovery.sql` | recuperação fail-closed (não restaura leitura ampla) |
| `20261101100200` | `20261101100200_entrega1_medical_certificate_versioning_recovery.sql` | recuperação sem perda de dados (mantém colunas/índices) |

| `20261101100400` | `20261101100400_entrega1_subdomain_immutability_recovery.sql` | rollback exato |

Depois de qualquer recuperação, **não** reative acesso recriando policy pública.
Use o bloco de emergência comentado (somente `authenticated`, com helper de
empresa) e rode os testes da seção 10 do README da entrega.