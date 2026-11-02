# Entrega 1 — Pacote de isolamento multiempresa (revisão 2)

> **Estado real:** nenhuma migration pendente foi executada no banco atual.
> Só rodaram consultas de leitura. A ficha pública **continua bloqueada**
> (`PUBLIC_FICHA_ENABLED = false` → HTTP 503 antes de qualquer consulta ou URL
> assinada).
>
> **Arquivo único para download:** `docs/entrega1/ENTREGA1_PACOTE_COMPLETO.txt`
> (todos os SQL, este README, o script mestre, o conteúdo dos quatro arquivos de
> frontend alterados, ordem, testes e pendências, separados por marcadores de
> caminho).

---

## 0. O que mudou nesta revisão (correções da revisão externa)

| Item | Problema apontado | Correção |
|---|---|---|
| 1 | `storage_object_scope` autorizava com base só no registro; o próprio cliente podia apontar para arquivo de outra empresa | Helpers agora recebem **bucket + caminho**; 4 gatilhos validam **company_id/company_ref, bucket, prefixo de pasta, existência real do objeto em `storage.objects` e vínculo com o colaborador** antes de qualquer referência ser gravada |
| 2 | O inventário de `documents` rejeitava `tenant_write` (ALL de admin) | Inventário passou a **reconhecer a autorização administrativa pela forma** (cmd, papéis, expressão) e a considerar apenas policies **PERMISSIVAS** de leitura como concessão |
| 3 | `CHECK (storage_path IS NOT NULL)` não prova arquivo existente/autorizado | Finalização validada no servidor (gatilho), inclusive em chamada direta ao PostgREST; fluxo recuperável preservado; testes de concorrência e de alteração do objeto durante a finalização |
| 4 | Consulta de hash com `GROUP BY` gerava hashes individuais | Consulta reescrita: inventário completo + **um único hash**, exatamente como a migration calcula, e a linha do hash da string vazia |
| 5 | Execução não transacional entre arquivos | **Script mestre** com transação externa única, sem `BEGIN/COMMIT` internos; reconhecimento do inventário dentro da transação; `company_settings` só **verificada** como pré-requisito |
| 6 | Pacote sem o conteúdo do frontend | TXT consolidado inclui os **4 arquivos de frontend** alterados e os SQL de sessão/configuração necessários à revisão |

Nada foi ampliado para onboarding, QR definitivo ou novos módulos.

---

## 0.1 Ambiente isolado (requisito externo) — leia antes de tudo

**Não consigo provisionar ambiente de homologação.** Nesta sessão não existe
ferramenta de criação de projeto/banco descartável. O único banco que eu
alcanço é o **ambiente atual**, que não pode receber as migrations pendentes.
Consequência direta e honesta:

- **nenhum teste do §12 foi executado**;
- **nenhuma conclusão** deste pacote se apoia em execução;
- o que existe é revisão de código + leitura de schema/ACL + procedimento
  reproduzível.

Também **não substituí testes por consultas rodando como `postgres`**. O
executor do SQL Editor é `postgres` com `rolbypassrls = true`: consultas ali
**ignoram RLS** e por isso **não provam nada** sobre isolamento entre empresas.

### O recurso externo exato que falta

Um **projeto Supabase descartável** (plano gratuito serve), separado do atual,
com:

| Item | Requisito |
|---|---|
| Projeto | novo, **sem** dados do atual; sem cópia de `auth.users`, Storage ou tabelas |
| Extensões | `pgcrypto` (usada por `gen_random_uuid()` e por `crypt` no fluxo de senha) |
| Credenciais | `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SERVICE_ROLE_KEY` **do projeto isolado** — não peça nem cole no chat |
| Acesso | SQL Editor como proprietário (necessário para `storage.*` e `auth.*`) |
| 4 usuários | `a-admin@`, `a-colab@`, `b-admin@`, `b-colab@fixture.invalid`, criados por você no Dashboard/Admin API |
| Chaves de teste | 4 sessões `authenticated` + 1 cliente `anon`, geradas no projeto isolado |

Alternativa sem Supabase: um Postgres 15+ com os schemas `auth` e `storage`
implementados à mão **não serve** — os testes de Storage e de `auth.uid()`
dependem do runtime real do Supabase. Se não houver projeto descartável, o
pacote **não pode ser aprovado**, só revisado.

### Procedimento de preparação (reproduzível)

1. **Criar** o projeto isolado e guardar URL/anon/service_role fora do
   repositório (variáveis de ambiente locais).
2. **Habilitar** `pgcrypto` no schema `extensions`.
3. **Aplicar o schema de base**: todas as migrations **já aplicadas** do
   projeto, **incluindo** `20261101100000_entrega1_company_settings_up.sql`.
   As quatro pendentes (**não**) entram nesta etapa.
4. **Criar os 4 usuários** (Dashboard > Authentication > Add user, e-mail
   confirmado) com os e-mails da fixture.
5. **Rodar a fixture**:
   ```sql
   set app.entrega1_environment = 'isolated';
   set app.entrega1_seed_ack    = 'EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL';
   -- cole supabase/tests/entrega1_isolated_seed.sql
   ```
   O arquivo aborta se os marcadores faltarem, se já existir `empresa-a`/
   `empresa-b` ou se as migrations pendentes já estiverem aplicadas.
6. **Capturar** inventário + hash (§5) e **exportar** as pré-verificações (§11)
   para arquivo.
7. **Aplicar** o pacote pelo script mestre (§4).
8. **Executar** os testes do §12 pelas APIs, com as 4 sessões + `anon`.
9. **Registrar** a tabela do §12.5 com evidência (código de erro/HTTP + horário).
10. **Descartar** o projeto (ou rodar `supabase/tests/entrega1_isolated_teardown.sql`).

Nenhum passo acima exige senha neste chat.

---

## 1. Composição do pacote

### Migrations pendentes (executáveis)

| Ordem | Versão | Arquivo | Papel |
|---|---|---|---|
| — | `20261101100000` | `20261101100000_entrega1_company_settings_up.sql` | **JÁ APLICADA.** Cria `company_settings` + helpers de sessão. **Verificada, não reaplicada** |
| 1 | `20261101100100` | `20261101100100_entrega1_documents_scope_policy_up.sql` | escopo de leitura de `public.documents` |
| 2 | `20261101100200` | `20261101100200_entrega1_medical_certificate_versioning_up.sql` | arquivo obrigatório, imutabilidade, versionamento |
| 3 | `20261101100300` | `20261101100300_entrega1_storage_tenant_isolation_up.sql` | policies de Storage, buckets privados, helpers bucket+path, **validação de propriedade de referências** |
| 4 | `20261101100400` | `20261101100400_entrega1_subdomain_immutability_up.sql` | subdomínio imutável no banco |

### Script mestre (novo)

