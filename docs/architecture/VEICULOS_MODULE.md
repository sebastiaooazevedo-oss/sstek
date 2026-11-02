# Módulo Veículos — Etapa 1 (cadastro, documentos e permissões)

Documento de apoio do módulo `veiculos`. O `project_plan.md` continua sendo a referência
geral do produto; este arquivo registra decisões, contratos e pendências do módulo de frota.

## 1. Escopo entregue nesta etapa

- Cadastro de veículos com ID interno estável (`ref`) separado da placa.
- Documentação veicular **versionada** (`vehicle_documents`), com versão anterior preservada.
- Exigências documentais por **categoria + finalidade de uso** (`vehicle_document_requirements`).
- Registro de aviso de vencimento (`vehicle_document_alerts`) — registro interno, sem envio de e-mail.
- Telas: lista da frota, formulário de cadastro, ficha do veículo (documentos, versões,
  pendências, avisos e inativação) e configuração de exigências.
- Permissões do módulo na matriz de perfis da empresa e na matriz da plataforma.

## 2. Modelo de dados

| Tabela | Papel |
|---|---|
| `vehicles` | Cadastro. `ref` é o identificador usado por todos os relacionamentos; `plate_normalized` é a chave de duplicidade por empresa. |
| `vehicle_documents` | Documentos versionados. `is_current` marca a versão vigente; `replaces_ref` / `superseded_by_ref` / `replacement_reason` preservam a cadeia de substituição. |
| `vehicle_document_requirements` | Exigência por `category` (`*` = todas) e `purpose` (`*` = qualquer). `active=false` desativa sem apagar. |
| `vehicle_document_alerts` | Histórico de avisos de vencimento (canal, destinatário, quem registrou). |

Regras aplicadas no banco:

- `UNIQUE (company_ref, plate_normalized)` — impede placa duplicada dentro da empresa.
- Triggers `touch_updated_at` em `vehicles`, `vehicle_documents` e `vehicle_document_requirements`.
- **RLS ligada nas quatro tabelas** com apenas uma policy de `SELECT` (`is_current_company_ref`).
  Não existe policy de escrita: o navegador não grava nada, nem auditando.

## 3. Escrita e auditoria — Edge Function `veiculos`

Toda gravação passa por `supabase/functions/veiculos`. O endpoint usa dois clientes:
um cliente ANON com o JWT do usuário (apenas identifica o usuário e resolve
`tenant_effective_access`) e um cliente SERVICE ROLE para banco e auditoria.

Ações: `salvar_veiculo`, `salvar_documento`, `salvar_exigencia`, `remover_exigencia`,
`registrar_aviso`, `inativar_veiculo`.

Validações no servidor:

- Placa normalizada, formato `ABC1234` / `ABC1D23`, duplicidade por empresa.
- Propriedade/situação em lista fechada; proprietário obrigatório quando locado/terceiro.
- Ano, hodômetro e tanque numéricos e coerentes.
- Datas reais (inclui calendário) e vencimento nunca anterior à emissão.
- Substituição de documento: só a versão vigente pode ser substituída; a anterior recebe
  `is_current=false` e `superseded_by_ref`.
- Inativação exige motivo (mínimo 10 caracteres) e **não exclui** nada.

Permissões verificadas no servidor: `vehicles.create`, `vehicles.edit`,
`vehicles.documents`. Toda ação grava em `system_audit_logs` (empresa, veículo,
antes/depois, autor, motivo).

## 4. Permissões

Matriz da empresa (`src/pages/app/permissions/permissionCatalog.ts`):

- `tenant.vehicles` — abre o módulo (menu + rota).
- `vehicles.create` — cadastrar veículo.
- `vehicles.edit` — editar cadastro, situação, hodômetro e inativar.
- `vehicles.documents` — anexar/substituir documentos, registrar aviso e configurar exigências.

Matriz da plataforma (`platformDefaults.ts`) recebeu as mesmas chaves; o mapa gravado em
`platform_settings.role_permissions` foi atualizado de forma **aditiva** (`admin = true`,
`colaborador = false`), sem reset de nenhuma configuração existente.

## 5. Dependências das próximas etapas

| Etapa | Depende de |
|---|---|
| 2 — Inspeções e EPCs | `vehicles.ref`, checklist versionado por categoria, `epi_deliveries` existente |
| 3 — Responsabilidade, termos e dupla conferência | `vehicles.ref`, cadastro de colaboradores, assinatura eletrônica existente |
| 4 — Manutenção | `vehicles.odometer`, documentos e situação do veículo |
| 5 — Abastecimento (opcional por empresa), utilizações e relatórios | `vehicles.odometer`/`tank_capacity`, configuração por empresa e novas permissões de valores |

## 6. Pendências honestas desta etapa

- **Envio real de aviso de vencimento por e-mail**: hoje o aviso é registrado internamente.
  O envio depende do Resend configurado no projeto — não é chamado de "alerta automático".
- **Fotos do veículo**: upload no bucket privado `documents` (`<subdominio>/veiculos/...`)
  com link assinado de 1 hora.
- **Exclusão**: não existe. Veículo com histórico só pode ser inativado.
- **Permissões de valores/relatórios, inspeções, entrega/devolução e abastecimento** só
  entram junto com as etapas correspondentes — não foram declaradas como prontas.
- **Conformidade legal**: as exigências são parametrização da empresa e não constituem
  garantia automática de conformidade.

