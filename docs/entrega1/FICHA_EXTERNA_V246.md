# Ficha externa de verificação de SST — versão 246

Documento de acompanhamento da reestruturação da ficha externa de fiscalização
(QR-Code do colaborador). Registra **o que foi implementado no código**, **o que
continua pendente** e **o que não foi testado**.

Regra que vale para todo este documento: nada aqui declara conformidade com a
LGPD. Mascaramento e marca-d'água são redução de exposição, não conformidade.

---

## 1. O que foi implementado nesta versão

### 1.1 Layout da ficha externa

Arquivos:

- `src/pages/fiscalizacao/page.tsx` — composição da página (cabeçalho, ficha, estados de erro e de acesso encerrado).
- `src/pages/fiscalizacao/components/FichaSst.tsx` — a ficha propriamente dita.
- `src/pages/fiscalizacao/components/FichaWatermark.tsx` — marca-d'água repetida em diagonal.
- `src/pages/fiscalizacao/types.ts` — modelo de dados permitido na ficha externa.
- `src/mocks/fiscalizacaoModelo.ts` — dados ilustrativos do modelo de layout.

Conteúdo da ficha, na ordem do modelo aprovado:

1. Cabeçalho: título "Ficha de verificação de SST", `ACESSO AUTORIZADO`, horário de expiração da sessão, marcação `DADOS ILUSTRATIVOS` quando aplicável.
2. Empresa: nome, endereço web, alerta `Conferência presencial necessária`.
3. Identidade: foto, nome, função, setor, `Cadastro ativo`, identificação do adesivo, "Situação informada pela empresa • Atualizado em ...".
4. Documentos reduzidos: CPF (`***.***.305-**`), PIS/PASEP (`***`), CTPS (`***`), Admissão (`***`).
5. Resumo: capacitação com pendência, EPI com revisão pendente, EPIs registrados.
6. Cursos e treinamentos: critério/prazo aplicável + etiqueta de situação.
7. Ficha de EPI: EPI, CA, entrega, **controle de troca**, situação.
8. Avisos: prazo de troca ≠ validade do CA; entrega não comprova uso/conservação; resumo não comprova vínculo empregatício nem conformidade integral; dados reduzidos e documentos completos sob solicitação.
9. Rodapé auditável: `Consulta auditada • Sessão <código> • <data/hora>` e `Encerrar acesso`.

Removido da ficha externa: botão de imprimir/baixar PDF, botões "Consultar",
downloads e qualquer controle de geração de QR-Code. Emissão e reimpressão do
adesivo continuam somente em `QR-Codes`, no ambiente administrativo.

### 1.2 Marca-d'água

- Texto repetido em diagonal: `CONSULTA RESTRITA · <código da sessão>`.
- Sobreposição discreta também sobre a foto.
- `aria-hidden` preservado; **não** bloqueia botão direito, seleção ou print. O
  controle real é a autorização de sessão no servidor.

### 1.3 Estados da rota `/fiscalizacao/:id`

| Situação | Comportamento |
| --- | --- |
| Endpoint público desativado | Tela neutra "Consulta não disponível", sem dado pessoal, sem empresa, sem colaborador |
| QR sem empresa identificada | Tela neutra com orientação para reemitir o adesivo |
| Dados autorizados | Ficha renderizada com o que o backend devolve |
| `Encerrar acesso` | Tela "Acesso encerrado" — nova consulta exige nova autorização |

### 1.4 Modelo de layout

`/fiscalizacao/modelo` renderiza a ficha com **dados ilustrativos**
(`src/mocks/fiscalizacaoModelo.ts`). Não consulta banco, não consulta API e não
expõe dado de pessoa real. É o caminho aprovado para validar o layout sem
reativar o endpoint antigo.

---

## 2. Regra do QR-Code (definida, ainda não implementada no servidor)

Separação obrigatória:

- **QR-Code** — identificador persistente do colaborador, impresso no adesivo.
  Não muda por leitura, expiração de sessão, atualização cadastral ou publicação
  do sistema.
- **Sessão de consulta** — autorização temporária e revogável. Expira sem alterar
  o QR impresso.

O identificador deve ser **aleatório e opaco** (não derivado de CPF, matrícula ou
qualquer referência previsível), e o QR identifica a ficha — não concede acesso
irrestrito aos dados.

### 2.1 Situação atual do identificador

O adesivo hoje carrega `colaboradores.id` na rota. Este código **não** é aleatório
e não é revogável de forma independente. Substituí-lo exige plano de transição e
reimpressão — **não deve ser trocado silenciosamente** e não se mantém rota antiga
que contorne a proteção.

### 2.2 Estrutura proposta (não aplicada)

Nenhuma migration foi criada ou executada nesta versão.