`supabase/scripts/entrega1_apply_all_transactional.sql` — abre **uma** transação,
posiciona `app.storage_policy_ack` dentro dela, verifica o pré-requisito e executa
**apenas** os quatro arquivos pendentes.

### Fixtures de homologação (novos — só ambiente isolado)

| Arquivo | Papel |
|---|---|
| `supabase/tests/entrega1_isolated_seed.sql` | cria empresas A/B, vínculos, `company_settings` independentes, documentos (geral/interno/individual), regulamento, atestados (um **sem arquivo**, de propósito) e objetos de Storage fictícios |
| `supabase/tests/entrega1_isolated_teardown.sql` | remove só a fixture |

Os dois exigem `app.entrega1_environment = 'isolated'` **e**
`app.entrega1_seed_ack = 'EU_CONFIRMO_QUE_ESTE_BANCO_E_DESCARTAVEL'`, e o seed
aborta se as migrations pendentes já estiverem aplicadas. Nenhum valor do
ambiente atual é copiado.

### Recuperação (execução manual, fora da pasta de migrations)

| Arquivo em `supabase/recovery/` | Tipo |
|---|---|
| `20261101100100_entrega1_documents_scope_policy_recovery.sql` | recuperação **fail-closed** (não restaura leitura ampla) |
| `20261101100200_entrega1_medical_certificate_versioning_recovery.sql` | recuperação **sem perda de dados** (mantém colunas/índices) |
| `20261101100300_entrega1_storage_tenant_isolation_recovery.sql` | recuperação **fail-closed** (remove policies, 4 gatilhos e 10 funções; buckets privados sem policy) |
| `20261101100400_entrega1_subdomain_immutability_recovery.sql` | **rollback exato** |

### Por que a recuperação não está em `supabase/migrations/`

1. Um executor que varra a pasta em ordem alfabética roda `_down`/`_recovery`
   **antes** do `_up`.
2. Ferramenta de migration aplica tudo da pasta; reversão é ato humano com
   exportação prévia.
3. A pasta `supabase/tests/` já segue essa convenção no projeto.

### Versionamento

- Antes: 8 arquivos dividiam `20261101100000` com `company_settings` (versão
  duplicada, `_down` ordenando antes de `_up`).
- Agora: `100100`, `100200`, `100300`, `100400` — únicas e crescentes.
- `company_settings` **permanece** em `20261101100000`. Renomear apagaria a
  rastreabilidade de uma migration já aplicada num banco sem
  `supabase_migrations.schema_migrations`. Ao adotar histórico:
  ```sql
  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261101100000', 'entrega1_company_settings') on conflict do nothing;
  ```

---

## 2. O que está implantado, entregue e testado

| Categoria | Item |
|---|---|
| **Implantado (rodadas anteriores)** | `fiscalizacao-publica` com `PUBLIC_FICHA_ENABLED = false` (503) |
| **Implantado (rodadas anteriores)** | `platform-admin` recusa troca de subdomínio (`409 SUBDOMAIN_IMMUTABLE`) |
| **Código alterado (frontend)** | fluxo de atestado: upload → **confirmação do objeto no servidor** → INSERT; correção por nova versão; selo de versão vigente |
| **SQL entregue, NÃO aplicado** | 4 migrations + 4 recuperações + script mestre |
| **Verificado por leitura** | colunas, policies reais, flags de RLS, proprietários, privilégios, buckets, stores do app |
| **Testado de verdade** | só build do frontend e deploy de edge functions |
| **NÃO testado** | qualquer operação com identidades reais; nenhum teste do §12 foi executado |
| **NÃO verificável por mim** | backup/PITR e restauração efetiva |

**Não existe ambiente isolado disponível nesta sessão.** Nenhum teste é
declarado aprovado.

---

## 3. Ordem de aplicação e dependências

| # | Arquivo | Depende de | Motivo |
|---|---|---|---|
| 0 | `company_settings_up` | — | **já aplicada**; fornece os helpers de sessão |
| 1 | `documents_scope_policy_up` | helpers de sessão | regra de negócio; o Storage espelha |
| 2 | `medical_certificate_versioning_up` | `medical_certificates`, `documents`, `system_audit_logs` | cria `replaces_id`/`revision`, constraint e gatilhos |
| 3 | `storage_tenant_isolation_up` | **2 (coluna `replaces_id`)** | valida referências e cria helpers; aborta se a 2 não estiver aplicada |
| 4 | `subdomain_immutability_up` | `companies`, `is_platform_admin` | independente |

Dependência dura: **3 → 2** (verificada no `$pre$` do arquivo 3).

---

## 4. Execução atômica

Nenhum dos quatro arquivos tem `begin;`/`commit;`. Eles são **corpos de
statements**; a transação vem de fora.

### Opção A (recomendada) — script mestre

```bash
psql "$DATABASE_URL" \
  -v storage_policy_ack="<HASH_DO_§5>" \
  -f supabase/scripts/entrega1_apply_all_transactional.sql
```

- Uma transação: qualquer falha reverte **tudo**.
- O reconhecimento do inventário é feito **dentro** da transação.
- `company_settings` é **verificada**, nunca reaplicada.
- Sem `-v`, o script usa `COLE_O_HASH_AQUI` e a migration 3 aborta antes de
  qualquer `DROP` — comportamento desejado.
- Você **não** edita delimitadores de transação.

### Opção B — SQL Editor (sem psql)

Abra **uma** aba, cole nesta ordem e execute de uma vez:

```sql
select set_config('app.storage_policy_ack', '<HASH_DO_§5>', true);
-- corpo integral de 20261101100100_..._up.sql
-- corpo integral de 20261101100200_..._up.sql
-- corpo integral de 20261101100300_..._up.sql
-- corpo integral de 20261101100400_..._up.sql
```

O SQL Editor envia o script inteiro em uma transação. Como os arquivos não têm
`BEGIN/COMMIT`, não há transação aninhada nem commit parcial.

### Limites honestos

`begin/commit` cobre DDL e policies. **Não** cobre o cache de schema do
PostgREST (alguns segundos) nem sessões concorrentes que já estejam abertas.

### Se falhar

| Mensagem | Causa | O que fazer |
|---|---|---|
| `company_settings não existe` | pré-requisito não aplicado | aplique `20261101100000`; nada foi alterado |
| `Revisão explícita do inventário pendente` | hash diferente/ausente | rode a consulta do §5 e reexecute com o hash; nada foi alterado |
| `Migração interrompida ... policies desconhecidas` | policy permissiva desconhecida citando bucket isolado, sem `bucket_id`, ou irrestrita | decisão humana; nada foi alterado |
| `Policies de leitura extra em public.documents` | leitura ampla desconhecida | revise `tenant_write` e demais; nada foi alterado |
| `Existem storage_path duplicados` | dois atestados no mesmo caminho | corrija manualmente; nada foi alterado |
| `Pré-requisito ausente: aplique 20261101100200` | ordem invertida | aplique na ordem; nada foi alterado |
| `Conferência final falhou` | objeto criado com regra/papel errado | a transação reverte inteira |
| `must be owner of table objects` | sessão sem ser proprietário no schema `storage` | use a conta dona; nada foi alterado |