## 7. Frota de demonstração, arquivos fictícios e limpeza

Para apresentar o módulo sem depender de cadastro manual, as cinco empresas de
demonstração receberam um conjunto **idêntico** de três veículos fictícios: `VGA1A23`
(tudo em dia), `VGA2B34` (seguro vencendo) e `VGA3C45` (CRLV vencido, seguro e inspeção
ausentes). Os `ref` seguem o padrão `<subdominio>-vh-<placa>`.

Sobre o `VGA1A23` também foi publicado o checklist versionado
**“Inspeção diária — frota leve”** (`template_ref = vtpl-demo-diaria`, v1, 8 itens,
1 item crítico que bloqueia) e registrada **uma inspeção** com snapshot completo,
resultado `reprovado`, 1 achado de iluminação em aberto e sem bloqueio.

Arquivos de CRLV e apólice **não** são gravados por SQL: eles são gerados no navegador
(`demoDocumentFiles.ts`, via `pdf-lib`) e enviados pelo caminho real de upload, para que o
link assinado do bucket privado seja exercitado de verdade. O gatilho é o painel
**Demonstração**, no cabeçalho do módulo (visível para quem tem `vehicles.edit`).

### Comando de limpeza

Ação `limpar_frota_demo` na Edge Function `veiculos`:

- exige papel **admin** (sessão) **e** `vehicles.edit`;
- seleciona apenas veículos com placa fictícia **e** `ref` com o prefixo da própria empresa;
- remove, nesta ordem: achados de inspeção, inspeções, bloqueios, vínculos de EPC,
  check-ins, avisos de vencimento, documentos e, por fim, os veículos;
- apaga do bucket `documents` os arquivos dos documentos removidos;
- registra em `system_audit_logs` quantos veículos foram removidos e por quem.

O checklist publicado e as exigências documentais **permanecem** após a limpeza — são
configuração, não frota. Nenhuma ação de exclusão de veículo real foi aberta.

## 8. Fotos obrigatórias e condutor responsável

### 4 fotos obrigatórias do cadastro

O cadastro do veículo passou a exigir as **quatro laterais**: `frente`,
`lateral esquerda`, `lateral direita` e `traseira`. A lateral é gravada no próprio
caminho do arquivo (`<subdominio>/veiculos/<lateral>-<timestamp>-<arquivo>`), então
a foto continua ligada à lateral correta depois de recarregar a tela. Fotos antigas,
sem o código da lateral, aparecem como “extras” e não contam para a obrigatoriedade.

A regra é validada nos dois lados: no formulário (`missingPhotoSlots`) e na Edge
Function (`salvar_veiculo`, erro `fotos_obrigatorias`). O teto do servidor continua
em 6 fotos por veículo (4 laterais + até 2 extras).

### Condutor responsável derivado do checklist

O condutor responsável **não é digitado** e é definido no servidor em
`registrar_checkin`:

- **Retirada** (`kind = entrega`): o colaborador que executa o checklist assume o
  veículo — `responsible_name` recebe o autor da sessão (`actorName`). CPF e cargo são
  completados a partir de `company_collaborators` quando o e-mail do usuário bate com
  um colaborador ativo; nada disso vem do cliente.
- **Devolução** (`kind = devolucao`): o registro aponta quem estava com o veículo
  (`responsible_name` da retirada em aberto) e, ao encerrar a retirada, o veículo fica
  **sem condutor responsável**.

Na interface, o condutor responsável atual é sempre derivado da retirada em aberto
(`openDeliveryFor`): aparece na lista da frota, na ficha do veículo e na aba
**Checklist de retirada**. O termo “custódia” foi substituído por **checklist** na
interface; os nomes internos (`vehicle_checkins`, `kind`, `status`) foram mantidos.

### Fotos da frota de demonstração

Os três veículos fictícios são cadastrados por SQL e, por isso, nascem **sem fotos** —
o que é incompatível com a regra das 4 laterais. Para resolver isso sem inventar
caminho de arquivo, o painel **Demonstração** ganhou a ação *“Anexar laterais
faltantes”*:

- `demoVehiclePhotos.ts` desenha as quatro vistas no navegador (canvas → JPEG), uma por
  lateral, com placa, modelo, data/hora e a tarja “FOTO FICTÍCIA”;
- cada arquivo é enviado por `uploadVehicleFile(file, slotKey)`, ou seja, o código da
  lateral entra no caminho (`<subdominio>/veiculos/<lateral>-<timestamp>-...`);
- o cadastro é salvo pela ação real `salvar_veiculo`, com as fotos novas na frente para o
  limite de 6 não cortar nenhuma lateral. A validação de `fotos_obrigatorias` roda igual.

A ação é **idempotente**: lateral que já tem foto não é reenviada. Fotos antigas sem
código de lateral continuam aparecendo como extras.

### Câmera no checklist de retirada/devolução

O botão “Tirar foto” do `CheckinModal` deixou de usar o atributo `capture` do input de
arquivo (que só abre câmera em navegador móvel) e passou a abrir o
`CameraCaptureModal` (`getUserMedia`), o mesmo componente usado nas inspeções. Quando a
permissão é negada ou não há câmera, a opção “Enviar do dispositivo” continua disponível
e o fluxo não quebra. A foto continua obrigatória no check-in (validada no cliente e no
servidor, erro `evidencia_obrigatoria`).