- `collaborator_qr_tokens`: `id`, `company_id`, `collaborator_ref`, `token_hash`,
  `status` (`active`/`revoked`), `created_at`, `revoked_at`, `created_by`,
  `revoke_reason`. Índice único parcial garantindo **um único token ativo por
  colaborador** — é isso que impede duas renovações simultâneas de gerarem dois
  códigos vigentes.
- `fiscalizacao_sessions`: `id`, `qr_token_id`, `session_code` (opaco, exibido no
  rodapé), `requester_ref`, `company_id`, `expires_at`, `revoked_at`,
  `created_at`. Um índice por `expires_at` para expiração.
- `qr_renewal_log` (ou `system_audit_logs`): empresa, colaborador, usuário
  responsável, data/hora, motivo, resultado, identificadores internos da versão
  anterior e da nova. **Sem** tokens, hashes completos ou URLs de acesso.

### 2.3 Renovação do QR-Code

- Permissão específica **"Renovar QR-code do colaborador"**, parametrizável nos
  perfis de acesso da empresa.
- Validação **no servidor** em toda solicitação. Esconder o botão não é controle.
- Exige motivo obrigatório e confirmação explícita de que o QR anterior deixará de
  funcionar.
- Substituição atômica (transação com o índice único acima).
- Invalida o QR anterior **e** as sessões externas vinculadas a ele.
- Preserva cadastros, documentos e histórico do colaborador.
- O novo código fica disponível para reimpressão.
- Não permite renovação entre empresas: o `company_id` do token é validado contra
  a sessão do usuário.
- Quem pode renovar **não** recebe automaticamente permissão para administrar
  perfis nem para conceder essa mesma autorização.

---

## 3. Acesso externo (pendente no backend)

Fluxo definido, **não implementado**:

1. Escanear o QR → entrada neutra, sem dado pessoal.
2. Identificação do consultante → criação da sessão no servidor.
3. Ficha exibida somente com sessão válida, com `Acesso autorizado`, horário de
   expiração e `Encerrar acesso`.
4. Expiração, revogação e permissões validadas **no backend**.

A consulta não depende de consentimento do trabalhador nem da presença dele para
desbloquear — o fluxo de atendimento à fiscalização oficial é independente disso e
não confunde visitante comum com fiscal autorizado.

---

## 4. Proteção técnica — estado

| Item | Estado |
| --- | --- |
| Ficha pública desativada (`PUBLIC_FICHA_ENABLED = false`) | **mantido** |
| CPF mascarado no servidor | implementado no endpoint (que segue desligado) |
| PIS/CTPS/e-mail/telefone fora da resposta | implementado no endpoint |
| Autorização de cada consulta no servidor | **pendente** (depende da sessão) |
| Impedir troca de colaborador/empresa por parâmetro | **pendente** (hoje `subdomain` + `ref` vêm do cliente) |
| Foto sem URL pública permanente | **pendente** (hoje `photo_url` é entregue direto) |
| `Cache-Control: no-store` | **pendente** |
| Bloqueio de indexação | **pendente** (`robots`/`X-Robots-Tag` na rota pública) |
| Limite de tentativas e registro de acesso sem token | **pendente** |
| Chave privilegiada no frontend | não ocorre (chave de serviço só na function) |

Nada disso foi aplicado ao banco ou à function nesta versão.

---

## 5. Testes

**Nenhum teste de comportamento foi executado.** O build do frontend passou, e
build não é prova de segurança.

Checklist a executar em ambiente isolado:

- [ ] QR permanece idêntico após leitura, nova sessão e atualização cadastral.
- [ ] Sessão expira sem alterar o QR impresso.
- [ ] Usuário sem permissão não renova — inclusive por chamada direta à API.
- [ ] Renovação autorizada invalida o código antigo e grava o log completo.
- [ ] Duas renovações simultâneas não produzem dois códigos vigentes.
- [ ] Acesso cruzado entre empresas é negado.
- [ ] A resposta da API não contém CPF/PIS/CTPS completos nem documentos pessoais.
- [ ] Logout, expiração e revogação bloqueiam novas consultas.
- [ ] `Cache-Control: no-store` presente na resposta da ficha.

---

## 6. Pendências

**Bloqueantes para liberar a ficha externa**

1. Versionar `collaborator_qr_tokens` e `fiscalizacao_sessions` (migration + RLS).
2. Reescrever `fiscalizacao-publica` para exigir sessão válida e reduzir a resposta.
3. Criar o endpoint de renovação com validação de permissão no servidor.
4. Plano de transição do identificador atual (`colaboradores.id`) para token opaco,
   com reimpressão dos adesivos.
5. Executar os testes do item 5 com evidência.

**Não bloqueantes**

- Padronizar "Controle de troca" no backend: hoje a ficha externa recebe a
  validade do CA, e por isso a coluna aparece como "Não informado" e a situação
  como "Conferir no local".
- Exibir a lista de cursos na ficha real (o endpoint atual não devolve cursos).
- `X-Robots-Tag` e `no-store` na rota pública.
- Rate limit por IP + token na criação de sessão.