---

## 5. Inventário de `storage.objects` e hash (consulta corrigida)

A migration aborta **antes de qualquer `DROP`** enquanto o hash do conjunto de
policies desconhecidas não for informado — **inclusive quando o conjunto está
vazio** (`d41d8cd98f00b204e9800998ecf8427e`). Reconhecer "não há nada a
reconhecer" também é um ato explícito.

A consulta abaixo devolve **uma linha**, com o inventário completo, **um único
hash** calculado exatamente como a migration calcula (concatenação em ordem de
`policyname`, sem separador extra) e o hash da string vazia como referência.
**Não há `GROUP BY`** — o defeito anterior produzia um hash por policy.

```sql
with known(name) as (
  values ('documents_read'),('documents_insert'),('documents_update'),('documents_delete'),
         ('branding_read'),('branding_insert'),('branding_update'),('branding_delete'),
         ('caepi_base_all'),('caepi_base_platform_all')
), pol as (
  select
    p.policyname,
    p.cmd,
    array_to_string(p.roles::text[], ',')                        as roles,
    coalesce(nullif(btrim(p.qual), ''), '<null>')                as using_expr,
    coalesce(nullif(btrim(p.with_check), ''), '<null>')          as check_expr
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename  = 'objects'
    and p.policyname not in (select name from known)
), agg as (
  select coalesce(string_agg(
           format(E'\n  - %s | cmd=%s | roles=%s | using=%s | check=%s',
                  policyname, cmd, roles, using_expr, check_expr),
           '' order by policyname), '') as inventory
  from pol
)
select
  inventory                                        as inventario_completo,
  md5(inventory)                                   as ack_hash,
  md5('')                                          as hash_da_string_vazia,
  (inventory = '')                                 as conjunto_vazio
from agg;
```

- `conjunto_vazio = true` → o valor válido de `ack_hash` é o da coluna
  `hash_da_string_vazia`.
- `conjunto_vazio = false` → revise **cada linha** de `inventario_completo`
  antes de usar `ack_hash`.

**O que isso NÃO é:** cobertura automática. Não existe verificação confiável de
"expressão permissiva" por texto — `bucket_id <> 'avatars'` passaria por
qualquer regex. Os bloqueios duros da migration cobrem apenas casos
verificáveis; o resto é revisão humana obrigatória. A única prova real de
isolamento é o roteiro do §12 executado com identidades distintas.

---

## 6. Propriedade de referências (item 1)

### 6.1 O problema

Antes, `storage_object_scope(p_name)` decidia o escopo olhando **apenas o
registro** (`documents.storage_path`, `medical_certificates.storage_path`,
`internal_regulations.storage_path`, `company_settings.logo_path`). Se o
cliente conseguisse inserir uma linha apontando para um arquivo de outra
empresa, essa linha passaria a ser "prova" de propriedade — e o helper
autorizaria acesso.

### 6.2 O que o servidor impõe agora

Toda escrita de referência passa por `storage_reference_problem(bucket, caminho,
company_id, company_ref, collaborator_ref, tipo)`, chamada por **quatro
gatilhos**:

| Tabela | Gatilho | Momentos |
|---|---|---|
| `documents` | `documents_validate_storage_reference` | INSERT e UPDATE de `storage_path`, `company_id`, `company_ref` |
| `medical_certificates` | `medical_certificates_validate_file_reference` | INSERT |
| `internal_regulations` | `internal_regulations_validate_storage_reference` | INSERT e UPDATE de `storage_path`, `company_ref` |
| `company_settings` | `company_settings_validate_branding_reference` | INSERT e UPDATE de `logo_path`, `letterhead_path`, `company_id` |

A validação recusa, nesta ordem:

1. caminho vazio, `data:`, `http(s):`, `blob:`, caminho absoluto ou com `..`;
2. bucket incompatível com o tipo (`branding` só no bucket `branding`; documento,
   atestado e regulamento só em `documents`);
3. `company_id` que não existe, ou `company_ref` que não corresponde ao
   `company_id` do registro, ou registro sem empresa identificada;
4. **prefixo do caminho diferente do subdomínio da empresa do registro** →
   arquivo de outra empresa é recusado;
5. **objeto inexistente** em `storage.objects` para aquele `(bucket_id, name)`;
6. atestado fora de `<empresa>/atestados/<colaborador>/`, com colaborador vazio
   ou apontando para a pasta de **outra pessoa**;
7. atestado apontando para caminho já usado por documento/regulamento, e
   documento/regulamento apontando para caminho de atestado;
8. branding fora de `<empresa>/logo/` ou `<empresa>/letterhead/`.

Consequência prática: **o registro criado pelo cliente deixa de ser prova de
propriedade**. Ele só é aceito se o objeto existir no bucket correto e se o
caminho pertencer, por prefixo, à empresa do próprio registro.

### 6.3 Helpers bucket-aware

| Antes | Agora |
|---|---|
| `storage_object_scope(p_name)` | `storage_object_scope(p_bucket, p_name)` |
| `storage_path_is_medical_certificate(p_name)` | `storage_path_is_medical_certificate(p_bucket, p_name)` |
| — | `storage_object_exists(p_bucket, p_name)` |
| — | `storage_reference_problem(...)` |

O mesmo `name` em buckets diferentes **não é o mesmo arquivo**
(`storage.objects` é único por `(bucket_id, name)`). `storage_object_scope` agora
retorna `null` quando o objeto não existe naquele bucket ou quando o caminho não
está na pasta da empresa atual.

### 6.5 Leitura da própria pasta de atestados

Para permitir o fluxo `upload → confirmação → INSERT`, a policy de leitura
autoriza o colaborador a listar/ler **a própria pasta** de atestados mesmo antes
de o registro existir (`storage_path_is_own_certificate_folder`). Isso não
amplia acesso a nada de outra pessoa ou de outra empresa.

### 6.6 Dependência de `BYPASSRLS` (verificada agora)

A checagem de existência lê `storage.objects`, cujo dono é
`supabase_storage_admin` — com `relrowsecurity = true` e
`relforcerowsecurity = false`. As funções são `SECURITY DEFINER`: se o dono
delas **não** tiver `BYPASSRLS`, as policies `to authenticated` escondem as
linhas e `storage_object_exists` devolveria `false` para tudo, negando o acesso
inteiro (fail-closed, mas inutilizável).

Verificado no banco atual: executor `postgres`, `rolbypassrls = true`,
`rolsuper = false`, dono de `storage.objects` = `supabase_storage_admin`.

