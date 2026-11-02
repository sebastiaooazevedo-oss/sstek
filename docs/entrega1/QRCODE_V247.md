# QR-Code de fiscalização — v247

Correção do modal administrativo que ainda exibia o modelo antigo da ficha
(com CPF, PIS, CTPS e admissão completos) no lugar da ficha externa aprovada.

Nada foi alterado no banco. Nenhum migration, policy, grant ou dado foi tocado.

---

## 1. As três camadas, separadas

| Camada | Arquivo | O que faz | O que NÃO faz |
|---|---|---|---|
| **Modal administrativo** | `src/pages/app/modules/qrcodes/components/QrFichaModal.tsx` | Emite e mostra o QR vigente, imprime o adesivo, abre a página externa, oferece a renovação com permissão + motivo + log, e mostra a **prévia** da ficha externa | Não exibe CPF/PIS/CTPS completos. Não é a ficha externa real. |
| **Página externa** | `src/pages/fiscalizacao/page.tsx` + `components/EntradaNeutra.tsx` | Entrada neutra (sem dado pessoal) e, depois de sessão autorizada no servidor, o resumo permitido | Não libera nada no cliente. Não faz "consulta" por botão. |
| **Endpoint** | `supabase/functions/fiscalizacao-publica/index.ts` | Deverá entregar o resumo já reduzido | **Continua bloqueado** (`PUBLIC_FICHA_ENABLED = false`) |

`FiscalizacaoCard.tsx` (o card antigo com dados completos) foi **removido**. Não
existe mais uma ficha administrativa paralela: se a prévia divergir da ficha
externa, é bug.

## 2. Prévia do modal = ficha externa aprovada

`src/pages/app/modules/qrcodes/components/QrFichaModal.tsx` agora renderiza o
**mesmo componente** da página externa (`FichaSst`), em `modo="previa"`.

Conversão em `src/pages/app/modules/qrcodes/fiscalizacaoPreview.ts`:

- CPF → `***.***.305-**` (três dígitos do grupo central, derivados de
  `digits.slice(6, 9)`; `412.887.305-11` → `***.***.305-**`).
- PIS/PASEP, CTPS e admissão → `***`.
- Marca-d'água `CONSULTA RESTRITA · <código>` sobre a ficha e sobre a foto.
- Cursos com prazo/critério + etiqueta de situação.
- EPI com colunas **EPI / CA / Entrega / Controle de troca / Situação**.
- Nenhum botão "Consultar", nenhum download, nenhum controle de geração de QR.

**Critério de EPI mantido:** a coluna "Controle de troca" aparece como
**Não informado** e a situação como **Conferir no local**. Validade de CA não é
validade de equipamento, e entrega registrada não comprova uso ou conservação.
Os contadores usam o mesmo critério das tabelas (`epiRevisao = 0`).

No rodapé da prévia: `Prévia administrativa · Sem sessão externa`, e o lugar do
"Encerrar acesso" mostra `Ação do consultante indisponível na prévia`.

Dados completos continuam no **cadastro interno** (Colaboradores, EPI,
Documentos), respeitando a permissão de cada perfil.

## 3. Controles administrativos preservados

- **Imprimir o QR vigente** — `QrPrintDialog`, com o aviso explícito no retorno:
  "O QR-Code não foi renovado."
- **Abrir a página de fiscalização** — link para o código vigente.
- **Renovar QR-code** — `QrRenewModal`, com a permissão `qrcodes.renew`
  (nova, em `permissionCatalog.ts`), motivo obrigatório (lista + complemento),
  confirmação de que o código anterior deixa de funcionar e registro em log com
  empresa, colaborador, responsável, data/hora, motivo, resultado e os
  identificadores internos anterior/novo — sem URL e sem token.

Reimprimir não renova: o caminho de impressão não escreve no store de
identificadores.

## 4. Aviso corrigido

Texto antigo ("O link público aponta para esta ficha") substituído por:

> O QR identifica esta ficha. A consulta externa exige identificação e autorização.

Complemento ao lado das ações: "Reimprimir não renova o código. A renovação
exige permissão, motivo e registro em log."

## 5. O endereço do QR — diagnóstico

**Antes:** `/fiscalizacao/c-006?empresa=vega` — referência previsível (`c-006`,
sequencial) **e** empresa na URL. Era o formato legado, confirmado: `c-006` é o
`id` do cadastro de demonstração, não um identificador emitido.