O `$check$` da migration 3 **falha** se o dono de
`storage_reference_problem(...)` não tiver `BYPASSRLS`. Assim o problema aparece
na aplicação, não em produção.

---

## 7. Auditoria da escrita em `system_audit_logs` (item 4)

Consulta executada nesta rodada (leitura) e resultado:

| Item | Resultado |
|---|---|
| `relrowsecurity` | `true` |
| `relforcerowsecurity` | **`false`** |
| proprietário da tabela | `postgres` |
| policy aplicável | `system_audit_logs_all` — `ALL`, `to public`, `using false`, `with check false` |
| `GRANT` | `anon`/`authenticated`/`service_role`/`postgres` têm privilégios de tabela, mas a RLS nega todas as linhas |
| proprietário da função de auditoria | `postgres` (dono da sessão que aplica a migration) |

**Conclusão técnica:** `relforcerowsecurity` isoladamente **não** decide a
questão — o que decide é **quem executa** e **se a RLS se aplica a ele**. Como
`relforcerowsecurity = false`, o dono da tabela (`postgres`) **não** é submetido
à RLS; a função é `SECURITY DEFINER` com esse dono, então o `INSERT` da
auditoria funciona apesar da policy `false`.

Se `relforcerowsecurity` virar `true`, **ou** a função trocar de dono para um
papel sem privilégio, **todo cadastro de atestado passa a falhar** no
`after insert`. Reconferência:

```sql
-- RLS, FORCE RLS e proprietário das tabelas envolvidas
select c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('system_audit_logs','medical_certificates','documents');

-- dono e SECURITY DEFINER das funções de auditoria/gatilho
select p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('medical_certificates_audit_insert',
                    'medical_certificates_validate_file_reference',
                    'documents_validate_storage_reference');

-- privilégios efetivos do dono da função sobre a tabela de auditoria
select has_table_privilege('postgres', 'public.system_audit_logs', 'INSERT') as pode_insert;
```

**Não desligue RLS para contornar.** Se divergir do esperado, pare e reporte.

---

## 8. Inventário de `documents` (item 2)

Estado real conferido (`pg_policies`):

| Policy | cmd | papéis | expressão |
|---|---|---|---|
| `documents_all` | ALL | `public` | `false` / `false` |
| `legacy_all_disabled` | ALL | `authenticated` | `false` / `false` |
| `tenant_read` | SELECT | `authenticated` | `is_current_company_ref(company_ref)` (substituída) |
| `tenant_write` | ALL | `authenticated` | `is_current_company_ref(company_ref) AND current_company_role() = 'admin'` |

**Defeito corrigido:** a versão anterior abortava com qualquer policy
`SELECT`/`ALL` cujo `qual` não fosse literalmente `false` — inclusive
`tenant_write`, que é a autorização administrativa necessária.

**Regra atual:**

- `tenant_write` é verificada **pela forma**: `PERMISSIVE`, `cmd = ALL`, papéis
  `{authenticated}`, expressão com `is_current_company_ref` **e**
  `current_company_role() = 'admin'`, sem `'super'` e sem `true`. Se mudar,
  aborta com a expressão real impressa.
- Policies **RESTRITIVAS** nunca são tratadas como concessão: restritiva só
  estreita; não soma por OR.
- Policy desconhecida só bloqueia se for **PERMISSIVA** e de leitura
  (`SELECT`/`ALL`) com `qual` diferente de `false`.
- Policy desconhecida de **escrita** não amplia leitura: gera aviso
  (`raise notice`), não bloqueio. As referências de arquivo são validadas por
  gatilho de qualquer forma.

A conferência final aplica exatamente as mesmas regras — não há divergência
entre inventário e verificação.

---

## 9. Atestados: fluxo recuperável e finalização validada (item 3)

### 9.1 Fluxo (3 etapas)

1. **Upload** para `documents/<subdominio>/atestados/<ref>/...` com `upsert: false`.
2. **Confirmação no servidor**: o app lista a própria pasta e compara o tamanho
   gravado com o arquivo escolhido. Sem confirmação, **nada é cadastrado**.
3. **INSERT**: só então o registro é criado. Se o INSERT falhar, não há registro;
   o objeto é removido por best-effort e o usuário tenta de novo.

### 9.2 Recusas do servidor na finalização

- caminho vazio → recusado pelo gatilho **e** pela constraint
  `medical_certificates_requires_file`;
- arquivo inexistente no bucket → recusado;
- caminho de outra empresa (prefixo diferente) → recusado;
- caminho na pasta de **outro colaborador** → recusado;
- caminho já usado por documento/regulamento → recusado;
- `replaces_id` de outra empresa/colaborador, versão já substituída ou arquivo
  reaproveitado → recusado (gatilho de revisão);
- chamada direta ao PostgREST → passa pelos **mesmos** gatilhos.

### 9.3 Concorrência

- `pg_advisory_xact_lock(hashtext('medical_certificates:revision:' || replaces_id))`
  serializa revisões simultâneas do mesmo original;
- índice único parcial em `replaces_id` faz a segunda transação falhar com
  `duplicate key` (é a proteção esperada, não um bug);
- índice único em `storage_path` impede dois registros com o mesmo caminho.

### 9.4 Limite honesto sobre "arquivo novo"

O índice único em `storage_path` **não** impede, sozinho, que o conteúdo do
objeto seja sobrescrito no Storage. Quem impede isso é a policy:
`storage_can_update` nega UPDATE em caminho de atestado e `storage_can_insert`
nega gravar em caminho já registrado como atestado. O app também usa
`upsert: false`. Testes de "alteração do objeto durante a finalização" estão no
§12.3 — e são testes de **comportamento**, não uma prova formal.

### 9.5 Registros existentes sem arquivo

Não são apagados, não são reatribuídos, não são "corrigidos por suposição".
Aparecem em `medical_certificates_without_file` e, na UI, com o selo
**“Sem arquivo”** e o botão **“Anexar arquivo”**, que cria uma nova versão.
Estado atual confirmado: `medical_certificates` **vazia** (0 linhas).

### 9.6 Correção legítima

Correção = **nova versão** (`replaces_id` + `revision`), com indicação da versão
vigente na interface. **Não** existe rotina de desabilitar gatilho.

---

## 10. Subdomínio e helpers

### 10.1 `app.allow_subdomain_change` não é autorização

É um GUC: qualquer sessão define o próprio. O gatilho exige, em conjunto:

1. `public.is_platform_admin()` (derivado de `auth.uid()` + `platform_admins.status='active'`),
   **ou** `current_user in ('postgres','supabase_admin')` — caminho que só existe
   no console SQL (o PostgREST executa como `authenticator` → `anon`/`authenticated`/`service_role`);
2. o marcador `app.allow_subdomain_change = 'true'`.

A função é `SECURITY INVOKER` de propósito: com `DEFINER`, `current_user` viraria
o dono e o teste de proprietário seria sempre verdadeiro. O `$check$` falha se
alguém a tornar `DEFINER` ou se ela ficar executável por `anon`/`authenticated`.

### 10.2 Papel "super"

| Fato verificado | Resultado |
|---|---|
| `profiles_role_check` | `CHECK (role = ANY (ARRAY['admin','collaborator']))` |
| `profiles.role` default | `'collaborator'` |
| Onde 'super' existe no **frontend** | só como rótulo de rota |
| Onde 'super' existe no **banco** | **9 policies legadas** (ver abaixo), sempre como `current_company_role() = ANY (ARRAY['admin','super'])` |

Não existe acesso global a dados de tenant por string de papel: como
`profiles.role` nunca assume `'super'`, esse ramo é **código morto** — não
concede nada a ninguém. O super usuário global (`platform_admins`) só atua em
`caepi-base`/`platform-admin`. Nenhuma regra SQL **do pacote** usa `'super'`.

**Correção de documentação (achado desta rodada, leitura de `pg_policies`):**
a versão anterior do README dizia que `'super'` existia *apenas* no frontend.
Isso está errado. As policies abaixo, já existentes no banco, citam `'super'`:

| Tabela | Policies | Papéis |
|---|---|---|
| `medical_certificates` | `medical_certificates_insert`, `medical_certificates_read` | `authenticated` |
| `medical_certificate_followups` | `_insert`, `_read`, `_update` | **`public`** |
| `apr_records` | `apr_records_collaborator_insert`, `apr_records_collaborator_update` | (legado) |
| `mood_followups` | `mood_followups_update`, `mood_followups_write` | (legado) |

Impacto: nenhum privilégio extra (ramo inalcançável), **mas** as três policies
de `medical_certificate_followups` são `to public` — concedidas também a `anon`.
Na prática `anon` é negado porque `is_current_company_ref()` depende de
`auth.uid()` e devolve `null`. Ainda assim é configuração frouxa.

Essas policies **não** são alteradas por este pacote (fora de escopo declarado).
Ficam registradas para a próxima entrega: recomendar `to authenticated` no lugar
de `to public` e remover o ramo `'super'` morto, revisando cada tabela.

### 10.3 Múltiplos vínculos → acesso fechado (decisão mantida)

`current_company_id()` devolve `null` com mais de um vínculo ativo
(`count(*) = 1`). Com isso role/subdomain/collaborator_ref ficam `null` e todas
as policies negam. Fail-closed deliberado; a seleção de empresa é outra entrega.

### 10.4 Privilégios `EXECUTE` dos helpers — corrigido no arquivo 3 (item 5)

**Achado real** (`pg_proc.proacl`, leitura no ambiente atual):

| Função | ACL observada | Leitura |
|---|---|---|
| `current_collaborator_ref()` | `=X/postgres \| postgres=X \| anon=X \| authenticated=X \| service_role=X` | **PUBLIC** (`=X/...`) **e** `anon` explícito |
| `current_company_subdomain()` | `postgres=X \| anon=X \| authenticated=X \| service_role=X` | `anon` explícito |
| `current_company_id()`, `current_company_role()`, `is_current_company_ref`, `is_company_member`, `is_company_admin`, `is_platform_admin` | sem `anon`, sem PUBLIC | corretos |

**Por que revogar só de `anon` não basta:** o item `=X/postgres` é o grant
implícito a `PUBLIC`. Ele é herdado por **todo** papel — inclusive `anon` e
qualquer papel criado depois. Remover apenas o grant direto de `anon` mantém o
acesso por `PUBLIC` de pé, e o `anon` continua executando.

**Correção aplicada no pacote** (seção 2.1 de
`20261101100300_..._storage_tenant_isolation_up.sql`):

```sql
revoke all on function public.current_collaborator_ref()  from public;
revoke all on function public.current_collaborator_ref()  from anon;
grant  execute on function public.current_collaborator_ref() to authenticated;
-- idem para current_company_subdomain(), current_company_id(),
-- current_company_role(), is_current_company_ref(text),
-- is_company_member(uuid), is_company_admin(uuid)
```

**Chamadas legítimas preservadas:** policies `to authenticated`; funções
`SECURITY DEFINER` com dono `postgres` (o dono sempre executa); `service_role`
(grant explícito, não afetado por `revoke ... from public`). **Nada legítimo é
executado por `anon`.** O `$check$` da migration 3 falha se o direito a
`PUBLIC`/`anon` voltar ou se `authenticated` perder o acesso. A recuperação
(§13) **não reabre** `PUBLIC`/`anon` de propósito — só verifica que
`authenticated` continua com `EXECUTE`.

**Consulta de conferência (após aplicar):**

```sql
select p.oid::regprocedure::text as assinatura,
       coalesce(array_to_string(p.proacl, ' | '), '<NULL: PUBLIC EXECUTE>') as acl,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_company_id','current_company_role','current_collaborator_ref',
                    'current_company_subdomain','is_current_company_ref',
                    'is_company_member','is_company_admin')
order by p.proname;
```

Esperado depois do pacote: `anon_exec = false` em **todas**, `auth_exec = true`
em **todas**, e nenhuma ACL contendo `=X/` (grant a PUBLIC).

---

## 11. Pré-verificações e exportações (antes de aplicar)

Rode e **guarde o resultado em arquivo** (tudo leitura):

```sql
-- (1) Inventário completo de storage.objects (§5)
select schemaname, tablename, policyname, permissive, cmd, roles::text[], qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- (2) Policies das tabelas que serão tocadas
select schemaname, tablename, policyname, permissive, cmd, roles::text[], qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('documents','medical_certificates','internal_regulations',
                    'company_settings','companies','system_audit_logs');

-- (3) Definição integral dos helpers de sessão (revisão do §6.3)
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_company_id','current_company_role','current_collaborator_ref',
                    'current_company_subdomain','is_current_company_ref','is_company_member',
                    'is_company_admin','is_platform_admin','platform_enabled_modules');

-- (4) Configuração dos buckets
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets where id in ('documents','branding','caepi-base');

-- (5) Metadados dos objetos (sem conteúdo)
select bucket_id, name, owner, created_at, updated_at, metadata->>'size' as size_bytes
from storage.objects where bucket_id in ('documents','branding','caepi-base')
order by bucket_id, name;

-- (6) Dados afetados
select id, company_id, company_ref, collaborator_ref, storage_path, created_at
from public.medical_certificates order by created_at;

select id, company_id, company_ref, storage_path, scope, visible_to_collaborator, collaborator_id
from public.documents where storage_path is not null;

select id, company_id, logo_path, letterhead_path from public.company_settings;

select id, company_ref, storage_path from public.internal_regulations;

select id, subdomain, status from public.companies order by subdomain;
```