**Agora:**

| Situação | URL gerada | Regra |
|---|---|---|
| Código legado (já impresso) | `/fiscalizacao/c-006?empresa=vega` | **Mantido como está.** Nenhum código existente foi renovado. |
| Código novo/renovado | `/fiscalizacao/7KQ4M2XB9RTA5HND` | Identificador opaco de 16 caracteres (~80 bits), sem empresa na URL |

- `src/pages/app/modules/qrcodes/qrIdentifierStore.ts` gera e guarda o código.
- `publicBase.ts` passou a resolver o código vigente dentro de
  `fiscalizacaoUrl()`, então **grade, ficha do colaborador, ficha de EPI,
  adesivos e impressão em lote** já usam o identificador correto sem mudar
  assinatura.
- O modal mostra o status do código: `Opaco v2` ou `Legado`, com a explicação
  "Código antigo, previsível. Continua valendo — a migração não é automática."

**Plano de transição (não executado):** reimprimir por lote conforme o adesivo
se desgasta, ou renovar os legados de forma autorizada — sempre com motivo e
log. Nenhuma rota antiga é mantida como atalho para contornar a proteção; a
referência legada é o próprio identificador, não um bypass.

## 6. Página externa — entrada neutra

`EntradaNeutra` mostra, antes de qualquer autorização: marca, aviso de área
restrita e o formulário de identificação do consultante (nome, órgão,
identificação funcional, finalidade). **Nenhum dado pessoal, nem da empresa.**

Ao solicitar acesso, a tela declara o estado real:

> Autorização indisponível no momento — `AUTH_SERVICE_PENDING`
> A ficha não é liberada por decisão do navegador.

E oferece `/fiscalizacao/modelo` para ver o **layout** com dados ilustrativos,
marcado como demonstração. O endpoint antigo **não** foi reativado.

---

## O que foi realmente executado

| Verificação | Executado | Resultado |
|---|---|---|
| Compilação do projeto (`build`) | **sim** | passou |
| Conferência de imports/exports e rotas | **sim** (leitura) | ok |
| Cálculo de máscara de CPF (`412.887.305-11` → `***.***.305-**`) | **sim** (lógica revisada) | ok |
| Geração do identificador opaco no navegador | **não** | exige execução real |
| Teste da página externa em janela anônima | **não** | exige navegador |
| Chamada HTTP ao endpoint público | **não** | endpoint bloqueado |
| Capturas de tela do modal e da página externa | **não** | não tenho captura de tela nesta sessão |

Rotas para conferência manual: `/app/qrcodes` → "Ver ficha";
`/fiscalizacao/modelo`; `/fiscalizacao/<qualquer-codigo>` (entrada neutra).

O build passar **não** é prova de segurança. Nenhum teste de isolamento,
autorização ou revogação foi executado.

---

## Pendências

**Bloqueantes**

- B1 — Serviço de sessão externa (token opaco, expiração e revogação validadas
  no servidor) inexistente. Sem ele, a ficha real não abre.
- B2 — `fiscalizacao-publica` continua com `PUBLIC_FICHA_ENABLED = false`.
- B3 — Persistência do identificador opaco é **local ao navegador**. Rotação
  atômica, unicidade e revogação precisam ir para o banco.
- B4 — Mascaramento precisa ser feito no servidor. Hoje só a prévia mascara no
  cliente; a ficha real depende do que o endpoint devolver.
- B5 — Log de renovação é local. A trilha auditável definitiva precisa de tabela
  com RLS.
- B6 — Nenhum teste de comportamento executado (janela anônima, chamada direta
  sem permissão, duas renovações simultâneas).

**Não bloqueantes**

- N1 — Legados previsíveis ainda em campo até a reimpressão.
- N2 — Sem `Cache-Control: no-store` no endpoint (depende de B1/B2).
- N3 — `qrcodes.renew` é nova no catálogo: perfis da empresa precisam recebê-la
  explicitamente (o perfil administrador integral já cobre).
- N4 — `fiscalizacaoPublicApi.ts` permanece sem uso até o novo contrato existir.

## O que NÃO pode ser afirmado

Conformidade com LGPD pelo mascaramento e pela marca-d'água. A marca-d'água não
impede print, e o mascaramento na prévia não prova que a API entrega apenas o
permitido — isso só se comprova no backend.