**Snapshot desta sessão (leitura):** `documents` 52 linhas, **0** com
`storage_path`; `medical_certificates` 0; `internal_regulations` 2, **0** com
`storage_path`; `company_settings` 0 linhas; bucket `branding` 1 objeto;
`caepi-base` 23 objetos. Ou seja: nenhuma referência existente será recusada
pelos novos gatilhos.

### Backup × restauração

| Item | Situação |
|---|---|
| Exportação dos SELECTs acima | disponível — você gera agora |
| Backup automático do projeto | existe por padrão, **não consigo comprovar** |
| PITR | **não verificável por mim** |
| **Restauração testada** | **não verificada** |
| Recuperação lógica (`supabase/recovery/`) | garantida em desenho, **não testada** |

Os arquivos são aditivos. Nenhum apaga linha de dado nem move objeto. A única
escrita em dado existente é `storage.buckets.public = false` (reversível).

---

## 12. Roteiro de testes

**Pré-requisitos:** `A-admin` (empresa A, `role='admin'`), `A-colab` (empresa A,
`collaborator_ref` preenchido), `B-admin` (empresa B), `B-colab` (empresa B) e a
**anon key** para o caso anônimo. Execute pelo `supabase-js` logado como cada
identidade — **nunca** como `postgres`, que ignora RLS. Dados fictícios.
**Nunca cole senhas/tokens no chat.**

Evidência em **todos**: erro retornado (`error.code` do PostgREST/Storage ou
status HTTP), `data` quando houver, horário.

### 12.1 Base (1–28)

| # | Identidade | Operação | Esperado |
|---|---|---|---|
| 1 | A-admin | `upload('empresa-a/doc-teste.txt')` em `documents` | sucesso |
| 2 | A-admin | `createSignedUrl` de objeto com registro em `documents` | sucesso |
| 3 | A-admin | `createSignedUrl('empresa-b/qualquer.txt')` | negado |
| 4 | A-admin | `upload('empresa-b/x.txt')` | negado |
| 5 | A-admin | `update` movendo `empresa-a/…` → `empresa-b/…` | negado (`WITH CHECK`) |
| 6 | A-admin | `remove` de documento comum | sucesso |
| 7 | A-colab | `createSignedUrl` de documento individual **dele** | sucesso |
| 8 | A-colab | `createSignedUrl` de documento individual **de outro**, com `visible_to_collaborator = true` | **negado** |
| 9 | A-colab | `createSignedUrl` de material geral publicado | sucesso |
| 10 | A-colab | `createSignedUrl` de material interno | negado |
| 11 | A-colab | `upload('empresa-a/atestados/<SEU_ref>/a.pdf')` | sucesso |
| 12 | A-colab | `upload('empresa-a/atestados/<OUTRO_ref>/a.pdf')` | negado |
| 13 | A-colab | `createSignedUrl` do atestado de outro colaborador | negado |
| 14 | A-admin | `createSignedUrl` do atestado de um colaborador da empresa | sucesso |
| 15 | A-admin | `update` do objeto de atestado | negado |
| 16 | A-admin | `upload(..., { upsert: true })` no caminho do atestado | negado |
| 17 | A-admin | `remove` do objeto de atestado | negado |
| 18 | A-admin | `update` em `medical_certificates` | negado (`check_violation`) |
| 19 | A-admin | `delete` em `medical_certificates` | negado |
| 20 | A-admin | `insert documents` com `storage_path` de um atestado | negado |
| 21 | A-admin | `insert medical_certificates` com `replaces_id` + arquivo novo | sucesso, `revision=2`, log em `system_audit_logs` |
| 21b | A-admin | repetir 21 para o **mesmo** `replaces_id` | negado (`duplicate key`) |
| 21c | A-admin | `insert` com `replaces_id` de outra empresa/colaborador | negado |
| 21d | A-admin | `insert medical_certificates` **sem** `storage_path` | negado (`requires_file` / gatilho) |
| 22 | A-admin | `update company_settings` da própria empresa | sucesso |
| 23 | A-colab | `update company_settings` da própria empresa | negado |
| 24 | B-admin | `select`/`update` de `company_settings` de A; `insert` com `company_id` de A | negado (3 operações) |
| 25 | A-colab | `update system_settings` / `rpc platform_enabled_modules()` | negado / leitura OK |
| 26 | A-admin | `POST /functions/v1/platform-admin {action:"modules_save"}` | `403 NOT_PLATFORM_ADMIN` |
| 27 | anônimo | `POST /functions/v1/fiscalizacao-publica` com subdomain+ref reais | `503` + `{"ok":false,"error":"public_access_temporarily_disabled"}`, sem dado nem URL assinada |
| 28 | — | usuário `profiles.status <> 'active'` e, separado, empresa `suspended`, repetindo o teste 1 | negado nos dois casos |

### 12.2 Propriedade de referências (P1–P12) — novos

Pré-requisito: existir em B um objeto real `empresa-b/...` e um atestado real de
`B-colab` em `empresa-b/atestados/<ref-B>/...`.

| # | Identidade | Operação | Esperado |
|---|---|---|---|
| P1 | A-admin | `insert documents` com `storage_path = 'empresa-b/arquivo.txt'` | negado — *arquivo não pertence à pasta da empresa* |
| P2 | A-admin | `insert documents` com `company_ref = 'empresa-b'` e caminho de A | negado — *company_ref não corresponde* |
| P3 | A-admin | `insert internal_regulations` com `storage_path` de B | negado |
| P4 | A-admin | `insert medical_certificates` com caminho de B | negado |
| P5 | A-admin | `update documents` trocando `storage_path` para caminho de B | negado |
| P6 | A-admin | `update company_settings` com `logo_path` de B | negado (branding de outra empresa) |
| P7 | A-admin | `createSignedUrl` do objeto de B citado em P1 | negado |
| P8 | A-admin | `createSignedUrl` de objeto **inexistente** no bucket (`empresa-a/nao-existe.pdf`) | negado / URL não utilizável |
| P9 | A-admin | `update` (rename) do objeto de B | negado |
| P10 | A-admin | `remove` do objeto de B | negado |
| P11 | A-admin | `insert documents` **geral** apontando para `empresa-a/atestados/<ref-de-outro>/a.pdf` | negado — *caminho já pertence a um atestado* |
| P12 | A-admin | `insert documents` com `storage_path = 'data:image/png;base64,...'` | negado — *referência não é caminho de Storage* |

> P11 é exatamente o caso "aponta documento geral para atestado de outra
> pessoa". Mesmo que o caminho esteja na empresa certa, a posse é do
> colaborador e o caminho está registrado como atestado.

### 12.3 Concorrência e alteração durante a finalização (C1–C4) — novos

| # | Cenário | Esperado |
|---|---|---|
| C1 | Duas revisões simultâneas do **mesmo** `replaces_id` (duas sessões, `insert` concorrente) | uma sucede; a outra falha com `duplicate key … _uidx`. `revision` não duplica |
| C2 | Upload do arquivo → **antes do INSERT**, outra sessão tenta `update`/`upsert` no mesmo objeto | negado por policy (caminho na pasta de atestado) |
| C3 | Upload do arquivo → **antes do INSERT**, outra sessão tenta `remove` do objeto | negado por policy |
| C4 | Upload → INSERT com `storage_path` de um objeto que **acabou de ser removido** | negado — *arquivo não existe no bucket* |

> C2/C3 comprovam a policy, **não** uma garantia do índice único. O índice não
> protege conteúdo; a policy protege.

### 12.4 Fluxo recuperável e interface

| # | Cenário | Esperado |
|---|---|---|
| E1 | trocar subdomínio pelo app / `platform-admin` | `409 SUBDOMAIN_IMMUTABLE` |
| E2 | `set local app.allow_subdomain_change='true'` + `update companies` | negado (não é `is_platform_admin()`) |
| E3 | anônimo `GET /storage/v1/object/public/branding/<arquivo>` | negado (bucket privado) |
| E4 | A-admin `list('documents')` com prefixo `empresa-b/` | vazio/negado |
| E5 | abrir atestado **sem arquivo** na tela | selo “Sem arquivo” + “Anexar arquivo”; **não** conta como concluído |
| E6 | simular falha de upload e cadastrar | erro na tela, **nenhum registro criado**, nova tentativa possível |
| E7 | usuário com 2 vínculos ativos lê `documents` | vazio/negado |
| E8 | upload concluído mas **confirmação** falha (ex.: `list` bloqueado) | erro na tela, nenhum registro, objeto removido por best-effort |
| E9 | INSERT falha após upload confirmado | erro na tela, nenhum registro, nova tentativa possível |

Chamada real à ficha pública:

```bash
curl -s -o body.txt -w '%{http_code}\n' \
  -X POST "$SUPABASE_URL/functions/v1/fiscalizacao-publica" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"subdomain":"empresa-a","ref":"<ref-ficticio>"}'
cat body.txt   # esperado: {"ok":false,"error":"public_access_temporarily_disabled"}
```

**Nenhum destes testes foi executado.** Este roteiro é reproduzível; não é
evidência.

### 12.5 Registro de execução (estado real desta entrega)

Nada abaixo foi executado. A coluna `observado` está vazia por isso — não por
falta de espaço. `não executado` é o valor honesto: não há ambiente isolado
provisionado (§0.1), e rodar como `postgres` no ambiente atual não é teste.

| teste | identidade | esperado | observado | status | evidência |
|---|---|---|---|---|---|
| 1–6 | A-admin | upload/URL/rename/remove dentro de A; operações em B negadas | — | não executado | — |
| 7–10 | A-colab | individual próprio e geral publicado OK; individual de outro e interno negados | — | não executado | — |
| 11–13 | A-colab | upload na própria pasta OK; pasta de outro e URL de atestado de outro negados | — | não executado | — |
| 14–17 | A-admin | lê atestado da empresa; update/upsert/remove do objeto de atestado negados | — | não executado | — |
| 18–19 | A-admin | UPDATE/DELETE em `medical_certificates` negados | — | não executado | — |
| 20 | A-admin | documento comum com caminho de atestado negado | — | não executado | — |
| 21 / 21b / 21c / 21d | A-admin | revisão válida OK (`revision=2` + log); duplicada, de outra empresa e sem arquivo negadas | — | não executado | — |
| 22–24 | A-admin / A-colab / B-admin | `company_settings` da própria empresa OK para admin, negada para colaborador, negada para B | — | não executado | — |
| 25–26 | A-colab / A-admin | `system_settings` e `platform-admin` negados | — | não executado | — |
| 27 | anônimo | ficha pública `503` sem dado e sem URL assinada | — | não executado | — |
| 28 | usuário inativo / empresa suspensa | operação negada nos dois casos | — | não executado | — |
| P1–P6 | A-admin | referência para arquivo/configuração/atestado de B negada em `documents`, `internal_regulations`, `medical_certificates`, `company_settings` | — | não executado | — |
| P7–P10 | A-admin | URL assinada, rename e remove do objeto de B negados; objeto inexistente não gera URL utilizável | — | não executado | — |
| P11 | A-admin | documento **geral** apontando para atestado de outra pessoa negado | — | não executado | — |
| P12 | A-admin | `storage_path` com `data:` negado | — | não executado | — |
| C1 | duas sessões A-admin | revisões concorrentes: uma sucede, outra falha em `_uidx`; `revision` não duplica | — | não executado | — |
| C2 | A-admin concorrente | `update`/`upsert` no objeto de atestado durante a finalização negado | — | não executado | — |
| C3 | A-admin concorrente | `remove` do objeto de atestado durante a finalização negado | — | não executado | — |
| C4 | A-admin | INSERT com caminho de objeto recém-removido negado | — | não executado | — |
| E1–E2 | app / SQL | troca de subdomínio `409`; `set local app.allow_subdomain_change` sem `is_platform_admin()` negado | — | não executado | — |
| E3 | anônimo | `GET .../object/public/branding/...` negado (bucket privado) | — | não executado | — |
| E4 | A-admin | `list` com prefixo `empresa-b/` vazio/negado | — | não executado | — |
| E5 | A-colab | atestado sem arquivo aparece como “Sem arquivo”, não como concluído | — | não executado | — |
| E6 / E8 / E9 | A-colab | falha de upload / de confirmação / de INSERT: sem registro, erro visível, nova tentativa possível | — | não executado | — |
| E7 | usuário com 2 vínculos | leitura de `documents` negada (fail-closed) | — | não executado | — |
| S1 | A-colab | A-colab **não** consegue ler metadados de objeto de B nem de A002 via `list`/`createSignedUrl` | — | não executado | — |
| S2 | A-colab | confirmação do próprio upload funciona (list da própria pasta) **sem** expor terceiros | — | não executado | — |
| EX1 | `anon` | `has_function_privilege('anon', …)` = `false` nos 7 helpers de sessão | — | não executado | — |
| EX2 | `authenticated` | `has_function_privilege('authenticated', …)` = `true` nos mesmos helpers | — | não executado | — |
| SEED | operador | seed aborta sem marcadores / com fixture prévia / após migrations aplicadas | — | não executado | — |

> `S1`/`S2` cobrem o pedido específico: **verificar a existência do objeto no
> servidor sem conceder ao colaborador leitura de metadados de terceiros**. O
> helper `storage_object_exists` é `SECURITY DEFINER` (executado pelo dono) e a
> policy de `list` só devolve o que `storage_can_read` autoriza — o colaborador
> confirma o **próprio** upload e não vê a pasta de ninguém.

---

## 13. Procedimento de recuperação (preserva dados, mantém acesso fechado)

Ordem: **do último para o primeiro** (4 → 1).

| Passo | Arquivo | Efeito | Tipo |
|---|---|---|---|
| 4 | `subdomain_immutability_recovery.sql` | remove gatilho/função | rollback **exato** |
| 3 | `storage_tenant_isolation_recovery.sql` | remove 9 policies, 4 gatilhos de propriedade e 10 funções; buckets privados **sem policy** | recuperação **fail-closed** |
| 2 | `medical_certificate_versioning_recovery.sql` | remove gatilhos (inclui TRUNCATE), views e constraint; **mantém** colunas/índices | recuperação **sem perda de dados** |
| 1 | `documents_scope_policy_recovery.sql` | remove `tenant_read`; **não** restaura leitura ampla; `tenant_write` permanece | recuperação **fail-closed** |
| 0 | `company_settings` | **não reverter** — é pré-requisito dos helpers de sessão | — |

### Rollback exato × recuperação com acesso fechado

| Item | Existe rollback exato? |
|---|---|
| Subdomínio | **Sim** — o UP só criou gatilho e função |
| Atestados | **Não.** `requires_file` sai; `replaces_id`/`revision` e índices ficam. Bloco destrutivo comentado no arquivo |
| Storage | **Não.** Voltar significaria recriar policies `to public` que permitiam `anon` ler/apagar qualquer objeto. Recusado |
| Documents | **Não.** Voltar significaria liberar todos os documentos da empresa para qualquer membro. Recusado |

### Se o Storage ficar sem policy (estado de falha)

1. **Não** recrie policy pública nem volte `public = true`.
2. Identifique o arquivo que falhou (§4) e reaplique; os `$check$` dizem o motivo.
3. Acesso emergencial: apenas leitura para `authenticated`, com helper de empresa
   (bloco comentado no arquivo de recuperação).
4. Depois de corrigir, rode os testes 1–17 e P1–P12.

Objetos e linhas **não** são tocados em nenhum cenário de recuperação.

---

## 14. Frontend alterado (conteúdo integral no TXT consolidado)

| Arquivo | Mudança | Depende de SQL? |
|---|---|---|
| `src/pages/app/modules/meusdocumentos/medicalCertificateStore.ts` | upload → **confirmação no servidor (existência + tamanho)** → INSERT; sem fallback "registro sem arquivo"; leitura tolerante a schema antigo; `useMedicalCertificates()` devolve só versões vigentes; `useMedicalCertificatesHistory()` | **Não** — cai para o schema atual; versionamento só aparece após a migration 2 |
| `.../components/MedicalCertificateUploadModal.tsx` | modo correção (`replacesId`), aviso de nova versão, erro mantém rascunho e foto | Não |
| `.../meusdocumentos/page.tsx` | selo Vigente/Sem arquivo, botão Corrigir/Anexar arquivo, seções de histórico | Não |
| `.../components/CertificateViewerModal.tsx` | versão, status e aviso de registro sem arquivo | Não |

Nada publicado depende do SQL pendente. Sem a migration, a UI esconde o botão de
correção e o fluxo segue no schema atual.

---

## 15. Pendências (abertas)

1. **Aplicar** as 4 migrations na ordem (script mestre), com exportação prévia (§11).
2. **Executar** os testes do §12 (base, propriedade, concorrência, recuperável)
   com identidades reais e devolver evidências. Nada foi aprovado.
3. Confirmar **backup/PITR** e, idealmente, testar uma restauração.
4. ~~Revogar `EXECUTE` de `anon` nos dois helpers (§10.4)~~ — **incorporado à
   migration 3, seção 2.1** (revoga de `PUBLIC` **e** de `anon`, reconcede a
   `authenticated`). Continua **pendente de conferência** com a consulta do
   §10.4 depois de aplicar.
5. `medical_certificates_requires_file` está `NOT VALID`. Com 0 registros hoje,
   após aplicar: `alter table public.medical_certificates validate constraint medical_certificates_requires_file;`
6. Usuário com **2+ vínculos** sem contexto (fail-closed) — seleção de empresa é
   outra entrega.
7. Correção administrativa auditada em massa (função `security definer` com
   `is_platform_admin()` + `system_audit_logs`) — não implementada.
8. Auditoria de `photo_url` antes de qualquer reativação da ficha pública.
9. Token opaco de QR (aleatório, revogável, rate limit) — só então reativar.

## 16. O pacote está apto para aplicação controlada?

**Resposta curta: apto para revisão e para aplicação controlada com
acompanhamento; NÃO apto a ser declarado validado.** A diferença é só uma:
nenhum teste de comportamento foi executado (§12.5).

| Critério | Estado |
|---|---|
| SQL revisado linha a linha contra o schema real | **sim** |
| Numeração única, ordem explícita, recuperações fora da pasta executável | **sim** |
| Atomicidade em uma transação externa (script mestre) | **sim** |
| Inventário/hash do Storage com reconhecimento explícito (inclusive vazio) | **sim** |
| Propriedade de referência imposta no servidor (4 gatilhos) | **sim** (código) |
| Finalização de atestado validada no servidor | **sim** (código) |
| Fluxo recuperável no app (sem registro em falha) | **sim** (código + build) |
| `PUBLIC`/`anon` fechados nos helpers | **sim** (código) |
| Testes P1–P12, C1–C4, base 1–28, E1–E9, EX1–EX2 executados | **não** |
| Ambiente isolado provisionado | **não** |

### Pré-condições que ainda faltam para aplicação no ambiente atual

1. **Projeto isolado** (§0.1) e execução integral do §12 com evidência.
2. **Exportação prévia** (§11) arquivada: inventário de Storage, policies,
   helpers, buckets, metadados de objetos e dados afetados.
3. **Hash do inventário** capturado **no ambiente isolado** e recapturado no
   ambiente atual imediatamente antes da aplicação (o conjunto pode diferir).
4. **Confirmação de backup/PITR** e, idealmente, uma restauração testada.
5. **Sessão como proprietário** do projeto (necessário para `storage.objects`
   e para `auth.*`).
6. **Janela sem escritas** de atestado: `medical_certificates_requires_file`
   entra como `NOT VALID`; a validação do histórico é decisão posterior.
7. **Reconhecimento** de que Storage e documents **não têm rollback exato**
   (§13): o retorno é acesso fechado, não o estado anterior.

Enquanto 1–7 não estiverem cumpridos, o pacote permanece **entregue e não
aplicado**.

---

**A ficha pública permanece bloqueada.** Nenhum avanço para QR definitivo,
onboarding, Entrega 2 ou novos módulos.