# SSTEK — Sistema de Gestão de Segurança do Trabalho (SaaS)

## 1. Descrição do Projeto
O **SSTEK** é uma plataforma SaaS multi-tenant (por subdomínio) para gestão de Segurança do Trabalho (SST).
Cada empresa cliente acessa o sistema por um subdomínio próprio (ex.: `empresa.sstek.com`).
A plataforma centraliza documentos obrigatórios (ASO, PGR, PCMSO, PPP, Ficha de EPI, Ordens de Serviço,
certificados de treinamento), controle de vencimentos, QR-Code de fiscalização do colaborador, pesquisas de
clima, avaliações psicossociais (conforme legislação) e dashboards estratégicos.

- **Público-alvo:** empresas de todos os portes que precisam organizar SST (indústria, construção, logística, serviços).
- **Proposta de valor:** centralizar toda a documentação legal de SST, reduzir risco de multas por vencimento,
  dar rastreabilidade em fiscalização via QR-Code e gerar indicadores psicossociais e de clima.

## 2. Estrutura de Páginas
- `/` — Site institucional do produto (landing + login de entrada)
- `/login` — Autenticação do sistema (acesso por perfil/subdomínio)
- `/app` — Shell do sistema (área logada, com navegação por perfil)
  - `/app/dashboard` — Dashboards de acompanhamento
  - `/app/colaboradores` — Cadastro e gestão de colaboradores (perfil Administrador)
  - `/app/meusdados` — Meus dados do colaborador (perfil + criação da assinatura pessoal)
  - `/app/alertas` — Central de alertas do colaborador (documentos aguardando assinatura + avisos)
  - `/app/colaboradores/:id` — Ficha do colaborador + QR-Code
  - `/app/documentos` — Documentos (empresa e colaborador), filtros, impressão em lote e geração da Ficha de Presença
  - `/app/documentos/impressao-em-lote` — **Conferência da Impressão em Lote** (um dossiê por colaborador, com prévia, download e impressão)
  - `/app/regulamento` — Regulamento Interno (leitura página a página + assinatura de ciência; painel do administrador com versões e adesão)
  - `/app/dds` — DDS (Diálogo Diário de Segurança): registro com fotos, facilitador, participantes vinculados à base de colaboradores e tópicos abordados
  - `/app/epi` — Ficha de EPI (registro de entrega com CA, itens, motivo, foto opcional do EPI e aceite por assinatura; impressão do QR-Code do colaborador pela ficha)
  - `/app/qrcodes` — QR-Codes de fiscalização (grade, impressão individual/em lote e logs por colaborador)
  - `/app/qrlogs` — QR-Codes & logs de escaneamento (Super Administrador)
  - `/app/apr` — APR — Análise Preliminar de Risco (perigos, medidas de controle e aceite por assinatura dos executantes)
  - `/app/cipa` — CIPA (Comissão Interna de Prevenção de Acidentes e Assédio): múltiplas comissões por estabelecimento (matriz/filiais), composição e mandato, agenda de reuniões/eventos, atas, plano de ações, processos eleitorais e inspeções com registro fotográfico
  - `/app/pesquisas` — Pesquisas internas (cadastro estilo formulário com ID automático, período, público por função, anonimato garantido e histórico de pesquisas)
  - `/app/empresas` — Gestão de empresas/tenants (Super Administrador)
  - `/app/parametrizacao` — Parametrização de recursos por perfil (Super Administrador)
  - `/app/licencas` — Licenças, cobrança recorrente e controle de inadimplência (Super Administrador)
  - `/fiscalizacao/:id` — Página pública de fiscalização aberta pelo QR-Code (resumo, cursos e EPIs)
  - `/portal` — Área do colaborador (editar dados, trocar senha, baixar documentos, alertas)

## 3. Funcionalidades Principais
- [x] Site institucional + login do sistema
- [x] Shell do sistema com navegação por perfil e dashboards de acompanhamento
- [ ] Autenticação e perfis de acesso (Super Administrador, Administrador, Colaborador)
- [ ] Parametrização de recursos por perfil (ativar/desativar)
- [ ] Gestão multi-tenant por subdomínio com branding da empresa (logo)
- [ ] Cadastro de empresas (Super Administrador)
- [x] Importação de colaboradores por planilha (.xlsx) — simulada nesta fase
- [x] Cadastro completo de colaboradores (dados cadastrais + foto)
- [x] Documentos da empresa (PCMSO, LTCAT, PGR, AET/AE, Mapa de Risco, Acordos/Convenções, APR)
- [x] Documentos do colaborador (ASO, Ficha de EPI, PPP, EPC, Ordem de Serviço, Certificados, Atestados, Outros)
- [x] Filtros e impressão em lote de documentos
- [x] QR-Code por colaborador (resumo, cursos ativos/vencidos, ficha de EPI) + log de escaneamento
- [x] Ficha de Presença (título, facilitador + documento, data, local, participantes) com coleta de assinatura (canvas) do facilitador e de cada participante, e exportação em PDF
- [x] DDS — Diálogo Diário de Segurança (registro com fotos, tema, facilitador, setor, local, duração, participantes vinculados à base de colaboradores, tópicos e observações) nos perfis Administrador e Super Administrador, com vínculo a treinamento, relatório mensal de participações (PDF) e exportação individual em PDF
- [x] Ficha de EPI com CA, itens entregues, motivo, foto opcional do equipamento e aceite por assinatura (canvas), com exportação em PDF e impressão do QR-Code de fiscalização do colaborador direto pela ficha
- [x] **Painel de chancelas emitidas (superadministrador):** aba "Chancelas emitidas" com filtros por empresa, tipo (EPI, DDS, APR, CIPA, Assinaturas/Documentos), período e busca livre; detalhes da chancela, atalho para a validação pública, comprovante em PDF e exportação da lista filtrada em CSV (`;`, UTF-8 com BOM) para auditorias e fiscalizações. A página pública `/validar/:token` também oferece o download do comprovante sem exigir login, tanto para chancela quanto para documento assinado.
- [x] **Chancela de autenticidade (QR-Code no rodapé)** em todo documento assinado eletronicamente: documentos do módulo Assinaturas, Ficha de EPI, lista de presença do DDS, APR e atas da CIPA passam a exibir no rodapé do PDF (e na prévia em tela) um bloco de chancela com QR-Code, código de verificação, quantidade de signatários e hash SHA-256 do conteúdo — o QR aponta para a validação pública real em `/validar/:token`, onde o servidor confirma o registro (modelo semelhante ao Autentique)
- [x] **Chancela nos relatórios mensais impressos pelo gestor** (EPI, DDS, APR e consolidado da CIPA por unidade): o PDF consolidado sai com o mesmo bloco de chancela, registrando quem emitiu (gestor da sessão + responsável técnico), o período/unidade/tema filtrados e o hash SHA-256 dos dados efetivamente impressos — trocar o filtro, incluir ou remover linha muda o hash e invalida a conferência do papel anterior. Escopo reaproveitado (`epi`/`dds`/`apr`/`cipa`) para que o painel Chancelas emitidas continue filtrando por tipo.
- [x] **Endereço completo de validação fixado no rodapé impresso:** todo PDF chancelado (EPI, DDS, APR, CIPA) traz, logo acima da linha de rodapé, um quadro com a URL completa de conferência em texto legível (fonte monoespaçada, quebra de linha permitida), além do QR-Code — para quem recebe o papel e não tem celular à mão.
- [x] **Coluna "Emissor" no painel Chancelas emitidas:** identifica o gestor que imprimiu cada relatório (derivado do signatário com papel de gestor/emissor gravado na chancela), exibido na lista, nos detalhes, no comprovante de validação (público e administrativo) e na exportação CSV. O painel também permite **filtrar por "Emitido por"**: o servidor devolve os nomes distintos de emissores do recorte atual (empresa, tipo e período) e o filtro é aplicado sobre esse mesmo recorte, com resumo indicando o emissor ativo e atalho para limpar.
- [x] **Chancela no relatório consolidado de inspeções de campo e no arquivo de pleito encerrado da CIPA:** o PDF consolidado de Inspeções de Campo (exportação e lote com capa por unidade) e o arquivo/dossiê de cada pleito encerrado (individual e em lote) passam a sair com bloco de chancela, hash SHA-256 do conteúdo impresso e endereço completo de validação. O arquivo do pleito reaproveita o escopo `cipa` e o hash cobre urnas, eleitos, ausentes e o hash de encerramento do processo.
- [x] **Conferência do hash impresso na página pública:** em `/validar/:token` o portador do papel pode colar o hash SHA-256 impresso (completo ou abreviado com reticências) e a página compara com o registro do servidor — exibindo aviso destacado quando **não confere**, além do hash completo registrado para comparação manual.
- [x] **Chancela no Dossiê do processo eleitoral (aba Processos):** o botão **Dossiê (PDF)** passou a registrar a chancela antes de imprimir, igual ao arquivo de pleito encerrado — botão em "Chancelando…" com trava durante o registro, hash SHA-256 cobrindo as peças selecionadas, a ata vinculada, os anexos externos e os candidatos, e endereço completo de validação no rodapé. Escopo `cipa`, então continua visível no filtro "CIPA" do painel Chancelas emitidas.
- [x] **Histórico de exportações com autor e chancela:** o painel **Exportações desta sessão** (ícone de histórico na barra superior) passou a guardar, em cada entrada, **quem baixou** (autor da sessão) e o **código de verificação da chancela** quando o arquivo saiu chancelado. Cada download de arquivo/dossiê de pleito também grava um evento no log de auditoria do sistema (novo tipo "Downloads e exportações", ação "Download"), com nome do autor, pleito(s), código da chancela e indicação quando o selo não pôde ser registrado.
- [x] Alertas de EPI a vencer (validade por CA) no dashboard do Administrador
- [x] APR — Análise Preliminar de Risco (perigos, severidade/probabilidade, medidas de controle e aceite por assinatura dos executantes, com exportação em PDF)
- [x] Card de resumo de APR no dashboard do Administrador (APRs do mês, riscos críticos e aceites pendentes)
- [x] Assinatura de aceite de APR pelo portal do Colaborador (lista de APRs pendentes no "Meu painel") com geração do registro em Documentos ao concluir
- [x] Painel do Colaborador com filtro de APRs (pendentes e histórico de aceites) e assinatura do aceite de EPI pelo portal
- [x] Relatório mensal de APR (riscos críticos por setor e aceites pendentes) com exportação em PDF
- [x] Geração automática do registro da Ficha de EPI assinada na lista de Documentos (vinculada ao tipo "Ficha de EPI")
- [x] Card de resumo de EPI no dashboard do Administrador (entregas do mês, itens, aceites pendentes e assinados)
- [x] Relatório mensal de EPI (entregas e aceites por colaborador) com exportação em PDF
- [x] Filtro de período (Semana/Mês/Período) nos relatórios de DDS, APR e EPI, na lista de Documentos e no log de escaneamento dos QR-Codes
- [x] Atalhos de intervalo rápido "Últimos 7 dias" e "Últimos 30 dias" no filtro de período
- [x] Atalhos de intervalo rápido "Mês atual" e "Mês passado" no filtro de período
- [x] KPIs do topo (DDS, APR, EPI, Documentos e QR-Codes) respeitando o período selecionado (filtro de período também aplicado ao próprio EPI)
- [x] Exportação em PDF e em planilha (CSV) da lista de Documentos e do log de escaneamento dos QR-Codes, já filtrados pelo período
- [x] Exportação em PDF e em planilha (CSV) das listas de DDS, APR e EPI, já filtradas pelo período
- [x] Seletor de período global no dashboard do Administrador, filtrando todos os cards/painéis de uma vez
- [x] Rodapé padronizado nos PDFs exportados, com campo de assinatura do responsável e numeração de páginas
- [x] Rodapé de assinatura do responsável técnico também no comprovante público de fiscalização do QR-Code
- [x] Botão "Exportar resumo" no dashboard do Administrador (PDF dos cards do período filtrado)
- [x] Bloco de assinatura do responsável técnico também nos documentos em tela (Ficha de Presença e Termo de EPI)
- [x] Histórico de "exportações geradas" na sessão, com reenvio rápido dos últimos PDFs emitidos
- [x] Cabeçalho de identificação (empresa + período + responsável) na impressão do comprovante público
- [x] Consulta de CA na Ficha de EPI (digitar o número do Certificado de Aprovação e ver ficha completa do equipamento: fabricante, norma, validade do CA, tamanhos, descrição e restrições)
- [x] Consulta rápida de CA no topo da lista de EPI (ferramenta independente de uma entrega) e emissão do **Laudo de equipamento** em PDF a partir do CA consultado
- [x] Validação de CA ativo no cadastro de EPI (bloqueio de CA inativo), com a regra **parametrizável** na tela de Configurações do sistema
- [x] Identidade visual parametrizável: upload da **logo da empresa** (tela de login e sistema logado) e do **papel timbrado** aplicado a todas as exportações de relatórios em PDF
- [x] Dados cadastrais da empresa (razão social, CNPJ e responsável técnico) configuráveis e aplicados no cabeçalho/assinatura de todos os relatórios e no comprovante público de fiscalização
- [x] Assinatura pessoal do colaborador ("Criar assinatura" em Meus dados): 4 modelos de escrita cursiva, nome completo ou parcial (primeiro + último), reutilizada em todos os documentos assinados (EPI, APR, DDS e Ficha de Presença de treinamentos), com notificação de pendências no topo do app
- [x] Ficha de Presença com participante vinculado à base de colaboradores usando a assinatura do perfil
- [x] Ficha do colaborador (Admin) exibindo o status da assinatura pessoal com prévia para conferência
- [x] Central de Alertas do colaborador com a lista de documentos aguardando assinatura e acesso direto ao documento
- [x] Notificação de **documento direcionado ao colaborador** (sino do topo + Central de Alertas) com registro de **ciência ao visualizar** e remoção automática do alerta
- [x] **Regulamento Interno** (`/app/regulamento`): leitura obrigatória página a página (a assinatura só é liberada após folhear todas), assinatura de ciência registrada no Supabase, painel do administrador com **quem já leu/assinou e quem falta**, **publicação de nova versão em PDF** exclusiva para perfis parametrizados e **histórico de versões substituídas (não vigentes)** que exige nova assinatura de todos
- [x] Lista de presença do DDS exportável em PDF já com as assinaturas dos participantes (tomadas da assinatura pessoal do perfil), com prévia das assinaturas no detalhe do DDS
- [x] Painel no dashboard do Administrador listando quais colaboradores já criaram a assinatura pessoal (com prévia e filtro)
- [x] Exportação do painel de assinaturas (Admin) em PDF e planilha CSV, respeitando o filtro (todos / criadas / pendentes)
- [x] Lembrete automático no topo (sininho + banner no dashboard) avisando o Administrador de quantos colaboradores estão sem assinatura pessoal
- [x] Módulo real de assinatura eletrônica (base legal): representação visual desenhada ou tipográfica, termo de adesão versionado com evidências, hash SHA-256 de conteúdo e de assinatura, trilha de auditoria e bloqueios validados no servidor (edge function)
- [x] Estrutura de conta individual + vínculo com a empresa (conferência de identidade por nome + CPF + matrícula) e verificação de contato por e-mail — pronta para ligar quando a autenticação real entrar
- [x] Isolamento multi-tenant do núcleo de assinatura (empresas, base de colaboradores e perfis): RLS somente leitura para o cliente; a escrita ocorre apenas pelo backend
- [x] Fluxo de documentos assináveis com estados (Rascunho, Aguardando assinaturas, Parcialmente assinado, Concluído, Cancelado) e vínculo de substituição entre versões
- [x] Envio com congelamento de conteúdo/versão/signatários/posições e hash SHA-256 do conteúdo e do PDF-base calculado no servidor
- [x] Autenticação adicional por código de uso único (prazo, limite de tentativas e vínculo a usuário/empresa/documento/versão, sem reutilização)
- [x] Assinatura transacional no backend (unicidade por empresa/documento/versão/signatário + idempotência) com fechamento automático do documento
- [x] Conferência (visualizar/baixar), declaração específica por finalidade e “Informar divergência” sem registrar concordância
- [x] Cancelamento e substituição versionada preservando o documento anterior e suas evidências
- [x] Módulo Assinaturas (Administrador e Colaborador) com pendências na Central de Alertas e no sino do topo
- [x] Registro do "sentimento do dia" no primeiro acesso (5 níveis com emojis, motivo opcional), com resumo no painel do colaborador, painel por período para o gestor e alerta de sentimento negativo
- [x] Gráfico de evolução (linha) do sentimento médio por dia no painel do gestor, com visão consolidada da equipe e drill-down individual (nota do período ou do dia específico)
- [x] Comparativo no gráfico de evolução (sobrepor 2 ou 3 colaboradores), marcador de dias com alerta negativo e resumo de tendência por área/setor, com o gráfico incluído na exportação em PDF
- [x] Minha ficha de EPI no perfil do colaborador (EPIs em uso com validade do CA + histórico de entregas/aceites), com assinatura dos aceites pendentes e exportação em PDF/CSV
- [x] Hierarquia de liderança parametrizável: vínculo do gestor por nome (cadastro) e por função/área, com definição de quais perfis podem alocar líderes e visibilidade dos resultados de quem está abaixo
- [x] Painel "Minha equipe" para o líder (liderados por nome e por área, com atalho para a ficha de cada um) e alertas de EPI a vencer da equipe
- [x] Resumo de EPIs em uso no painel do colaborador (com atalho para Minha ficha de EPI) e fichas de EPI armazenadas no perfil do colaborador, com exclusão parametrizável por perfil
- [x] Humor do dia (humor + alerta) de cada liderado exibido direto na lista de "Minha equipe", com atalho para o painel de sentimento, e exportação do painel do líder (liderados + humor + EPIs a vencer da equipe) em PDF e CSV
- [x] Filtro "somente quem tem alerta hoje" no topo do "Minha equipe", contagem de EPIs a vencer/vencidos no card de cada liderado e gráfico de evolução do sentimento da equipe anexado ao PDF do líder
- [x] Capa com resumo executivo do dia (alertas de sentimento, EPIs a vencer/vencidos e registros de humor) na abertura do PDF do líder
- [x] Inspeção de Campo (documento com campos da legislação: identificação, checklist de itens por NR, não conformidades, risco e ações, colaboradores vistoriados com busca por nome/CPF/matrícula e registro fotográfico) com exportação em PDF
- [x] Módulo CIPA (Comissão Interna de Prevenção de Acidentes e Assédio): múltiplas comissões (matriz e filiais) com composição, cargos e mandato, agenda de reuniões/eventos, atas com deliberações e fotos, plano de ações, eleições com candidatos/apuração e inspeções com registro fotográfico, com exportações em PDF/CSV
- [x] CIPA: aprovação da ata com a assinatura pessoal do perfil do presidente e do secretário (com ID do ato e data/hora), refletida na lista de atas e no PDF, e avisos de reunião próxima / ação atrasada no sino do topo e nos dashboards
- [x] CIPA: geração automática do registro da ata aprovada (presidente + secretário) na lista de Documentos (tipo "Ata da CIPA") e situação "Aprovada / Aguardando aprovação" na lista de atas, com filtro e contadores por situação
- [x] CIPA: registro da ata em Documentos com situação de aprovação (filtro por situação em Documentos), PDF da ata aprovada gerado e anexado automaticamente ao registro (visualização/download) e aviso no sino para atas aguardando aprovação
- [x] CIPA: impressão em lote dos PDFs das atas aprovadas selecionadas em Documentos e bloco "Aprovações da CIPA" no dashboard do Administrador (aprovadas x pendentes por comissão)
- [x] CIPA: filtro por comissão no bloco "Aprovações da CIPA" (focar numa filial) e download do PDF da ata aprovada direto do card da lista de atas, sem passar por Documentos
- [x] CIPA: Ficha de Inscrição de Candidato dentro de cada processo eleitoral (prazo de candidatura, requisitos de elegibilidade NR-5 e foto 3x4 com regra de fundo branco), com mural de aviso público de inscrições abertas visível a todos e fotos dos candidatos na lista
- [x] CIPA: aviso no sino do topo quando há candidatura com inscrições abertas ou perto de encerrar e geração automática do Edital de Convocação em PDF (prazo, requisitos e regras de foto) anexado ao registro em Documentos
- [x] CIPA: campo de texto do aviso/edital editável no formulário da eleição (personaliza as palavras do Edital de Convocação) e geração do Edital de Resultado/Publicação pós-apuração (com a lista de eleitos) anexado ao registro em Documentos
- [x] CIPA: campo de vagas (titulares/suplentes) no formulário da eleição, com o Edital de Resultado classificando automaticamente eleitos entre titulares e suplentes, e carimbo de "PUBLICADO" com a data no topo do edital anexado em Documentos
- [x] CIPA: sugestão automática do nº de vagas pela NR-5 (Quadro I) conforme empregados e grau de risco da comissão, aviso no sino quando o Edital de Resultado é publicado (destacando os eleitos) e Dossiê do Processo Eleitoral (convocação + ata + resultado + posse) em um único PDF em lote
- [x] CIPA: anexos externos (ex.: edital assinado em papel) no Dossiê do Processo Eleitoral — os arquivos constam do índice de anexos do dossiê e também viram documentos próprios vinculados à eleição — e Ficha de Cadastro da CIPA em PDF (com o selo NR-5) gerada pelo botão "Gerar PDF" no cadastro da comissão
- [x] CIPA: pré-visualização visual (miniatura de imagem com ampliação em popup) dos anexos externos no modal do Dossiê do Processo Eleitoral, além do nome do arquivo
- [x] CIPA: anexar arquivos externos ao Dossiê arrastando-e-soltando na área de anexos e pré-visualização das imagens dos anexos do processo eleitoral também na tela de Documentos (miniatura + ampliação)
- [x] CIPA: Termo de Posse como documento próprio em Documentos quando a eleição é Publicada, dossiê (com a ata da comissão) disponível na impressão em lote da tela de Documentos e sugestão da NR-5 também no cadastro da comissão, alertando quando a composição está fora do dimensionamento
- [x] CIPA: reordenação dos anexos externos no modal do Dossiê (setas subir/descer definem a ordem no índice) e miniaturas dos anexos de imagem exibidas também no card da eleição (aba Eleições), com ampliação em popup
- [x] Estabelecimento no cadastro de colaboradores (unidades da empresa) com migração da base existente, tela de Colaboradores conectada ao cadastro real (Supabase) e **segregação da base eleitoral da CIPA por estabelecimento**
- [x] Cadastro real de colaboradores aplicado em todo o núcleo operacional: EPI, DDS, Assinaturas, **APR** (executantes) e **Ficha de Presença/Documentos** (participantes e vínculos), sem cadastro de demonstração nessas telas
- [x] Dados operacionais de **EPI (entregas)** e **DDS (registros)** persistidos no Supabase (tabelas `epi_deliveries` e `dds_records`) com stores compartilhados, e fotos do DDS gravadas como data URL
- [x] Dados operacionais de **APR (análises, riscos e aceites)** e das **Fichas de Presença** persistidos no Supabase (tabelas `apr_records` e `attendance_sheets`), com stores compartilhados e PDF anexado às fichas
- [x] **Lista de Documentos persistida** no Supabase (tabela `documents`) com store compartilhado: documentos da empresa/colaborador, atas, editais e dossiê da CIPA, anexos externos, fichas de presença e inspeções de campo — todos sobrevivem a recarregar a página
- [x] **Inspeções da CIPA** e **Inspeção de Campo (Documentos)** persistidas no Supabase (tabelas `cipa_inspections` e `field_inspections`), com o PDF da inspeção anexado ao registro em Documentos
- [x] **Unidade/Estabelecimento na APR** (campo selecionável sugerido pelo cadastro real) com **filtro por unidade** na tela de APR e no relatório mensal
- [x] **CIPA — núcleo persistido**: comissões, agenda de reuniões, atas e plano de ações salvos no Supabase (tabelas `cipa_committees`, `cipa_meetings`, `cipa_minutes` e `cipa_actions`) com store compartilhado, mantendo a mesma API dos consumidores (página, visão geral, alertas, topbar e Documentos)
- [x] **Unidade/Estabelecimento no EPI e no DDS** (automática: no EPI pela unidade do colaborador e no DDS pela unidade dos participantes) com **filtro por unidade** nas telas e nos relatórios mensais
- [x] **Uploads de Documentos no Storage**: os arquivos enviados passam a ser guardados de fato no bucket privado `documents` (com link assinado para visualizar/baixar), em vez de apenas os metadados — inclusive no **"Novo documento"**
- [x] **Unidade nas inspeções (CIPA e Inspeção de Campo)** com **filtro por unidade**, e **lista/relatório próprio das Inspeções de Campo** (filtro por unidade, KPIs, exportação PDF/CSV e remoção) como porta de entrada para gerar o documento
- [x] **Unidade no cabeçalho dos PDFs em lote** (Documentos e Atas) para rastreabilidade por estabelecimento: capa de **resumo por unidade** no lote de Documentos e **unidade da comissão** no cabeçalho da ata
- [x] CIPA: processo eleitoral persistido no Supabase (Fase 1) e **base eleitoral** com versionamento/fechamento (Fase 2) — importação do cadastro de colaboradores, elegibilidade apto/inapto com justificativa, hash de integridade (SHA-256), bloqueio de edição no banco após o fechamento e **controle de participação separado do voto** (sem qualquer vínculo eleitor×voto)
- [x] **Pesquisas internas** (`/app/pesquisas`, antigo menu "Avaliações"; `/app/avaliacoes` redireciona para o novo endereço): cadastro estilo formulário com **ID automático** (PESQ-AAAA-0000), data/hora de início e fim, público **todos** ou **por função**, escolha entre **anônima** (respostas gravadas sem qualquer vínculo com o colaborador) ou **identificada** (com controle de resposta única), perguntas com até **5 opções**, botão **Publicar Pesquisa** e **Cancelar**, e histórico preservado no painel do administrador com **busca** e filtros por **situação (vigente/agendada/encerrada)** e **tipo (anônima/identificada)**; o colaborador responde as pesquisas direcionadas ao seu perfil e o sino/menu mostram as pendências (com aviso de nova pesquisa publicada). Inclui **exportação em PDF e CSV** dos resultados de cada pesquisa (por pergunta, por função e pendentes) e **painel de adesão** nas pesquisas identificadas, com percentual e lista de quem ainda falta responder.
- [x] **Pesquisas — produtividade da gestão**: botão **Duplicar** em cada pesquisa (reaproveita perguntas, público e anonimato em um novo formulário, com novo ID automático e período a revisar), **lembrete automático no sino** para quem ainda não respondeu (antecedência configurável de 1 a 15 dias antes do encerramento, com selo de prazo no cartão do colaborador) e **comparação entre pesquisas** com evolução do índice geral e das notas por pergunta de escala (médias agrupadas por enunciado, variação em pontos e exportação em CSV).
- [ ] Pesquisa de clima diário (obrigatória no 1º acesso do dia)
- [ ] Avaliação psicossocial anônima (40 perguntas, conforme legislação)
- [ ] Dashboards dinâmicos e estratégicos das avaliações
- [x] Alertas de vencimento de documentos (painel por situação, renovação de validade e aviso no sino)
- [x] **Aviso de vencimento de documentos por e-mail**: janela de antecedência parametrizável (padrão 60 dias),
  envio para o **e-mail do SESMT** e para **outros e-mails cadastrados**, com disparo ao abrir a área de
  Documentos e botão "Avisar por e-mail / Enviar verificação agora" (sem duplicar avisos por validade)
- [x] **Aviso de vencimento ampliado**: cópia para o **gestor/líder responsável** (apenas documentos da própria equipe),
  **PDF anexo agrupado por unidade** e **resumo semanal** ao SESMT (vencimentos da semana + o que venceu), cada um
  habilitável na parametrização
- [x] **Aviso no sino para o líder — CAT de liderado sem recibo de entrega**: o topo resolve os liderados pela hierarquia de “Minha equipe” (por nome e por área/setor, casando o cadastro por id, e-mail ou CPF) e exibe o aviso **“X CAT(s) de liderados sem recibo de entrega”**, com os nomes pendentes, marcado como aguardando ação (só desaparece quando o recibo é anexado) e com atalho para o painel “CATs em aberto na sua equipe” em Minha equipe.
- [x] **Solicitações de renovação — número automático, abertura antecipada e consulta profissional**: cada tratativa recebe número público **RS-AAAA-0001**; botão **Nova Solicitação** permite antecipar a renovação de documentos que ainda não venceram (excluindo os que já têm solicitação aberta e os já vencidos, que entram automaticamente); a fila ganhou busca por **número, CPF, colaborador e tipo de documento** e filtro de **vencimento por período** (7/30/60/90 dias ou intervalo De/Até), com indicadores clicáveis e faixa lateral de urgência em cada linha.
- [ ] Portal do colaborador (editar dados, senha, download, visualização)
- [ ] Licenças S1/S2/S3, cobrança recorrente, usuário extra e bloqueio por inadimplência
- [ ] Subdomínios: controle de contratos, pagamentos e bloqueio por dias de atraso

## 4. Modelo de Dados (previsto — ainda NÃO criado)
Base de dados será conectada em fase posterior. Entidades previstas:

### companies (tenants)
id, name, subdomain, logo_url, plan (S1/S2/S3), status, due_day, grace_days, created_at

### profiles / users
id, company_id, role (super_admin/admin/collaborator), name, email, password, avatar_url, active, created_at

### collaborators
id, company_id, name, cpf, rg, pis, ctps, role_function, admission_date, birth_date, phone, email, photo_url

### documents
id, company_id, collaborator_id (opcional), type, name, file_url, issued_at, expires_at, scope (empresa/colaborador)

### document_types
id, company_id (opcional), name, scope (empresa/colaborador), required

### epi_records (Ficha de EPI)
id, collaborator_id, epi_name, ca, quantity, delivered_at, expires_at, photo_required, photo_url, signature_url, accepted_at

### apr_records
id, company_id, title, activity, area, location, responsible, status, created_at

### apr_risks
id, apr_id, hazard, risk, severity, probability, control

### apr_signatures / apr_participants
id, apr_id, collaborator_id, signature_url, accepted_at

### cipas (Comissão Interna de Prevenção de Acidentes e Assédio)
id, company_id, name, unit, city, cnpj, risk_grade, employees_count, mandate_number, mandate_start, mandate_end, status

### cipa_members
id, cipa_id, name, role_function, area, registration, representation (empregador/empregado), member_role (presidente/vice/secretário/titular/suplente), since

### cipa_meetings
id, cipa_id, title, type (ordinária/extraordinária/evento), date, time, location, agenda[], notes, status

### cipa_atas
id, cipa_id, meeting_id, number, date, title, content, decisions[], participants[], photos[]

### cipa_actions
id, cipa_id, title, description, origin, responsible, due_date, priority, status

### cipa_elections / cipa_election_candidates
id, cipa_id, title, year, process_number, registration_start, registration_end, vote_date, status, eligible_voters, notice
candidate: id, election_id, name, role_function, area, votes, registration, contact, photo_url, declared_at

### cipa_inspections
id, cipa_id, title, date, area, location, responsible, checklist[], non_conformities, risk, action, action_owner, action_due, photos[], notes

### qr_scan_logs
id, collaborator_id, scanned_at, device, user_agent, ip, location

### surveys
id, company_id, title, type (climate/psychosocial/custom), anonymous, target (all/function/profile), status

### survey_questions
id, survey_id, order, text, dimension

### survey_answers
id, survey_id, collaborator_id (nullable se anônimo), question_id, score, created_at

### subscriptions / invoices
id, company_id, plan, amount, extra_users, period_start, period_end, status, paid_at

### collaborator_signatures (assinatura pessoal do colaborador — CRIADA)
collaborator_id (PK), font_model (great-vibes/allura/dancing-script/sacramento), name_style (full/partial), updated_at

## 5. Backend / Integrações
- **Banco de dados / Auth / Storage:** **SaaS Supabase conectado**. Já em uso a tabela `system_settings`
  (parametrizações, identidade visual e dados da empresa, com leitura pública para a tela de login) e o bucket de Storage
  público `branding` (arquivos de logo e papel timbrado). Também em uso a tabela `collaborator_signatures`
  (ponteiro da assinatura ativa do colaborador, por `collaborator_id`). Também em uso a tabela `daily_moods`
  (registro diário do sentimento por usuário, com unicidade por usuário e dia).
- **Núcleo de assinatura eletrônica (Fase 4.22):** tabelas `companies`, `company_collaborators`, `profiles`,
  `signature_terms`, `signature_term_acceptances`, `signature_representations`, `signature_audit_log` e
  `document_signatures`, todas com RLS habilitado e **somente leitura** para o cliente (a escrita ocorre apenas no
  backend). Toda a lógica/validação vive na **edge function `signature-engine`** (deployada, `verify_jwt: false`
  enquanto o login é demonstração), que usa o service role para gravar. Quando a autenticação real for conectada, a
  função passa a resolver a conta por `auth.uid()` (JWT) e a aplicar as regras de papel — sem mudar a interface.
  Parte das telas ainda opera com dados fictícios (mocks) até a migração completa para o banco.
- **Chancela de autenticidade (selo com QR-Code):** tabela `document_seals` (empresa, escopo, referência do documento, hash SHA-256 do conteúdo, signatários, token público aleatório e data/hora), com RLS habilitado e **somente leitura** para o cliente. As ações `seal_document` (cria ou reaproveita o selo pelo hash — idempotente) e `validate_seal` (pública) foram adicionadas à edge function `signature-engine`. A página `/validar/:token` primeiro tenta validar um documento assinável e, se não encontrar, valida a chancela — exibindo empresa, documento, hash, data e quem assinou. O hash é calculado no navegador sobre o conteúdo canônico do documento e conferido no servidor. A consulta administrativa (`seals_overview`) aceita filtro por empresa, período e escopo, devolvendo empresa, tipo, referência, código, emissor, signatários e hash; o painel é somente leitura e o comprovante (PDF via impressão) pode ser gerado tanto pelo superadministrador quanto por qualquer pessoa na página pública, sem sessão autenticada. Relatórios consolidados (mensais de EPI, DDS, APR, consolidado da CIPA, relatório consolidado de inspeções de campo, dossiê do processo eleitoral na aba Processos e arquivo de pleito encerrado da CIPA) usam o mesmo `seal_document` via `reportSealHtml`, com legenda própria ("Relatório emitido eletronicamente") e o gestor emissor registrado como signatário — de onde o painel e o comprovante extraem o campo Emissor. A página pública também permite colar o hash impresso e avisa quando ele não confere com o registro.
- **Cobrança recorrente:** prevista (Stripe ou Toss/PayPal/Square) — decidir em fase de licenças.
- **Envio de e-mail (alertas de vencimento de documentos):** implementado via **Resend** na edge function
  `notify-document-expiry` (secrets `RESEND_API_KEY` e `RESEND_FROM_DOMAIN` no Supabase Dashboard). A função aceita
  vários **grupos de destinatários** (SESMT + um grupo por gestor), gera o **PDF por unidade** com `pdf-lib` e tem o
  modo `weekly` para o resumo semanal. A parametrização fica por empresa em `document_expiry_alert_settings`
  (janela em dias, e-mail do SESMT, e-mails adicionais, aviso ao gestor, PDF anexo, resumo semanal e dia da semana)
  e o controle de avisos já enviados em `document_expiry_notifications` (único por documento + validade +
  destinatário). Sem os secrets configurados a função responde `resend-not-configured` e o sistema avisa na tela,
  mantendo o alerta visível no app.
- **QR-Code:** gerado no front-end; leitura via câmera/URL pública.

## 6. Plano de Desenvolvimento (por fases)

### Fase 1: Vitrine + Login (CONCLUÍDA)
- Objetivo: apresentar o produto e permitir o acesso ao sistema.
- Entregável: landing page institucional completa (hero, recursos, perfis, QR-Code, avaliações,
  planos, depoimentos, FAQ, CTA, footer) + tela de login + shell placeholder da área logada.

### Fase 2: Shell do sistema + Dashboards (CONCLUÍDA)
- Objetivo: área logada com navegação por perfil e dashboards de acompanhamento.
- Entregável: layout da aplicação (sidebar/topbar responsivos), menu lateral que muda conforme o perfil
  (Super Administrador / Administrador / Colaborador), dashboards de acompanhamento por perfil com KPIs,
  tabelas, gráficos, alertas e placeholders dos módulos futuros.

### Fase 3: Colaboradores e Documentos (Administrador) (CONCLUÍDA)
- Objetivo: cadastro de colaboradores, upload/importação e gestão de documentos.
- Entregável: módulo de Colaboradores (lista com filtros por nome/função/CPF, formulário de cadastro
  completo com foto, ficha do colaborador, importação .xlsx simulada), módulo de Documentos
  (empresa e colaborador, abas, filtros por tipo/validade, seleção e impressão em lote, área de upload
  com seleção de vínculo) e o modal "Novo documento" (nome, tipo e destinatário Empresa/Colaborador).

### Fase 4: Ficha de EPI, APR e QR-Code — EM ANDAMENTO
- Objetivo: fluxo legal de EPI com assinatura, APR e QR-Code de fiscalização.
- Entregável parcial (CONCLUÍDO):
  - **QR-Code de fiscalização do colaborador**: componente de QR real (qrcode.react) que aponta para a
    página pública `/fiscalizacao/:id`, exibindo resumo do cadastro, cursos ativos/vencidos e a ficha de EPI
    com validade de cada item.
  - **Módulo `/app/qrcodes`** (Administrador): grade de QR-Codes por colaborador, filtros por nome/função/área,
    seleção, impressão individual e em lote, ficha ampliada em modal e histórico de escaneamentos por colaborador.
  - **Módulo `/app/qrlogs`** (Super Administrador): log global de escaneamentos com data/hora, aparelho,
    navegador, IP, localização, origem e resultado, além do ranking de QR-Codes mais lidos.
  - **Página pública `/fiscalizacao/:id`**: visão de fiscalização (o que o fiscal vê ao escanear o QR-Code),
    com registro do escaneamento.
- Entregável restante: (Ficha de EPI e APR concluídas nas fases 4.3/4.4).

### Fase 4.1: DDS e Ficha de Presença (CONCLUÍDA)
- Objetivo: registrar o Diálogo Diário de Segurança e as listas de presença.
- Entregável: módulo `/app/dds` (Administrador e Super Administrador) com KPIs, filtros por tema/situação/período,
  grade de cards com foto de capa, formulário "Novo DDS" com upload de múltiplas fotos, tópicos abordados e
  observações, além do modal de detalhe com galeria; e a **Ficha de Presença** disponível no módulo de
  Documentos (título, facilitador, data, local e participantes com função), gerando o registro na lista.
  Logos oficiais SSTEK (versão colorida e versão branca) aplicadas em todo o sistema.

### Fase 4.2: Assinaturas, PDF e Relatório de DDS (CONCLUÍDA)
- Objetivo: completar o fluxo documental de presença e a análise de participações do DDS.
- Entregável:
  - **Ficha de Presença**: coleta de assinatura em canvas (facilitador + cada participante), campo de
    documento/CPF, e botão **Exportar PDF** que gera a ficha formatada (lista de presença com assinaturas).
  - **DDS**: campo "Treinamento vinculado" no cadastro e no detalhe, e **Relatório mensal de participações**
    (KPI por mês, participações por treinamento e detalhamento dos diálogos) com exportação em PDF.
  - **Dashboard do Administrador**: card de resumo de DDS (DDS do mês, participações, agendados, tema mais
    recorrente e últimos diálogos registrados) com atalho para o módulo.
  - Utilitário de exportação (`src/pages/app/utils/exportPdf.ts`) reutilizado por toda a impressão/PDF do sistema.

### Fase 4.3: EPI com aceite, PDF individual do DDS e participantes nominais (CONCLUÍDA)
- Objetivo: reaproveitar a coleta de assinatura no aceite de EPI, permitir exportar um DDS individual e vincular
  os participantes do DDS a colaboradores reais da base.
- Entregável:
  - **Ficha de EPI** (`/app/epi`, Administrador): página com KPIs (entregas, itens, aceites assinados/pendentes),
    filtros por colaborador/itens/motivo/aceite e lista de entregas; formulário "Nova entrega de EPI" com
    seleção de colaborador da base, motivo, montagem de itens (EPI + CA + quantidade) e **aceite por assinatura**
    (canvas reutilizado), além de **Exportar PDF** do Termo de entrega e aceite; modal de detalhe com itens,
    observações e assinatura.
  - **DDS individual**: botão **Exportar PDF** no detalhe do diálogo (cabeçalho SSTEK, dados, tópicos e lista de
    participantes).
  - **Participantes nominais do DDS**: no cadastro, os participantes passam a ser selecionados da base de
    colaboradores (busca por nome/função/setor, chips e contagem automática) em vez de digitar apenas o número;
    o detalhe exibe a lista de participantes com função.

### Fase 4.4: Alertas de EPI, foto na entrega e APR com aceite (CONCLUÍDA)
- Objetivo: alertar sobre a validade do CA dos EPIs, enriquecer a entrega com foto e implantar a APR com aceite.
- Entregável:
  - **Alertas de EPI a vencer**: card "EPI a vencer · validade por CA" no dashboard do Administrador, listando
    colaborador, equipamento, CA, validade e a situação (vencido há N dias / vencendo em N dias).
  - **Foto opcional na entrega de EPI**: upload de imagem (data URL) no formulário, exibida na ficha de EPI e no
    PDF do termo de aceite.
  - **Imprimir QR-Code pela ficha de EPI**: botão no detalhe que gera o QR-Code de fiscalização do colaborador
    (a partir do canvas) e o envia para impressão no documento padronizado.
  - **Módulo APR** (`/app/apr`, Administrador): KPIs (APRs, riscos mapeados, aceites e pendências), filtros por
    texto/setor/aceite e lista; formulário "Nova APR" com construtor de riscos (perigo, risco, severidade,
    probabilidade, medidas de controle e nível calculado), seleção de executantes da base e **aceite por assinatura
    individual de cada executante** (canvas); modal de detalhe com matriz de riscos, assinaturas e **Exportar PDF**.

### Fase 4.5: APR integrada (dashboard, portal do colaborador e documentos) (CONCLUÍDA)
- Objetivo: integrar a APR ao restante do fluxo, levando o resumo para o Administrador, a assinatura para o
  Colaborador e o registro final para a lista de Documentos da empresa.
- Entregável:
  - **Store compartilhado de APR** (`src/pages/app/modules/apr/aprStore.ts`): centraliza os registros da APR na
    sessão e conclui automaticamente a análise quando todos os executantes assinam.
  - **Store compartilhado de Documentos** (`src/pages/app/modules/documentos/documentsStore.ts`): fonte única da
    lista de documentos; gera o registro da APR (tipo "APR") ao concluir e reflete na tela de Documentos.
  - **Card de resumo de APR** no dashboard do Administrador (APRs do mês, riscos críticos, aceites pendentes e
    APRs concluídas, com últimos registros e atalho para o módulo) — no mesmo estilo do card de DDS.
  - **Portal do Colaborador**: seção "APRs pendentes de assinatura" no "Meu painel", com lista das análises
    vinculadas ao colaborador e modal para assinar o aceite (canvas) direto do portal.
  - **Geração automática em Documentos**: ao concluir uma APR, o registro dela é adicionado à lista de Documentos
    da empresa, vinculado ao tipo "APR".

### Fase 4.6: Portal do colaborador (EPI + APR) e relatório mensal de APR (CONCLUÍDA)
- Objetivo: levar o aceite de EPI para o portal do Colaborador (como feito com a APR), detalhar as APRs com
  filtro de pendentes/histórico e consolidar um relatório mensal de APR.
- Entregável:
  - **Store compartilhado de EPI** (`src/pages/app/modules/epi/epiStore.ts`): centraliza as entregas de EPI na
    sessão para que a página do módulo (Administrador) e o portal do Colaborador compartilhem os mesmos dados;
    a assinatura do colaborador é registrada por `signEpiDelivery`, marcando a entrega como "Assinada".
  - **Aceite de EPI no portal do Colaborador**: seção "Aceites de EPI pendentes" no "Meu painel", listando as
    fichas de EPI do colaborador sem assinatura, com modal (canvas) para assinar o recebimento direto do portal.
  - **APRs com filtro**: card de APR no painel do Colaborador com abas "Pendentes" e "Histórico de aceites",
    mostrando tanto as análises a assinar quanto as já assinadas por ele.
  - **Relatório mensal de APR** (`/app/apr`): botão "Relatório mensal" que abre o consolidado por mês (APRs do mês,
    riscos críticos, aceites pendentes e concluídas), com **riscos críticos por setor** e **aceites pendentes de
    assinatura**, e exportação em **PDF**.

### Fase 4.7: EPI integrado (documento automático, card no dashboard e relatório mensal) (CONCLUÍDA)
- Objetivo: completar a integração do EPI ao restante do sistema, como feito com a APR.
- Entregável:
  - **Geração automática em Documentos**: ao registrar ou assinar uma Ficha de EPI (status "Assinada"), o
    registro dela é adicionado à lista de Documentos, vinculado ao tipo "Ficha de EPI" e ao colaborador.
    O gerador (`buildEpiDocument`) fica no store compartilhado de Documentos e é disparado por `addEpiDelivery`
    e `signEpiDelivery` (inclui o aceite feito pelo portal do Colaborador).
  - **Card de resumo de EPI** no dashboard do Administrador (entregas do mês, itens entregues, aceites pendentes
    e assinados, com as últimas entregas e atalho para o módulo), no mesmo estilo dos cards de DDS e APR —
    lido do store compartilhado de EPI, portanto atualiza em tempo real.
  - **Relatório mensal de EPI** (`/app/epi`): botão "Relatório mensal" que abre o consolidado por mês (entregas,
    itens, aceites assinados e pendentes), com **entregas e aceites por colaborador** e o detalhamento das
    entregas, e exportação em **PDF**.

### Fase 4.8: Filtro de período em DDS e APR (CONCLUÍDA)
- Objetivo: dar navegação temporal consolidada nos módulos DDS e APR.
- Entregável:
  - **Componente reutilizável de período** (`src/pages/app/components/PeriodFilter.tsx`): hook `usePeriodFilter`
    + barra `PeriodFilterBar` com os modos **Tudo / Semana / Mês / Período**. O modo *Semana* considera a semana
    atual (seg a dom) e o modo *Mês* traz um seletor com os meses presentes nos dados; o modo *Período* permite
    escolher as datas **De / Até**.
  - **DDS**: os antigos chips fixos de período foram substituídos pelo novo filtro (antes as datas eram
    chumbadas no código), integrado ao restante dos filtros de busca/tema/situação.
  - **APR**: passou a contar com o mesmo filtro de período (que antes não existia), ao lado dos filtros de
    texto/setor/aceite, refletindo também na contagem de resultados exibida.

### Fase 4.9: Filtro de período em relatórios, Documentos e QR-Codes (CONCLUÍDA)
- Objetivo: unificar a navegação temporal em todo o sistema, reaproveitando o componente de período.
- Entregável:
  - **Atalhos rápidos** no `PeriodFilter` (`src/pages/app/components/PeriodFilter.tsx`): os botões
    **Últimos 7 dias** e **Últimos 30 dias** no modo *Período* preenchem o intervalo De/Até automaticamente
    em relação à data de hoje. O parser de data (`parseBrDate`) passou a aceitar valores com hora anexada
    (ex.: "29/09/2026 09:14:22") e foi adicionado o utilitário `periodLabel` para rotular o período atual nos
    títulos dos PDFs.
  - **Relatórios de DDS, APR e EPI**: os antigos chips fixos por mês foram substituídos pela barra
    `PeriodFilterBar` (Tudo / Semana / Mês / Período), com o rótulo do período refletido no consolidado e no
    PDF exportado.
  - **Lista de Documentos** (`/app/documentos`): o filtro de período passa a considerar a data de emissão
    (`issuedAt`) dos documentos, integrado aos filtros de aba, busca, tipo e validade.
  - **Log de escaneamento dos QR-Codes** (`/app/qrlogs`): o filtro de período passa a considerar o carimbo de
    data/hora do escaneamento (`scannedAt`), integrado aos filtros de busca, origem e resultado.

### Fase 4.10: Período aplicado aos KPIs e exportação das listas (CONCLUÍDA)
- Objetivo: fazer toda a navegação temporal refletir também nos indicadores do topo e permitir exportar as
  listas já filtradas por período.
- Entregável:
  - **KPIs por período**: os cards de topo de **DDS, APR, EPI, Documentos e QR-Codes** passam a ser calculados
    sobre o subconjunto filtrado pelo período (não mais sobre o total). O módulo **EPI** ganhou o filtro de
    período (Tudo / Semana / Mês / Período), alinhando-o aos demais.
  - **Atalhos de mês** no `PeriodFilter`: além de "Últimos 7 dias" e "Últimos 30 dias", o modo *Período* agora
    oferece **Mês atual** e **Mês passado**, com o intervalo De/Até preenchido automaticamente.
  - **Exportação de listas**: novo utilitário de planilha (`src/pages/app/utils/exportTable.ts`) e o menu
    `ExportMenu` (`src/pages/app/components/ExportMenu.tsx`) permitem **Exportar em PDF** e **Exportar planilha
    (CSV)** da **lista de Documentos** e do **log de escaneamento dos QR-Codes**, sempre respeitando o período
    (e demais filtros) selecionados.

### Fase 4.11: Exportação nas listas, período global no dashboard e rodapé de PDF (CONCLUÍDA)
- Objetivo: levar a exportação para todas as listas, criar um filtro de período único no dashboard do
  Administrador e profissionalizar o rodapé dos documentos exportados.
- Entregável:
  - **Exportação nas listas de DDS, APR e EPI**: as três listas ganharam o menu **Exportar** (PDF e planilha
    CSV), reaproveitando `ExportMenu`, `exportPdf` e `exportTable`, sempre respeitando o período e os demais
    filtros da tela.
  - **Seletor de período global no dashboard do Administrador**: uma barra `PeriodFilterBar` no topo que filtra
    de uma só vez os cards de topo, os cards de DDS, APR e EPI (derivados dos stores compartilhados) e os
    indicadores de Documentos (derivados do store de documentos), além das listas resumidas.
  - **Rodapé padronizado nos PDFs**: `pdfFooter` passou a renderizar um bloco de assinatura do responsável
    técnico (nome/assinatura/matrícula e data) e, via *CSS Page Margin Boxes* (`@page` com `counter(page)` e
    `counter(pages)`, suportado no Chrome 131+), a numeração "Página X de Y" em todas as exportações.

### Fase 4.12: Rodapé de assinatura no comprovante público e "Exportar resumo" no dashboard (CONCLUÍDA)
- Objetivo: propagar o rodapé de assinatura já usado nos PDFs para o documento público de fiscalização e
  permitir exportar o resumo do dashboard do Administrador em PDF.
- Entregável:
  - **Componente de assinatura reutilizável** (`src/pages/app/components/SignatureFooter.tsx`): versão em tela
    do mesmo rodapé de assinatura gerado nos PDFs (`pdfFooter`) — campos de *Responsável Técnico*,
    *Assinatura / Matrícula* e *Data*, seguidos do rodapé institucional SSTEK.
  - **Comprovante público de fiscalização** (`/fiscalizacao/:id`): o bloco de assinatura do responsável técnico
    foi adicionado logo abaixo da ficha, entrando também na impressão; o cabeçalho, o aviso de escaneamento e os
    botões ficam ocultos na impressão (`print:hidden`), produzindo um comprovante limpo ao imprimir/salvar PDF.
  - **"Exportar resumo" no dashboard do Administrador**: botão no painel "Período dos indicadores" que gera um
    PDF consolidado do período selecionado, com os cards de topo e os resumos de DDS, APR, EPI e Documentos,
    reutilizando `printHtml`, `pdfHeader` e `pdfFooter` (portanto com o mesmo rodapé de assinatura e a numeração
    de páginas).

### Fase 4.13: Assinatura em tela, histórico de exportações e cabeçalho de auditoria (CONCLUÍDA)
- Objetivo: fechar o ciclo de auditoria — assinatura do responsável técnico nos documentos impressos, reenvio
  rápido do que já foi emitido e identificação do comprovante público em campo.
- Entregável:
  - **Bloco de assinatura nos documentos em tela**: o componente `SignatureFooter` passou a ser exibido também na
    **Ficha de Presença** (`AttendanceSheetModal`), na nova entrega de **Termo de EPI** (`EpiDeliveryModal`) e no
    detalhe da **Ficha de EPI** (`EpiDetailModal`), alinhando o que aparece na tela ao rodapé já usado nos PDFs.
  - **Histórico de exportações da sessão**: novo store em memória (`src/pages/app/utils/exportHistory.ts`) que
    registra automaticamente cada emissão de `printHtml` (PDF) e `downloadCsv` (planilha). No topo do app
    (`AppTopbar`) há um ícone de histórico que lista os últimos documentos emitidos, com botão **Reenviar**
    (reemite o mesmo PDF/planilha) e a opção de limpar o histórico.
  - **Cabeçalho de identificação na impressão do comprovante público**: a página `/fiscalizacao/:id` ganhou um
    cabeçalho que só aparece na impressão (`print:block`), com **empresa + CNPJ**, **período de referência** e
    **responsável técnico**, para uso em auditoria em campo.

### Fase 4.14: Consulta de CA na Ficha de EPI (CONCLUÍDA)
- Objetivo: permitir identificar rapidamente um EPI pelo número do Certificado de Aprovação (CA), exibindo
  todas as informações técnicas do equipamento, diretamente na Ficha de EPI.
- Entregável:
  - **Catálogo enriquecido** (`src/mocks/epi.ts`): cada item do catálogo passou a carregar fabricante, norma
    técnica, validade do CA, tamanhos disponíveis, descrição de proteção e restrição de uso.
  - **Utilitários de busca** (`src/pages/app/modules/epi/epiUtils.ts`): `normalizeCa` (ignora pontos/espaços) e
    `findEpiByCa`, que localiza o equipamento pelo CA digitado com ou sem formatação.
  - **Modal "Consultar CA"** (`src/pages/app/modules/epi/components/ConsultaCaModal.tsx`): campo para digitar o
    CA + botão **Consultar**, resultado com a ficha completa do equipamento, estado "não encontrado" orientando a
    conferir o número e chips com os CAs disponíveis no catálogo para consulta rápida.
  - **Botão "Consultar CA" na Ficha de EPI**: no formulário de **Nova entrega de EPI** (`EpiDeliveryModal`),
    junto à seção "Equipamentos entregues", com a opção de **adicionar o item encontrado direto à entrega**; e
    no **detalhe da Ficha de EPI** (`EpiDetailModal`), com um botão de consulta por item entregue.

### Fase 4.15: Consulta rápida de CA, validação parametrizável e laudo do equipamento (CONCLUÍDA)
- Objetivo: dar consulta de CA independente de uma entrega, validar se o CA está ativo no cadastro
  (com a regra habilitável pela empresa) e emitir um laudo técnico do equipamento em PDF.
- Entregável:
  - **Parametrização do sistema** (`src/pages/app/settings/settingsStore.ts`): store leve e compartilhado com a
    flag `validarCaAtivoNoEpi` (habilitada por padrão), com hook `useSystemSettings` e `updateSetting`.
  - **Tela de Configurações** (`src/pages/app/modules/config/page.tsx`, rota `/app/config`): substitui o
    placeholder do módulo por uma página real com a seção "Ficha de EPI" e o **toggle** de validação de CA ativo.
  - **Catálogo com situação do CA** (`src/mocks/epi.ts`): cada item passou a ter `active` (e `inactiveReason`
    quando inativo), permitindo sinalizar CAs vencidos/cancelados.
  - **Utilitários** (`src/pages/app/modules/epi/epiUtils.ts`): `isCaActive` e `buildCaReportBody` (corpo do
    laudo técnico do equipamento).
  - **Consulta de CA ampliada** (`ConsultaCaModal`): exibe o **status do CA** (ativo/inativo) com o motivo da
    inativação, botão **Exportar laudo (PDF)** e chips do catálogo coloridos conforme a situação. O botão
    "Adicionar à entrega" só aparece quando o CA é válido (ou a validação está desativada).
  - **Botão "Consultar CA" no topo da lista de EPI**: consulta rápida, independente de uma entrega, aberto
    direto da página `/app/epi`.
  - **Validação no cadastro de entrega** (`EpiDeliveryModal`): ao incluir um EPI cujo CA está inativo, o
    sistema bloqueia a inclusão com aviso claro (quando a validação está habilitada); o seletor de itens
    também marca "(CA inativo)".

### Fase 4.16: Identidade visual — logo da empresa e papel timbrado (CONCLUÍDA)
- Objetivo: permitir que cada empresa configure sua marca (logo) e o papel timbrado usado nos documentos.
- Entregável:
  - **Persistência no Supabase**: criada a tabela `system_settings` (colunas `validar_ca_ativo_no_epi`,
    `logo_url`, `letterhead_url`, `updated_at`, linha única) com leitura pública e o bucket de Storage público
    `branding` com policies de leitura e upload. O store `settingsStore` passou a carregar/gravar no banco
    (antes era apenas em memória) e ganhou `uploadBrandingAsset`.
  - **Upload na tela de Configurações** (`/app/config`): nova seção **Identidade visual** com upload da **logo da
    empresa** (PNG/JPG/SVG) e do **papel timbrado** (PNG/JPG), com pré-visualização, arrastar-e-soltar, trocar e
    remover.
  - **Logo dinâmica no sistema**: novo componente `BrandLogo` (com fallback para a logo padrão SSTEK) aplicado
    na **tela de login** e no **topo do app logado** (sidebar).
  - **Papel timbrado nas exportações**: `pdfHeader` (`src/pages/app/utils/exportPdf.ts`) passou a usar o papel
    timbrado enviado no cabeçalho de **todos** os PDFs de relatórios, laudos, fichas e listas, mantendo o
    fallback para o cabeçalho institucional SSTEK quando nenhum arquivo foi enviado.

### Fase 4.17: Dados cadastrais da empresa nos relatórios e no comprovante público (CONCLUÍDA)
- Objetivo: cadastrar os dados da empresa (razão social, CNPJ e responsável técnico) e fazê-los acompanhar
  todos os relatórios, além de aplicar a logo enviada também no comprovante público de fiscalização.
- Entregável:
  - **Colunas no Supabase**: a tabela `system_settings` ganhou `company_legal_name`, `company_cnpj`,
    `technical_responsible` e `technical_registration`; o `settingsStore` passou a carregar/gravar esses campos.
  - **Seção "Dados da empresa"** na tela de Configurações (`/app/config`), via novo componente
    `CompanyDataForm`, com gravação ao sair do campo (evita requisição a cada tecla).
  - **Cabeçalho e assinatura dos relatórios**: `pdfHeader` passou a exibir a **razão social + CNPJ** (mesmo quando
    há papel timbrado) e `pdfFooter` a assinar com o **responsável técnico + registro**; o mesmo nome foi levado ao
    rodapé em tela (`SignatureFooter`).
  - **Comprovante público de fiscalização** (`/fiscalizacao/:id`): passou a usar a **logo da empresa** (`BrandLogo`)
    no topo, aplica o **papel timbrado** no cabeçalho (inclusive na impressão) e exibe **empresa + CNPJ** e
    **responsável técnico** cadastrados, com fallback para os dados de exemplo quando não configurados.

### Fase 4.18: Assinatura pessoal do colaborador (CONCLUÍDA)
- Objetivo: permitir que o colaborador crie uma assinatura pessoal (modelo de escrita + nome completo/parcial)
  e reutilizá-la automaticamente em todos os documentos que assinar, com aviso de pendências.
- Entregável:
  - **Tabela no Supabase** `collaborator_signatures` (`collaborator_id`, `font_model`, `name_style`,
    `updated_at`) com RLS e leitura/escrita liberadas enquanto o login está em modo demonstração.
  - **Store da assinatura** (`src/pages/app/signature/`): `signatureFonts` (4 modelos cursivos — Clássica,
    Formal, Fluida e Manuscrita), `signatureUtils` (`resolveSignatureName` e `renderSignaturePng`, que gera o PNG
    da assinatura via canvas) e `signatureStore` (hooks `useCollaboratorSignature`, `saveSignature`,
    `clearSignature`).
  - **Modal "Criar assinatura"** (`CreateSignatureModal`): escolha entre os 4 modelos de escrita, opção de
    assinar com o **nome completo** ou **parcial** (primeiro + último nome) e prévia ao vivo; também permite
    remover a assinatura.
  - **Tela "Meus dados" do colaborador** (`/app/meusdados`, nova rota e página de perfil): cartão do perfil,
    dados cadastrais e a seção **Minha assinatura** com o botão **Criar assinatura** (ou editar/remover).
  - **Componentes reutilizáveis**: `SignatureStamp` (prévia da assinatura) e `SignatureCapture` (área de
    assinatura dos documentos — exibe a assinatura pré-definida do perfil para confirmação, com opção de
    assinar manualmente).
  - **Aplicação nos documentos**: os aceites de **EPI** e **APR** passam a usar a assinatura do perfil
    (convertida em imagem e guardada no aceite) quando ela existe, mantendo o fallback de assinatura manual.
  - **Notificação de pendências**: no topo do app, o perfil Colaborador recebe o aviso de quantos documentos
    estão aguardando a sua assinatura, com atalho direto para o painel.

### Fase 4.19: Assinatura do perfil na Ficha de Presença, ficha do colaborador e Central de Alertas (CONCLUÍDA)
- Objetivo: levar a assinatura pessoal para os documentos de presença/treinamento, dar visibilidade ao
  Administrador e criar uma central de pendências de assinatura para o colaborador.
- Entregável:
  - **Ficha de Presença com assinatura do perfil**: o campo de nome do participante passou a ter autocomplete a
    partir da base de colaboradores (`datalist`); ao corresponder a um cadastro, o participante é vinculado e a
    coleta de assinatura passa a usar o componente `SignatureCapture` (assinatura do perfil, com opção de
    assinar manualmente), preenchendo também função e CPF quando vazios. Vale para fichas de DDS e treinamentos.
  - **Ficha do colaborador (Admin)**: o modal de detalhe (`CollaboratorDetailModal`) ganhou a seção
    **Assinatura pessoal**, exibindo a prévia da assinatura (`SignatureStamp`), o modelo de escrita e o estilo do
    nome quando já criada — ou um aviso de que ainda não foi criada; a prévia é apenas para conferência.
  - **Central de Alertas do colaborador** (`/app/alertas`, nova rota e página): reúne, em destaque, os
    documentos que aguardam assinatura (APRs e Fichas de EPI pendentes) com **acesso direto ao documento**
    (abre o modal de assinatura do perfil na hora), além dos demais avisos de vencimento. A página é alimentada
    pelos stores compartilhados de APR e EPI.
  - **Atalhos**: a notificação de pendências do topo do app e o card "Meus alertas" do painel do colaborador
    passaram a apontar para a nova Central de Alertas.

### Fase 4.20: Lista de presença do DDS com assinaturas e painel de assinaturas (Admin) (CONCLUÍDA)
- Objetivo: fechar o ciclo do DDS com uma lista de presença assinada e dar ao Administrador uma visão de quem já
  criou a assinatura pessoal.
- Entregável:
  - **Lista de presença do DDS em PDF**: no detalhe do DDS (`DdsDetailModal`) foi adicionado o botão **Lista de
    presença**, que gera um PDF com os participantes (nome e função) e a **assinatura de cada um**, obtida da
    assinatura pessoal do perfil (`renderSignaturePng` + `resolveSignatureName`) e renderizada na tabela via
    `printHtml`/`pdfHeader`/`pdfFooter`. O PDF também soma quantas assinaturas foram coletadas.
  - **Prévia das assinaturas no detalhe do DDS**: a lista de participantes passou a exibir a assinatura do perfil
    (`SignatureStamp`) ao lado de cada nome, ou a indicação "sem assinatura".
  - **Painel de assinaturas no dashboard do Administrador** (`src/pages/app/components/SignaturePanel.tsx`): novo
    painel que lista os colaboradores e mostra quem já criou a assinatura pessoal (com prévia e modelo de
    escrita/estilo do nome) e quem está pendente, com barra de cobertura, contadores e filtro
    **Todos / Com assinatura / Pendentes**.

### Fase 4.21: Exportação e lembrete de assinaturas pendentes no Administrador (CONCLUÍDA)
- Objetivo: dar ao Administrador relatórios do painel de assinaturas e um aviso automático sobre colaboradores
  sem assinatura pessoal criada.
- Entregável:
  - **Exportação do painel de assinaturas** (`SignaturePanel`): menu **Exportar** com **PDF** (via
    `printHtml`/`pdfHeader`/`pdfFooter`/`tableHtml`) e **planilha CSV** (via `downloadCsv`), listando
    colaborador, função, área, assinatura (nome resolvido), modelo de escrita/estilo e situação (Criada/Pendente)
    — sempre respeitando o filtro selecionado (Todos / Com assinatura / Pendentes).
  - **Lembrete automático no topo**: o `AppTopbar` passou a exibir, para o perfil Administrador, a notificação
    "X colaborador(es) ainda sem assinatura pessoal criada" (com atalho para o dashboard/Painel de assinaturas).
  - **Banner no dashboard do Administrador**: aviso destacado no topo do dashboard (abaixo do cabeçalho), visível
    apenas quando há pendências, com o total de colaboradores sem assinatura e atalho para a lista de
    colaboradores.

### Fase 4.22: Módulo real de assinatura eletrônica com base legal — Etapa 01 (CONCLUÍDA)
- Objetivo: transformar a assinatura pessoal em um módulo de assinatura eletrônica com base legal, com toda
  autorização, assinatura, data, hash e bloqueio validados no backend (nunca apenas na interface), preservando a
  arquitetura atual e o login de demonstração.
- Entregável:
  - **Schema de contas e tenancy** (Supabase): `companies` (tenants), `company_collaborators` (base da empresa usada
    na conferência de identidade) e `profiles` (conta individual, com vínculo `auth_user_id`, papel, contato
    verificado e `sessions_invalidated_at`). Semeados a empresa demo (Vega) e 12 colaboradores da base.
  - **Núcleo jurídico da assinatura**: `signature_terms` (termos versionados — v1 com o texto legal exato),
    `signature_term_acceptances` (evidências do aceite: versão, conteúdo, data/hora do servidor, IP, user-agent e
    hash), `signature_representations` (representações **versionadas** e imutáveis — cada alteração cria uma nova
    versão e preserva a anterior e sua imagem), `signature_audit_log` (trilha de auditoria) e `document_signatures`
    (assinatura de documentos com `content_hash`, `signature_hash` e a **imagem exata** usada em cada assinatura).
  - **RLS**: todas as tabelas novas com RLS habilitado e apenas leitura para o cliente — a escrita é feita
    exclusivamente pelo backend (service role), impedindo forja de termos, versões, hashes e assinaturas na interface.
  - **Edge function `signature-engine`** (validação no servidor, `verify_jwt: false` para o modo demonstração):
    ações `verify_affiliation` (vínculo por nome + CPF + matrícula na base da empresa), `accept_term` (registra o
    aceite com hash e evidências), `save_representation` (versiona a representação e exige **nova autenticação**
    para alteração), `remove_representation` (desativa preservando o histórico), `sign_document` (aplica os
    bloqueios: termo aceito, assinatura ativada, autorização do destinatário, versão do documento inalterada e não
    duplicidade; gera os hashes e registra a assinatura) e `record_account_event` (alteração de contato/recuperação
    de conta gera auditoria e invalida sessões). Usa dois clientes: anon apenas para validar o JWT e service role
    para as operações privilegiadas.
  - **"Minha assinatura"**: o modal passou a ter o **gate do termo** (leitura + aceite com registro no servidor) e
    a escolha entre **Desenhar assinatura** (traço no canvas) ou **Modelo de escrita** (tipográfica). Alteração exige
    **reautenticação**. A tela "Meus dados" exibe o status (ativa, versão, tipo, termo aceito) e um **histórico da
    assinatura** com todas as versões e a imagem de cada período.
  - **Componentes e integrações**: `SignatureStamp` passa a renderizar a **imagem salva** (desenho ou tipográfica);
    `SignatureCapture`, a Ficha de Presença do DDS e a lista de presença passam a usar a imagem exata registrada.
    Os aceites de **APR** e **Ficha de EPI** agora são validados e registrados no servidor via `sign_document`
    (bloqueando a assinatura quando o termo não foi aceito ou a assinatura não está ativada).
  - **Visão do Administrador**: o painel de assinaturas e a ficha do colaborador passam a indicar o **tipo**
    (desenhada/tipográfica), o **status de ativação**, a **versão** e o **aceite do termo** do colaborador. O Administrador
    continua impedido de assinar em nome de colaboradores (regra aplicada no backend).

### Fase 4.23: Fluxo de documentos assináveis — Etapa 02 (CONCLUÍDA)
- Objetivo: transformar a assinatura em um fluxo documental completo, com estados, congelamento de versão,
  hash no servidor, autenticação adicional por desafio, transação de assinatura, fechamento automático e
  substituição versionada — preservando a arquitetura atual e o login de demonstração.
- Entregável:
  - **Estados do documento**: `signature_documents` com os estados **Rascunho**, **Aguardando assinaturas**,
    **Parcialmente assinado**, **Concluído** e **Cancelado**, e o vínculo de **substituição**
    (`supersedes_document_id` / `superseded_by_document_id`) entre o documento antigo e o novo.
  - **Rascunho editável**: preenchimento de dados, escolha dos **signatários**, seus **papéis** e as
    **posições das assinaturas** na folha (prévia A4 clicável — `DocumentSheet`).
  - **Envio com congelamento**: `submit_document` congela conteúdo, versão, signatários e posições e calcula o
    **SHA-256 do conteúdo** e do **PDF-base apresentado** no servidor (nunca na interface).
  - **Signatários/desafios**: `signature_document_signatories` (uma linha por signatário, com status) e
    `signature_challenges` (código de uso único com **prazo**, **limite de tentativas** e vínculo a
    usuário/empresa/documento/versão, sem reutilização). A notificação (`issue_challenge`) não autoriza
    nem executa assinatura.
  - **Assinatura transacional**: RPC `sg_sign_document` impõe **unicidade por empresa/documento/versão/signatário**
    (índice único parcial) e **idempotência** para cliques repetidos e requisições simultâneas; quem já assinou
    não assina de novo a versão e os demais signatários seguem autorizados; ao fechar a última assinatura o
    documento é **encerrado** (`concluido`).
  - **Antes de confirmar**: visualização e download do documento completo (`exportDocumentPdf`), **declaração
    específica** por finalidade (recebimento de EPIs / participação em treinamento / ciência do conteúdo) e
    **“Informar divergência”** (registrada em `signature_divergences` **sem** registrar concordância).
  - **Correções**: `cancel_document` e `substitute_document` — a substituição cria uma **nova versão** (exigindo
    novas confirmações) e **preserva** o documento anterior e suas evidências; conteúdo enviado não é editável
    nem assinaturas apagadas silenciosamente.
  - **Interface**: novo módulo `Assinaturas` (`/app/assinaturas`, Administrador e Colaborador) com KPIs por
    estado, filtros (Todos / Meus pendentes / por estado) e busca; editor de rascunho; modal de detalhe com
    conferência, assinatura por desafio e gestão (cancelar/substituir). Pendências alimentam a **Central de
    Alertas** do colaborador e o **sino do topo**.

### Fase 4.24: Identidade, evidências, validação por QR e Documentos assinados — Etapa 03 (CONCLUÍDA)
- Objetivo: dar identidade própria a cada ato de assinatura, trilha de evidências completa, preservação separada
  dos arquivos com hashes próprios, validação pública por token não enumerável e a área de "Documentos assinados"
  para auditoria/fiscalização — tudo validado no servidor.
- Entregável:
  - **Identidade do ato e do documento**: `document_signatures.signature_uid` (UUID **UNIQUE** gerado no servidor)
    identifica a assinatura; `signature_documents.document_uid` (UUID **UNIQUE**) identifica o documento. A
    assinatura passa a ser exibida sempre na ordem exigida: representação visual preservada → "Assinado
    eletronicamente por" → NOME COMPLETO → Data (DD/MM/AAAA HH:mm:ss — UTC−03:00) → ID da assinatura (UUID).
    O ID identifica o ato e não é apresentado como prova isolada de autenticidade.
  - **Evidências por confirmação**: `document_signatures` ganhou `signer_name`, `company_name`, `document_title`,
    `timezone_display`, `auth_method`, `auth_result` e `evidence` (jsonb). Cada confirmação registra identidade,
    empresa, documento, versão, hash do PDF-base, data/hora UTC do servidor, fuso de exibição, declaração aceita,
    método/resultado da autenticação e a versão da representação visual — **sem** armazenar senhas, códigos de
    autenticação ou chaves privadas.
  - **Preservação separada + hashes próprios**: `signature_documents` ganhou `final_pdf_hash` e
    `evidence_report_hash`, além do `base_pdf_hash` já existente. O hash do PDF final **não** inclui o próprio
    campo (`final_pdf_hash`), evitando conter o hash de um arquivo que contém esse hash; os arquivos antigos não
    são reconstruídos com dados atuais do cadastro (snapshots de nome/empresa/representação).
  - **QR de validação**: `signature_documents.validation_token` — token aleatório **não enumerável** (24 bytes),
    reservado no momento do congelamento (antes de qualquer assinatura criptográfica final, para não invalidá-la) e
    exibido como QR-Code (reaproveitando `qrcode.react`) apontando para a página pública `/validar/:token`.
  - **Transações v2 no backend**: RPCs `sg_submit_document_v2` (grava o token) e `sg_sign_document_v2` (grava
    `signature_uid` e as evidências), mantendo **unicidade** (empresa/documento/versão/signatário) e
    **idempotência**; RPC `sg_finalize_document` calcula/grava os hashes de PDF final e do relatório de evidências
    ao concluir. Ações novas na edge function `signature-engine`: `validate_document` (pública, só informações
    mínimas, recomputa o hash do conteúdo para sinalizar divergências e nunca trata cancelado como vigente) e
    `get_document_evidence` (autorizada: gestores e signatários).
  - **Página pública de validação** (`/validar/:token`): confere os registros, mostra status, identificador e
    informações mínimas, sinaliza **divergências** e deixa claro que **documento cancelado não é vigente**; não
    expõe CPF, contatos, IP nem documentos de saúde (o conteúdo completo/evidências exigem autorização).
  - **Módulo "Documentos assinados"** (`/app/documentos-assinados`): filtros (situação, tipo e busca), **download
    autorizado** do documento em PDF (com as assinaturas preservadas) e **exportação das evidências** em PDF, CSV
    e pacote JSON (preservação independente do SaaS), via `getDocumentEvidence`.

### Fase 4.25: Politica, classificacao legal e integridade — Etapa 04 (CONCLUIDA)
- Objetivo: configurar a politica de assinatura por categoria documental e papel do signatario (com fundamento,
  versao e aprovacao), classificar a assinatura com honestidade, permitir integracao de certificado ICP-Brasil
  (bloqueando sem integracao/validacao reais, sem simulacao), garantir integridade (auditoria append-only com
  cadeia de hash, armazenamento imutavel, retencao por categoria) e entregar o dossie de testes.
- Entregavel:
  - **Politica por categoria/papel**: tabela `signature_policies` (doc_type × signer_role → nivel exigido,
    `requires_certificate`, `legal_fundamento`, `legal_references`, `policy_version`, `approved_by`, `approved_at`),
    com versao a cada alteracao (nova linha ativa; a anterior e desativada) e resolucao efetiva por empresa
    (RPC `sg_signature_policy_for`). Padrao semeado: nivel **simples** para EPI, treinamento, DDS e APR, com
    referencias a MP 2.200-2/2001 art. 10, Lei 14.063/2020 art. 4o, NR-1 (1.6/1.7), NR-6 (6.5.1d/6.5.1.1) e LGPD.
  - **Classificacao honesta**: `document_signatures.signature_level` (simples/avancada/qualificada). O metodo
    atual (representacao visual + codigo de uso unico) e **simples** e nunca e apresentado como avancada ou
    qualificada. Login, imagem e codigo NAO sao classificados como avancada automaticamente.
  - **ICP-Brasil sem simulacao**: `signature_certificate_config` (provedor + endpoint + habilitado). A politica
    pode exigir certificado (`required_level` avancada/qualificada); sem provedor/endpoint reais o motor bloqueia
    a conclusao (`CERTIFICATE_NOT_AVAILABLE` / `CERTIFICATE_REQUIRED` / `CERTIFICATE_VALIDATION_UNAVAILABLE`) e
    nenhum certificado, selo ou resultado de validacao e simulado. O certificado da empresa protegendo o arquivo
    nao equivale a assinatura qualificada do trabalhador.
  - **Campos por categoria**: templates no editor de rascunho — EPI (trabalhador, empresa, equipamento, modelo, CA,
    quantidade, data, responsavel), treinamento (conteudo, carga horaria, data, local, instrutor + qualificacao,
    responsavel tecnico, NR) e DDS (assunto, conteudo, data, responsavel, participantes; nao substitui treinamento).
  - **Integridade**: auditoria append-only com **cadeia de hash** (`prev_hash`/`entry_hash`) e triggers que
    bloqueiam UPDATE/DELETE na auditoria; imutabilidade do documento congelado e das assinaturas (sem exclusao
    silenciosa). Recibo de **carimbo de tempo independente** (`signature_timestamp_receipts`), gravado como
    `not_configured` quando nao ha TSA real — distinguindo o horario do servidor.
  - **Retencao/backup por categoria**: `signature_retention_policies` (prazo, backup exigido, base legal).
  - **Modulo "Politicas de assinatura"** (`/app/politicas`, Administrador e Super): politica por categoria/papel,
    retencao, integracao de certificado e **dossie de testes** executavel (`run_test_suite`).
  - **Dossie de testes** (RPC `sg_run_tests` + verificacoes no motor): auditoria append-only, exclusao bloqueada,
    congelamento/imutabilidade, unicidade por empresa/documento/versao/signatario, cadeia de hash, acesso entre
    empresas, assinatura por pessoa nao designada, desafio expirado/reutilizado, alteracao apos envio, conclusao
    apenas com todos, validacao de arquivo adulterado, edicao de imagem sem afetar antigos e falha de certificado.
- **Pendencia honesta**: a validacao real da cadeia ICP-Brasil depende de provedor externo; ate la, o que exige
  certificado permanece bloqueado. A conformidade juridica integral depende de revisao da politica documental.

### Fase 4.26: Sentimento do dia — check-in obrigatório e acompanhamento pelo gestor (CONCLUÍDA)
- Objetivo: registrar o sentimento diário de cada usuário no primeiro acesso do dia e permitir que o gestor
  responsável acompanhe, com alerta dedicado para sentimentos negativos.
- Entregável:
  - **Tabela `daily_moods`** (Supabase): um registro por usuário e por dia (`UNIQUE (user_key, mood_date)`),
    guardando humor, pontuação, motivo, empresa, área e o **gestor responsável** no momento do registro. RLS de
    leitura/gravação em modo demonstração (a gravação usa upsert na chave, evitando duplicidade em cliques repetidos).
  - **Modal bloqueante**: ao entrar no sistema o usuário deve escolher 1 das 5 opções (**Muito Triste, Triste,
    Neutro, Feliz, Muito Feliz**). O campo de motivo é **opcional**, com texto convidativo que desaparece ao focar e
    mensagem fixa de privacidade. Uma vez registrado, não reaparece no mesmo dia.
  - **Vínculo de gestor**: novo campo **"Gestor / Líder responsável"** no cadastro do colaborador; o registro passa a
    carregar esse gestor, e a visibilidade segue a regra (Admin/Super têm supervisão de todos; cada líder vê seus
    liderados).
  - **Resumo do colaborador**: card **"Meu sentimento"** no painel, com o registro de hoje e os últimos dias.
  - **Painel do gestor**: card **"Sentimento da equipe"** no dashboard do Administrador (registros do dia, alertas e
    últimos registros) e módulo dedicado (`/app/sentimento`) com filtro por período, indicadores, distribuição,
    filtro "somente alertas" e exportação em PDF/CSV.
  - **Alerta de sentimento negativo**: destaque na tela do gestor e no sino do topo quando alguém registra
    **Triste ou Muito Triste**.

### Fase 4.27: Evolução do sentimento — gráfico de linha e drill-down (CONCLUÍDA)
- Objetivo: permitir ao gestor enxergar a **tendência** do sentimento médio ao longo do período (mês), com a
  visão consolidada de todos os colaboradores e a possibilidade de abrir a evolução de um colaborador individual
  e consultar a nota de um dia específico.
- Entregável:
  - **Gráfico de linha (recharts)**: nova seção **"Evolução do sentimento"** no painel do gestor (`/app/sentimento`)
    mostrando a **média diária** (escala 1 a 5) da equipe no período selecionado, com linha de referência no
    **Neutro (3)**, eixo com emojis, pontos clicáveis e tooltip por dia (média, nº de registros e emoji). Dias com
    média negativa (≤ 2) ganham destaque de cor.
  - **Drill-down individual**: um seletor alterna entre **Equipe (consolidado)** e cada **colaborador** presente no
    período; ao escolher uma pessoa, o gráfico passa a exibir a evolução dela.
  - **Detalhe do dia**: clicar em um ponto do gráfico abre o detalhe daquele dia (quando a visão é consolidada,
    lista todos os registros do dia com nome, humor e motivo; na visão individual, mostra a nota e o registro da
    pessoa).
  - **Resumo do período**: cartões com média, dias com registro, melhor dia, dia mais baixo e a **variação** entre
    o início e o fim do período.
  - **Helpers** (`moodTrend.ts`): agregação diária (eixo contínuo quando o período é curto; apenas dias com registro
    quando é longo), lista de colaboradores do período e resumo/tendência.

### Fase 4.28: Evolução comparativa, marcação de alertas e tendência por área (CONCLUÍDA)
- Objetivo: aprofundar a leitura de tendência do painel do gestor — comparar pessoas, sinalizar dias ruins e
  resumir por setor — além de levar o próprio gráfico para o PDF exportado.
- Entregável:
  - **Comparativo de 2 a 3 colaboradores**: a seção **"Evolução do sentimento"** ganhou o seletor
    **Individual / Comparar**; no modo Comparar é possível escolher de 2 a 3 colaboradores (chips com limite e
    contador) e o gráfico **sobrepõe uma linha por pessoa**, com legenda, cores dos tokens do tema e tooltip
    mostrando cada série do dia. As linhas passam a usar o gráfico multi-série do `recharts`.
  - **Marcador de dia com alerta negativo**: os dias em que houve registro **Triste/Muito Triste** recebem um
    **marcador** no eixo do dia (rótulo destacado + ponto) e a indicação "Alerta de sentimento negativo" no
    tooltip; o detalhe do dia também sinaliza o alerta.
  - **Tendência por área/setor**: novo bloco com, por área, média, registros, dias, **quantidade de alertas**,
    % positivo e a **variação (seta)** entre o primeiro e o último dia do período — ordenado por volume.
  - **Gráfico no PDF do painel**: a exportação em PDF do painel do gestor passou a incluir o **gráfico de
    evolução** (SVG capturado, com as variáveis de tema embutidas na impressão), o **resumo do período** e a
    **tabela de tendência por área/setor**.
  - **Helpers** (`moodTrend.ts`): `buildComparisonTrend` (série comparativa multi-colaborador), tipo de
    tendência por dia com `hasAlert`, `areaTrend` (resumo por área/setor) e o contrato `MoodTrendExport` para a
    captura destinada ao PDF.

### Fase 4.29: Minha ficha de EPI e hierarquia de liderança (CONCLUÍDA)
- Objetivo: dar ao colaborador a visão da própria ficha de EPI e permitir uma hierarquia de liderança
  parametrizável (vínculo por nome e por função/área), de modo que todo líder enxergue os resultados de quem
  está abaixo.
- Entregável:
  - **Minha ficha de EPI** (`/app/minhaepi`, Colaborador): página do próprio colaborador com os **EPIs em uso**
    (equipamento, CA, validade do certificado e situação Ativo/Vencendo/Vencido), além do **histórico de
    entregas e aceites**. As fichas pendentes podem ser assinadas ali mesmo (`EpiSignModal`) e cada entrega pode
    ser aberta no detalhe (`EpiDetailModal`); inclui exportação em **PDF** e **CSV**. O atalho já existente em
    "Meus dados" e no painel do colaborador agora aponta para a página real.
  - **Store de liderança** (`src/pages/app/modules/leadership/leadershipStore.ts`): centraliza o **líder por
    área/setor** (vínculo por função) e a lista de **perfis autorizados a alocar líderes**; expõe
    `areasLedBy`, `subordinatesOf` e `isLeader` para compor quem está "abaixo" de cada líder (por nome **e** por
    área). Nesta fase os vínculos ficam em memória (modo demonstração).
  - **Visibilidade por área**: `teamMoods` passou a aceitar as áreas lideradas; o **painel do gestor**
    (`MoodTeamPanel`) e o módulo **Sentimento da equipe** passam a somar, aos liderados por nome, os
    colaboradores das áreas sob responsabilidade do líder. O colaborador que também é líder passa a ver o
    painel **"Sentimento da equipe"** no próprio painel.
  - **Parametrização no perfil Administrador** (`/app/config` → seção **Hierarquia de liderança**): define
    **quais perfis podem alocar líderes** e o **líder responsável por cada área/setor** (com a contagem de
    colaboradores por área). O campo "Gestor / Líder responsável" no cadastro do colaborador respeita essa
    parametrização (bloqueado quando o perfil não está autorizado).

### Fase 4.30: Minha equipe, EPI a vencer por área e fichas de EPI no perfil (CONCLUÍDA)
- Objetivo: dar ao líder uma visão de time com atalho para cada ficha e os EPIs a vencer da equipe, levar o
  resumo real de EPIs para o painel do colaborador e organizar as fichas de EPI no perfil do colaborador com
  exclusão parametrizável.
- Entregável:
  - **Painel "Minha equipe"** (`/app/minhaequipe`, Colaborador): lista os liderados do líder **por nome**
    (vínculo individual) e **por área/setor** (vínculo por função), com badges indicando o tipo de vínculo e
    atalho **Ver ficha** (abre `CollaboratorDetailModal`) para cada colaborador. Admin/Super têm visão de
    supervisão (toda a operação ativa). Helpers novos no store de liderança: `subordinatesByPerson` e
    `subordinatesByArea`.
  - **EPI a vencer da equipe**: nova seção no painel "Minha equipe" com os itens de EPI perto do vencimento ou
    vencidos da equipe do líder (filtrados pelos liderados), com atalho para o módulo de EPI — levando o vínculo
    por área também para os alertas de validade do CA.
  - **Resumo de EPIs em uso no painel do colaborador**: o card "Minha ficha de EPI" (e o KPI de EPIs em uso) do
    painel passa a refletir os EPIs realmente entregues (helper compartilhado `computeEpiInUse`), com atalho para
    a página **Minha ficha de EPI**.
  - **Fichas de EPI no perfil do colaborador**: o modal "Ficha do colaborador" (Admin) ganhou a seção
    **Fichas de EPI armazenadas**, listando todas as fichas de EPI do colaborador (nome, emissão, tamanho e
    situação) com visualização do termo e **exclusão em duas etapas**.
  - **Parametrização de exclusão** (`/app/config` → seção **Exclusão de documentos**): novo store
    `documentPermissionsStore` define **quais perfis podem excluir documentos assinados**; fora desses perfis a
    exclusão fica bloqueada (cadeado), preservando o registro de conformidade. Nesta fase a permissão fica em
    memória (modo demonstração).
  - **Resolução de identidade por e-mail**: a sessão do colaborador resolve o nome pelo e-mail informado no
    login, permitindo identificar líderes (que também são colaboradores) na demonstração.

### Fase 4.31: Sentimento do dia na lista do líder e exportação do painel do líder (CONCLUÍDA)
- Objetivo: aproximar o líder do time — ver o humor do dia de cada liderado direto na lista do "Minha equipe" e
  poder exportar o painel do líder (liderados + humor + EPIs a vencer da equipe).
- Entregável:
  - **Humor do dia na lista**: cada liderado em "Minha equipe" (`/app/minhaequipe`) passa a exibir um chip com o
    **sentimento do dia** (emoji + rótulo) lido do store `daily_moods` via `findTodayMood`; quando o humor é
    negativo o chip ganha destaque de alerta. Quando não há registro do dia, o chip indica "Sem registro hoje".
  - **Atalho para o painel de sentimento**: o chip de humor e um resumo de topo ("Sentimento de hoje: X/Y
    registraram", com a contagem de alertas) apontam para `/app/sentimento`, além do atalho já existente no
    cabeçalho.
  - **Exportação do painel do líder**: menu **Exportar** com **PDF** (via `printHtml`/`pdfHeader`/`pdfFooter`/
    `tableHtml`) e **planilha CSV** (via `downloadCsv`), trazendo os **liderados com vínculo e humor do dia** e a
    tabela de **EPIs a vencer na equipe** (vencido/vencendo, CA e validade) — os KPIs do painel também entram no
    PDF.

### Fase 4.32: Filtro de priorização, EPI por liderado e gráfico no PDF do líder (CONCLUÍDA)
- Objetivo: ajudar o líder a priorizar rapidamente os casos de atenção do dia, sinalizar o risco de EPI de cada
  pessoa e levar o gráfico de evolução do sentimento da equipe para dentro do PDF do líder.
- Entregável:
  - **Filtro/badge "Somente alerta hoje"**: barra de filtro no topo do "Minha equipe" (`/app/minhaequipe`) com
    os modos **Todos** e **Somente alerta hoje** (com contador). No modo alerta, a lista passa a exibir apenas os
    liderados que registraram **sentimento negativo hoje** (Triste/Muito Triste), com estado vazio dedicado quando
    não há casos.
  - **EPI a vencer por liderado**: cada card de liderado passa a exibir, ao lado do chip de humor, um chip com a
    **quantidade de EPIs a vencer/vencidos** dele (destaque mais forte quando há item vencido). A coluna "EPI a
    vencer" também entra na tabela de liderados do PDF e do CSV do líder.
  - **Gráfico de evolução no PDF do líder**: nova seção **"Evolução do sentimento da equipe"** no painel do líder
    (componente `TeamMoodTrend`, reaproveitando o **mesmo gráfico** do painel do gestor via `MoodTrendChart` +
    `buildComparisonTrend`), com a média diária do time e drill-down por dia. O SVG do gráfico é capturado e
    anexado ao **PDF do líder** (junto com o resumo do período), como anexo visual.
  - **KPIs ajustados**: o painel do líder passa a destacar **"Com alerta hoje"** e **"EPIs a vencer/vencidos"**
    no topo, alinhando os indicadores à nova leitura de priorização.

### Fase 4.33: Capa com resumo executivo do dia no PDF do líder (CONCLUÍDA)
- Objetivo: abrir o PDF do líder com uma capa de leitura rápida — o resumo executivo do dia (alertas, EPIs e
  registros) antes do relatório detalhado.
- Entregável:
  - **Capa "Resumo executivo do dia"**: o PDF do "Minha equipe" (`/app/minhaequipe`) passa a ter uma
    **primeira página** com o cabeçalho/papel timbrado da empresa, o título, o líder e a data, seguida de três
    cartões de destaque — **alertas de sentimento hoje**, **EPIs a vencer/vencidos** e **registros de humor
    hoje** (X de Y) — com realce quando há ponto de atenção.
  - **Destaques do dia**: lista objetiva dos alertas (com os nomes dos colaboradores em alerta), dos EPIs a
    vencer/vencidos (com a quebra entre vencidos e a vencer) e da cobertura de registros de humor do dia.
  - **Leitura rápida**: nota de priorização que orienta olhar as seções "Liderados" e "EPI a vencer" nas
    páginas seguintes quando há alertas; do contrário, sinaliza que a equipe está dentro do esperado.
  - **Quebra de página**: estilos de capa (`exportPdf.ts`) com `page-break-after` isolam a capa do relatório,
    que segue a partir da segunda página com o cabeçalho institucional.

### Fase 4.34: Inspeção de Campo (documento de inspeção de segurança) (CONCLUÍDA)
- Objetivo: registrar a inspeção de segurança de campo (rotina do PGR/NR-1) com os campos legais, os
  colaboradores vistoriados (busca por nome, CPF e matrícula, para grandes operações) e o registro fotográfico.
- Entregável:
  - **Tipo de documento "Inspeção de Campo"** no catálogo de Documentos (`src/mocks/documents.ts`), com botão
    **Inspeção de campo** no cabeçalho do módulo (`/app/documentos`).
  - **Modal Inspeção de Campo** (`FieldInspectionModal`): identificação (título, tipo, data, hora, turno),
    local (área/setor e local específico), responsável (nome, registro e função) e objeto/escopo da inspeção.
  - **Checklist de itens verificados** (`InspectionChecklist`) com as principais NRs (EPIs, 5S, máquinas,
    elétrica, iluminação, ruído, sinalização, incêndio, ergonomia, cargas, químicos, circulação, altura e
    espaços confinados), marcando cada item como **Conforme / Não conforme / Não aplicável** com observação.
  - **Não conformidades e ações**: desvios identificados, grau de risco (Baixo/Médio/Alto/Crítico), ação
    corretiva, responsável e prazo.
  - **Colaboradores vistoriados** (`InspectedCollaboratorsField`): busca na base por **nome, CPF ou matrícula**
    (facilitando grandes operações), com situação individual (Conforme/Atenção/Não conforme) e opção de
    inclusão manual; o cadastro do colaborador ganhou o campo **Matrícula** (aplicado na lista, importação e ficha).
  - **Registro fotográfico**: upload de múltiplas imagens com prévia e remoção, embutidas no PDF.
  - **Exportação em PDF**: relatório com identificação, itens verificados, não conformidades/ações, tabela dos
    colaboradores vistoriados (nome, CPF, matrícula, função/área e situação), galeria fotográfica e assinatura do
    responsável técnico; o registro é adicionado à lista de Documentos.

### Fase 4.35: Módulo CIPA (comissões, agenda, atas, ações, eleições e inspeções) (CONCLUÍDA)
- Objetivo: criar o módulo CIPA para atender empresas com mais de uma comissão (matriz e filiais), cobrindo
  composição e mandato, agenda de reuniões/eventos, atas, plano de ações, eleições e inspeções com fotos.
- Entregável:
  - **Múltiplas CIPAs**: cadastro de uma comissão por estabelecimento (matriz ou filial), com CNPJ, grau de risco,
    nº de empregados, mandato e **composição** (presidente, vice, secretário, titulares e suplentes) com cargo,
    representação (empregador/empregado), função, área e matrícula — com busca de membros na base de colaboradores.
  - **Agenda**: agendamento de **reuniões ordinárias, extraordinárias e eventos** (ex.: SIPAT), com data, hora,
    local/link, pauta e situação (Agendada/Realizada/Cancelada).
  - **Atas**: registro das deliberações, participantes e **registro fotográfico**, com vínculo a uma reunião e
    exportação em PDF.
  - **Plano de ações**: ações originadas das atas/reuniões/inspeções, com responsável, prazo, prioridade e
    situação (Pendente/Em andamento/Concluída/Atrasada), com filtros e exportação em PDF/CSV.
  - **Eleições**: processo eleitoral conforme a NR-5 (inscrições, votação, apuração e publicação), com candidatos,
    registro de votos, ranking e exportação da apuração em PDF.
  - **Inspeções com fotos**: inspeção vinculada à comissão com itens verificados (Conforme/Não conforme/Não
    aplicável), não conformidades, grau de risco, ação corretiva e **registro fotográfico**, com exportação em PDF.
  - **Navegação por abas** e filtro global por comissão (Visão geral, Comissões, Agenda, Atas, Ações, Eleições e
    Inspeções), com KPIs e visão consolidada de próximos compromissos e ações em aberto.
  - Novo módulo `/app/cipa` no menu (Administrador e Super Administrador) e store compartilhado da sessão
    (`src/pages/app/modules/cipa/cipaStore.ts`), no modo demonstração.

### Fase 4.36: Aprovação da ata e alertas da CIPA no sino e nos dashboards (CONCLUÍDA)
- Objetivo: formalizar a aprovação da ata com a assinatura pessoal do presidente e do secretário e avisar sobre
  reuniões próximas e ações atrasadas da CIPA no sino do topo e nos dashboards.
- Entregável:
  - **Aprovação da ata**: novo modelo `CipaAtaSignature` (papel, nome, colaborador vinculado, data/hora e ID do
    ato) e campo `approvals` na ata. O presidente e o secretário são derivados da composição da comissão
    (`ataApprovers`, com vínculo à base de colaboradores por nome).
  - **Coleta de assinatura**: modal `AtaApprovalModal` que usa a **assinatura pessoal do perfil**
    (`SignatureCapture`) de cada aprovador, com registro de data/hora e ID do ato; quando a pessoa ainda não
    criou a assinatura, é possível assinar manualmente. A lista de atas (`AtasTab`) mostra o contador de
    aprovações, libera o botão **Coletar aprovação** e exibe os blocos de assinatura no detalhe.
  - **PDF da ata**: seção **Aprovação da ata** com a representação visual preservada, o texto padrão
    "Assinado eletronicamente por", o nome, o papel, a data/hora (UTC−03:00) e o ID da assinatura.
  - **Alertas de CIPA** (`cipaAlerts.ts`): reuniões agendadas (próximas) e ações atrasadas (prazo vencido ou
    situação "Atrasada"). Alimentam o **sino do topo** (`AppTopbar`) e o painel **"CIPA · Atenção necessária"**
    (`CipaAlertsPanel`) nos dashboards do Administrador e do Colaborador, com atalho direto para o módulo.

### Fase 4.37: Aprovação da ata → documento automático e situação na lista (CONCLUÍDA)
- Objetivo: ao aprovar a ata por completo (presidente + secretário), gerar automaticamente o registro na lista
  de Documentos; e exibir a situação "Aprovada / Aguardando aprovação" na lista de atas, com filtro por situação.
- Entregável:
  - **Situação da ata** (`cipaUtils.ts`): helpers `isAtaSignatureCollected`, `ataSignedCount`,
    `isAtaFullyApproved` (todos os aprovadores registrados já assinaram — presidente e secretário) e
    `ataApprovalStatus`. A lista de atas (`AtasTab`) passou a exibir um badge **Aprovada** (primary) ou
    **Aguardando aprovação** (secondary) em cada card, além do contador de assinaturas `X/N`.
  - **Filtro por situação**: controle segmentado no topo da lista (Todas / Aprovadas / Aguardando aprovação) com
    contadores por situação, integrado à busca por título/número/conteúdo e ao filtro global por comissão.
  - **Geração automática em Documentos** (`documentsStore.buildAtaDocument`): ao salvar a aprovação
    (`persistAta`, disparado pelo `AtaApprovalModal`), se a ata fica aprovada por completo o registro é
    gerado/atualizado na lista de Documentos, vinculado ao novo tipo **"Ata da CIPA"** (id determinístico
    `doc-ata-<id>`, evitando duplicidade); se a aprovação for desfeita, o registro é removido.
  - **Catálogo de Documentos** (`src/mocks/documents.ts`): novo tipo **Ata da CIPA** (escopo empresa) e o
    registro da ata de Setembro/2026 já aprovada pré-carregado para demonstração.

### Fase 4.38: Situação de aprovação e PDF anexado em Documentos + aviso de ata pendente (CONCLUÍDA)
- Objetivo: refletir a situação de aprovação das atas na tela de Documentos (com filtro), anexar automaticamente
  o PDF da ata aprovada ao registro e avisar no sino quando uma ata fica pendente de aprovação.
- Entregável:
  - **Situação de aprovação no registro** (`src/mocks/documents.ts`): o `DocumentRecord` ganhou
    `approvalStatus` (aprovada/aguardando), `ataId`, `attachedPdfHtml` e `attachedAt`.
  - **Builder de PDF reaproveitável** (`src/pages/app/modules/cipa/ataPdf.ts`): `buildAtaPdfBody` monta o corpo
    da ata (registro, deliberações, participantes, aprovação e fotos) e é usado tanto na exportação manual quanto
    no anexo automático.
  - **Anexo automático** (`documentsStore.buildAtaDocument`): cada alteração de ata atualiza o registro de
    Documentos com a situação correspondente; quando a ata é aprovada por completo, o PDF é gerado e anexado ao
    registro. Os registros das atas existentes são semeados ao iniciar o store.
  - **Filtro por situação de aprovação** (`/app/documentos`): novo seletor (Todas / Aprovadas / Aguardando
    aprovação), badge de situação na linha e indicador "PDF anexado"; os botões **Visualizar/Baixar** abrem o PDF
    anexado. A situação também entra na exportação (PDF/CSV).
  - **Aviso de ata pendente no sino** (`cipaAlerts.ts`): novo alerta (kind `approval`) para atas aguardando
    aprovação, exibido no sino do topo (`AppTopbar`) e no painel "CIPA · Atenção necessária" (`CipaAlertsPanel`),
    com o contador de assinaturas `X/N`.

### Fase 4.39: Impressão em lote das atas e bloco "Aprovações da CIPA" no dashboard (CONCLUÍDA)
- Objetivo: permitir selecionar várias atas aprovadas em Documentos e baixar/imprimir todos os PDFs anexados
de uma só vez, e dar ao Administrador um bloco consolidado de aprovações da CIPA por comissão.
- Entregável:
  - **Impressão/baixa em lote em Documentos** (`/app/documentos`): o botão **Imprimir em lote** passou a reunir
    de fato os PDFs anexados (`attachedPdfHtml`) dos documentos selecionados em um único documento de impressão,
    com quebra de página entre eles (classe `.batch-page` em `exportPdf.ts`) — o navegador abre a impressão e o
    usuário pode salvar todos como um PDF único. Documentos selecionados sem PDF anexado são ignorados com aviso.
  - **Seleção rápida de atas aprovadas**: botão **Selecionar atas aprovadas (N)** que marca de uma vez todas as
    atas aprovadas (com PDF anexado) do filtro atual.
  - **Bloco "Aprovações da CIPA"** (`CipaApprovalsPanel`): novo painel no dashboard do Administrador com o total
    de **atas aprovadas x pendentes**, o **progresso geral de aprovação** e o detalhamento **por comissão**
    (barra de progresso e contadores), com atalho para o módulo CIPA.

### Fase 4.40: Filtro por comissão no bloco de aprovações e download do PDF da ata no card (CONCLUÍDA)
- Objetivo: permitir focar o bloco "Aprovações da CIPA" numa filial específica e baixar o PDF da ata aprovada
direto da lista de atas, sem depender da tela de Documentos.
- Entregável:
  - **Filtro por comissão** (`CipaApprovalsPanel`): chips no topo do bloco ("Todas as comissões" + cada comissão),
    com contador de pendências em cada chip. O filtro reescopa os cartões de resumo, o progresso geral e a lista
    por comissão para a filial selecionada, mantendo o atalho "Abrir CIPA".
  - **Download do PDF no card da ata** (`AtasTab`): o botão do card passou a ser sensível à situação — atas
    **Aprovadas** exibem o botão destacado **Baixar PDF** (com ícone de download, usando o mesmo gerador do PDF
    anexado em Documentos); atas **Aguardando aprovação** mantêm o botão secundário de pré-visualização.

### Fase 4.41: Ficha de Inscrição de Candidato nas eleições da CIPA (CONCLUÍDA)
- Objetivo: permitir, dentro de cada processo eleitoral, o cadastro de candidatos que pretendem concorrer às vagas,
  com prazo de candidatura, ficha com foto 3x4 seguindo a regra de fundo branco, e um mural de aviso público
  visível a todos os interessados.
- Entregável:
  - **Modelo estendido** (`src/mocks/cipa.ts`): `ElectionCandidate` ganhou matrícula, contato, `photoUrl` (foto 3x4)
    e `declaredAt`; `CipaElection` ganhou `notice` (texto do aviso público). Novos catálogos
    `candidateRequirements` (requisitos de elegibilidade da NR-5) e `candidatePhotoGuidelines` (recomendações da
    foto 3x4 com fundo branco).
  - **Prazo de candidatura** (`cipaUtils.ts`): helpers `parseFlexibleDate`/`toDisplayDate` (aceitam "dd/mm/aaaa" e
    "aaaa-mm-dd") e `candidacyState`, que retorna a fase (em breve / aberta / encerrada) e os dias restantes.
  - **Ficha de Inscrição** (`CandidateRegistrationModal`): formulário com nome, matrícula, função, área e contato,
    upload da **foto 3x4** (validação de tipo e 5 MB, prévia), o bloco de **recomendações da foto** (fundo branco,
    enquadramento, sem filtros etc.), o bloco de **requisitos de elegibilidade** e a declaração de veracidade.
  - **Mural de aviso público** (`ElectionsTab`): faixa de destaque no topo listando os processos com inscrições
    abertas (dias restantes, prazo, texto do aviso e nº de inscritos) com o botão **Quero me candidatar**; e, em
    cada card de eleição, o estado do prazo (aberta/em breve/encerrada) e o botão **Inscrever candidato**.
  - **Candidatos com foto**: a apuração de cada eleição passa a exibir a **foto** de cada candidato e um atalho para
    editar a ficha de inscrição; os dados de exemplo da eleição da Filial Recife ficaram com inscrições abertas e
    candidatos com foto para demonstração.

### Fase 4.42: Aviso de candidatura no sino e Edital de Convocação automático (CONCLUÍDA)
- Objetivo: avisar no sino do topo quando há um processo eleitoral com inscrições abertas ou perto de encerrar
  (como já ocorre com as atas) e gerar automaticamente o Edital de Convocação em PDF com as informações já
  preenchidas no painel da eleição, anexando-o à lista de Documentos.
- Entregável:
  - **Alertas de candidatura** (`cipaAlerts.ts`): novo tipo de alerta (kind `candidacy`) e helper `candidacyAlerts`,
    que lista os processos com inscrições abertas ordenados pelos mais próximos de encerrar (destaque quando faltam
    até 3 dias). Os `buildCipaAlerts` passaram a receber as eleições, alimentando o **sino do topo** (`AppTopbar`)
    e o painel "CIPA · Atenção necessária" (`CipaAlertsPanel`), com contador de candidaturas no resumo.
  - **Gerador do edital** (`src/pages/app/modules/cipa/editalPdf.ts`): `buildEditalPdfBody` monta o Edital de
    Convocação com identificação do processo, prazo de inscrição, data da votação, eleitores aptos, objeto, regras
    de inscrição, **requisitos de elegibilidade (NR-5)**, **regras da foto 3x4**, relação de inscritos e a
    declaração de veracidade.
  - **Anexo automático em Documentos**: novo tipo "Edital de Convocação da CIPA" no catálogo
    (`src/mocks/documents.ts`), campo `electionId` no `DocumentRecord` e o builder `buildEditalDocument`
    (`documentsStore.ts`, id determinístico `doc-edital-<id>`). O edital é gerado/anexado ao **salvar a eleição**
    quando o processo está recebendo inscrições, e os processos já abertos são semeados ao iniciar o store.
  - **Ação no card da eleição** (`ElectionsTab`): botão **Edital (PDF)** que (re)gera e anexa o edital e abre a
    pré-visualização para impressão/salvamento.

### Fase 4.43: Aviso editável no formulário e Edital de Resultado/Publicação (CONCLUÍDA)
- Objetivo: permitir ao admin personalizar as palavras do Edital de Convocação direto no painel da eleição e gerar
o Edital de Resultado/Publicação após a apuração, anexando a lista de eleitos à lista de Documentos.
- Entregável:
  - **Campo de aviso/edital no formulário** (`ElectionFormModal`): nova área de texto "Aviso / texto do edital de
    convocação" (com contador e texto-padrão sugerido), carregada/gravada em `CipaElection.notice`, usada como
    introdução do Edital de Convocação em PDF e exibida no mural de aviso público.
  - **Gerador do Edital de Resultado** (`editalPdf.buildResultadoEditalPdfBody`): monta o Edital de
    Resultado/Publicação com identificação do processo, resumo da votação (eleitores aptos, votos válidos,
    candidatos e eleitos), a **relação dos eleitos** (por votos) e o **resultado completo da apuração** com a
    situação de cada candidato (eleito/não eleito).
  - **Anexo automático em Documentos**: novo tipo "Edital de Resultado da CIPA" no catálogo
    (`src/mocks/documents.ts`) e o builder `buildResultadoDocument` (`documentsStore.ts`, id determinístico
    `doc-resultado-<id>`). O edital é gerado/anexado ao **salvar a eleição** cujo processo está **Apurada/Publicada**,
    e os processos já concluídos são semeados ao iniciar o store.
  - **Ação no card da eleição** (`ElectionsTab`): botão **Edital de Resultado** que (re)gera e anexa o edital e
    abre a pré-visualização para impressão/salvamento.

### Fase 4.44: Vagas (titulares/suplentes) e carimbo PUBLICADO no Edital de Resultado (CONCLUÍDA)
- Objetivo: informar no painel da eleição quantas vagas de titulares e suplentes existem, para o Edital de Resultado
  classificar automaticamente os eleitos, e aplicar ao topo do edital anexado um carimbo de "PUBLICADO" com a data.
- Entregável:
  - **Campo de vagas** (`CipaElection.titularVacancies` / `suplenteVacancies` e no `ElectionFormModal`): nova linha
    "Vagas de titulares" e "Vagas de suplentes" no formulário da eleição, com orientação de que o Edital de
    Resultado usa esses números para distribuir os eleitos.
  - **Classificação automática** (`cipaUtils.rankCandidates` / `electionSeatLabel`): classifica os candidatos por
    votos em eleitos **titulares** (top N), **suplentes** (próximos M) e **não eleitos**, com fallback ao
    comportamento anterior quando nenhuma vaga é informada.
  - **Edital de Resultado** (`editalPdf.buildResultadoEditalPdfBody`): nova coluna **Situação** com Titular/Suplente
    na relação dos eleitos, situação individual no resultado completo da apuração, resumo com as vagas e texto de
    quantas vagas foram preenchidas por titulares e suplentes.
  - **Carimbo PUBLICADO**: elemento visual "PUBLICADO" com a data no topo do Edital de Resultado (estilos
    `.cover-head`/`.publish-stamp` em `exportPdf.ts`), aplicado tanto na pré-visualização quanto no PDF anexado em
    Documentos.
  - **Reflexo no card da eleição** (`ElectionsTab`): badge com as vagas e etiqueta de Titular/Suplente na apuração
    dos votos, quando as vagas estão configuradas.

### Fase 4.45: Sugestão de vagas pela NR-5, aviso de resultado publicado e Dossiê do Processo Eleitoral (CONCLUÍDA)
- Objetivo: sugerir automaticamente o nº de vagas (titulares/suplentes) pelo dimensionamento da NR-5 conforme a
  quantidade de empregados da comissão, avisar no sino do topo quando o Edital de Resultado é publicado
  (destacando os eleitos) e reunir convocação, ata da comissão, resultado e posse em um único PDF em lote.
- Entregável:
  - **Dimensionamento pela NR-5** (`cipaUtils.nrsDimensioning` / `parseRiskGrade`): tabela do Quadro I
    (faixa de empregados × grau de risco) que retorna os efetivos (titulares) e suplentes por parte, marcando
    quando o porte **dispensa** a constituição de CIPA (trabalhador designado).
  - **Sugestão no formulário** (`ElectionFormModal`): banner "Sugestão pelo Quadro I da NR-5" com a faixa e o grau
    da comissão e o nº sugerido, botão **Aplicar sugestão** e **pré-preenchimento automático** das vagas ao iniciar
    um processo novo enquanto os campos estão vazios.
  - **Aviso de resultado publicado** (`cipaAlerts.publishedResultAlerts`): novo alerta (kind `result`) para os
    processos com situação **Publicada**, destacando os **nomes dos eleitos** (titulares/suplentes) no sino do
    topo (`AppTopbar`) e no painel "CIPA · Atenção necessária" (`CipaAlertsPanel`), com contador de resultados.
  - **Termo de Posse** (`editalPdf.buildPossePdfBody`): documento com a relação dos empossados (titular/suplente),
    o resumo das vagas e o mandato de 1 ano, além dos campos de assinatura de cada eleito.
  - **Dossiê do Processo Eleitoral** (`editalPdf.buildDossierPdfBody`): PDF único com **capa e índice** reunindo o
    Edital de Convocação, a Ata da Comissão Eleitoral, o Edital de Resultado/Publicação e o Termo de Posse, cada qual
    em sua página (quebras via `.batch-page`). A ata relacionada é localizada por `cipaUtils.electionCommitteeAta`.
  - **Anexo em Documentos**: novo tipo "Dossiê do Processo Eleitoral da CIPA" no catálogo (`src/mocks/documents.ts`)
    e o builder `buildDossierDocument` (`documentsStore.ts`, id determinístico `doc-dossie-<id>`), semeado para os
    processos já publicados ao iniciar o store.
  - **Ação no card da eleição** (`ElectionsTab`): botão **Dossiê (PDF)** que (re)gera e anexa o dossiê e abre a
    pré-visualização para impressão/salvamento em lote.

### Fase 4.46: Termo de Posse em Documentos, dossiê na impressão em lote e enquadramento da NR-5 no cadastro da comissão (CONCLUÍDA)
- Objetivo: incluir o Termo de Posse como documento próprio quando a eleição é Publicada, permitir incluir o
  dossiê (com a ata da comissão) na impressão em lote já existente em Documentos e mostrar a sugestão da NR-5
  também no cadastro da comissão, alertando quando a composição está fora do dimensionamento.
- Entregável:
  - **Termo de Posse como documento** (`documentsStore.buildPosseDocument` + tipo "Termo de Posse da CIPA" em
    `src/mocks/documents.ts`): o PDF do Termo de Posse (`editalPdf.buildPossePdfBody`) passa a ser anexado como
    registro próprio (id determinístico `doc-posse-<id>`). É gerado/atualizado ao salvar a eleição em situação
    **Publicada** (`ElectionsTab.handleSave`) e semeado para os processos já publicados ao iniciar o store.
  - **Ação no card da eleição** (`ElectionsTab`): novo botão **Termo de Posse** que (re)gera e anexa o documento e
    abre a pré-visualização para impressão/salvamento.
  - **Dossiê na impressão em lote** (`/app/documentos`): novo botão **Selecionar dossiês da CIPA (N)** ao lado da
    seleção rápida de atas aprovadas; ao imprimir em lote, o dossiê selecionado é regenerado com a **ata da
    comissão atual** (`documentsStore.batchPdfForDocument`, que reconstrói o PDF a partir do processo e das atas
    vigentes), garantindo que o dossiê vá completo para a impressão.
  - **Sugestão da NR-5 no cadastro da comissão** (`CipaFormModal`): banner de **enquadramento no Quadro I da NR-5**
    com a faixa de empregados e o grau de risco, o nº sugerido de titulares/suplentes por parte e a comparação com
    os **representantes dos empregados** lançados na composição — **Conforme** (secundário) ou **Fora do Quadro I**
    (alerta), orientando o ajuste da composição; quando o porte **dispensa** a CIPA, informa que basta um
    trabalhador designado.

### Fase 4.47: Dossiê automático na publicação, selo da NR-5 no card e seleção das peças do dossiê (CONCLUÍDA)
- Objetivo: gerar automaticamente o Dossiê do Processo Eleitoral (anexado em Documentos) quando a eleição é
  publicada, junto com o Termo de Posse; exibir o selo "Conforme / Fora do Quadro I" da NR-5 direto no card de
  cada comissão na lista de CIPA; e permitir escolher quais peças entram no dossiê ao gerá-lo.
- Entregável:
  - **Dossiê automático na publicação** (`ElectionsTab.handleSave`): ao salvar a eleição em situação **Publicada**,
    além do Termo de Posse, o **Dossiê do Processo Eleitoral** é gerado/anexado automaticamente em Documentos,
    já com a ata da comissão localizada (`cipaUtils.electionCommitteeAta`).
  - **Peças selecionáveis do dossiê** (`editalPdf.buildDossierPdfBody` + tipo `DossierParts` em
    `src/mocks/documents.ts`): o dossiê passa a montar o índice e as páginas conforme as peças escolhidas
    (Edital de Convocação, Ata da Comissão Eleitoral, Edital de Resultado/Publicação e Termo de Posse). O
    `DocumentRecord` ganhou `dossierParts` e o `batchPdfForDocument` respeita a seleção salva.
  - **Modal de seleção** (`DossierModal`): ao clicar em **Dossiê (PDF)** no card da eleição, o usuário escolhe
    quais peças entram; a ata mostra a **situação de aprovação** (aprovada / aguardando) e, quando não há ata
    vinculada, a peça fica desabilitada com o aviso "Sem ata vinculada".
  - **Selo da NR-5 no card da comissão** (`CipasTab`): cada card de comissão em CIPA → Comissões passa a exibir o
    selo **NR-5: Conforme / Fora do Quadro I / Dispensa de CIPA**, comparando os representantes dos empregados
    lançados com o nº esperado pelo Quadro I (`cipaUtils.nrsDimensioning`), com dica contextual (faixa, grau e
    ajuste esperado) no título do selo.

### Fase 4.48: Anexos externos no dossiê e Ficha de Cadastro da CIPA em PDF (CONCLUÍDA)
- Objetivo: permitir anexar arquivos externos (ex.: edital assinado em papel) junto às peças automáticas do
  Dossiê do Processo Eleitoral, registrando-os também como documentos vinculados à eleição; e incluir o selo da
  NR-5 na ficha/PDF do cadastro da comissão (além do card).
- Entregável:
  - **Anexos externos no dossiê** (`DossierModal`): nova seção com upload múltiplo de arquivos (PDF, DOCX, XLSX ou
    imagem) e lista com remoção; os anexos acompanham a geração do dossiê.
  - **Registro dos anexos em Documentos** (`documentsStore.buildElectionAttachmentDocument` + tipo "Anexo do
    Processo Eleitoral da CIPA" em `src/mocks/documents.ts`): cada arquivo anexado vira um documento próprio
    vinculado à eleição (`electionId`), com id determinístico por eleição + nome do arquivo (sem duplicar).
  - **Índice de anexos no PDF** (`editalPdf.buildDossierPdfBody` + `DocumentRecord.dossierAttachments`): a capa do
    dossiê passa a listar os **Anexos externos** anexados; o `batchPdfForDocument` mantém a lista ao regenerar o
    dossiê na impressão em lote.
  - **Ficha de Cadastro da CIPA em PDF** (`src/pages/app/modules/cipa/cipaPdf.ts` — `buildCipaFichaPdfBody`):
    documento com identificação do estabelecimento, mandato, o **enquadramento no Quadro I da NR-5** (selo
    **Conforme / Fora do Quadro I / Dispensa de CIPA** com faixa, grau e comparação da composição) e a composição
    completa da comissão, além dos blocos de assinatura.
  - **Botão no cadastro da comissão** (`CipaFormModal`): botão **Gerar PDF** que imprime a ficha da comissão já com
    o selo da NR-5, montada a partir dos dados e da composição informados no formulário.

### Fase 4.49: Pré-visualização visual dos anexos externos no Dossiê (CONCLUÍDA)
- Objetivo: anexar os arquivos externos de forma visual no modal do Dossiê, mostrando a miniatura das imagens
  além do nome do arquivo.
- Entregável:
  - **Miniatura na lista de anexos** (`DossierModal`): cada arquivo de imagem anexado passa a exibir uma
    **pré-visualização** em miniatura (object URL criado na hora) ao lado do nome; arquivos não-imagem
    continuam com o ícone por tipo (PDF/Word/Excel). Cada linha indica "Imagem · clique para ampliar" ou
    "Arquivo anexado".
  - **Ampliar imagem**: clicar na miniatura abre um **popup de pré-visualização** em tamanho maior, com o nome
    do arquivo, dispensável ao clicar fora; os object URLs são liberados ao remover o anexo e ao desmontar.

### Fase 4.50: Arrastar-e-soltar no Dossiê e pré-visualização dos anexos em Documentos (CONCLUÍDA)
- Objetivo: permitir anexar arquivos externos ao Dossiê arrastando-os para a área de anexos e levar a
  pré-visualização das imagens do processo eleitoral também para a tela de Documentos.
- Entregável:
  - **Arrastar-e-soltar no Dossiê** (`DossierModal`): a área de anexos passou a aceitar **arrastar-e-soltar**
    arquivos (além do clique), com realce visual durante o arraste e a mesma validação (PDF, DOCX, XLSX ou imagem).
  - **Pré-visualização persistida** (`DossierAttachment` + `DocumentRecord.previewDataUrl` em
    `src/mocks/documents.ts`): as miniaturas passam a ser geradas como **data URL** (via `FileReader`) em vez de
    object URL, e o `onConfirm` do modal entrega os anexos com a miniatura embutida.
  - **Anexos com miniatura em Documentos** (`documentsStore.buildElectionAttachmentDocument` + `DocumentRecord.previewDataUrl`):
    ao gerar o dossiê, cada arquivo externo vira um documento vinculado à eleição carregando a miniatura da imagem.
  - **Exibição visual em Documentos** (`/app/documentos`): na linha do anexo, a imagem passa a aparecer como
    **miniatura clicável** (com ícone de ampliar no hover) em vez do ícone de arquivo, e um **popup de
    ampliação** abre a imagem em tamanho maior, dispensável ao clicar fora ou no X.

### Fase 4.51: Reordenação dos anexos do Dossiê e miniaturas no card da eleição (CONCLUÍDA)
- Objetivo: permitir definir a ordem em que os anexos externos entram no índice do Dossiê e mostrar as
  miniaturas das imagens anexadas também no card de cada eleição (aba Eleições), não só em Documentos.
- Entregável:
  - **Reordenar anexos** (`DossierModal`): cada anexo externo passou a exibir um **número de ordem** e botões
    **mover para cima / mover para baixo**; a ordem da lista é a ordem em que os arquivos entram no índice de
    anexos do dossiê (`buildDossierPdfBody`), e os botões ficam desabilitados nas extremidades.
  - **Miniaturas no card da eleição** (`ElectionsTab`): cada card de eleição passou a exibir a seção
    **Anexos externos (N)**, lendo do store de Documentos os anexos vinculados àquela eleição; imagens aparecem
    como **miniatura clicável** (com ampliação em popup) e arquivos não-imagem com o ícone por tipo.

### Fase 4.52: Processo eleitoral da CIPA — Fase 1 (persistência + máquina de estados + cronograma NR-5 + comunicação ao sindicato) (EM ANDAMENTO)
- Objetivo: iniciar a transformação da eleição da CIPA em processo eleitoral completo e auditável, com persistência no Supabase (base para as fases seguintes: base de eleitores separada do voto, urna anônima, apuração e integridade).
- Entregável desta etapa (concluída):
  - **Tabelas no Supabase** (RLS habilitado): `cipa_elections` (registro do processo: status, responsável, estabelecimento, exercício/mandato, dimensionamento), `cipa_election_schedule` (cronograma com prazos e comprovação), `cipa_election_committee` (integrantes da comissão eleitoral), `cipa_election_communications` (comunicações e comprovantes, ex.: comunicação ao sindicato) e `cipa_election_events` (trilha de auditoria **append-only** — sem UPDATE/DELETE).
  - **Domínio do processo** (`electionProcess.ts`): máquina de estados com 10 fases (Planejamento → Convocação → Inscrições → Candidaturas encerradas → Eleição programada → Votação aberta → Apuração → Resultado → Posse → Processo concluído), fluxo sequencial com **bloqueio de avanço** quando há marco obrigatório pendente ou prazo vencido; cronograma com os marcos da NR-5 e cálculo de situação **Prazo atendido / Prazo próximo / Prazo vencido / Não aplicável** (nunca marca “atendido” sem etapa cumprida/comprovada).
  - **Store persistente** (`electionProcessStore.ts`): carrega e grava por `company_ref` + `election_ref`, garantindo o processo e o cronograma ao abrir, registrando cada alteração na auditoria.
  - **Painel do Processo Eleitoral** (`ElectionProcessModal`): abas Fase & mandato, Cronograma NR-5, Comissão Eleitoral, Comunicações e Auditoria; botão **Processo eleitoral** no card de cada eleição (aba Eleições) e badge da fase atual no card.
- **Nota de adequação legal:** o sistema não embute prazos numéricos da NR-5 como verdade normativa; as datas/antecedências são informadas e conferidas pela empresa/comissão e os itens que dependem de interpretação da norma devem ser validados por responsável humano.

### Fase 4.53: Processo eleitoral da CIPA — Fase 2 (base de eleitores, urna anônima e votação secreta) (NÃO INICIADA)
- Objetivo: implementar **urna eletrônica real** no Supabase, com separação técnica absoluta entre participação (eleitor) e voto (anônimo), RLS restritiva e Edge Function transacional de votação; apuração, quórum e evidências de integridade nas etapas seguintes.
- Ordem prevista: base de eleitores e participação → urna anônima (sem vínculo eleitor×voto) → Edge Function transacional (concorrência/atômica) → RLS e segurança → interface de votação secreta + protocolo de participação → encerramento/quórum/apuração → protocolo e integridade (hash da urna) → testes de segurança/sigilo → relatório técnico.

### Fase 4.54: Processo eleitoral da CIPA — Fase 2 (base eleitoral, versionamento, fechamento e participação) (CONCLUÍDA)
- Objetivo: criar uma base eleitoral persistente no Supabase que defina com segurança quem participa de cada processo, preservando histórico/versões e preparando a arquitetura para a futura urna secreta — **sem qualquer vínculo correlacionável entre eleitor e voto**.
- Entregável:
  - **Tabelas no Supabase** (RLS habilitado): `cipa_voter_rolls` (versões/snapshots da base: Em preparação / Fechada, totais, responsável, data/hora e hash de integridade), `cipa_voter_entries` (eleitores de cada versão, com elegibilidade apto/inapto e justificativa) e `cipa_voter_participation` (**CONTROLE DE PARTICIPAÇÃO**: não votou / votou — **sem** candidato, voto, hash de voto ou qualquer id que relacione eleitor ao voto).
  - **Isolamento e integridade no banco**: gatilho `cipa_voter_entry_guard` bloqueia incluir/alterar/excluir eleitor quando a versão está **fechada** (garantia no banco, não só na tela); gatilho `cipa_participation_guard` torna o registro de participação imutável (não permite trocar a identidade do eleitor nem reverter votou→não votou) e a RLS **não concede DELETE** na participação.
  - **Unicidade de participação**: `UNIQUE (company_ref, election_ref, collaborator_ref)` na tabela de participação — pré-requisito para a urna garantir **um voto por eleitor** mesmo em requisições simultâneas.
  - **Store persistente** (`voterRollStore.ts`): carrega/grava por `company_ref` + `election_ref`, importa colaboradores do cadastro principal (`company_collaborators`, sem duplicar CPF), calcula o **SHA-256 de integridade** da base, gera **nova versão** e trata a **correção excepcional** de base fechada (nova versão + justificativa).
  - **Tela “Base eleitoral”** (`VoterRollModal`, botão no card de cada eleição): cabeçalho (processo, estabelecimento, versão, status, aptos, inaptos, última atualização), ações **Importar/Adicionar eleitores**, **Validar base**, **Gerar nova versão** e **Fechar base eleitoral**; histórico de versões com hash; lista de eleitores com elegibilidade (apto/inapto + justificativa) e aba de **Auditoria** (reutilizando `cipa_election_events`).
  - **Reaproveitamento**: a auditoria usa a trilha append-only já criada na Fase 1; nada de tabelas/CIPAs duplicadas.
- **Nota de adequação legal/pendências**: (a) o cadastro `company_collaborators` passou a ter **campo de estabelecimento** na Fase 4.55, permitindo a segregação da base eleitoral por estabelecimento; (b) os prazos da NR-5 permanecem informados pela empresa/comissão; (c) a urna anônima e a Edge Function transacional são a **Fase 3** (não implementadas nesta etapa).

### Fase 4.55: Estabelecimento no cadastro de colaboradores e segregação da base eleitoral (CONCLUÍDA)
- Objetivo: adicionar o **estabelecimento/estrutura** ao cadastro de colaboradores, migrar a base existente e usar esse vínculo para **segregar a base eleitoral da CIPA por estabelecimento** — e conectar a tela de Colaboradores ao cadastro real (Supabase), antes que era demonstração em memória.
- Entregável:
  - **Migração no Supabase** (sem apagar dados): novas colunas em `company_collaborators` (`establishment`, `rg`, `pis`, `ctps`, `admission_date`, `birth_date`, `phone`, `email`, `city`, `status`, `manager_ref`, `photo_url`, `documents_ok`, `documents_total`, `trainings_active`, `trainings_expired`, `epis_in_use`), com **policies de SELECT/INSERT/UPDATE/DELETE** e índice por `(company_id, establishment)`. Os **12 colaboradores existentes** foram migrados para **Unidade Matriz — São Bernardo do Campo** (padrão decidido) e tiveram os dados cadastrais preenchidos a partir da base atual.
  - **Cadastro real** (`collaboratorsStore.ts`): store persistente em Supabase (por empresa resolvida pelo subdomínio), com load/CRUD/importação; o `id` do app continua sendo o `ref` (c-001…), preservando os vínculos de gestor/líder, EPI, assinaturas e QR-Codes.
  - **Tela de Colaboradores** (`/app/colaboradores`): passou a ler/gravar no **cadastro real** — filtro por **estabelecimento**, coluna e selo de estabelecimento na lista, campo no **formulário** (nova seção “Estabelecimento / Unidade”), seleção do estabelecimento de destino na **importação .xlsx**, estabelecimento na **ficha do colaborador** e estados de carregamento/erro com “Tentar novamente”.
  - **Segregação na CIPA**: a **Base eleitoral** (`VoterRollModal`) só oferece os colaboradores do **estabelecimento da eleição** (importação filtrada), exibindo quantos ficam de fora por pertencer a outro estabelecimento — reaproveitando o campo `establishment` trazido pelo `voterRollStore`.
  - **Estabelecimentos** disponíveis: as unidades já existentes na CIPA (Unidade Matriz — São Bernardo do Campo, Filial Campinas, Filial Recife), definidas em `collaboratorEstablishments`.

### Fase 4.56: Migração de EPI, DDS e Assinaturas para o cadastro real de colaboradores (CONCLUÍDA)
- Objetivo: eliminar o uso do cadastro de demonstração (mock) nos módulos EPI, DDS e Assinaturas, passando todos a ler o **cadastro real** de colaboradores (Supabase, tabela `company_collaborators`) já conectado na Fase 4.55.
- Entregável:
  - **Atalho reutilizável** (`collaboratorsStore.useCollaboratorsList`): hook que resolve a empresa pela sessão (`subdomain`) e devolve a lista de colaboradores do cadastro real, evitando repetição de código nos módulos.
  - **EPI** (`EpiDeliveryModal`): a seleção de colaborador da nova entrega passa a vir do cadastro real.
  - **DDS** (`DdsFormModal` e `DdsDetailModal`): a seleção de participantes e a resolução de função dos participantes passam a usar o cadastro real.
  - **Assinaturas** (`DocumentDraftModal`): a escolha de signatários passa a ler o cadastro real.
  - **Escopo preservado**: os demais módulos que ainda usam a lista de demonstração (APR, Documentos/Ficha de Presença, QR-Codes, dashboards, entre outros) permanecem intactos; a migração foi restrita aos três módulos solicitados, sem quebrar funcionalidades existentes.
- **Pendência honesta**: os módulos EPI, DDS e Assinaturas ainda mantêm seus **próprios dados operacionais** em memória (demonstração); esta etapa migrou apenas a **fonte do cadastro de colaboradores** para o registro real.

### Fase 4.57: Cadastro real no APR/Documentos e persistência operacional de EPI e DDS (CONCLUÍDA)
- Objetivo: concluir a migração do cadastro de demonstração para o **cadastro real** de colaboradores nas telas que ainda usavam mocks (APR e Ficha de Presença/Documentos) e levar os **dados operacionais** de EPI (entregas) e DDS (registros) para **persistência no Supabase**.
- Entregável:
  - **APR** (`AprFormModal`): executantes passam a ser selecionados do **cadastro real** (`useCollaboratorsList`), com as dependências reativas ajustadas para o carregamento assíncrono.
  - **Documentos** (`AttendanceSheetModal`, `InspectedCollaboratorsField`, `NewDocumentModal`, `UploadDocumentModal`): participantes, vistoriados e vínculo de documentos passam a ler o **cadastro real** de colaboradores.
  - **Tabelas no Supabase** (RLS habilitado + índice por `company_ref`): `epi_deliveries` (entregas: colaborador, itens com CA/quantidade em `jsonb`, motivo, foto, assinatura e status) e `dds_records` (registros: título, data/hora, tema, treinamento, facilitador, setor, local, duração, participantes, tópicos, notas, situação, capa e fotos). Dados atuais **semeados** (7 entregas de EPI e 6 DDS).
  - **Store de EPI persistente** (`epiStore.ts`): reescrito para o Supabase mantendo a **mesma API** (`useEpis`, `getEpis`, `addEpiDelivery`, `signEpiDelivery`) — página do módulo, portal do Colaborador, dashboards e topbar seguem funcionando; a assinatura do aceite atualiza o registro e gera o documento.
  - **Store de DDS persistente** (`ddsStore.ts`, novo): `useDds` / `addDds` / `removeDds`; a página `/app/dds` deixou de usar estado local e o dashboard do Administrador passou a ler os DDS do store.
  - **Fotos do DDS** (`DdsFormModal`): passam a ser gravadas como **data URL** (antes eram object URLs temporários), permitindo persistir e reexibir após recarregar.
- **Pendência honesta**: os dados operacionais de **APR** e da **Ficha de Presença** continuam em memória (a migração desta etapa cobriu o cadastro de executantes/participantes e a persistência de EPI e DDS).

### Fase 4.58: Persistência operacional de APR e das Fichas de Presença (CONCLUÍDA)
- Objetivo: levar os **dados operacionais** de **APR** (análises, riscos e aceites) e das **Fichas de Presença** para **persistência no Supabase**, encerrando a pendência deixada pela Fase 4.57 e tornando os módulos totalmente persistentes.
- Entregável:
  - **Tabelas no Supabase** (RLS habilitado + índices por `company_ref`/`company_id`): `apr_records` (ref, título, atividade, setor, local, data, responsável, `risks` em `jsonb`, `signatures` em `jsonb`, observações e situação) e `attendance_sheets` (ref, título, facilitador + documento/assinatura, data, local, `participants` em `jsonb`, contadores de participantes/assinaturas). As **4 APRs atuais** foram semeadas com seus riscos e executantes.
  - **Store de APR persistente** (`aprStore.ts`): reescrito para o Supabase **mantendo a mesma API** (`useAprs`, `getAprs`, `subscribeAprs`, `addApr`, `signApr`), além de `removeApr`. A conclusão da APR quando todos os executantes assinam continua gerando o registro em Documentos. Consumidores (página `/app/apr`, dashboard do Administrador, portal do Colaborador, Central de Alertas e sino do topo) seguem funcionando sem alteração.
  - **Store das Fichas de Presença** (`attendanceStore.ts`, novo): persiste o conteúdo operacional da ficha e move para ele o gerador do corpo do PDF (`buildAttendancePdfBody`) e o builder do documento (`buildAttendanceDocument`, com o PDF anexado). Ao carregar, reconstrói os registros correspondentes em Documentos (idempotente por id), de modo que as fichas continuem disponíveis após recarregar a página.
  - **Ficha de Presença** (`AttendanceSheetModal` + `/app/documentos`): o modal passou a entregar a ficha completa (`onSave`) em vez de só o registro resumido; a página persiste a ficha, atualiza a lista de Documentos e exibe o aviso de sucesso/erro.

### Fase 4.59: Documentos persistidos, filtro por unidade na APR e persistência das inspeções (CONCLUÍDA)
- Objetivo: levar a **lista de Documentos** para persistência no Supabase com store compartilhado, dar **filtro por estabelecimento/unidade** à APR (tela e relatório mensal) e persistir os dados operacionais das **inspeções da CIPA**, da **Inspeção de Campo (Documentos)** e do **Dossiê do processo eleitoral**.
- Entregável:
  - **Tabela `documents`** (RLS habilitado + único `(company_ref, ref)` + índice por `company_ref`): guarda todos os campos do `DocumentRecord`, incluindo `attached_pdf_html`, `preview_data_url`, `dossier_parts`/`dossier_attachments`, vínculos (`ata_id`, `election_id`) e situação de aprovação.
  - **Store de Documentos persistente** (`documentsStore.ts`, reescrito): mantém a **mesma API** (`useDocuments`, `getDocuments`, `addDocument`, `addDocuments`, `removeDocument`, `batchPdfForDocument` e os builders `buildAprDocument`/`buildEpiDocument`/`buildAtaDocument`/`buildEditalDocument`/`buildResultadoDocument`/`buildPosseDocument`/`buildDossierDocument`/`buildElectionAttachmentDocument`). As gravações atualizam o estado local na hora (otimista) e persistem em segundo plano; quando a tabela está vazia, os dados atuais (base inicial + atas/editais/resultados/posse/dossiê da CIPA) são **semeados** automaticamente.
  - **Unidade na APR** (`src/mocks/apr.ts` + `aprStore.ts` + `AprFormModal`): a análise ganhou o campo **Unidade / Estabelecimento** (sugerido a partir do cadastro real de colaboradores), persistido na coluna `establishment` de `apr_records` (as 4 APRs existentes foram preenchidas).
  - **Filtro por unidade na APR** (`/app/apr` + `AprMonthlyReportModal`): novo seletor “Todas as unidades” na tela (com a unidade exibida junto ao setor e incluída no PDF/CSV) e também no relatório mensal (que destaca a unidade no consolidado exportado).
  - **Tabela `cipa_inspections`** (RLS + único + índice) e **store persistente** (`cipaInspectionsStore.ts`): a API das inspeções (`useInspections`/`addInspection`) é **reexportada pelo `cipaStore`**, então a aba Inspeções, a visão geral e os alertas seguem sem alteração, agora salvando de verdade.
  - **Tabela `field_inspections`** (RLS + único + índice) e **store persistente** (`fieldInspectionStore.ts`): guarda a inspeção operacional completa (identificação, checklist, não conformidades, ação, vistoriados e fotos) e reconstrói o registro em Documentos **com o PDF da inspeção anexado**. O `FieldInspectionModal` passou a entregar a inspeção completa (`onSave`) e a página de Documentos a persisti-la.
  - **Dossiê do processo eleitoral** persistido via o store de Documentos (o registro do dossiê e seus anexos externos agora ficam salvos). O `DossierModal` passou a **pré-preencher** as peças/ anexos com a última seleção persistida da eleição ao ser reaberto.
- **Nota honesta**: o `cipaStore` continua em memória para comissões, agenda, atas, ações e eleições (modo demonstração); esta etapa persistiu **Documentos**, **Inspeções da CIPA**, **Inspeção de Campo** e o **Dossiê**, além do filtro de unidade na APR.

### Fase 4.60: CIPA persistida, unidade no EPI/DDS e uploads no Storage (CONCLUÍDA)
- Objetivo: encerrar a pendência da Fase 4.59 persistindo o **núcleo da CIPA**, levar o **Estabelecimento/Unidade** também para **EPI e DDS** (tela e relatórios) e migrar os **uploads de arquivos de Documentos** para o **Storage privado** (guardando o arquivo real, não só os metadados).
- Entregável:
  - **Tabelas no Supabase** (RLS habilitado + único `(company_ref, ref)` + índice por `company_ref`): `cipa_committees`, `cipa_meetings`, `cipa_minutes` e `cipa_actions`.
  - **Store persistente da CIPA** (`cipaCoreStore.ts`, novo) para comissões, agenda, atas e plano de ações, e o `cipaStore.ts` reescrito como **fachada**: reexporta o núcleo persistente e o store de inspeções, mantendo **a mesma API** (`useCipas`/`getCipas`, `useMeetings`, `useAtas`, `useActions` e os `add*/update*`) para que página, visão geral, alertas, topbar e Documentos seguissem sem alteração. Quando as tabelas estão vazias, os dados atuais são **semeados** automaticamente. Os **processos eleitorais** (composição/candidatos/votos) seguem em memória nesta etapa.
  - **Unidade no EPI**: coluna `establishment` em `epi_deliveries`, preenchida automaticamente pela unidade do colaborador selecionado; exibida na lista e usada no **filtro por unidade** da tela e do **relatório mensal** (com a unidade no detalhe e no PDF/CSV).
  - **Unidade no DDS**: coluna `establishment` em `dds_records`, derivada automaticamente da unidade predominante dos **participantes**; com **filtro por unidade** na tela e no **relatório mensal**. As entregas de EPI e os registros de DDS já existentes foram **preenchidos** com a unidade a partir do cadastro.
  - **Uploads no Storage** (`documentsStore` + `UploadDocumentModal`): o bucket privado `documents` guarda o **arquivo real** enviado (colunas `storage_path`/`file_url` em `documents`); o modal agora envia cada arquivo (com estado “Enviando…”) e a tela de Documentos gera o **link assinado** (temporário) na hora para visualizar/baixar. Imagens também geram miniatura para a pré-visualização.
- **Nota honesta**: os **processos eleitorais** da CIPA (composição, candidatos e votos) ainda rodam em memória; a governança do processo segue persistida pelo `electionProcessStore`. Esta etapa cobriu o núcleo da CIPA, a unidade em EPI/DDS e os uploads no Storage.

### Fase 4.61: Unidade nas inspeções (CIPA e Inspeção de Campo) e anexo real no "Novo documento" (CONCLUÍDA)
- Objetivo: levar o **Estabelecimento/Unidade** também para os **relatórios de inspeções** (Inspeções da CIPA e Inspeção de Campo), com **filtro por unidade**, e permitir **anexar o arquivo real** também no **"Novo documento"** (que antes só guardava o nome do arquivo) — hoje só o "Enviar arquivos" salvava no Storage.
- Entregável:
  - **Unidade nas inspeções** (banco): nova coluna `establishment` em `cipa_inspections` e em `field_inspections` (as tabelas estavam vazias; sem backfill necessário).
  - **Inspeção da CIPA** (`src/mocks/cipa.ts` + `cipaInspectionsStore.ts` + `CipaInspectionModal` + `InspectionsTab`): a inspeção ganhou o campo **Unidade / Estabelecimento** (sugerido pelas unidades cadastradas), exibido no card, incluído no **PDF** e usado no novo **filtro "Todas as unidades"** da aba Inspeções.
  - **Inspeção de Campo** (`fieldInspectionStore.ts` + `FieldInspectionModal`): a inspeção ganhou o campo **Unidade / Estabelecimento**, persistido, exibido no card e incluído no **PDF**.
  - **Lista/relatório próprio das Inspeções de Campo** (`FieldInspectionReportModal`, novo): novo modal aberto pelo botão **Inspeção de campo** em Documentos, com **filtro por unidade**, busca, KPIs (inspeções, não conformidades, vistoriados e fotos), lista expansível (checklist, ação corretiva e fotos), **Exportar PDF/CSV**, **remoção** (remove também o documento correspondente) e o botão **Nova inspeção** que abre o formulário — a geração do documento passa a acontecer a partir do relatório.
  - **Anexo real no "Novo documento"** (`NewDocumentModal`): passou a enviar o arquivo para o **bucket privado `documents`** (reaproveitando `uploadDocumentFile`), guardando `storagePath`/`fileUrl`, tamanho real e tipo do arquivo, com miniatura para imagens, validação de 25 MB e estado "Enviando…" — a visualização/baixa usa o **link assinado** já usado pelos uploads.
- **Nota honesta**: as tabelas `cipa_inspections` e `field_inspections` estavam vazias no momento da migração (nada a converter); a unidade das novas inspeções é escolhida no formulário a partir das unidades cadastradas.

### Fase 4.62: Filtro por unidade em Documentos, exportação em lote das inspeções e unidade no cadastro em lote e nas Fichas de Presença (CONCLUÍDA)
- Objetivo: segmentar **toda a conformidade documental por estabelecimento**, permitir **baixar todas as Inspeções de Campo em um único PDF**, trazer a **Unidade** para o **cadastro de colaboradores em lote** (por linha da planilha) e para as **Fichas de Presença** geradas em Documentos.
- Entregável:
  - **Banco**: novas colunas `establishment` em `documents` e `attendance_sheets`. O cadastro `company_collaborators` já possuía `establishment` (Fase 4.55).
  - **Modelo de Documento** (`src/mocks/documents.ts` + `documentsStore.ts`): o `DocumentRecord` ganhou o campo `establishment` (persistido em `mapRow`/`toRow`). Os builders passaram a carregar a unidade quando ela existe: `buildFieldInspectionDocument` (unidade da inspeção), `buildAttendanceDocument` (unidade da ficha) e `buildEpiDocument` (unidade do colaborador da entrega).
  - **Filtro por unidade em Documentos** (`/app/documentos`): novo seletor **“Todas as unidades”** no topo da lista. A unidade efetiva de cada documento é a **unidade própria** (inspeções, fichas, EPI) ou, para documentos **de colaborador**, a unidade do **cadastro real**; documentos **sem unidade** são tratados como **corporativos** e aparecem em **qualquer** filtro (PCMSO, PGR, LTCAT etc.). A unidade entra como **coluna** na tabela (com o selo “Corporativo” quando não houver), na **exportação PDF/CSV** e nos botões de **limpar filtros**.
  - **Exportação em lote das Inspeções de Campo** (`FieldInspectionReportModal`): novo botão **“Exportar lote (PDF único)”** que reúne todas as inspeções **filtradas** (ex.: por unidade) em um **único PDF**, cada uma em sua página (classe `.batch-page`), desabilitado quando não há registros.
  - **Cadastro de colaboradores em lote** (`ImportCollaboratorsModal`): a unidade passou a ser **por linha da planilha** (coluna “Estabelecimento”) em vez de um único destino para todos; cada colaborador identificado pode ter sua unidade ajustada antes de importar.
  - **Fichas de Presença** (`attendanceStore.ts` + `AttendanceSheetModal`): a ficha ganhou o campo **Unidade / Estabelecimento** (persistido em `attendance_sheets`, exibido no PDF e carregado no documento gerado), **sugerido automaticamente** pela **unidade predominante dos participantes** vinculados ao cadastro, com possibilidade de ajuste manual.
- **Nota honesta**: a unidade de documentos de colaborador é derivada em tempo real do **cadastro** (não duplicada no documento); por isso, se a unidade do colaborador mudar no cadastro, o filtro dos documentos dele acompanha automaticamente.

### Fase 4.63: Filtro por unidade no dashboard de conformidade e capa de resumo por unidade no PDF em lote das inspeções (CONCLUÍDA)
- Objetivo: levar o **filtro por unidade/estabelecimento** aos **dashboards de conformidade** (KPIs e painéis do Administrador) e abrir o **PDF em lote das Inspeções de Campo** com uma **capa de resumo por unidade** (totais por estabelecimento antes das páginas individuais).
- Entregável:
  - **Filtro por unidade no dashboard do Administrador** (`AdminDashboard.tsx`): novo seletor **“Todas as unidades”** ao lado do período, que refiltra de uma só vez os **KPIs do topo** e os **painéis de DDS, APR, EPI e Documentos**. As fontes são filtradas por `establishment` (APR/EPI/DDS) e, em Documentos, pela mesma regra da tela de Documentos — **unidade própria** (inspeções/fichas/EPI) ou, para documentos de colaborador, a **unidade do cadastro real**; documentos **sem unidade** (corporativos) aparecem em **qualquer** filtro. A **contagem de colaboradores ativos** passa a considerar o cadastro real por unidade.
  - **Listas ligadas a colaborador**: as tabelas “Documentos a vencer”, “Entregas de EPI recentes” e “EPI a vencer · validade por CA” também acompanham o filtro por unidade (resolvendo a unidade pelo cadastro do colaborador), com **estados vazios** dedicados quando a unidade não tem registros.
  - **Resumo exportado**: o PDF do **“Exportar resumo”** passa a indicar no cabeçalho/legenda a **unidade selecionada** (ou “Todas as unidades”).
  - **Capa de resumo por unidade no PDF em lote** (`FieldInspectionReportModal`): o botão **“Exportar lote (PDF único)”** passa a abrir o documento com uma **capa** (“Resumo por unidade”) contendo os **totais consolidados por estabelecimento** (inspeções, não conformidades, vistoriados e fotos), além dos KPIs gerais e de uma nota de contexto — antes das páginas individuais de cada inspeção. Reaproveita os estilos de capa (`.cover`) já existentes em `exportPdf.ts`.
- **Nota honesta**: o filtro por unidade cobre os painéis de conformidade operacional (KPIs, DDS, APR, EPI, Documentos e listas de colaborador); os blocos **gerais de clima/função** (pesquisa de clima e distribuição por função) continuam como visões corporativas do painel.

### Fase 4.64: Unidade no cabeçalho dos PDFs em lote (Documentos e Atas) (CONCLUÍDA)
- Objetivo: incluir a **unidade/estabelecimento** no **cabeçalho dos PDFs em lote** (tela de Documentos e o lote de atas, que é o mesmo fluxo quando se selecionam as atas aprovadas) para **rastreabilidade por estabelecimento**.
- Entregável:
  - **Capa de resumo por unidade no lote de Documentos** (`/app/documentos` → `Imprimir em lote`): o documento em lote passa a abrir com uma **capa** (“Resumo por unidade”) contendo os **totais por estabelecimento** (documentos por unidade), o total de documentos do lote, o número de unidades envolvidas e a contagem de **documentos corporativos**, além da unidade selecionada no filtro e da nota de contexto — antes das páginas individuais de cada documento. Reaproveita os estilos de capa (`.cover`) já existentes em `exportPdf.ts`, no mesmo padrão da capa do lote de Inspeções de Campo.
  - **Unidade no cabeçalho da ata** (`ataPdf.buildAtaPdfBody`): o corpo do PDF da ata ganhou o parâmetro opcional `cipaUnit` e passa a exibir **“Unidade: …”** no bloco de identificação (Data / CIPA / Unidade). A unidade é obtida da **comissão (CIPA) de origem** da ata e repassada pelos chamadores (`AtasTab.exportAta`/`handleAddAta`/`persistAta` e `documentsStore.buildAtaDocument`).
  - **Regeneração no lote** (`documentsStore.batchPdfForDocument`): ao imprimir em lote, o PDF da ata é **regenerado** a partir da ata atual e da unidade da comissão de origem (`getAtas`/`getCipas`), garantindo a unidade no cabeçalho mesmo em registros salvos antes desta fase.
- **Decisão de escopo**: por escolha do usuário, a **ata permanece corporativa** para efeito do **filtro de Documentos** (não muda a regra de unidade corporativa); a unidade da comissão aparece **apenas no cabeçalho/PDF da ata**.

### Fase 4.65: Processo eleitoral da CIPA — Fase 3 (urna eletrônica, voto secreto por CPF e termo jurídico) (CONCLUÍDA)
- Objetivo: implementar a **urna eletrônica** do processo eleitoral da CIPA — janela de votação com hora de início/fim, votação pública identificada por CPF com aceite de termo jurídico, cédula **secreta** (sem vínculo eleitor×voto), controle de **um voto por CPF**, avisos de votação encerrada, apuração confidencial, relatório de ausentes e composição da CIPA após o pleito.
- Entregável:
  - **Janela de votação** (`src/mocks/cipa.ts` + `ElectionFormModal`): a eleição ganhou **Hora de início** e **Hora de encerramento da votação** (além da Data da votação) e o campo **estabelecimento** (herdado da comissão). O utilitário `electionWindowIso` (`cipaUtils.ts`) combina data + horários na janela efetiva.
  - **Banco (urnas)**: tabelas `cipa_ballot_config` (janela, termo, token público, status, hash de integridade), `cipa_ballot_candidates` (cédula), `cipa_ballots` (**cédula anônima — sem eleitor**) e `cipa_ballot_term_acceptances` (aceite do termo com IP/user-agent), com RLS (leitura liberada; escrita das cédulas apenas pelo servidor). RPC transacional `cipa_cast_ballot` grava a cédula anônima e marca a participação num único ato, com trava (`FOR UPDATE`) que garante **um voto por CPF** — sem qualquer vínculo entre eleitor e voto.
  - **Termo jurídico** (`voteTerms.ts`, versionado): texto de ciência e concordância (identificação, sigilo do voto, um voto por eleitor, janela, LGPD, veracidade), registrado com versão, data/hora e identificação, sem vínculo com a cédula.
  - **Edge function `cipa-vote`** (pública, `verify_jwt: false`, service role): ações `get_ballot`, `identify` (CPF na base eleitoral — com fallback para o cadastro ativo do estabelecimento quando não há base fechada), `accept_term`, `cast_vote` (voto anônimo transacional + e-mail de confirmação) e `send_invites` (convites ao pleito).
  - **Página pública `/votacao/:token`**: identificação por CPF (com máscara) + leitura e aceite do termo; tela de votação com candidatos, **confirmação expandida** e os botões **Branco / Corrigir / Votar**; comprovante com nome da eleição, comissão/local, data/hora de encerramento e protocolo; telas de **votação encerrada**, **já votou**, link não encontrado e erro.
  - **Painel admin da urna** (`ElectionVotingModal`, botão **Urna / Votação** no card da eleição): publicar/atualizar a urna, **abrir a votação e disparar os convites**, reenviar convites, copiar o **link público**, **encerrar a votação** (grava hash SHA-256 de integridade), **apuração confidencial** (contagens por candidato + brancos, sem mostrar quem votou em quem) e **relatório de ausentes** (quem não compareceu) em **PDF/CSV**.
  - **Composição da CIPA** (`ElectionCompositionModal`, botão **Compor CIPA**): após o encerramento, permite adicionar as pessoas indicadas para compor o novo mandato (com atalho para **adicionar os eleitos** da apuração) e grava a composição na própria comissão (`cipa_committees.members`).
- **Nota honesta**: (a) o disparo do link por e-mail e o e-mail de confirmação do voto dependem do **Resend** configurado; o código já está pronto e envia assim que as chaves `RESEND_API_KEY`/`RESEND_FROM_DOMAIN` existirem — até lá, o painel informa que o envio está desativado e oferece o **link para compartilhar**; (b) o disparo é feito ao **abrir a votação** (e no botão "Reenviar convites"); um envio automático "no dia" dependeria de um agendador (cron), não incluído nesta etapa; (c) o sigilo usa a separação técnica consagrada (participação × cédula anônima em tabelas distintas e sem vínculo).

### Fase 4.66: Fechamento do pleito da CIPA — BU, indicações, aceite final e inviolabilidade (CONCLUÍDA)
- Objetivo: concluir o processo eleitoral da CIPA com a **apuração formal (Boletim de Urna)**, a **indicação da empresa** (antes, durante ou após a votação), o **aceite final do administrador** e a **inviolabilidade** da urna, das indicações e dos documentos do pleito após o encerramento.
- Entregável:
  - **Indicações da empresa** (banco `cipa_mandate_indications` + painel): registram os representantes do empregador a qualquer momento do processo; ao **confirmar**, entram na composição da comissão (`cipa_committees.members`) junto com os eleitos.
  - **Boletim de Urna (BU)** (`ballotPdf.buildBuPdfBody` + `ballotResult.buildBuData`): apuração completa com **eleitos e não eleitos**, votos por candidato, **habilitados**, **votantes**, **ausentes** e brancos, além do hash de integridade da urna — sem qualquer vínculo entre eleitor e voto.
  - **Ata de Resultado Final** (`ballotPdf.buildResultFinalAtaPdfBody`): registro formal do resultado, com o resultado declarado e a relação dos eleitos.
  - **Relatório de comparecimento** (`ballotPdf.buildAttendanceReportPdfBody`): habilitados × votantes × **lista de quem não compareceu** ao pleito.
  - **Fichas de cadastro de candidatos** (`ballotPdf.buildCandidateFichaPdfBody`): uma ficha por candidato, com foto 3x4, dados e requisitos de elegibilidade.
  - **Painel do pleito por abas** (`ElectionVotingModal`): **Urna** (publicar/abrir/encerrar/link/ausentes), **Resultado (BU)**, **Indicações da empresa**, **Encerramento** (aceite final) e **Documentos do pleito**.
  - **Encerramento / aceite final** (`FinalizationPanel` + `finalizeVoting`): gera os documentos finais (BU, ata e comparecimento) e grava o encerramento no processo (`finalized_at`/`finalized_by`/`final_hash`/`bu_snapshot`), com evento na auditoria.
  - **Inviolabilidade no banco**: gatilhos bloqueiam alterar/excluir a urna (`cipa_ballot_config`/`cipa_ballot_candidates`/`cipa_ballots`), as indicações (`cipa_mandate_indications`), o próprio processo (`cipa_elections`) e os documentos do pleito (`documents` com `election_id`) após o aceite final. Na interface, as ações de edição ficam bloqueadas e o card da eleição exibe o selo **Encerrado**.
  - **Documentos do pleito no módulo** (`PleitoDocumentsPanel`): mostra o **período vigente da CIPA** e reúne/regenera todas as peças do processo (edital de convocação, edital de resultado, BU, ata de resultado final, relatório de comparecimento, termo de posse, dossiê e fichas de candidato), com os registros anexados em Documentos.
- **Nota honesta**: os registros **eleitorais** de composição/candidatos da eleição (a base de exibição) continuam no modo demonstração em memória; a **urna**, a **base eleitoral**, a **participação**, as **indicações** e o **encerramento** são persistidos no Supabase e são o que fica **inviolável** no banco. O disparo por e-mail segue dependente do Resend configurado.

### Fase 4.67: Arquivo de eleições encerradas e relatório consolidado da CIPA por unidade (CONCLUÍDA)
- Objetivo: criar o **painel de eleições encerradas** com os dossiês preservados e **download em lote dos pleitos concluídos**, e o **relatório consolidado de CIPA por unidade** (período vigente, eleitos, indicações e composição final).
- Entregável:
  - **Sub-abas na aba Eleições** (`ElectionsTab`): a aba passou a ter três visões — **Processos** (a lista já existente), **Eleições encerradas** e **Relatório por unidade**.
  - **Painel “Eleições encerradas”** (`ClosedElectionsPanel`): lista os processos com **aceite final** registrado (invioláveis), com KPIs (habilitados, votaram, eleitos, ausentes), o **hash de integridade** e o botão **Ver dossiês preservados** (documentos vinculados à eleição, abertos em PDF). Seleção múltipla com **Baixar em lote**, gerando um **PDF único** com o **dossiê completo de cada pleito** (capa do pleito + dossiê do processo eleitoral + BU + ata de resultado final + relatório de comparecimento), e **Baixar arquivo do pleito** por eleição.
  - **Motor de PDFs** (`cipaReports.ts`): `buildClosedElectionPdfBody` (arquivo completo de um pleito), `buildClosedElectionsBatchPdfBody` (lote com capa-resumo) e `buildConsolidatedCipaPdfBody` (relatório consolidado).
  - **Painel “Relatório por unidade”** (`ConsolidatedCipaReport`): para cada comissão/estabelecimento exibe o **período vigente** do mandato, os **eleitos** (com votos e titular/suplente), as **indicações da empresa** e a **composição final**; abrange **todas as unidades** (respeitando o filtro de comissão do topo) e exporta em **PDF** e **CSV**.

### Fase 4.68: Fichas de candidato no arquivo do pleito, filtro por unidade no relatório consolidado e vínculo da ficha ao processo (CONCLUÍDA)
- Objetivo: deixar o **arquivo do pleito em lote** mais completo incluindo as **fichas de cadastro de todos os candidatos**, dar ao **relatório consolidado por unidade** o seu **próprio filtro de unidade** (independente do filtro de comissão do topo) e **vincular a ficha de cadastro de candidato ao processo eleitoral** por meio de um dropdown.
- Entregável:
  - **Fichas no arquivo do pleito** (`cipaReports.ts`): o arquivo de cada pleito encerrado (individual e no **lote**) passou a reunir, além da capa do pleito, do dossiê do processo eleitoral, do BU, da ata de resultado final e do relatório de comparecimento, as **fichas de cadastro de todos os candidatos** (uma por candidato inscrito, via `ballotPdf.buildCandidateFichaPdfBody`). O índice da capa e a nota do lote listam a nova peça.
  - **Filtro por unidade dentro do relatório consolidado** (`ConsolidatedCipaReport`): novo seletor **“Todas as unidades”** dentro do painel, com estado próprio — considera **todas as comissões cadastradas** (não depende do filtro de comissão do topo) e filtra o consolidado pela unidade escolhida, refletindo no PDF e no CSV.
  - **Ficha de candidato vinculada ao processo** (`CandidateRegistrationModal` + `ElectionsTab`): o cadastro da ficha ganhou o campo **Processo eleitoral** (dropdown), listando os processos **com inscrições abertas** (e, para edição, o processo de origem), com o processo já selecionado quando existe apenas um em uso; ao salvar, a ficha é gravada no **processo escolhido** (`onSave(candidate, electionId)`). Há avisos quando não há processo aberto ou quando as inscrições do processo selecionado não estão abertas.

### Fase 4.69: Equipamentos por texto livre, validacao real de CA no portal oficial e parametrizacao de bloqueio (CONCLUIDA)
- Objetivo: deixar de depender de um catalogo fixo de EPIs na entrega, permitindo digitar livremente o nome do equipamento e o CA, validar o CA de verdade no portal oficial do CAEPI (nao mais apenas no catalogo interno) e parametrizar separadamente se a empresa permite incluir equipamentos com CA nao encontrado ou CA vencido.
- Entregavel:
  - **Edge Function `consulta-ca`** (nova, publica): consulta best-effort o portal oficial `https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx` (formulario ASP.NET WebForms), extraindo o resultado (situacao do CA, validade, equipamento) sem simular dados — em caso de falha/mudanca do portal, retorna `found: false` com mensagem honesta, nunca inventa informacao do equipamento.
  - **Campos de texto livre na entrega** (`EpiDeliveryModal`): o seletor preso ao catalogo interno foi substituido por campos **Nome do EPI** e **CA** digitaveis livremente, mais a **Quantidade**, e um botao **Validar CA** que consulta o portal oficial e mostra o selo de situacao (ativo / vencido-inativo / nao encontrado) antes de adicionar o item.
  - **Botao "Consultar CA" revisado** (`ConsultaCaModal`): passa a consultar primeiro o **portal oficial** e só recorre ao catalogo interno como referencia offline quando o portal falha ou nao responde, deixando isso explicito na tela.
  - **Parametrizacao dupla** (`/app/config` -> secao Ficha de EPI): dois novos interruptores independentes — **Permitir adicionar EPI com CA nao encontrado** e **Permitir adicionar EPI com CA vencido** (colunas `permitir_ca_nao_encontrado`/`permitir_ca_vencido` em `system_settings`, desativados por padrao) — sem eles ativados, a inclusao do equipamento na entrega é bloqueada quando a validacao indicar CA vencido ou nao encontrado.
- **Nota honesta**: o portal do CAEPI nao tem API publica documentada; a consulta e feita por raspagem best-effort do formulario oficial. Se a estrutura do site mudar, a funcao retorna erro de forma transparente e a tela recorre ao catalogo interno como referencia, respeitando sempre a parametrizacao de bloqueio.

### Fase 4.70: Base de dados local do CAEPI (importacao do .csv.gz, consulta local e backup) (CONCLUIDA)
- Objetivo: parar de depender da raspagem ao vivo do portal do governo em toda consulta de CA, permitindo **importar a Tabela de CA oficial do CAEPI** (arquivo `.csv.gz`) para dentro do nosso banco, com upload de novas versoes mantendo as anteriores como backup e um log permanente de movimentacoes.
- **Historico de tentativas**: as tres primeiras versoes do importador (descompactar tudo em memoria de uma vez, depois em pedacos, depois com leitura por HTTP Range) falhavam porque a etapa de descompactar o arquivo inteiro (~22 MB comprimido vira ~150-250 MB em texto) antes de poder processa-lo em fatias estourava o limite de memoria do servidor.
- **Versao atual (streaming real)**: a funcao `caepi-import` baixa o arquivo comprimido como um FLUXO e liga esse fluxo direto a um `DecompressionStream`, que descompacta sob demanda — o arquivo inteiro descompactado NUNCA existe de uma vez em memoria. As linhas sao processadas e gravadas no banco conforme chegam, em lotes de 2.000. Cada chamada processa no maximo 40.000 linhas novas (para nao estourar o tempo maximo de execucao); ao continuar, a funcao reinicia a leitura do arquivo do zero (descompactacao e muito rapida) e pula em streaming as linhas ja gravadas ate chegar no ponto exato onde parou, sem duplicar nem perder nenhuma linha.
- **Tabelas no Supabase** (RLS habilitado): `caepi_import_batches` (lote de importacao: arquivo, tamanho, `row_count` = CAs gravados, `lines_seen` = posicao de retomada, status processing/completed/failed, lote **ativo** para consulta, quem importou), `caepi_catalog_entries` (um registro por CA do lote) e `caepi_import_logs` (log permanente de toda movimentacao). View `caepi_active_catalog` expõe os registros do lote ativo para consulta rapida por CA.
- **Bucket de Storage privado `caepi-base`**: guarda o arquivo `.csv.gz` de cada lote enviado.
- **Tela "Base de dados do CAEPI"** (`/app/config`, componente `CaepiBaseUpload`): mostra a base ativa atual, botao para enviar nova base, historico das ultimas 3 versoes e log de movimentacoes.
- Quando a base local (bulk import) nao tem um CA, a consulta cai para a Fase 4.71 (consulta ao vivo com cache).

### Fase 4.71: Cache local de consultas de CA (CONCLUIDA)
- Objetivo: reduzir a dependencia da raspagem ao vivo do portal do governo, guardando automaticamente cada CA ja consultado para que consultas repetidas sejam instantaneas.
- **Tabela `caepi_ca_cache`** (RLS habilitado, leitura para usuarios autenticados): guarda por `ca_normalized` (unico) o resultado da ultima consulta ao vivo (CA, CNPJ, razao social, equipamento, descricao, situacao, ativo, validade, campos brutos, data da consulta). Cache valido por 30 dias; apos esse prazo a proxima consulta revalida no portal oficial.
- **Edge Function `consulta-ca`**: antes de raspar o portal, verifica o cache local (gravacao com Service Role, nunca exposta ao navegador); se encontrar um CA valido no cache, responde na hora. Caso contrario, consulta o portal ao vivo (fluxo da Fase 4.69) e, se encontrar o CA, grava o resultado no cache para as proximas consultas.
- Entregavel:
  - **Tabelas no Supabase** (RLS habilitado): `caepi_import_batches` (lote de importacao: arquivo, tamanho, quantidade de registros, status processing/completed/failed, qual lote esta **ativo** para consulta, quem importou), `caepi_catalog_entries` (um registro por CA do lote: numero do CA, numero do processo, CNPJ, razao social, equipamento, descricao, situacao, validade) e `caepi_import_logs` (**log permanente** de toda movimentacao — upload iniciado, ativacao, remocao de backup antigo, falha — nunca apagado mesmo quando o arquivo/lote e removido). View `caepi_active_catalog` expõe apenas os registros do lote ativo para consulta rapida por CA.
  - **Bucket de Storage privado `caepi-base`**: guarda o arquivo `.csv.gz` de cada lote enviado.
  - **Edge Function `caepi-import`** (nova): baixa o arquivo do storage, descompacta o gzip, interpreta o CSV **detectando as colunas pelo cabecalho** (robusto a pequenas variacoes de layout), grava os registros em lotes de insercao, ativa o novo lote (desativando o anterior) e **rotaciona o backup** — mantem os **ultimos 3 arquivos** fisicos (e os registros desses 3 lotes); lotes mais antigos tem o arquivo e os registros removidos, mas o **registro do lote e o log de auditoria permanecem para sempre**.
  - **Consulta de CA priorizando a base local** (`caService.ts` -> `consultarCaBaseLocal`/`consultarCaOficial`): toda consulta de CA (botao "Consultar CA" e "Validar CA" na entrega de EPI) passa a checar primeiro a **base local importada**; so cai para a raspagem ao vivo do portal oficial quando o CA nao esta na base local (ou nenhuma base foi importada ainda).
  - **Tela "Base de dados do CAEPI"** (`/app/config`, componente `CaepiBaseUpload`): mostra a **base ativa atual** (arquivo, quantidade de CAs, tamanho, data de importacao), botao para **enviar nova base (.csv.gz)**, **historico das ultimas 3 versoes** (com selo Base ativa/Backup/Arquivo removido) e o **log de movimentacoes** (quem fez, quando e o que aconteceu).
- **Nota honesta**: o portal do CAEPI nao expõe um layout de colunas documentado publicamente; o importador usa deteccao de cabecalho por padrao de texto (ex.: coluna que contem "CA", "SITUACAO", "VALIDADE", "CNPJ" etc.) — se o arquivo oficial mudar radicalmente de layout, a importacao avisa com uma mensagem clara em vez de gravar dados errados. Quando a base local nao tem um CA (por nao ter sido importada ainda ou por ser um CA novo), o sistema continua caindo para a consulta ao vivo do portal oficial, mantendo a confiabilidade da Fase 4.69.

### Fase 4.72: Notificação de documentos direcionados ao colaborador (CONCLUÍDA)
- Objetivo: garantir que todo documento registrado com destinatário **Colaborador** gere um aviso para ele ficar ciente, e que o alerta **desapareça após a visualização** — sem remover o acesso ao documento.
- Entregável:
  - **Controle de ciência** (`src/pages/app/modules/documentos/documentAckStore.ts`): store compartilhado (`useSyncExternalStore`)
    com os ids já visualizados por **empresa + colaborador** (persistido em `localStorage`, portanto separado por usuário no
    mesmo navegador), além do helper `directedDocumentsFor` que seleciona os documentos `scope = colaborador`,
    vinculados ao colaborador e **visíveis a ele**.
  - **Sino do topo** (`AppTopbar`): cada documento direcionado ainda não visualizado vira uma notificação
    "Novo documento para você: …", com **contador de não visualizados** no ícone do sino e link direto para
    `/app/alertas?doc=<id>` (abre o documento já na central).
  - **Central de Alertas** (`/app/alertas`): nova seção **"Documentos direcionados a você"**, com selo "Novo",
    dados de emissão/validade e botão **Visualizar**; ao abrir (`DocumentViewerModal`) a ciência é registrada, o
    alerta sai do sino e da lista, e o documento passa para **"Documentos já visualizados"** (lista recolhível),
    preservando o acesso.
  - **Visualizador do documento** (`DocumentViewerModal`): metadados, prévia de imagem (com ampliação) ou abertura
    do PDF anexado/arquivo do Storage, e confirmação explícita de que o alerta foi removido.
  - **Menu lateral** (`AppSidebar`): o badge do item **Alertas** passa a refletir a quantidade real de documentos
    novos direcionados ao colaborador (em vez do número fixo), desaparecendo conforme ele visualiza.
- **Nota honesta**: o fluxo de **assinatura eletrônica** (`signature_documents`) mantém a notificação de
  "documento aguardando a sua assinatura" até a assinatura ser concluída — esse alerta não é removido apenas por
  visualizar, porque a pendência de assinatura continua existindo.

### Fase 4.73: Superadministrador da plataforma e base CAEPI central (CONCLUÍDA)
- Objetivo: criar o perfil global da plataforma (distinto do administrador de empresa), com painel de empresas/subdomínios, vínculo de administradores, auditoria e administração exclusiva da base central CAEPI — com autorização validada no banco e no backend.
- **Inventário do que existia** (antes da alteração): o perfil `super` era apenas um papel de demonstração no `localStorage`; as rotas `/app/empresas`, `/app/parametrizacao` e `/app/licencas` caíam no `ModulePlaceholder` (sem cadastro real). Não existia tabela de administradores globais, domínios nem auditoria de plataforma. `companies` tinha apenas `name/subdomain/legal_name/cnpj/status/created_at`, com 1 empresa e 2 perfis. As tabelas do CAEPI tinham policy `ALL` com `qual = true` e `with_check = true` para o papel público — ou seja, **qualquer empresa podia reescrever o catálogo**.
- Entregável:
  - **Banco**: `companies` ganhou `plan`, `suspended_at`, `suspension_reason`, `notes`, `created_by`, `updated_at`; índice único em `lower(subdomain)`; nova tabela `company_domains` (domínio/subdomínio, tipo, principal, status DNS/HTTPS) já semeada com o subdomínio atual; `platform_admins` (vínculo real `auth_user_id` → Superadministrador); `platform_audit_logs` **append-only** com gatilho que bloqueia UPDATE/DELETE; funções `is_platform_admin()` e `resolve_tenant(subdomain)` (identifica o tenant, não autoriza); restrição `profiles_role_check` impede o papel `super_admin` no vínculo empresarial.
  - **Base central CAEPI**: as policies de `caepi_catalog_entries`, `caepi_import_batches`, `caepi_import_logs` e `caepi_import_errors` passaram a permitir **somente leitura** (`with_check = false`), bloqueando INSERT/UPDATE/DELETE do cliente; a ativação de versão passou para a função transacional `caepi_activate_batch` (exige lote concluído e com registros; mantém a versão anterior em caso de falha). A base ativa com **42.033 registros** foi preservada.
  - **Edge functions**: nova `platform-admin` (`verify_jwt: true`), que valida o JWT com cliente anon e exige vínculo ativo em `platform_admins` via service role, com ações de empresa, status/suspensão, domínio, vínculo de administrador, acesso de suporte, histórico/ativação do CAEPI e erros; toda escrita gera auditoria. A `caepi-import` passou a exigir o mesmo vínculo (ator vindo do token, não do corpo) e ganhou ações `resume`/`cancel`; a ativação usa a função atômica. Corrigido também um filtro inválido (`is_active`) na limpeza de versões antigas do catálogo.
  - **Painel global** (`/app/empresas` e `/app/plataforma`, em `src/pages/app/modules/plataforma/`): abas **Empresas** (cadastro/edição, suspender/reativar com motivo, vincular administradores, acesso de suporte auditado), **Subdomínios** (registro + status externo de DNS/HTTPS), **Base CAEPI** (versão ativa, amostra consultada do banco, histórico, ativar versão, relatório de erros, importação) e **Auditoria**. Exige login real no Supabase Auth; o login demonstrativo não abre o painel.
  - **Bloqueio por tenant** (`TenantGate`): o shell resolve o subdomínio via `resolve_tenant`; subdomínio desconhecido mostra página própria (sem abrir dados de outra empresa) e empresa suspensa bloqueia o acesso sem excluir dados. A área global fica isenta do portão (é cross-tenant).
  - **Empresa**: a seção CAEPI em `/app/config` passou a ser **somente leitura** (`CaepiCatalogReadOnly`), exibindo versão ativa, contagem e versões anteriores, com aviso de que importar/ativar é exclusivo do Superadministrador.
  - **Testes executados**: duas empresas temporárias criadas (uma ativa, uma suspensa) resolveram para IDs distintos; a base global retornou 42.033 registros e **nenhuma coluna de empresa** no catálogo; subdomínio duplicado foi rejeitado pelo índice único; inserir perfil com papel `super_admin` foi rejeitado pela constraint; registros de teste removidos ao final (1 empresa, 1 domínio restantes).
- **Pendências honestas**: (a) ainda não existe conta de Superadministrador provisionada — o procedimento seguro está documentado no painel e em `docs/architecture/PLATFORM_ADMIN_AND_CENTRAL_CAEPI.md`; (b) a configuração real de DNS/hospedagem/HTTPS é externa e aparece como `pending` até confirmação; (c) o app das empresas segue com login demonstrativo (a autorização global é real, mas a autorização por empresa no front ainda não usa Supabase Auth); (d) a leitura de `companies` permanece aberta ao papel público para a resolução de subdomínio — dados cadastrais sensíveis devem ser migrados para uma view restrita em fase futura; (e) `super_admin` não é um papel de `profiles`: vive apenas em `platform_admins`.

### Fase 4.74: Autenticação real das empresas e blindagem de autorização (CONCLUÍDA)
- Objetivo: substituir a sessão demonstrativa (localStorage) por Supabase Auth + `session_context()`, fechar a única tabela pública sem RLS e preservar as ações legítimas do colaborador sem abrir escrita direta em tabela.
- Entregável:
  - **Inventário**: `company_domains` era a única tabela pública com RLS desativada (e sem policy aplicada), com `anon` tendo SELECT/INSERT/UPDATE/DELETE — risco de sequestro de subdomínio. Corrigido com RLS forçada e policy apenas de leitura para membros da empresa; escrita só via service role no painel global.
  - **Autenticação real**: `AuthProvider` (`src/pages/app/auth/authProvider.tsx`) com login, logout, recuperação e redefinição de senha; `SessionGate` com quatro estados distintos (carregando / sem sessão / sem permissão / erro de conexão); todos os retornos de `session_context()` tratados sem fallback. Removida toda leitura de `localStorage` para papel/empresa.
  - **Ações do colaborador**: RPCs `epi_acknowledge_delivery` e `regulation_acknowledge` (SECURITY DEFINER, `search_path=''`) derivam a identidade de `profiles.auth_user_id` + `current_company_id()` e gravam apenas os campos de aceite/ciência. `current_collaborator_ref()` adicionado.
  - **Pesquisas e humor**: policies ausentes em `survey_responses` criadas (própria resposta / anônima) e escrita de `daily_moods` restrita ao próprio `user_key`.
  - **Sem dados de demonstração como fallback**: stores de Documentos e Regulamento deixam de semear conteúdo fictício e de cair no mock quando a consulta falha; resolução de empresa sem fallback para "primeira empresa".
  - **Testes**: bateria versionada em `supabase/tests/tenant_authorization.sql` e documentação em `docs/architecture/TENANT_AUTH_AND_RLS_HARDENING.md`. Verificações executáveis confirmaram 0 tabelas sem RLS, falha fechada das RPCs sem sessão, claims forjadas ignoradas e catálogo CAEPI intacto (42.033).
- **Pendências reais**: aplicar a migration `20261018140000_..._up.sql` (contém os `REVOKE` que o executor da ferramenta recusa), rodar a bateria no SQL Editor, executar o roteiro de teste por API com usuários reais e provisionar o primeiro Superadministrador. DNS/HTTPS de `vega` seguem `pending`.

### Fase 4.75: Administrador principal da empresa no cadastro do tenant (CONCLUÍDA)
- Objetivo: no cadastro de empresa do Superadministrador, criar junto o **usuário administrativo responsável pelo primeiro acesso e pelos registros iniciais**, com vínculo protegido — só o superadministrador altera ou exclui; o administrador da empresa apenas visualiza.
- Entregável:
  - **Coluna `profiles.is_primary_admin`** (com índice único parcial: **um principal por empresa**) e backfill marcando o administrador mais antigo de cada empresa.
  - **Blindagem no banco** (gatilho `profiles_guard_primary_admin`): sessões de empresa não conseguem alterar nem excluir o administrador principal, nem promover outro perfil a principal; chamadas de service role (painel global) e o superadministrador autenticado seguem permitidos.
  - **Cadastro de empresa** (`CompanyFormModal`): seção **Administrador responsável** (nome, e-mail e telefone) obrigatória na criação. O backend `platform-admin` cria o `profiles` com papel Administrador e `is_primary_admin`, valida e-mail único entre empresas e desfaz a empresa se o vínculo falhar.
  - **Painel global**: lista de empresas exibe o administrador principal (e se o primeiro acesso está pendente); o modal **Administradores** mostra o vínculo como protegido, permite **editar** (nome/e-mail/telefone) e **revogar** o acesso, e recusa alterações no principal pelo formulário de vínculo comum (`update_primary_admin` / `revoke_primary_admin`).
  - **Visão da empresa** (`/app/config` → **Usuários de acesso**): o administrador da empresa vê o administrador principal com selo de proteção e ações **desabilitadas**, além da lista dos demais usuários de acesso como consulta.
  - **Demonstração**: as quatro empresas de exemplo ganharam administrador principal (primeiro acesso pendente).

### Fase 4.76: Prévia da chancela antes de exportar e etiqueta de origem no painel de chancelas (CONCLUÍDA)
- Objetivo: permitir conferir o bloco de chancela (QR-Code + código de verificação + hash) **antes** de exportar o PDF e separar visualmente, no painel Chancelas emitidas, o que foi **assinado por colaborador** do que foi **emitido por gestor**.
- Entregável:
  - **Componente reutilizável de prévia** (`src/components/feature/SealPreview.tsx`): reaproveita o `AuthenticitySeal` (mesmo bloco impresso no rodapé do PDF) com estados de *registrando*, *selo pronto*, *documento sem assinatura* e *falha ao registrar*.
  - **Hook `useDocumentSeal`** (`src/pages/app/signature/useDocumentSeal.ts`): carrega a chancela do documento ao abrir o detalhe, aproveitando a idempotência do `seal_document` (mesmo conteúdo → mesmo selo, sem duplicar registros).
  - **Getters de selo** (`epiSeal`, `aprSeal`, `ataSeal`) separados do HTML, permitindo que a tela e o PDF usem **o mesmo selo** já carregado (o `*SealHtml` virou um invólucro sobre eles).
  - **Prévia na Ficha de EPI e na APR** (`EpiDetailModal`, `AprDetailModal`): seção “Prévia da chancela de autenticidade” antes do botão de exportar, com aviso quando ainda não há assinatura.
  - **Prévia na ata** (`AtaSealPreview` dentro de `AtasTab`): exibida no detalhe expandido da ata, montada a partir das aprovações assinadas.
  - **Prévia no DDS** (`DdsDetailModal` + `ddsSeal`/`ddsSealHtml` em `src/pages/app/modules/dds/ddsUtils.ts`): o bloco de chancela da **lista de presença** aparece abaixo da lista de participantes, reaproveitando o mesmo selo na exportação (sem gerar chancela duplicada); quando ninguém tem assinatura registrada, explica que não há o que chancelar.
  - **Prévia nos documentos do módulo Assinaturas** (`DocumentDetailModal`): o selo do documento assinável passa a usar o mesmo cartão de prévia dos demais documentos — com estado informativo quando o documento ainda não foi congelado/assinado; o `SealPreview` passou a aceitar `SealDisplay` (token + metadados) além do `DocumentSeal`.
  - **Etiqueta de origem no painel Chancelas emitidas** (`SealsPanel` + `sealOriginOf` em `authenticitySeal.ts`): **Assinado por colaborador** (documentos assinados pelo próprio colaborador), **Emitido por gestor** (relatórios com emissor signatário) e **Sem assinatura nominal**, na lista, nos detalhes, na legenda do painel e na **exportação CSV** (nova coluna “Origem da chancela”).

### Fase 4.77: Prévia da chancela na Ficha de Presença e aviso de chancela revogada em documento cancelado (CONCLUÍDA)
- Objetivo: cobrir o último documento assinado que ainda não tinha prévia de selo (a **Ficha de Presença** dos treinamentos em Documentos) e deixar explícito, na prévia, que a chancela de um **documento cancelado** não vale mais.
- Entregável:
  - **Selo próprio da Ficha de Presença** (`src/pages/app/modules/documentos/attendanceSeal.ts`): `attendanceSeal`, `attendanceSealParticipants` e `attendanceHasSignature`; o selo só nasce quando ao menos o **facilitador** ou **um participante** tem assinatura coletada, com o mesmo conteúdo canônico usado na exportação (idempotente no servidor).
  - **Novo escopo de chancela `presenca`** (`authenticitySeal.ts` + `SealsPanel`): rótulo “Ficha de Presença”, ícone e filtro próprios no painel Chancelas emitidas.
  - **Prévia na Ficha de Presença** (`AttendanceSealSection` dentro de `AttendanceSheetModal`): o selo é emitido **sob demanda** (“Gerar prévia da chancela”), evitando registros de rascunho a cada tecla; qualquer alteração de conteúdo invalida a prévia anterior, e o **Exportar PDF** registra/reaproveita o selo e imprime exatamente o que foi pré-visualizado.
  - **PDF da ficha chancelado** (`attendanceStore.buildAttendancePdfBody`/`buildAttendanceDocument`): o rodapé passa a receber o selo e o PDF anexado ao registro em Documentos é gravado já chancelado; ao recarregar, um PDF já chancelado **não é sobrescrito** por uma versão sem selo.
  - **Aviso de chancela revogada** (`SealPreview` com `revoked`/`revokedNote`): quando o documento está **cancelado**, a prévia abre com alerta destacado (“Documento cancelado: esta chancela não tem mais validade”), o bloco de selo aparece **esmaecido com o carimbo “SEM VALIDADE”** e o texto deixa claro que o código/QR continuam apenas como registro histórico e que a conferência pública passa a responder que o documento não está vigente. O aviso mostra a **data e o motivo** do cancelamento quando existirem.
  - **PDF de documento cancelado** (`documentPdf.exportDocumentPdf`): o arquivo passa a sair com uma **tarja de cancelamento** no topo e a chancela com o título “Documento cancelado — chancela sem validade”, nunca apresentada como vigente.

### Fase 4.78: Papel timbrado de folha inteira como fundo impresso (correção) (CONCLUÍDA)
- Objetivo: corrigir a exportação em PDF que baixava apenas o **papel timbrado**, sem o conteúdo do documento, quando a imagem enviada em Configurações é uma **folha A4 inteira**.
- Entregável:
  - **Causa**: `pdfHeader` injetava o papel timbrado no fluxo do documento com largura total e altura automática; uma folha inteira ocupava sozinha a primeira página e empurrava/escondia todo o conteúdo.
  - **Detecção automática** (`exportPdf.printHtml`): antes de imprimir, a imagem do timbre tem sua proporção medida (`naturalHeight/naturalWidth`); acima de `1.15` é tratada como **folha inteira**.
  - **Folha inteira vira fundo de página**: a imagem passa a `position: fixed` cobrindo toda a folha (classe `.letterhead.is-sheet`) e **repete em todas as páginas** impressas, com o conteúdo na área útil via `@page { margin: 44mm 16mm 40mm }` — nada mais é empurrado para fora da primeira página.
  - **Faixa/cabeçalho continua como cabeçalho**: imagens largas (proporção baixa) ficam no fluxo, agora com `max-height: 40mm` e `object-fit: contain`, sem consumir a página.
  - **Impressão mais confiável**: `printHtml` passou a aguardar o carregamento das imagens (timbre, assinaturas, fotos) antes de disparar a impressão, com limite de tempo para não travar.
- **Escopo**: vale para todos os PDFs do sistema (documentos, atas, relatórios, laudos, fichas e lotes), pois todos usam `pdfHeader` + `printHtml`.

### Fase 4.79: Área útil do papel timbrado com medidas absolutas (correção) (CONCLUÍDA)
- Objetivo: eliminar o desalinhamento do conteúdo sobre o papel timbrado que aparecia na impressão mesmo após a correção da Fase 4.78.
- Entregável:
  - **Causa**: o fundo era posicionado com deslocamento negativo (`top: -44mm; left: -16mm`) e dimensionado em percentual (`calc(100% + 32mm)` / `calc(100% + 84mm)`). Quando o navegador usa a folha inteira como caixa de referência, a imagem era esticada para **381mm** numa folha de **297mm**, estourando o topo e eliminando o rodapé — o PDF saía desconfigurado.
  - **Medidas absolutas**: `.letterhead.is-sheet` passa a fixar `top: 0; left: 0; width: 210mm; height: 297mm` com `object-fit: fill`, independente da caixa de referência do navegador.
  - **Margem do papel zerada** (`@page { size: A4; margin: 0 }`): o afastamento do conteúdo migra para o `padding` do `body` (`40mm 16mm 28mm`), tornando o ponto inicial do texto determinístico — **178mm de largura útil**. Zerar a margem também impede o cabeçalho automático do navegador (data + título + URL) de ser impresso sobre o timbre.
  - **Camada de conteúdo** (`.doc-flow`, `position: relative; z-index: 1`): todo o corpo impresso fica acima do papel timbrado, evitando que a imagem interfira no fluxo e no recorte de páginas.
  - **Rodapé sem duplicação**: o bloco `@bottom-left` (linha SSTEK) foi removido, pois o mesmo texto já sai no rodapé do documento (`pdfFooter`); permanece apenas a numeração de páginas no modo sem timbre de folha inteira.
  - **Diagnóstico registrado**: o PDF enviado pelo usuário comprovou que o conteúdo da ata existe integralmente no banco (523 caracteres, 3 deliberações, 6 participantes) mas saía truncado no arquivo — além do cabeçalho automático do navegador duplicando o título em todas as páginas.

### Fase 4.80: Timbre de folha inteira como faixa de cabeçalho (correção definitiva) (CONCLUÍDA)
- Objetivo: resolver o PDF que saía **em branco** (só o papel timbrado, sem nenhum texto) depois da tentativa de usar a imagem como fundo de página.
- Causa raiz: a imagem do timbre era posicionada em `position: fixed` por cima da folha. No fluxo de impressão o navegador compõe camadas fixas por cima do conteúdo, então a folha (que tem fundo branco na arte) cobria todo o texto — páginas em branco. A tentativa seguinte (background da raiz) foi descartada porque depende da opção **“Gráficos de plano de fundo”** da caixa de impressão, que vem desligada por padrão.
- Entregável:
  - **`exportPdf.ts`**: `.letterhead.is-sheet` deixa de ser camada fixa/fundo e passa a ser uma **imagem normal no fluxo**, recortada como faixa de cabeçalho (`width: 100%; height: 42mm; object-fit: cover; object-position: top center`), mostrando o topo do timbre (logo e dados da empresa). O texto flui logo abaixo, portanto **nunca** pode ser coberto ou empurrado, e imprime independente de qualquer opção da caixa de impressão.
  - **`applyLetterheadLayout`**: apenas detecta a proporção da imagem (folha inteira: altura/largura ≥ 1,15) e aplica a classe; não injeta mais `@page`, `padding` de body nem estilos de fundo.
  - **Efeito em todo o sistema**: documentos, atas da CIPA, APRs, EPI, DDS, relatórios, laudos e impressões em lote usam o mesmo gerador, então a correção vale para todos.

### Fase 4.81: QR da chancela rasterizado e bloco de chancela compacto (CONCLUÍDA)
- Objetivo: corrigir o QR-Code que saía **em branco** e **grande demais** no bloco de chancela do PDF e reduzir a altura do bloco, deixando a composição harmônica na folha timbrada.
- Entregável:
  - **Rasterização do QR** (`exportPdf.ts` → `rasterizeSvgDataUrls`): o QR da chancela é gerado como SVG em data URL e o motor de impressão do Chrome frequentemente não o rasteriza ao gerar o PDF (QR em branco). Antes de imprimir, todas as imagens `data:image/svg+xml` do documento são desenhadas em um **canvas** (4× de escala, fundo branco) e substituídas por **PNG** em data URL; o `xmlns` do SVG é garantido explicitamente quando ausente, pois SVG carregado como imagem exige o namespace.
  - **QR em 2 × 2 cm**: `.seal-qr-img` passou a `20mm × 20mm` (antes 96px) e a coluna `.seal-qr` foi fixada em `20mm`, com a legenda "Leia para validar" em corpo menor.
  - **Chancela mais baixa**: padding (`8px 10px`), margem superior (14px), borda (1,5px), títulos e linhas mais compactos (`seal-title` 10,5px, `seal-rows` 7px com `line-height 1.45`, `seal-note` 6,8px) e `.seal-note` com `page-break-before: avoid` para não se separar do bloco.
  - **Efeito em todo o sistema**: os estilos são compartilhados, então a chancela de EPI, DDS, APR, CIPA, relatórios mensais, inspeções, pleitos e documentos assinados também ficam com o QR visível e o bloco compacto.

### Fase 4.82: Tamanho do QR do colaborador travado em 3 × 3 cm na impressão (CONCLUÍDA)
- Objetivo: garantir que o **QR-Code do colaborador** (adesivos de fiscalização) seja o **único** QR com tamanho imutável — 3 × 3 cm reais — porque é a medida que encaixa em **crachá** e na face do **capacete**. Os demais QR (chancela, comprovantes) seguem com tamanho próprio.
- Entregável:
  - **Regra de impressão com escopo**: a trava de 3 cm saiu da regra global `.qr-code-box` e passou a valer apenas dentro da folha de adesivos (`.print-area .qr-code-box`, em `30mm × 30mm`, com o `canvas` esticado a 100%) — antes ela podia interferir em qualquer QR impresso no documento principal.
  - **Sem redução automática da folha**: a grade dos **selos circulares** usava 4 colunas de 4,6 cm + vãos de 3 mm (19,3 cm), o que **estourava a largura imprimível** do A4 (19 cm com margem de 10 mm). O navegador então reduzia a página inteira no "Ajustar à página" e o QR do colaborador saía **menor que 3 cm**. Agora o selo tem **4,5 cm** e o vão **1,5 mm** (18,45 cm no total), com `.print-area` limitado a 100% de largura para não gerar estouro horizontal.
  - **Medida preservada**: o QR continua em `113 px` na tela (≈ 3 cm) e em **30 mm** no papel, tanto na etiqueta quadrada (3,6 cm) quanto no selo circular (4,5 cm).

### Fase 4.83: Marca de corte de 3 cm, folha A4 adesiva 3 × 8 e dados do capacete no selo (CONCLUÍDA)
- Objetivo: permitir conferir a medida do QR sem régua na pré-visualização, oferecer a **folha A4 adesiva** com posições fixas de impressora (grade 3 × 8) e enriquecer o **selo do capacete** com a **validade do CA** do capacete entregue e o **telefone do SESMT**.
- Entregável:
  - **Marca de corte de 3 cm** (`QrPrintDialog`): régua desenhada abaixo da pré-visualização, com traços em 0/1/2/3 cm e etiqueta “3 cm”, exibida apenas na tela — não entra na impressão (o `.print-area` é montado separado, fora do app).
  - **Folha A4 adesiva (grade 3 × 8)**: novo formato `sheet` do adesivo, com célula horizontal de **63 × 34,5 mm** (QR de 3 cm à esquerda, nome/função/empresa/CA/SESMT à direita), **24 adesivos por folha** em posições fixas e quebra de página automática a cada 24 (`SHEET_PER_PAGE`, classe `.qr-label-page` com `break-after: page`). A área de impressão da folha é fixada em **190 mm** de largura para não sofrer “Ajustar à página”.
  - **Validade do CA no selo do capacete** (`qrStickerData.resolveHelmetCa`): localiza o **capacete entregue** ao colaborador na ficha de EPI (entrega mais recente), cruza o CA com o catálogo e imprime `CA 31.469 · 12/05/2027`. Sem capacete registrado, a linha não é impressa.
  - **Telefone do SESMT** (`qrStickerData.resolveSesmtPhone`): lido da **composição da CIPA** (membro com área SESMT) + cadastro do colaborador. Só é impresso quando existe esse membro — sem SESMT na CIPA, a linha é omitida.
  - **Prévia informativa** (`QrPrintDialog`): bloco “Informações do capacete” mostra qual CA/validade e qual telefone do SESMT serão impressos (ou o motivo da ausência) antes de imprimir, além do resumo de folhas A4 no modo grade.

### Fase 4.84: CA vencido em vermelho no selo, telefone do SESMT nas Configurações e validade do CA na página pública (CONCLUÍDA)
- Objetivo: dar leitura imediata do CA vencido no selo do capacete, permitir cadastrar o **telefone do SESMT** nas Configurações (alternativa quando a CIPA não tem membro de SESMT) e levar a **validade do CA do capacete** para o comprovante público aberto pelo QR-Code.
- Entregável:
  - **Banco**: nova coluna `system_settings.sesmt_phone` (migração `20261021100000_system_settings_sesmt_phone_up.sql`), lida/gravada pelo `settingsStore` com registro na auditoria (`company_data`).
  - **Destaque em vermelho** (`QrSticker` + `qrStickerData.isExpiredDate`): o `HelmetCaInfo` passou a carregar `expired` (data de validade comparada com o dia atual). Com o CA vencido, o selo circular e a célula da folha A4 trocam a moldura tracejada por moldura **vermelha sólida**, fundo levemente avermelhado e a linha do CA vira **“CA VENCIDO · 31.469”** em negrito vermelho, com `print-color-adjust: exact` para o papel sair colorido.
  - **Telefone do SESMT nas Configurações** (`CompanyDataForm`): novo campo “Telefone do SESMT” em *Dados da empresa*. `resolveSesmtPhone` ganhou o parâmetro de fallback: CIPA com área SESMT tem prioridade; sem membro, vale o telefone cadastrado. O diálogo de impressão informa a origem do número (CIPA ou Configurações).
  - **Validade do CA na página pública** (`FiscalizacaoCard` + `/fiscalizacao/:id`): novo bloco “CA do capacete em uso” logo abaixo dos dados cadastrais, com CA, nome do equipamento, **validade do certificado** e selo **CA vigente / CA vencido** (vermelho quando vencido), além do telefone do SESMT cadastrado. A validade é resolvida pela ficha de EPI (`resolveHelmetCa`), a mesma fonte usada no selo impresso.

### Fase 4.85: Alerta de CA vencido em ficha de EPI ativa no painel do Administrador (CONCLUÍDA)
- Objetivo: dar ao Administrador uma lista direta de **todos os colaboradores que estão com EPI em uso cujo CA já venceu**, considerando **somente a ficha ativa** (o equipamento em posse hoje), para ação imediata de substituição.
- Entregável:
  - **Motor do alerta** (`src/pages/app/modules/epi/expiredCaAlerts.ts`): `buildExpiredCaRows` cruza as entregas de EPI do Supabase com o cadastro real de colaboradores e resolve, por colaborador, a **entrega mais recente de cada CA** (ficha ativa). Entregas com motivo de **devolução** são ignoradas (o equipamento não está mais com o colaborador) e colaboradores **desligados** ficam fora. A validade do CA é lida da **base CAEPI importada** (`caepi_active_catalog.validade`, consultada em lote pelo hook `useExpiredCaAlerts`) com fallback para o **catálogo interno** (`findEpiByCa`).
  - **Painel de alerta** (`EpiExpiredCaPanel`) no topo do dashboard do Administrador: destaque em tom de alerta com o total de colaboradores e de equipamentos vencidos, lista ordenada do **mais crítico ao menos crítico** (dias de atraso) contendo nome, função, área, unidade, os dias de vencimento e, por equipamento, nome + CA + data de validade vencida. Mostra os 4 casos mais críticos e libera **“Ver todos os N colaboradores”**, com atalho para o módulo de EPI.
  - **Filtro por unidade**: o painel acompanha o seletor global do dashboard (`unit`), exibindo apenas os colaboradores do estabelecimento selecionado; sem casos na unidade, o alerta não é renderizado.
- **Nota honesta**: o alerta depende da validade do CA existir na base CAEPI importada ou no catálogo interno; CAs sem data de validade em nenhuma das fontes não são classificados como vencidos (nunca há vencimento presumido).

### Fase 4.86: Pedido de substituição de EPI com foto, registro de perda e aviso ao SESMT (CONCLUÍDA)
- Objetivo: fechar o ciclo de substituição do EPI — abrir o pedido direto da linha do colaborador com CA vencido, permitir que o próprio colaborador solicite a troca no portal, exigir foto do equipamento, registrar a perda com campos obrigatórios e avisar o administrador/SESMT para providenciar a troca.
- Entregável:
  - **Tabela `epi_replacement_requests`** (Supabase, RLS habilitado): pedido com colaborador, equipamento, CA, validade, motivo, `loss_detail`, foto obrigatória, observações, situação (Pendente / Em andamento / Concluída / Recusada), origem (SESMT ou colaborador) e dados de conclusão. Constraints no banco exigem **foto** e, quando o motivo é **Perda**, o **registro de perda** preenchido (data, local e descrição). Leitura por membros da empresa (colaborador vê apenas os próprios pedidos); abertura pelo administrador ou pelo próprio colaborador; atualização de situação **somente pelo administrador**.
  - **Store compartilhado** (`replacementStore.ts`): `useEpiReplacementRequests`, `createEpiReplacementRequest` e `setEpiReplacementStatus`, resolvendo a empresa pela sessão e mantendo a lista atualizada entre os painéis.
  - **Modal de pedido** (`EpiReplacementModal`): equipamento (com seleção dos EPIs em uso do colaborador ou texto livre), motivo (CA vencido, desgaste, dano, perda, tamanho inadequado, outro), **foto obrigatória** (redimensionada por `epiPhoto.compressEpiPhoto`), observações e o bloco de **registro de perda** (data, local, boletim e descrição) que aparece e se torna obrigatório quando o motivo é Perda.
  - **Botão “Registrar substituição” na linha do colaborador** (`EpiExpiredCaPanel`): cada colaborador com CA vencido ganha o botão direto, abrindo o pedido com colaborador e equipamento mais crítico **pré-preenchidos**; clicar em qualquer chip de equipamento abre o mesmo pedido já apontando para aquele CA.
  - **Aviso para o administrador** (`EpiReplacementRequestsPanel`): painel no dashboard do Administrador (respeitando o filtro de unidade) e no módulo de EPI com o total de pedidos abertos, abas Abertos/Concluídos, miniatura ampliável da foto, motivo, registro de perda, origem e data. O administrador pode **assumir o pedido**, **registrar a nova entrega de EPI** (modal de entrega pré-preenchido, que conclui o pedido automaticamente) ou **concluir sem nova entrega**.
  - **Solicitação pelo colaborador**: painel `EpiMyReplacementsPanel` no painel do colaborador e na **Minha ficha de EPI**, com botão “Solicitar troca” (equipamento escolhido entre os que estão em uso) e a lista dos próprios pedidos com situação; a tabela de EPIs em uso ganhou o botão **Solicitar troca** por equipamento.
- **Nota honesta**: a foto é gravada como data URL comprimida (mesmo padrão já usado na entrega de EPI), para não depender de um bucket adicional; o aviso ao “responsável pela segurança” é exibido para o perfil Administrador, que hoje concentra a gestão do SESMT na plataforma.

### Fase 4.87: Sino com pedidos de EPI, prazo de atendimento por motivo e anexos automáticos (CONCLUÍDA)
- Objetivo: fazer o administrador perceber na hora que existe pedido de substituição de EPI em aberto, cobrar prazo por tipo de motivo e guardar em Documentos a prova do atendimento (foto + nova ficha).
- Entregável:
  - **Sino do topo com pedidos abertos** (`AppTopbar`): o perfil Administrador passa a receber a notificação “N pedido(s) de substituição de EPI aguardando atendimento”, com o total de pedidos **fora do prazo** na descrição e um segundo aviso de atraso (tom de alerta) quando existe algum — ambos com atalho direto para o módulo de EPI. O contador do sino acompanha.
  - **Prazo de atendimento por motivo** (coluna `replacement_sla_hours` em `system_settings`, `replacementSla.ts`): cada motivo tem prazo próprio em horas (padrão: CA vencido e Perda 24h, Dano 48h, Desgaste/Tamanho inadequado/Outro 72h), calculado a partir da abertura do pedido. O prazo é parametrizável em **Configurações → Prazos de atendimento de EPI** (`EpiReplacementSlaForm`), com restauração dos padrões e registro da alteração no log de auditoria.
  - **Destaque de pedidos atrasados** (`EpiReplacementRequestsPanel`): selo vermelho “Atrasado há X”, contador “N fora do prazo de atendimento” no cabeçalho, borda de alerta na linha e ordenação dos atrasados no topo da lista; cada pedido mostra o prazo aplicado e o limite (data/hora).
  - **Prazo visível para o colaborador** (`EpiMyReplacementsPanel`): os pedidos em aberto exibem a previsão de atendimento (ou o aviso de prazo vencido).
  - **Anexos automáticos ao concluir** (`replacementDocuments.ts`): ao concluir o atendimento, a **foto do pedido** é anexada em Documentos como “Registro fotográfico de EPI” (novo tipo no catálogo) e, quando há nova entrega, a **nova Ficha de EPI** é anexada com o termo de aceite em PDF sempre atualizado (ids determinísticos, sem duplicar registro).
- **Nota honesta**: o prazo é calculado sobre a data de abertura com a parametrização vigente — se a empresa alterar o prazo de um motivo, pedidos ainda abertos passam a ser medidos pelo novo prazo; pedidos já concluídos não são remarcados.

### Fase 4.88: Resumo de prazos no painel do Administrador e foto do EPI devolvido em Documentos (CONCLUÍDA)
- Objetivo: dar ao administrador uma leitura imediata dos prazos de atendimento dos pedidos de substituição (quantos vencem hoje e quantos já atrasaram) e registrar em Documentos a **foto do EPI antigo devolvido** junto da nova Ficha de EPI, com o **histórico do pedido**.
- Entregável:
  - **Resumo de prazos** (`EpiReplacementSlaSummary`, novo painel no dashboard do Administrador, acima da lista de pedidos): cartões com **Pedidos em aberto**, **Vencem hoje** (com o contador de pedidos que vencem em até 3 dias), **Já atrasados** (destaque de alerta) e **Atendidos no prazo (%)** calculado sobre os pedidos concluídos (data de conclusão x limite do prazo). O painel acompanha o **filtro de unidade** do dashboard e, havendo atraso, exibe um aviso indicando que esses pedidos aparecem destacados na lista.
  - **Foto do EPI antigo devolvido** (coluna `return_photo` em `epi_replacement_requests` + `EpiReturnPhotoField`): a gestão anexa/troca a foto do equipamento devolvido direto na linha do pedido, com a imagem comprimida e ampliável; o colaborador também vê a miniatura do equipamento devolvido no seu pedido.
  - **Documento de devolução com histórico** (`replacementDocuments.buildReturnedEpiDocument`): ao concluir o atendimento, é anexado em Documentos um registro próprio “Devolução do EPI antigo — {equipamento} ({colaborador})” com a foto do equipamento devolvido e um **histórico completo do pedido** (abertura, origem, motivo, prazo aplicado, registro de perda, atendimento e nova entrega).
  - **Histórico embutido na nova Ficha de EPI**: o PDF da ficha gerada na substituição passa a trazer o mesmo histórico do pedido antes do rodapé (parâmetro opcional `historyHtml` em `buildEpiAcceptanceBody`), mantendo as duas fotos (EPI do pedido e EPI devolvido).
  - **Reanexo automático**: se a foto do devolvido for anexada depois da conclusão, o documento de devolução é atualizado em Documentos (ids determinísticos, sem duplicar).
- **Nota honesta**: sem foto do equipamento devolvido o documento de devolução ainda é gerado (com a foto do pedido e o histórico), mas as duas imagens só aparecem juntas quando a gestão registra a devolução.

### Fase 4.89: Assinatura real na ata, Responsável Técnico signatário e rodapé sem "Assinatura / Matrícula" e "Data" (CONCLUÍDA)
- Objetivo: garantir que o PDF da ata aprovada mostre a **assinatura eletrônica real** de cada signatário (e não o texto "Representação visual preservada"), incluir o **Responsável Técnico de Segurança do Trabalho** como signatário obrigatório (com pendência visível para ele assinar) e remover do rodapé dos documentos os campos manuais **Assinatura / Matrícula** e **Data**.
- Entregável:
  - **Campo no cadastro de colaboradores**: nova coluna `is_technical_responsible` em `company_collaborators` (índice único por empresa), campo `technicalResponsible` no modelo, no store (limpa o RT anterior ao marcar um novo) e um **interruptor "Este colaborador é o Responsável Técnico (RT)"** no formulário de cadastro.
  - **Responsável Técnico como signatário da ata** (`CipaAtaSignature` com o papel "Responsável Técnico", `ataApprovers` e `ensureRequiredApprovers`): a tela de atas e a coleta de aprovação passam a incluir o RT designado (fallback para o responsável técnico das Configurações), e a ata só é considerada **Aprovada** quando ele também assina.
  - **Assinatura visível no PDF** (`ataPdf` + `ataSignatureImages`): a representação de cada aprovação usa o snapshot salvo ou a **assinatura do perfil do colaborador** (traço ou tipografia renderizada em PNG), com fallback tipográfico pelo nome — sem o texto "Representação visual preservada". O mesmo vale para a grade de aprovação em tela (`AtaApprovalGrid`).
  - **Assinatura pelo próprio colaborador** (`AtaPendingSignaturesPanel` + `AtaSelfSignModal` no painel do Colaborador): lista as atas em que o usuário logado é signatário e ainda não assinou, permitindo assinar eletronicamente com a assinatura do perfil; ao concluir, a ata e o documento vinculado em Documentos são atualizados.
  - **Rodapé enxuto** (`pdfFooter` + `SignatureFooter`): o bloco do Responsável Técnico passa a exibir a **assinatura eletrônica** (imagem + nome + "Assinado eletronicamente em …" + ID) e foram removidos os campos manuais **Assinatura / Matrícula** e **Data**, já que a data/hora consta do próprio registro de assinatura.
- **Nota honesta**: a assinatura dos demais papéis (presidente e secretário) continua sendo coletada pela gestão da CIPA; o RT passa a ter também a pendência no próprio painel para assinar.

### Fase 4.90: Assinatura do RT nos documentos técnicos, bloqueio de emissão e aviso no sino (CONCLUÍDA)
- Objetivo: estender a assinatura do Responsável Técnico (RT) da ata para os demais **documentos técnicos da CIPA** (Ficha de Cadastro, inspeções e dossiê do processo eleitoral), **bloquear a emissão definitiva** enquanto o RT não assinar e avisar o administrador (e o próprio RT) no sino do topo.
- Entregável:
  - **Tabela `cipa_technical_signatures`** (Supabase, RLS): um ato por documento (`company_ref`, `scope` = `ficha-cipa`/`inspecao-cipa`/`dossie-eleicao`/`ata-cipa`, `reference_ref`), com signatário, imagem da assinatura, ID do ato e data/hora. Leitura para a empresa; assinatura pelo **administrador ou pelo próprio RT** (comparando com o colaborador da sessão); remoção só pelo administrador.
  - **Responsável Técnico compartilhado** (`technicalResponsible.ts`): resolve o RT pelo cadastro (interruptor “Este colaborador é o Responsável Técnico”), com fallback para o nome em Configurações, e informa se o usuário logado é o RT.
  - **Store e modal de assinatura** (`technicalSignatureStore.ts` + `TechnicalSignatureModal`): registra o ato com a assinatura do perfil do RT (ou desenho manual) e devolve a assinatura pronta para o rodapé dos PDFs.
  - **Bloqueio da emissão definitiva** (`useTechnicalSignatureGate`): a ficha da CIPA (“Gerar PDF”), o PDF da inspeção e o dossiê do processo eleitoral (aba Eleições e painel do pleito) só são emitidos depois da assinatura do RT, com aviso claro quando a empresa não tem RT definido ou quando quem exporta não é o RT.
  - **Assinatura no documento**: `buildCipaFichaPdfBody`, o corpo da inspeção e `buildDossierPdfBody` passam a receber a assinatura técnica e o rodapé sai com nome, assinatura, data/hora e ID do ato (o documento do dossiê anexado em Documentos também guarda a assinatura).
  - **Pendências e avisos**: novo painel **“Documentos técnicos aguardando sua assinatura”** no painel do RT (fichas, inspeções e dossiês), e o sino do topo passa a avisar o administrador sobre **atas** e **documentos técnicos** aguardando a assinatura do RT — para o próprio RT o aviso é uma ação obrigatória com atalho para o painel.
- **Nota honesta**: a assinatura do RT é registrada no momento da emissão (assinatura do próprio RT ou do administrador quando ele também é o RT). Se a empresa ainda não definiu um RT, a emissão fica bloqueada até o cadastro/parametrização ser ajustado.

### Fase 4.91: Prévia no modal de assinatura do RT, histórico de assinaturas técnicas e aviso por e-mail (CONCLUÍDA)
- Objetivo: dar ao Responsável Técnico a conferência do documento antes de assinar, criar a trilha de assinaturas técnicas por comissão na tela da CIPA e avisar o RT por e-mail quando a emissão de um documento técnico é solicitada e continua pendente de assinatura.
- Entregável:
  - **Prévia fiel no modal** (`technicalDocumentPreview.ts` + `TechnicalSignaturePreview`): o modal de assinatura do RT foi ampliado e passou a exibir, ao lado da coleta de assinatura, a **prévia do documento** em iframe, montada pelos **mesmos geradores do PDF** (ficha, inspeção, dossiê). O responsável técnico confere exatamente o que será emitido antes de confirmar. Para isso, o corpo do PDF da inspeção foi extraído para `inspectionPdf.buildInspectionPdfBody`, reutilizado pela aba Inspeções e pela prévia, e `exportPdf.buildDocumentPreviewHtml` monta o documento completo com o mesmo estilo de impressão.
  - **Histórico por comissão** (`TechnicalSignatureHistoryTab`): nova aba **Assinaturas do RT** na tela da CIPA, com KPIs (assinaturas registradas, comissões com atos e última assinatura) e a lista agrupada por comissão, mostrando **quem assinou**, **quando** (data/hora e fuso) e **quais documentos** (ficha, inspeção, dossiê ou ata), com o **ID do ato** e o título do documento. Respeita o filtro global de comissão.
  - **Aviso por e-mail ao RT**: novo campo `email` no responsável técnico resolvido pelo cadastro; nova **Edge Function `notify-technical-signature`** (JWT) que envia e-mail via Resend (`RESEND_API_KEY` e `RESEND_FROM_DOMAIN` nos secrets do Supabase), com o documento, quem solicitou e a empresa. O aviso é disparado quando alguém tenta emitir um documento técnico e a emissão é bloqueada por falta da assinatura do RT (`waiting-notified`), com deduplicação por documento na sessão e uma nota na mensagem de bloqueio informando que o RT foi avisado.
- **Nota honesta**: o envio de e-mail depende de `RESEND_API_KEY` e `RESEND_FROM_DOMAIN` configurados nos Secrets do Supabase; sem eles a função responde `resend-not-configured` e a interface apenas mantém o aviso de pendência, sem simular envio. A prévia usa o mesmo HTML do PDF, mas não substitui o PDF assinado (que só existe após o ato).

### Fase 4.92: Impressão em Lote por colaborador — seleção, geração do dossiê e página de conferência (CONCLUÍDA)
- Objetivo: permitir reunir, em **um único PDF por colaborador**, os documentos que já existem no cadastro dele — escolhendo colaboradores e tipos, definindo a ordem, conferindo o que foi encontrado (e o que está ausente) e **conferindo as páginas antes de imprimir**.
- Entregável:
  - **Entrada em Documentos**: novo botão **Impressão em lote** no cabeçalho do módulo (o antigo botão de seleção de linhas passou a se chamar **Imprimir selecionados**, para não confundir os dois fluxos).
  - **Seleção em 3 etapas** (`BatchPrintModal`): (1) **colaboradores** com busca por nome/função/matrícula e filtro por unidade; (2) **tipos e ordem**, com reordenação (subir/descer), remoção e um **pacote sugerido** (Ficha de Cadastro, ASO, Ficha de EPI e CNH); (3) **conferência da seleção**, mostrando por colaborador o que foi localizado, qual versão será usada e **quais documentos estão ausentes** — nada é omitido em silêncio.
  - **Busca nos arquivos existentes** (`batchPrintTypes.ts`): os documentos vêm do **cadastro de cada colaborador** (tabela `documents`), sem novo upload. Quando há **múltiplas versões**, a **vigente** é sugerida (entre as não vencidas, a de emissão mais recente) e a versão pode ser trocada no próprio passo de conferência. Nenhum documento de outro colaborador entra no lote.
  - **Ficha de Cadastro do Colaborador**: novo tipo de documento (`ficha-cadastro-colaborador`) montado a partir dos **dados já cadastrados** (sem novo preenchimento); novo tipo **CNH** também adicionado ao catálogo.
  - **Geração do dossiê** (`batchPdfBuilder.ts` + `pdf-lib`): cada colaborador recebe **um PDF** com **capa** (nome, função, unidade, matrícula, lista numerada dos documentos na ordem escolhida, páginas e pendências/avisos) seguida dos documentos. Arquivos **PDF reais** do Storage entram como **páginas originais mescladas** (preservando orientação, conteúdo, assinaturas visuais e QR Codes); imagens digitalizadas entram em página A4; registros **sem arquivo digital** entram como página de **registro cadastral** explicitamente rotulada, com aviso no dossiê. Documentos sem nenhum item incluído **falham** — nunca é gerado arquivo vazio. Numeração “Página X de Y” e rodapé em todas as páginas.
  - **Página “Conferência da Impressão em Lote”** (`/app/documentos/impressao-em-lote`, rota nova): cartão por colaborador com **nome**, **nome do PDF**, **documentos incluídos na ordem**, **pendências/falhas**, **quantidade de páginas**, botões **Visualizar PDF** (prévia de todas as páginas em iframe), **Baixar** e **Imprimir**, além da marcação manual **Conferido**. A impressão **não começa automaticamente**.
  - **Seleção, ZIP e impressão**: seleção dos arquivos conferidos, **Baixar selecionados (ZIP)** (via `fflate`) e **Continuar para impressão dos selecionados**. Como os navegadores bloqueiam várias janelas de impressão em sequência, o fluxo explica a limitação e abre **um arquivo por vez**, com o botão **Abrir próximo** na ordem. Nada é marcado como “impresso” — o navegador não informa a conclusão da impressão.
  - **Voltar e ajustar**: a seleção é preservada na sessão; o botão **Voltar e ajustar a seleção** retorna a Documentos com `?lote=ajustar` reabrindo o modal preenchido e permitindo **gerar novos resultados sem alterar os documentos originais**.
  - **Falha por colaborador**: quando a geração de um dossiê falha, o cartão mostra o motivo e o botão **Tentar novamente** refaz **apenas aquele colaborador**.
  - **Privacidade e auditoria**: os PDFs ficam **somente na sessão do navegador** (blob); não são enviados ao banco. Nova tabela **`document_batch_prints`** (RLS por empresa) registra **quem gerou**, **quais documentos e versões** entraram (ref, tipo, versão, emissão, origem e páginas), pendências, contagem de páginas e **quando** — servindo de rastro para auditoria.
  - **Limites declarados no próprio dossiê**: o PDF reunido é uma **cópia para apresentação/impressão**; não é documento novo, não substitui os originais e **não preserva a validade criptográfica** das assinaturas eletrônicas dos arquivos originais. A marcação **“Conferido”** é checagem operacional, não assinatura eletrônica. As permissões de consulta/exportação e o isolamento por empresa continuam valendo (a rota herda o guard de Documentos).
- **Nota honesta**: (a) arquivos enviados ao Storage entram mesclados na íntegra; documentos que existem apenas como registro (sem arquivo digital anexado) entram como **página de registro cadastral**, sempre sinalizada na conferência e no PDF; (b) a extração de páginas conta com o `pdf-lib` no navegador — PDFs protegidos por senha não são mesclados e viram pendência explícita.

### Fase 4.93: Exclusão de registros sem arquivo no lote e tela "Lotes gerados" (CONCLUÍDA)
- Objetivo: permitir **excluir do PDF** os documentos que existem apenas como registro (sem arquivo digital) já na **etapa de conferência** da impressão em lote, e dar visibilidade ao **rastro de auditoria** dos lotes já gerados, com filtro por **período** e por **colaborador**.
- Entregável:
  - **Opção de exclusão na conferência** (`BatchPrintReviewStep` + `batchPrintTypes.BatchPlanOptions`): novo interruptor **“Excluir do PDF os documentos sem arquivo digital”**, com a contagem de documentos afetados. Com a opção ativa, esses itens saem do dossiê, a linha aparece marcada como **excluída** e a exclusão é registrada nas pendências do lote (nunca silenciosa). A ficha de cadastro (montada a partir dos dados do colaborador) continua entrando — a exclusão vale apenas para registros **sem arquivo**.
  - **Configuração propagada** (`BatchConfig.includeMissing`): a escolha é guardada no store do lote, usada na geração, na regeração por colaborador e no **rastro de auditoria** (as pendências registram cada exclusão). Aviso na conferência quando um colaborador fica **sem nenhum documento incluível**.
  - **Nova tela “Lotes gerados”** (`/app/documentos/lotes`): lê a tabela `document_batch_prints` (RLS por empresa + filtro explícito por `company_ref`) e mostra o histórico agrupado por lote — código do lote, data/hora, **quem gerou**, colaboradores, páginas, falhas e o detalhe por colaborador (arquivo, documentos/versões incluídos, origem de cada item e pendências).
  - **Filtros**: **período** (7/30/90 dias, 12 meses, todo o período e **intervalo personalizado** com De/Até) e **colaborador** (lista derivada dos próprios registros), mais busca livre por lote, arquivo, tipo de documento ou nome. KPIs de lotes, dossiês, páginas e colaboradores no recorte.
  - **Ações**: **Repetir seleção** de um lote (reabre `BatchPrintModal` com os colaboradores e tipos daquele lote, sem tocar nos originais), atalhos para Documentos e para uma nova impressão em lote, estados de **carregamento, erro com “Tentar novamente”** e vazio explicativo.
  - **Atalhos**: botão **Lotes gerados** no cabeçalho de Documentos e na Conferência da Impressão em Lote.
- **Nota honesta**: os PDFs continuam **sem armazenamento** — a tela mostra o rastro (quem, o quê, quando); para obter uma cópia é preciso **gerar novamente** a partir dos documentos originais do cadastro.

### Fase 4.94: Dashboard do Administrador repaginado — gráficos interativos e detalhes operacionais em abas (CONCLUÍDA)
- Objetivo: reduzir a poluição visual do dashboard do Administrador (antes uma sequência longa de painéis e tabelas) e transformá-lo numa visão executiva profissional, com gráficos interativos (valores ao passar o mouse e detalhamento ao clicar) e os detalhes operacionais organizados por assunto.
- Entregável:
  - **Biblioteca de gráficos própria** (`src/pages/app/components/charts.tsx`): componentes em CSS/HTML (sem SVG) — `ColumnChart` (colunas agrupadas ou empilhadas com tooltip por mês e clique no mês), `DonutChart` (anel com leitura do ângulo do cursor, centro dinâmico com percentual e clique no segmento), `HBarChart` (barras horizontais clicáveis), `ProgressMetric` (cobertura com percentual e atalho de detalhe) e `StatTile` (KPI clicável). Todos respeitam os tokens de tema (`primary`/`accent`/`secondary`/`background`/`foreground`).
  - **Modal de drill-down** (`DashboardDrilldownModal`): ao clicar em qualquer gráfico/indicador abre a lista real por trás do número (documentos por situação/mês, colaboradores por função, assinaturas, atas da CIPA, clima e DDS), com resumo do recorte e estado vazio explicativo.
  - **Nova composição do dashboard** (`AdminDashboard.tsx`): cabeçalho executivo compacto (título, unidade, período e “Exportar resumo”), faixa de 4 KPIs clicáveis, dois gráficos principais (emissão de documentos por mês e situação documental), faixa de atividade operacional (DDS x EPI por mês + colaboradores por função) e a seção **Cobertura de conformidade** — substituindo a antiga sequência de cards por módulo.
  - **Detalhes operacionais em abas**: Pendências (EPI vencido/CA, SLA de substituição, pedidos de EPI, alertas da CIPA e aviso de assinaturas), Aprovações & assinaturas (painel de assinaturas e aprovações da CIPA), Documentos & EPI (tabelas de vencimento, entregas recentes e validade por CA, movidas para `DashboardRecords`) e Sentimento da equipe. Nenhum painel foi removido — apenas reorganizado para não competir com a leitura executiva.
  - **Filtro e exportação preservados**: o seletor de **unidade** e a barra de **período** continuam filtrando KPIs, gráficos e abas; o PDF do “Exportar resumo” foi atualizado para os novos indicadores consolidados.
- **Nota honesta**: os gráficos de clima/função usam os dados consolidados existentes (visão corporativa) e não são recortados pela unidade; o restante (documentos, DDS, EPI, CIPA e assinaturas) acompanha o filtro.

### Fase 4.95: Sentimento da equipe repaginado e registro do dia com comemoração (CONCLUÍDA)
- Objetivo: elevar o painel de Sentimento da equipe e a tela de registro diário a um acabamento premium e mais dinâmico, com efeito celebrativo quando o colaborador escolhe **Muito Feliz**.
- Entregável:
  - **Efeitos visuais próprios** (`src/index.css`): novas animações por CSS (sem imagens) para confete (`mood-confetti-piece`), pulo do emoji (`animate-mood-pop`), halo pulsante (`animate-mood-halo`), brilho deslizante (`mood-shimmer`), entrada suave (`animate-mood-rise`) e respiração do botão (`animate-mood-breathe`).
  - **Comemoração reutilizável** (`src/pages/app/mood/components/MoodCelebration.tsx`): rajada de partículas coloridas disparada por prop, nos modos compacto (dentro do card) e de palco (tela cheia), usando os tokens de cor do tema — sem SVG nem dependências novas.
  - **Seletor de sentimento premium** (`MoodChooser`): cards com elevação no hover, brilho atrás do emoji, marcação visível da escolha, brilho deslizante no card **Muito Feliz** e **confete a cada clique na opção Muito Feliz**; faixa de retorno empática por sentimento, atalhos de motivo (equipe, reconhecimento, demanda, dia tranquilo, aprendizado) e contador de caracteres.
  - **Modal de registro repaginado** (`DailyMoodGate`): faixa de cor no topo, saudação pessoal, cápsula de privacidade/tempo, botão com animação de respiração e **tela de agradecimento celebrada** (confete + emoji escolhido) antes de liberar o sistema.
  - **Faixa executiva no painel do gestor** (`MoodPulseHero`): medidor circular da média (1 a 5) com emoji do sentimento médio, barra empilhada clicável da distribuição, cartões por sentimento com mini-barra e atalho de filtro — clicar filtra a lista de registros (clicar de novo limpa).
  - **Painel `/app/sentimento` reorganizado**: hero executivo no lugar da antiga faixa de KPIs e do card de distribuição (menos repetição), reset rápido do alerta, chips de filtros ativos com contagem e lista de registros com avatar + emoji sobreposto e elevação no hover.
  - **Card do colaborador** (`MoodSummaryCard`): destaque do registro de hoje com halo, sequência de dias registrados e faixa dos **últimos 7 dias** (hoje em evidência).
  - **Card da equipe nos dashboards** (`MoodTeamPanel`): pulso do dia em barra única com legenda por sentimento e lista recente com avatar/emoji e destaque dos alertas.
- **Nota honesta**: a comemoração é puramente visual e local (não envia nada além do registro em `daily_moods`); o painel continua lendo os mesmos dados, agora organizados de forma mais legível.

### Fase 4.96: Quem escolheu cada sentimento, alertas de acolhimento e registro do acompanhamento (CONCLUÍDA)
- Objetivo: permitir ao gestor enxergar **as pessoas por trás dos números** do sentimento — quem escolheu cada humor no período — e transformar a tristeza em **ação de acolhimento**, com priorização dos casos e registro do retorno do superior.
- Entregável:
  - **Seletores por pessoa** (`src/pages/app/mood/moodPeople.ts`): `buildPeople` consolida os registros em uma ficha por colaborador (último registro, média, dias negativos, **sequência de dias negativos** e dias desde o último negativo) e classifica a atenção em **Prioridade alta / Atenção / Observação**, com `peopleByMood`, `attentionPeople` e o texto do sinal detectado (`attentionSignal`).
  - **Painel "Colaboradores"** (`MoodPeoplePanel` no `/app/sentimento`), com duas abas:
    - **Quem está como**: grade por sentimento (ou visão de um só sentimento, sincronizada com o clique no medidor do topo) listando **nome, área e data** de quem registrou, com avatar e indicador discreto de acolhimento; clicar abre a ficha.
    - **Precisa de atenção**: cartões por gravidade (com barra de severidade), motivo declarado, quantos dias negativos, chip do status do acolhimento e atalho **Abrir ficha**.
  - **Ficha do colaborador** (`MoodPersonModal`): retrato do último registro, classificação de atenção, indicadores (média, registros, dias negativos, dias seguidos), **histórico do período** com motivos e o bloco **Acolhimento** (Aguardando / Em acompanhamento / Acolhido + nota interna de até 500 caracteres), com aviso de privacidade (visível apenas para a gestão).
  - **Persistência no Supabase** (`mood_followups`): tabela por empresa/colaborador/dia com status e nota, unicidade `(company, collaborator_key, mood_date)`, **RLS** de leitura por empresa e escrita apenas para perfis `admin`/`super`; store `moodFollowupStore` com upsert, recarga reativa e rótulos de status.
  - **Alertas e exportação**: o aviso de sentimento negativo passou a abrir a aba de atenção; a exportação **PDF/CSV** do painel ganhou a coluna **Acolhimento** e o alerta foi reescrito para orientar o acolhimento próximo.
- **Nota honesta**: o acolhimento é um registro interno de gestão (não é enviado ao colaborador nem altera o humor registrado); a leitura dos motivos é restrita à gestão da empresa pela RLS.

### Fase 4.97: Aviso no sino e resumo de atenção no dashboard com parametrização (CONCLUÍDA)
- Objetivo: transformar o sentimento negativo em **alerta operacional no topo** quando ainda não houve acolhimento, e levar o resumo de **“quem precisa de atenção”** para o dashboard do administrador com **atalho direto para a ficha** — com opção de ligar/desligar esse bloco na parametrização.
- Entregável:
  - **Seletor cruzado** (`src/pages/app/mood/moodAttention.ts`): `attentionCasesFor` e `pendingMoodAlerts` cruzam as fichas de `moodPeople` com os acolhimentos de `moodFollowupStore`, retornando o status do acolhimento e a **idade do registro**. Um caso só é pendente quando o **último registro é negativo** e o acolhimento está **ausente ou ainda “aguardando”** — janela de 7 dias para o alerta do sino.
  - **Aviso no sino** (`AppTopbar`): o aviso de sentimento deixou de ser uma contagem simples do dia e passou a listar os casos **sem acolhimento** (visíveis ao admin/super e a líderes com equipe), como **item que exige ação** (não desaparece ao abrir o sino). Com **um** caso, o clique abre direto a ficha da pessoa (`/app/sentimento?pessoa=…`); com vários, abre a aba de atenção (`/app/sentimento?tab=attention`). O aviso desaparece sozinho quando o acolhimento é salvo.
  - **Atalhos por URL** (`/app/sentimento`): a página passou a ler `?tab=attention` e `?pessoa=<chave>` (via `useSearchParams`), abrindo a aba correta e a ficha da pessoa; ao fechar o modal, os parâmetros são limpos.
  - **Bloco “Quem precisa de atenção”** (`src/pages/app/components/dashboard/MoodAttentionCard.tsx`): novo card no dashboard do administrador, no mesmo recorte de período dos demais indicadores, com contadores por gravidade (Prioridade alta / Atenção / Observação), os casos **sem acolhimento primeiro**, sinal detectado, motivo declarado, status do acolhimento e **abertura da ficha direto no dashboard** (`MoodPersonModal`), além de atalho “Ver todos” para o painel de sentimento.
  - **Parametrização** (`/app/config` → seção **Atenção no sentimento da equipe**, componente `MoodAttentionSettings`): novo campo `dashboardMoodAttention` em `system_settings` (coluna `dashboard_mood_attention`, padrão **ativado**), com interruptor, auditoria no log do sistema, descrição do comportamento e atalho para o painel de sentimento. Desativado, o bloco sai do dashboard; o aviso do sino continua ativo por ser o alerta operacional.
  - **Persistência e auditoria**: `settingsStore` ganhou o campo no `SystemSettings`, na leitura/gravação e nos metadados de auditoria (`dashboard`), mantendo o padrão otimista de gravação.
- **Nota honesta**: o bloco do dashboard usa o período selecionado no painel (não o filtro de unidade, já que o registro de humor guarda a área/setor do colaborador, não o estabelecimento); as notas de acolhimento continuam visíveis apenas para a gestão.

### Fase 4.98: Estabelecimento no registro de sentimento e filtro por unidade no bloco de atenção (CONCLUÍDA)
- Objetivo: gravar o **estabelecimento/unidade** junto do registro diário de sentimento para que o bloco “Quem precisa de atenção” (dashboard e painel) respeite o **filtro de unidade** — encerrando a pendência registrada na Fase 4.97.
- Entregável:
  - **Banco**: nova coluna `establishment` em `daily_moods`, com **backfill** dos registros existentes a partir de `company_collaborators` (mesma empresa, por `ref`).
  - **Captura da unidade no registro** (`moodUtils.resolveMoodActor` + `moodStore.recordMood`): o ator do sentimento passou a carregar `establishment`, resolvido no **cadastro real** de colaboradores (por e-mail da sessão ou nome, com fallback para o mock); o upsert grava a unidade junto do humor, motivo, área e gestor.
  - **Seletores e modelo** (`MoodEntry`/`MoodRow`): o campo `establishment` foi incluído no `select`, no mapeamento e na interface consumida pelos painéis.
  - **Dashboard do Administrador** (`AdminDashboard`): a unidade de cada registro é a **unidade gravada** no sentimento e, para registros antigos sem unidade, a **unidade do cadastro do colaborador**; o recorte de sentimento passou a aplicar **período + unidade**, e `unitOptions` também considera as unidades dos registros. O `MoodAttentionCard` recebeu o rótulo da unidade aplicada (exibido no subtítulo) e mostra a **unidade de cada pessoa** no cartão.
  - **Painel “Sentimento da equipe”** (`/app/sentimento`): novo seletor **“Todas as unidades”** ao lado do período, com as unidades presentes no recorte do gestor, refletindo em **medidor, distribuição, colaboradores (quem está como / precisa de atenção), evolução e registros**; a unidade entra nos **chips de filtros ativos**, no **limpar filtros** e no **PDF** exportado.
  - **Fichas e listas**: a unidade aparece no subtítulo da **ficha da pessoa** (`MoodPersonModal`) e nas linhas de **“Quem está como”/“Precisa de atenção”** (`MoodPeoplePanel`), junto da área.
- **Nota honesta**: o aviso do **sino do topo** continua com escopo **da empresa** (alerta operacional do gestor), não do filtro de unidade do dashboard.

### Fase 4.99: Meus documentos do colaborador, atestado médico imutável, busca por documento e APR com nº de solicitação (CONCLUÍDA)
- Objetivo: ajustar a área do colaborador — trocar a busca "de colaborador" por busca nos **documentos dele**, entregar a página **Meus documentos** (contrato, ficha cadastral e atestados médicos) com upload de atestado e **aviso informativo à gestão**, e permitir que o colaborador **cadastre a própria APR** com **número da solicitação obrigatório**, que sai da visão dele assim que assinada.
- Entregável:
  - **Busca do topo por perfil** (`AppTopbar`): no perfil Colaborador o campo passou a buscar **documentos ligados a ele** (contrato, ficha cadastral, atestados e documentos emitidos no seu nome), com lista de resultados e atalho direto para o documento. A busca "colaborador, documento, CA" continua apenas para os perfis de gestão.
  - **Tela "Meus documentos"** (`/app/meusdocumentos`, nova rota e página): documentos pessoais fixos (**Contrato de Trabalho** e **Ficha Cadastral**) com visualização e impressão/PDF, **documentos emitidos para o colaborador** (fichas de EPI e demais com `visible_to_collaborator`) e a seção de **APR**.
  - **Atestados médicos (novo)**: tabela `medical_certificates` (empresa, colaborador, tipo, data, dias de afastamento, CID, observação, arquivo e autor) com **RLS somente leitura + inserção** — sem UPDATE e sem DELETE, portanto **ninguém apaga o atestado** depois de cadastrado. Upload da foto no próprio perfil (Storage privado `documents`, com cópia comprimida no banco quando o envio falha), obrigando tipo, data, dias de afastamento e CID (observação opcional, até 500 caracteres).
  - **Aviso informativo à gestão**: o sino do Administrador passa a listar **"Atestado médico cadastrado"** (colaborador, tipo, data e dias), com atalho para a **ficha do colaborador**, onde a seção **Atestados médicos** permite abrir a imagem do documento. É aviso informativo (some ao ser visto) e não exige ação.
  - **APR com nº da solicitação**: coluna `request_number` (e `created_by_ref`/`created_by_name`/`origin`) em `apr_records`; o campo **Nº da solicitação** passou a ser **obrigatório** no formulário e aparece no detalhe, no PDF exportado, no filtro por busca e nas exportações PDF/CSV.
  - **APR cadastrada pelo colaborador**: novo botão **Cadastrar APR** em "Meus documentos" (responsável, unidade e executante já pré-preenchidos), com RLS permitindo ao colaborador inserir/atualizar **apenas a própria APR** (`created_by_ref = current_collaborator_ref()`). Enquanto houver assinatura pendente a APR aparece na seção dele; **depois de assinada desaparece da visão do colaborador** e passa a constar somente no **painel do administrador** (que identifica a origem "Colaborador" na lista e no detalhe).
  - **Consistência nas listas do colaborador**: as APRs criadas por ele foram removidas do painel, da Central de Alertas e do contador do sino, garantindo que a APR assinada não deixe "amostra" no perfil de quem a cadastrou.
- **Nota honesta**: a RLS original de `apr_records` permitia escrita apenas do Administrador; a política foi estendida com escopo restrito à APR de autoria do próprio colaborador (sem liberar alteração de APRs da gestão). O aviso de atestado é informativo e não substitui o registro do afastamento na folha/ponto.

### Fase 5.00: Atestados no dashboard, PDF do atestado, filtro por nº de solicitação e alergias no cadastro (CONCLUÍDA)
- Objetivo: dar visibilidade operacional aos atestados médicos recebidos, permitir exportar em PDF o atestado com a foto e o resumo do afastamento, tratar o **número da solicitação** como filtro dedicado na APR e registrar **alergias** (múltiplas) no cadastro do colaborador.
- Entregável:
  - **Card “Atestados médicos recebidos”** (`MedicalCertificatesCard`, dashboard do Administrador): lista os atestados recebidos no **período** e na **unidade** selecionados no dashboard (usando a unidade gravada no atestado e, quando ausente, a unidade do cadastro), com contadores de colaboradores e de dias de afastamento. Cada linha abre a **ficha do colaborador**; atalhos laterais abrem a imagem do atestado e exportam o PDF.
  - **Unidade no atestado** (`medicalCertificateStore`): o modelo passou a expor `establishment` e `area` (já gravados no envio), permitindo o recorte por unidade no dashboard.
  - **PDF do atestado médico** (`certificatePdf.printMedicalCertificatePdf`): documento com identificação, **resumo do afastamento** (data, dias, início, término e retorno previsto), observações e a **foto anexada**, com rodapé/assinatura do responsável técnico. Botão **PDF** em cada atestado da **ficha do colaborador** (e no card do dashboard).
  - **Filtro por nº da solicitação na APR** (`/app/apr`): campo dedicado “Nº da solicitação” (aceita o número com ou sem formatação), integrado ao “Limpar filtros”. O **relatório mensal de APR** ganhou o mesmo filtro, refletido nos indicadores, no PDF exportado, na referência da chancela e na legenda.
  - **Alergias no cadastro do colaborador**: nova coluna `allergies text[]` em `company_collaborators`; o formulário passou a ter o interruptor **“Este colaborador possui algum tipo de alergia”** e, ao ativar, uma lista de alergias com botão **+ Adicionar alergia** e remoção por item. A ficha do colaborador exibe as alergias como chips de destaque (ou “nenhuma alergia declarada”).
- **Nota honesta**: o card do dashboard respeita o período e a unidade globais do painel (não duplica seletores); atestados antigos sem unidade gravada caem para a unidade do cadastro do colaborador.

### Fase 5.01: Resumo de absenteísmo por unidade/mês e alerta de afastamento prolongado no sino (CONCLUÍDA)
- Objetivo: transformar os atestados médicos em **indicador de absenteísmo** (dias de afastamento por unidade e por mês) no dashboard do Administrador e avisar a gestão no sino quando um afastamento passar do limite de dias definido pela empresa.
- Entregável:
  - **Limite configurável** (`system_settings.certificate_leave_alert_days`, padrão 3 dias): o store de configurações ganhou o campo `certificateLeaveAlertDays`, com gravação no Supabase, e a tela de Configurações recebeu a seção **Atestados médicos** (`MedicalCertificateAlertSettings`) com campo numérico e atalhos de 3, 5, 7 e 15 dias — a regra é “igual ou acima de X dias”.
  - **Regras compartilhadas** (`certificateInsights.ts`): centraliza a data de recebimento, o mês de referência do afastamento (mês da emissão), a unidade do atestado (com fallback para o cadastro), o recorte período+unidade e o agregador `buildAbsenteeism` (dias por mês, dias por unidade, colaboradores, atestados, média por pessoa e maior afastamento).
  - **Card “Absenteísmo”** (`AbsenteeismCard`, dashboard do Administrador, abaixo dos atestados recebidos): KPIs de dias de afastamento, colaboradores com atestado, média de dias por colaborador afastado e maior afastamento; **gráfico de colunas por mês**, **barras por unidade** e **matriz unidade × mês** com totais. Clicar em um mês ou unidade abre a lista de atestados que compõe os dias (com destaque para os afastamentos acima do limite) e atalho para a ficha/lista de colaboradores.
  - **Exportação do resumo**: o card exporta um **PDF** com os KPIs, a matriz unidade × mês e o total de atestados acima do limite; o botão **Exportar resumo** do dashboard (PDF executivo) passou a incluir os dias de afastamento, colaboradores com atestado, média por pessoa e o absenteísmo por unidade.
  - **Alerta no sino** (`AppTopbar`): novos avisos **“Afastamento prolongado · NOME · X dias”** (tom de alerta, ícone de advertência) com a data do atestado, a unidade e o limite aplicado, abrindo a ficha do colaborador. Atestados acima do limite saem da lista genérica “Atestado médico cadastrado” para não duplicar o fato, e o card de atestados recebidos passou a marcar “afastamento prolongado” na linha.
- **Nota honesta**: o alerta do sino é **informativo** (some ao ser visto, como os demais avisos de atestado) e não bloqueia nada; o resumo de absenteísmo respeita o período e a unidade selecionados no painel, sem seletores próprios, para os números fecharem com o cabeçalho do dashboard.

### Fase 5.02: Gráfico por período no PDF do absenteísmo e acompanhamento do afastamento prolongado na ficha (CONCLUÍDA)
- Objetivo: dar leitura visual do absenteísmo no papel e permitir que a gestão registre o **acompanhamento do afastamento prolongado** (retorno previsto + observação) direto na ficha do colaborador — sem alterar o atestado original, que segue imutável.
- Entregável:
  - **Gráfico de colunas no PDF do absenteísmo** (`absenteeismPdf.tsx`, novo): a exportação do card “Absenteísmo” foi extraída do componente para um módulo próprio e passou a abrir com o **gráfico de colunas dos dias de afastamento por período** (SVG montado no próprio HTML do documento, com eixos, valores e legenda), além dos KPIs e da **matriz unidade × mês** que já existiam.
  - **Tabela `medical_certificate_followups`** (Supabase, RLS habilitado + `UNIQUE (certificate_id)` + índices por empresa/colaborador): guarda `expected_return`, `note`, `updated_by` e `updated_at` do acompanhamento. Leitura para admin/super e para o próprio colaborador; **escrita apenas para admin/super**. O atestado continua **sem UPDATE/DELETE** — o acompanhamento vive em tabela separada.
  - **Store do acompanhamento** (`followupStore.ts`): `useMedicalFollowups`, `getFollowupFor`, `fetchFollowup` (leitura pontual usada pelos PDFs) e `saveFollowup` (upsert por `certificate_id`).
  - **Registro pela ficha** (`MedicalFollowupModal` + `CollaboratorDetailModal`): cada atestado na ficha ganhou o botão **Acompanhar**, que abre o modal com o resumo do atestado, o campo **Retorno previsto** (com sugestão calculada pela data do atestado + dias de afastamento), o campo **Observação** (limite de 500 caracteres) e o **último registro** (quem e quando atualizou). Atestados acima do limite configurado ganham a etiqueta **Afastamento prolongado** e um bloco com o retorno previsto; quando ainda não há acompanhamento, o bloco avisa e oferece **Registrar**.
  - **Acompanhamento no PDF do atestado** (`certificatePdf.ts`): a emissão do atestado passou a buscar o acompanhamento e incluir a seção **Acompanhamento do afastamento** (retorno previsto, quem registrou, data da atualização e a observação), ou a indicação de que não havia acompanhamento até a emissão.
- **Nota honesta**: o acompanhamento é um registro de gestão (retorno previsto + observação) e **não** substitui o atestado nem cria novo documento no módulo de Documentos; a sugestão de retorno é apenas um cálculo pela data + dias informados e pode ser sobrescrita pelo gestor.

### Fase 5.03: Documentos estruturados — Investigação de Acidente, Aferições e Permissão de Trabalho com checklist inteligente (CONCLUÍDA)
- Objetivo: criar três novos documentos técnicos dentro de Documentos, cada um com formulário próprio, checklist inteligente (itens sugeridos conforme o contexto), fotos e PDF anexado ao registro na lista.
- Entregável:
  - **Tabela `structured_documents`** (Supabase, RLS por empresa: leitura para a empresa, escrita para admin), com `kind` (`investigacao-acidente`, `afericoes`, `permissao-trabalho`), `title`, `doc_date`, `establishment` e o conteúdo em `payload` (jsonb).
  - **Store compartilhado** (`src/pages/app/modules/documentos/structured/structuredStore.ts`): carrega por `company_ref`, salva/atualiza e reconstrói cada documento em Documentos com o **PDF já anexado** (aparece na lista, pode ser visualizado, baixado e entrou na impressão em lote).
  - **Menu “Criar documento”** em `/app/documentos` com os três tipos, além dos novos tipos no catálogo (`Investigação de Acidente`, `Aferições`, `Permissão de Trabalho`).
  - **Investigação de Acidente** (`AccidentInvestigationModal`): ocorrência (tipo, gravidade, data/hora, turno, área, local), acidentado (nome, CPF, matrícula, função, admissão, nascimento, sexo, CID), **comunicações legais** (CAT, nº/data, evento S-2210 do eSocial, CIPA notificada, dias de afastamento e retorno previsto), descrição/agente causador/parte do corpo/natureza da lesão, **análise de causa raiz** (5 Porquês, Ishikawa, Árvore de Causas, Bow Tie), fatores contribuintes, ato/condição insegura, falha de gestão, NRs, EPIs e treinamentos, **plano de ação** (ação, responsável, prazo, situação), testemunhas, conclusão, checklist e **fotos**.
  - **Aferições** (`MeasurementModal`): seleção do **equipamento** (Decibelímetro, Dosímetro, Luxímetro, Anemômetro, Termômetro de Globo/IBUTG, Bombas de Amostragem, Detector de Gases, Vibrômetro **+ Novo equipamento** com nome/unidade/norma), dados do instrumento (marca, modelo, série, faixa, resolução, incerteza), **calibração** (certificado, laboratório/RBC, data e validade), condições ambientais, normas aplicáveis (NR-15 anexos, NR-17, NR-9, NR-33), **medições** (ponto, tempo de amostragem, valor, unidade, limite e resultado), conclusão técnica, **local + observações** e **assinatura de quem realizou a aferição** (nome, função, registro, empresa e testemunha).
  - **Permissão de Trabalho** (`WorkPermitModal`): nº da PT, data/início/término/validade, unidade, área, local/equipamento, ordem de serviço, **atividades autorizadas** (trabalho a quente, altura, espaço confinado, eletricidade, içamento, escavação, LOTO, químicos), executante (solicitante, empresa, responsável, função, nº de trabalhadores, vigia), **riscos e medidas de controle** (perigo, risco, controle, EPI/EPC), EPIs/ferramentas/isolamento, **teste atmosférico** (O₂, %LEL, H₂S, CO), checklist de liberação, fotos, **encerramento** e assinaturas (emissor, aprovador, executante, vigia).
  - **Checklist inteligente** (`SmartChecklist`): cada documento recebe um roteiro de verificação que **muda conforme o contexto** — tipo/gravidade da ocorrência, equipamento de medição escolhido ou atividades marcadas na permissão (as atividades já inserem automaticamente os itens da NR correspondente), com sugestões avulsas “adicionar todas”, itens personalizados, situação (Conforme / Não conforme / Não aplicável) e observação por item.
  - **PDF** (`structuredPdf.ts`): documento com identificação, todas as seções, KPIs do checklist, tabelas de medições/riscos/ações, galeria fotográfica, assinaturas dos responsáveis e rodapé institucional.
  - **Fotos** (`PhotoField`): upload múltiplo com **compressão automática** no navegador (máximo 8 fotos) e embutidas no PDF gerado.
- **Nota honesta**: o catálogo de equipamentos iniciais e os roteiros de verificação são referências de apoio (NR-15/NR-9/NR-33/NR-35/NR-23/NR-10/NR-17/NR-11/NR-18/NR-26), não substituem a avaliação do profissional habilitado nem a calibração oficial dos instrumentos.

### Fase 5.04: Alerta de vencimento em qualquer documento e cadastro rápido de validade (CONCLUÍDA)
- Objetivo: transformar a validade dos documentos em um alerta operacional real — sem depender de status salvos no passado — e permitir cadastrar a data de vencimento de qualquer documento que hoje é permanente, direto da lista.
- Entregável:
  - **Cálculo de validade corrigido** (`documentUtils.ts`): o parser passou a entender `dd/mm/aaaa` (formato de exibição) e `aaaa-mm-dd` (input de data), devolvendo `null` para vazio/inválido; novos helpers `daysUntilExpiry`, `expiryDaysLabel`, `toDateInputValue` e as constantes `EXPIRY_WARNING_DAYS` (30) e `EXPIRY_ALERT_DAYS` (60). A situação (`Em dia` / `Vencendo` / `Vencido`) passa a ser **recalculada na leitura**, então o documento vence sozinho com o tempo, mesmo sem ninguém editar o registro.
  - **Gravação da validade** (`documentsStore.updateDocumentValidity`): define/renova a data (ou marca como permanente) e recalcula a situação, persistindo no Supabase.
  - **Painel “Alertas de vencimento”** (`ExpiryAlertsPanel`) em Documentos: painel de destaque com contadores e abas **Vencidos / Vencendo (até 60 dias) / Sem validade**, listando nome, tipo, validade, colaborador e o rótulo “Vencido há N dias / Vence em N dias”, com ação **Renovar validade** e **Definir validade**.
  - **Botão “Definir validade” na lista**: documentos sem validade exibem um botão tracejado na coluna Validade (em vez do “—”), e documentos com validade mostram a data + atalho de edição e o selo de dias restantes.
  - **Modal de validade** (`ValidityModal`): data de vencimento com atalhos **+30 dias / +6 meses / +1 ano / +2 anos**, prévia da situação resultante e opção de **remover a validade** (documento permanente).
  - **Sino do topo**: novos avisos reais de **documentos vencidos** e **vencendo em até 60 dias** (gestão vê toda a base; o colaborador vê os documentos emitidos no nome dele), substituindo o aviso fictício que existia.
  - **Meus documentos (colaborador)**: faixa de alerta com os documentos do próprio colaborador vencidos/a vencer (com orientação de procurar o SESMT) e selo de dias restantes em cada documento da lista.

### Fase 5.05: Aviso ao gestor, PDF por unidade e resumo semanal de vencimentos (CONCLUÍDA)
- Objetivo: fazer o aviso de vencimento chegar a quem resolve — o **gestor/líder da equipe** —, levar a lista
  completa em **PDF agrupado por unidade** e criar um **resumo semanal** ao SESMT, cada serviço habilitável na
  parametrização.
- Entregável:
  - **Banco**: `document_expiry_alert_settings` ganhou `notify_managers`, `attach_pdf`, `weekly_summary`,
    `weekly_weekday` e `weekly_last_sent_at`; `document_expiry_notifications` ganhou `recipient` e a unicidade passou
    a `(document_ref, expires_at, recipient)`, com policy de UPDATE para o upsert do controle de avisos.
  - **Aviso ao gestor** (`expiryEmailNotifier.managerOfDocument/managersInScope`): o gestor é resolvido pelo
    `managerId` do cadastro real de colaboradores e recebe **somente** os documentos dos seus liderados, em um
    e-mail separado do SESMT. A deduplicação é por destinatário, então o mesmo documento pode ser avisado uma vez
    ao SESMT e outra ao gestor, sem repetir para quem já recebeu.
  - **PDF por unidade** (edge function, `pdf-lib`): PDF A4 paisagem com cabeçalho (empresa, data, totais), grupos por
    estabelecimento e colunas de documento, tipo, colaborador, validade e situação, com paginação/rodapé. A unidade
    usa o campo do documento e, na falta dele, a unidade do cadastro do colaborador (documentos sem unidade entram
    em “Corporativo”). Enviado como anexo do Resend apenas no grupo do SESMT.
  - **Resumo semanal** (`weeklyExpirySummary.ts`): reúne **vencidos ainda pendentes + vencendo em até 7 dias** e envia
    ao SESMT no **dia da semana parametrizado** (segunda a sexta), com intervalo mínimo de 6 dias entre resumos
    (`weekly_last_sent_at`). Dispara no primeiro acesso da gestão a partir do dia escolhido — este projeto não tem
    agendador de madrugada.
  - **Parametrização** (`DocumentExpiryAlertSettings`): três novos blocos com toggle — aviso ao gestor (lista os
    gestores que receberiam aviso hoje com a contagem de documentos), PDF anexo e resumo semanal (dia da semana,
    último envio, quantidade no resumo e botão “Enviar resumo agora”).

### Fase 5.06: Solicitações de renovação persistidas, SLA por tipo de documento, delegação e relatório por unidade (CONCLUÍDA)
- Objetivo: tirar a fila de renovações do navegador, permitir que a equipe acompanhe a mesma tratativa de qualquer dispositivo, dar prazo (SLA) por tipo de documento, garantir uma pessoa responsável (com delegação) e medir tempo de conclusão por unidade.
- Entregável:
  - **Tabela `document_renewal_requests`** (Supabase, RLS habilitado): `payload jsonb` com a solicitação completa (tarefas, exames, anexos, histórico) e colunas denormalizadas para relatório (`document_ref`, `unit`, `status`, `owner_name`, `delegated_from_name`, `sla_days`, `due_at`, `created_at`, `completed_at`). Políticas por `current_company_id()` (leitura/escrita para membros da empresa; exclusão apenas para admin) e índices por empresa/status, unidade e documento.
  - **Store persistente** (`renewalStore.ts` reescrito): mantém a API pública usada por painel, alertas, gaveta e conferência rápida; grava de forma otimista no Supabase, hidrata a fila ao abrir, preserva `localStorage` apenas como cache offline e **migra automaticamente** as solicitações antigas do navegador quando a tabela está vazia. Expõe estado de sincronização (`useRenewalSync`: carregando/salvando/erro) com botão “Tentar novamente” no rodapé do painel.
  - **SLA por tipo de documento** (`system_settings.document_renewal_sla_days` jsonb): nova seção **“Prazo (SLA) de renovação de documentos”** em Configurações, com prazo padrão de 30 dias, presets, busca de tipo e “voltar ao padrão” por tipo. A data-limite é calculada na abertura da solicitação e o prazo das solicitações já abertas é preservado.
  - **Responsável obrigatório e delegação**: toda solicitação nasce com responsável (quem abriu) e prazo; no modal é possível **delegar a tratativa** para outra pessoa (equipe do cadastro ou nome/e-mail livre + observação). Quem delegou passa a constar como “delegada por … · segue acompanhando” e cada movimento entra no histórico. A conclusão é bloqueada sem responsável definido.
  - **Sinalização de prazo**: chips de SLA no painel e no modal (prazo, dias restantes, “estourou há X dias”, “vence hoje”), ordenação das tratativas atrasadas primeiro, contador de “SLA estourado” e marcação de concluída no prazo/fora do prazo.
  - **Relatório de renovações** (`renewalReport.ts` + `RenewalReportModal`): por unidade, com volume, em andamento, atrasadas, concluídas, **tempo médio de conclusão (dias corridos)**, melhor/pior tempo e **aderência ao SLA**, ordenado das unidades mais críticas para as melhores. Exportação em **CSV** e **PDF** (com KPIs e tabela consolidada), aberto pelo botão **Relatório** no painel de solicitações.
- **Nota honesta**: a unidade usada no relatório é a unidade gravada na solicitação (unidade do documento ou do cadastro no momento da abertura), portanto mudanças posteriores de unidade no cadastro não reescrevem o histórico; o registro de anexos continua vinculado ao documento principal conforme a fase anterior.

### Fase 5.07: Aviso de SLA estourado/tratativa parada no sino e filtros de responsabilidade na fila (CONCLUÍDA)
- Objetivo: avisar a gestão no sino do topo quando uma solicitação de renovação **estoura o prazo (SLA)** ou fica **sem movimentação por X dias**, e permitir que cada pessoa veja rapidamente **as suas tratativas** e **as delegadas a ela**.
- Entregável:
  - **Parametrização do limite de paralisação** (`system_settings.document_renewal_idle_days`, padrão 5 dias, migração `20261027100000_document_renewal_idle_alert`): novo bloco “Aviso de tratativa paralisada” na seção de SLA em Configurações, com presets (3/5/7/10/15) e campo livre, gravado com auditoria.
  - **Detecção de movimentação** (`renewalStore.renewalLastActivity` / `renewalIdleInfo`): considera abertura, assunção, delegação, agendamento, comunicação por e-mail, anexos recebidos, tarefas concluídas e histórico; devolve dias corridos sem movimento e se já passou do limite. Solicitações concluídas ficam fora.
  - **Avisos no sino** (`AppTopbar`): para Admin/Super, notificação de **quantidade de solicitações com SLA estourado** (destacando a mais atrasada) e de **tratativas sem movimentação há X+ dias** (destacando a mais parada), ambas como ação obrigatória e com atalho para a tela de Documentos.
  - **Filtros na fila de solicitações** (`RenewalRequestsPanel`): chips **Todas / Minhas tratativas / Delegadas a mim** com contadores e legenda contextual. O filtro vale para as abas Em andamento e Concluídas, com estado vazio dedicado; o vínculo é resolvido pelos helpers `isOwnedBy` e `isDelegatedTo` (responsável atual × quem delegou).
  - **Sinalização na fila**: novo contador de tratativas **paradas** no cabeçalho e chip **“Parada há X dia(s)”** em cada linha, com a data/hora da última movimentação no título.
- **Nota honesta**: “delegada a mim” é derivada do par responsável atual + quem delegou (sem tabela nova de delegações); um documento que muda de unidade no cadastro não reescreve a unidade já gravada na solicitação.

### Fase 5.08: Tratativas paradas e SLA estourado no relatório por unidade e como atalho na fila (CONCLUÍDA)
- Objetivo: mostrar no consolidado por unidade **onde** estão as tratativas sem movimentação e as fora do prazo, e permitir abrir a fila de renovações já filtrada a partir do sino.
- Entregável:
  - **Relatório por unidade** (`renewalReport.buildRenewalReport`): o cálculo passou a receber o limite de dias sem movimentação (`documentRenewalIdleDays`) e cada linha ganhou a coluna **“Paradas”** ao lado de **“SLA estourado”** (a antiga “Atrasadas” foi renomeada). O total do relatório também expõe `stalled` e o limite usado, e a ordenação desempata primeiro por SLA estourado e depois por tratativas paradas.
  - **Tela do relatório** (`RenewalReportModal`): novo KPI **“Tratativas paradas”** (com o limite parametrizado), coluna “Paradas” na tabela por unidade e as mesmas colunas no CSV e no PDF (cabeçalhos `SLA estourado` e `Paradas (sem movimentação)`), além da legenda explicando o critério.
  - **Atalhos na fila** (`RenewalRequestsPanel`): linha **“Urgência”** com os chips **Paradas** e **SLA estourado** (contadores, desabilitados em zero, clique de novo limpa), combináveis com os filtros de responsabilidade; os chips só aparecem na aba Em andamento e são limpos ao trocar para Concluídas. Estados vazios dedicados para cada atalho.
  - **Link direto do sino**: os avisos de renovação do topo passaram a abrir `?renovacao=paradas` e `?renovacao=atrasadas`; o painel lê esse parâmetro (e o mantém sincronizado ao clicar nos chips), então a fila já abre filtrada e o endereço continua compartilhável.
- **Nota honesta**: “Paradas” usa a última movimentação registrada no histórico da solicitação (não o último acesso de ninguém), e o atalho de SLA considera a data-limite calculada na abertura — mudar o SLA parametrizado depois não reescreve prazos já gravados.

### Fase 5.09: Aviso antecipado antes do SLA estourar (CONCLUÍDA)
- Objetivo: avisar a equipe **antes** de o prazo (SLA) da renovação estourar, e não só depois do atraso — tempo hábil para concluir a tratativa.
- Entregável:
  - **Parametrização** (`system_settings.document_renewal_sla_warning_days`, padrão 3, migração `20261028100000_document_renewal_sla_warning`): coluna inteira com CHECK de 0 a 60 e **0 = aviso antecipado desligado** (o alerta de estouro continua). Novo bloco **“Aviso de prazo próximo do vencimento”** na seção de SLA em Configurações, com presets (1/3/5/7/10 dias antes), chip “Desligado” e campo livre, tudo registrado na auditoria.
  - **Cálculo** (`renewalStore.getRenewalSlaWarningDays` / `renewalDueSoonInfo`): devolve os dias restantes, a janela configurada e se a tratativa está **dentro da janela sem ter estourado**; solicitações concluídas e atrasadas ficam fora do aviso antecipado.
  - **Sino** (`AppTopbar`): novo aviso **“N tratativa(s) de renovação vencendo em até X dia(s)”**, destacando a de prazo mais curto (“vence hoje” quando for o caso) e abrindo a fila já filtrada em `?renovacao=vencendo`. Só aparece quando a antecedência está maior que zero.
  - **Fila de solicitações** (`RenewalRequestsPanel`): terceiro atalho de urgência **“Vencendo”** (âmbar, com contador, desabilita em zero, combina com Minhas tratativas / Delegadas a mim), contador **“N vencendo”** no cabeçalho, leitura do parâmetro `vencendo` da URL e estado vazio próprio. O destaque de prazo na linha passou a usar a janela parametrizada em vez do limite fixo de 3 dias.
- **Nota honesta**: o aviso antecipado depende da data-limite gravada na abertura da solicitação; alterar o SLA na parametrização não recalcula prazos já em andamento (a janela de aviso recalculada vale imediatamente para todos).

### Fase 5.10: Segundo aviso por público (gestor × responsável) e e-mail automático no início da janela (CONCLUÍDA)
- Objetivo: permitir **duas janelas de aviso diferentes** — uma para o **gestor** e outra para o **responsável da tratativa** — e transformar o início de cada janela em **e-mail automático**, sem depender de alguém abrir a tela.
- Entregável:
  - **Parametrização** (`system_settings.document_renewal_manager_warning_days`, padrão 7, CHECK 0–60, migração `20261029100000_document_renewal_manager_warning`): a coluna existente `document_renewal_sla_warning_days` (padrão 3) passou a ser oficialmente a **janela do responsável**. Duas colunas independentes, ambas com 0 = aviso daquele público desligado, gravadas com auditoria. A seção de SLA em Configurações ganhou dois blocos separados (**Aviso de prazo ao responsável da tratativa** e **Aviso de prazo ao gestor**), cada um com presets e campo livre.
  - **Cálculo** (`renewalStore.getRenewalManagerWarningDays`): janela do gestor isolada da janela do responsável; `renewalDueSoonInfo(request, window)` continua recebendo a janela como parâmetro, então cada público é avaliado com o seu próprio prazo.
  - **Sino** (`AppTopbar`): como o sino é da gestão, o aviso **“N tratativa(s) vencendo em até X dia(s)”** passou a usar a **janela do gestor**; a fila e o atalho **Vencendo** continuam na **janela do responsável** (quem executa).
  - **E-mail automático** (`renewalDeadlineNotifier.ts` + edge function `notify-renewal-deadline`): ao abrir a área de Documentos, o app avalia quem entrou na janela e envia **um e-mail por destinatário**, agrupando as tratativas dele — corpo e assunto diferentes para **gestor** e **responsável**. Dispara no primeiro acesso da gestão, sem configurar cron.
  - **Controle de repetição** (`document_renewal_deadline_notifications`, unicidade `request_ref + due_at + audience + recipient`, RLS por `current_company_id()`): cada pessoa recebe **um** aviso por data-limite; renovar o prazo (nova `due_at`) libera um novo aviso e reabrir a tela não duplica nada.
- **Nota honesta**: o disparo acontece quando a gestão abre a área de Documentos (não há agendador no projeto), então a janela é respeitada mas o horário exato depende desse acesso. Sem `RESEND_API_KEY` e `RESEND_FROM_DOMAIN` nos secrets do backend, os e-mails não saem — o app avisa e os avisos continuam no sino.

### Fase 5.11: Rastreabilidade dos avisos de prazo no histórico, aviso de teste e escalonamento ao gestor (CONCLUÍDA)
- Objetivo: tornar os **avisos de prazo por e-mail rastreáveis dentro de cada tratativa** (destinatário, público e data), permitir **validar o envio antes de depender dele** e criar **escalonamento ao gestor** quando o responsável não movimenta a tratativa depois do aviso.
- Entregável:
  - **Registro no histórico** (`renewalStore.RenewalDeadlineNotice` + `registerRenewalDeadlineNotices`): cada e-mail efetivamente enviado grava, dentro da própria solicitação (payload), o **público** (`gestor` / `responsavel` / `escalonamento`), o **destinatário** (e-mail e nome), a **data/hora do envio**, a **data-limite** e os **dias restantes** no momento do envio; também entra no histórico cronológico como evento de sistema. O modal da tratativa ganhou a seção **Avisos de prazo enviados** com essa lista (chip do público, destinatário, prazo e carimbo), além do contador de envios.
  - **Avisos não contam como movimentação** (`RenewalLogEntry.system`): os eventos automáticos de aviso entram no histórico, mas ficam marcados como `system` e são ignorados por `renewalLastActivity` — senão o próprio e-mail “reiniciaria” o relógio de tratativa parada e impediria o escalonamento.
  - **Aviso de teste na parametrização** (`DocumentRenewalSlaSettings`): campo de e-mail (pré-preenchido com o e-mail da sessão) + botão **Enviar aviso de teste**, que chama a mesma função `notify-renewal-deadline` com `test: true` e uma tratativa de exemplo. A função passou a marcar o assunto com **`[TESTE]`** e a incluir um aviso visual no corpo, deixando claro que nenhuma tratativa real foi avisada. A tela mostra o resultado: enviado, `resend-not-configured` (faltam secrets) ou erro do provedor.
  - **Escalonamento** (`system_settings.document_renewal_escalation_days`, padrão 5, CHECK 0–60, migração `20261030100000_document_renewal_escalation`): novo bloco **Escalonamento ao gestor** com presets (2/3/5/7/10) e chip **Desligado**. Se, X dias depois de um aviso de prazo, a tratativa continuar **sem nenhuma movimentação** (assumir, delegar, agendar, comunicar, anexar, concluir tarefa), o gestor recebe um **novo e-mail** de escalonamento — inclusive quando o prazo já estourou.
  - **Cálculo e controle** (`renewalDeadlineNotifier.renewalEscalationCandidates`): a linha de base é o **último aviso de prazo** daquela solicitação + data-limite; qualquer atividade posterior ao aviso cancela o escalonamento. O controle no banco passou a aceitar o público **`escalonamento`** (constraint ampliada), garantindo **um escalonamento por data-limite** sem colidir com o aviso original ao gestor.
  - **Edge function `notify-renewal-deadline`**: passou a entender o público `escalonamento` (corpo/assunto próprios, focados em tratativa sem movimentação) e o modo `test`, mantendo o agrupamento por destinatário.
- **Nota honesta**: o escalonamento segue a mesma limitação dos demais avisos — é verificado quando a gestão abre a área de Documentos (não há agendador no projeto). Um escalonamento por data-limite evita spam: se mesmo depois do reaviso nada mudar, o caso permanece visível na fila (atalhos Paradas / SLA estourado) e no sino.

### Fase 5.12: Número automático por solicitação, nova solicitação antecipada, busca por número/CPF/tipo e filtro de vencimento por período (CONCLUÍDA)
- Objetivo: dar identidade pública a cada tratativa de renovação, permitir abrir solicitação **antes** do vencimento do documento e transformar a fila em um recurso de consulta profissional (busca e janela de vencimento).
- Entregável:
  - **Número automático** (`renewalStore.nextRenewalCode`): toda solicitação nasce com um código público no formato **`RS-AAAA-0001`**, sequencial por ano, e as solicitações antigas (sem número) são numeradas em ordem cronológica ao carregar a fila e gravadas de volta, para o número nunca mudar. O código aparece na linha da fila (chip monoespaçado), no subtítulo/cabeçalho do modal, no bloco de identificação e no histórico da abertura.
  - **CPF do colaborador na solicitação** (`RenewalRequest.collaboratorCpf` + `RenewalRequestContext.collaboratorCpf`): a abertura (manual ou automática) passa a guardar o CPF do colaborador do cadastro real, exibido no modal e na linha, e usado na busca.
  - **Botão "Nova Solicitação"** (`NewRenewalRequestModal`): botão primário no cabeçalho do painel (e no estado vazio) abre a escolha de documento, listando **somente documentos que ainda não venceram e que não têm solicitação em andamento** — os vencidos já ganham tratativa automática e não podem ser duplicados. A busca do seletor cobre nome, tipo, colaborador, unidade e **CPF**, com filtro por tipo, ordenação pelo vencimento mais próximo, contadores de disponíveis/já com solicitação/vencidos pendentes e criação direta da tratativa (que abre o modal).
  - **Busca na fila** (`RenewalRequestsPanel`): campo de busca por **número (RS-2026-0001)**, **CPF** (comparação por dígitos), colaborador, tipo de documento, documento, unidade e responsável, aplicado sobre a aba e os filtros ativos, com resumo "N de M solicitações" e limpeza rápida.
  - **Vencimento por período** (`renewalStore.parseBrDate` / `renewalExpiryTs`): nova linha de filtro **Vencimento do documento** com presets **7 / 30 / 60 / 90 dias** e modo **Período** (De/Até), filtrando as solicitações pela data de validade atual do documento (não pelo SLA da tratativa).
  - **Destaque visual do recurso**: o painel ganhou faixa superior com gradiente dos tokens, ícone de marca, faixa de **indicadores clicáveis** (Em andamento / Vencendo / SLA estourado / Concluídas, que também funcionam como atalhos), contadores movidos para o topo e **faixa lateral de urgência** em cada linha (vermelha para atrasada, âmbar para vencendo, secundária para em andamento, primária para concluída).
  - **Componente de linha** (`RenewalRequestRow`, novo): extrai a linha da fila do painel (que estava grande demais) preservando progresso de tarefas, prazo, tratativa parada, delegação e ações.
- **Nota honesta**: o período filtra pela **data de validade gravada no documento** (o vencimento real do papel), enquanto o chip **Vencendo** continua usando a janela de aviso do SLA do responsável — são leituras diferentes e complementares.

### Fase 5.13: Padrão único de painel de cabeçalho nos módulos (CONCLUÍDA)
- Objetivo: fazer o portal inteiro falar a mesma língua visual, aplicando nas demais áreas o painel de cabeçalho criado para Documentos (faixa gradiente da marca, selo do módulo, título com hierarquia, barra de ações com uma ação primária dominante e abas integradas na base).
- Entregável:
  - **Componente compartilhado** (`src/pages/app/components/ModuleHeader.tsx`): painel único com faixa gradiente (primary → accent), selo em cápsula com ícone, título, subtítulo, slot de ações, faixa informativa (`meta`), abas com sublinhado integradas na base do painel e variante **compacta** para módulos exibidos dentro de outro módulo. Exporta também `ModuleToolbar` e as classes `modulePrimaryAction` / `moduleGhostAction` / `moduleToolbarDivider` para que todas as barras de ação fiquem idênticas.
  - **Aplicação nos módulos**: **Ficha de EPI**, **DDS**, **CIPA** e **Colaboradores** passaram a usar o painel padrão (CIPA com as abas integradas e a faixa de comissão selecionada; EPI e DDS mantêm a variante compacta quando abertos dentro de Documentos).
  - **Barra de ações padronizada**: ação primária sólida (Nova entrega de EPI, Novo DDS, Novo colaborador) seguida de divisores e ações de apoio em estilo fantasma (Consultar CA, Relatório mensal, Importar .xlsx), com o `ExportMenu` ganhando a variante **ghost** e menu suspenso com elevação, para não destoar do restante do conjunto.
- **Nota honesta**: a padronização desta etapa cobre os quatro módulos solicitados; as telas internas de CIPA (abas), os modais e os demais módulos (APR, Assinaturas, Pesquisas, Configurações) seguem com seus cabeçalhos próprios até serem migrados.

### Fase 5.14: CAT — Comunicação de Acidente de Trabalho como documento estruturado (CONCLUÍDA)
- Objetivo: criar o tipo de documento **CAT** com todos os dados exigidos pela Lei 8.213/91 (art. 22) e preparar a transcrição para o eSocial (S-2210), com preenchimento acelerado pelo cadastro do colaborador e upload do recibo de entrega ao trabalhador.
- Entregável:
  - **Novo tipo estruturado** (`structuredData.ts` + `src/mocks/documents.ts`): `kind: "cat"` com rótulo "CAT — Comunicação de Acidente de Trabalho" no catálogo de tipos, entrando na lista de Documentos como os demais documentos estruturados.
  - **Abas do formulário** (`src/pages/app/modules/documentos/structured/cat/`): `CatEmployerSection` (bloco 1 — razão social, CNPJ/CEI/CPF, CNAE, endereço completo com CEP e telefone, pré-preenchidos com os dados da empresa de `system_settings`), `CatWorkerSection` (bloco 2 — busca por **nome, CPF ou matrícula** no cadastro real que preenche CPF, RG, CTPS, NIT/PIS, matrícula eSocial, nascimento, admissão, área, telefone e cidade/UF, restando apenas sexo, estado civil, CBO, salário e endereço), `CatAccidentSection` (bloco 3 — tipo/espécie, data e hora, horas trabalhadas, local, descrição, **agente causador** e **parte do corpo atingida** das tabelas oficiais, registro policial), `CatMedicalSection` (bloco 4 — atendimento, unidade, profissional/CRM, diagnóstico com **CID** e sugestões, afastamento com último dia trabalhado e consequência com data de óbito) e `CatReceiptSection` (upload do **recibo de entrega da CAT**, data, para quem foi entregue e se também foi ao sindicato).
  - **Numeração automática** (`buildCatProtocol`): número de controle interno sequencial por ano (`CAT-2026-0001`) gerado na abertura, com campo separado para o **nº oficial da CAT** emitida no eSocial/Empregador Web.
  - **Transcrição para o eSocial**: bloco de resumo em texto com os campos-chave de cada bloco e botão **Copiar dados**, mais o **checklist legal** (prazo de 1 dia útil, emissão imediata em caso de óbito, recibo ao trabalhador e ao sindicato, S-2210, BO quando houver).
  - **PDF oficial** (`structuredPdf.catBody`): documento com os quatro blocos, o recibo anexado (miniatura quando imagem ou identificação do arquivo) e blocos de assinatura do empregador, do trabalhador e do emissor; resumo próprio na lista de Documentos (tipo de acidente, CID e situação do recibo).
- **Nota honesta**: o envio automático ao eSocial não é feito pelo sistema (não há integração oficial); a CAT é preparada para transcrição/cópia dos dados. O recibo é armazenado como anexo digital (imagem ou PDF até 3 MB) dentro do próprio documento.

### Fase 5.15: CAT integrada — investigação automática, cobrança no sino e ficha do colaborador (CONCLUÍDA)
- Objetivo: fechar o ciclo da CAT — transformar a comunicação legal em análise técnica, cobrar as pendências legais (nº oficial e recibo) e dar ao SESMT a visão das CATs na ficha do colaborador, junto aos atestados médicos.
- Entregável:
  - **Ponte CAT → Investigação de Acidente** (`structured/cat/catInvestigation.ts`): ao salvar uma CAT, o sistema gera automaticamente uma **Investigação de Acidente** já preenchida com os mesmos dados (tipo de ocorrência convertido, gravidade derivada da consequência, data/hora, local, descrição, agente causador, parte do corpo, CID, dados e documentos do acidentado e as comunicações legais — CAT emitida, nº oficial e situação do S-2210), com checklist base e o nº de controle derivado (`INV-…`). O técnico só completa a causa raiz e o plano de ação; as duas peças passam a existir em Documentos.
  - **Alerta no sino** (`AppTopbar`): novos avisos para a gestão — **CAT sem recibo de entrega anexado** e **CAT sem o nº oficial informado** (Lei 8.213/91, art. 22, §2º), marcados como pendência que exige ação e desaparecendo quando o dado é regularizado na CAT.
  - **CATs na ficha do colaborador** (`CollaboratorDetailModal`): nova seção **CAT · Comunicação de Acidente** acima do QR-Code, vinculando o registro ao colaborador por id ou por **CPF** (quando a CAT foi preenchida sem selecionar o cadastro), com data, CID, consequência, selos de **nº oficial** e **recibo**, botão **Ver CAT** (PDF oficial) e **Recibo** (abre o arquivo anexado).
- **Nota honesta**: cada salvamento de CAT gera uma investigação nova (a CAT é imutável como ato); ajustes na investigação são feitos no próprio documento, sem sobrescrever a CAT de origem.

### Fase 5.16: CATs em aberto, CAT no portal do colaborador e plano de ação sugerido (CONCLUÍDA)
- Objetivo: dar visão operacional das pendências da CAT por unidade, levar a via e o recibo ao próprio trabalhador e acelerar o plano de ação da investigação automática.
- Entregável:
  - **Painel “CATs em aberto”** (`documentos/components/CatOpenPanel.tsx`) na área de Documentos: lista somente as CATs com **nº oficial pendente** e/ou **recibo de entrega não anexado**, com contadores, **filtro por unidade** (unidades existentes nas CATs, incluindo “Sem unidade”) e ações diretas — informar o nº oficial do eSocial/Empregador Web, anexar o recibo (imagem/PDF até 3 MB, gravando data e recebedor) e abrir a CAT em PDF. Ao regularizar, o registro é regravado e o alerta do sino é recalculado.
  - **Unidade na CAT**: novo campo `employerUnit` no bloco do empregador (com sugestões dos estabelecimentos), herdado da unidade do colaborador ao selecioná-lo, salvo no registro estruturado e impresso no PDF — é o que permite o filtro por unidade do painel.
  - **CAT no portal do colaborador** (`meusdocumentos/components/CatCollaboratorSection.tsx`): seção **CAT · Comunicação de Acidente de Trabalho** alimentada pelos documentos estruturados da empresa, vinculando por cadastro **ou CPF**, com selos de nº oficial e recibo, botão **Baixar via da CAT** (PDF oficial) e **Baixar recibo** (arquivo anexado), além do aviso legal de entrega do recibo (Lei 8.213/91, art. 22, §2º).
  - **Plano de ação sugerido** (`structured/cat/catActionPlan.ts`): a investigação gerada pela CAT passa a nascer com **ações típicas por agente causador** (máquina, ferramenta, veículo, químico, biológico, físico, piso, queda de objeto, altura, elétrica/incêndio, animal, violência, ergonômico e “outro”), cada uma com responsável padrão, prazo em dias a partir do evento e situação “Pendente”. O aviso após salvar informa quantas medidas foram sugeridas e o texto de observações da investigação aponta a revisão de responsáveis e prazos.
- **Nota honesta**: as ações são sugestões de referência técnica, não um plano aprovado — responsáveis, prazos e a causa raiz continuam sob análise do SESMT na investigação.

### Fase 5.17: Unidade obrigatória na CAT e CATs em aberto na visão do líder (CONCLUÍDA)
- Objetivo: garantir que toda CAT fique vinculada a um estabelecimento e levar o acompanhamento das pendências legais também para o líder da equipe.
- Entregável:
  - **Unidade obrigatória na CAT** (`structured/CatModal.tsx` + `cat/CatEmployerSection.tsx`): o campo **Unidade / estabelecimento** passou a ser **obrigatório**, com aviso visual quando vazio e mensagem de bloqueio no rodapé. A geração da CAT é **interrompida** quando o evento não está vinculado a um estabelecimento, antes de qualquer validação restante do formulário.
  - **Transcrição para o eSocial**: a unidade passou a constar no resumo copiável dos dados do empregador, reforçando o vínculo do evento com o estabelecimento.
  - **Painel reutilizável** (`documentos/components/CatOpenPanel.tsx`): o painel ganhou **escopo por colaborador** (`collaboratorIds` / `collaboratorCpfs`, vinculando por cadastro **ou CPF**) e parâmetros de **título/descrição/classe externa**; o estado vazio e a mensagem passam a refletir o contexto (visão do líder).
  - **CATs em aberto na visão do líder** (`/app/minhaequipe`): o mesmo painel aparece na página **Minha equipe**, filtrado apenas pelas CATs dos colaboradores sob responsabilidade do líder (vínculo por nome, por área ou visão de supervisão), com as mesmas ações de regularização (informar nº oficial, anexar recibo e abrir a CAT em PDF).
- **Nota honesta**: as CATs antigas sem unidade continuam sendo exibidas no painel de Documentos sob o rótulo “Sem unidade”, mas novos registros só são criados com estabelecimento definido.

### Fase 5.18: Aviso no sino para o líder — CAT de liderado sem recibo de entrega (CONCLUÍDA)
- Objetivo: cobrar do **líder** a entrega da via da CAT ao trabalhador, avisando no sino do topo quando houver CAT de liderado sem recibo anexado.
- Entregável:
  - **Escopo de liderança no sino** (`AppTopbar.tsx`): o topo passou a resolver os **liderados** do usuário pela mesma hierarquia de “Minha equipe” (`subordinatesOf` do `leadershipStore` — vínculo por nome e por área/setor).
  - **Vínculo por cadastro ou CPF**: o escopo dos liderados considera o **id do cadastro** do colaborador (tanto o id da base de demonstração quanto o id do cadastro real do Supabase, casados por nome/e-mail/CPF) **e o CPF** — então a CAT preenchida digitando o nome à mão também é reconhecida como sendo do liderado.
  - **Alerta no sino**: para quem é líder e tem liderados, é exibido o aviso **“X CAT(s) de liderados sem recibo de entrega”**, com os nomes dos trabalhadores pendentes na linha de detalhe, marcado como **aguardando sua ação** (não desaparece ao abrir o sino — só sai quando o recibo é anexado na CAT) e com atalho direto para **Minha equipe**, onde o painel “CATs em aberto na sua equipe” permite regularizar ali mesmo.
-- **Nota honesta**: o aviso é destinado ao **líder** (perfil colaborador com equipe). A gestão (Admin/Super) continua recebendo o alerta corporativo “X CAT(s) sem recibo de entrega anexado”, com todas as CATs da empresa.

### Fase 5.19: DDS, Ficha de EPI e APR no menu "Criar documento" (CONCLUÍDA)
- Objetivo: reunir no mesmo lugar a criação de **todos** os documentos do dia a dia — inclusive os que vivem em módulos próprios — a partir de Documentos.
- Entregável:
  - **Grupo "Módulos" no menu Criar documento** (`DocumentsHeader.tsx`): além de Registros estruturados (CAT, Investigação, Aferições, Permissão) e Operacional (Ficha de Presença, Inspeção de Campo), o menu passou a ter as entradas **DDS — Diálogo Diário de Segurança**, **Ficha de EPI** e **APR — Análise Preliminar de Risco**, cada uma com ícone e descrição objetiva. O menu ganhou altura máxima com rolagem (`max-h-[70vh]`) para não estourar a tela.
  - **Abertura direta do formulário**: ao escolher a entrada, a tela troca para a seção do módulo (`?secao=dds|epi|apr`) **já com o formulário de criação aberto** — sem precisar clicar no botão do módulo outra vez. Os módulos (`DdsPage`, `EpiPage`, `AprPage`) receberam as props `openCreate` e `onCreateConsumed`, com trava de execução única (`useRef`) e limpeza do pedido no pai, evitando reabertura ao navegar entre seções.
  - **Compatibilidade**: as páginas continuam funcionando normalmente quando abertas pelo menu lateral (nenhuma prop obrigatória foi adicionada) e o restante do menu não mudou de comportamento.

### Fase 5.20: DDS, Ficha de EPI e APR saem da barra de abas e ficam só no "Criar documento" (CONCLUÍDA)
- Objetivo: limpar a barra visível de Documentos — as três seções de módulos deixam de ocupar abas e passam a ser acessadas exclusivamente pelo menu **Criar documento**, na mesma lista onde já estava a CAT.
- Entregável:
  - **Menu "Criar documento" unificado** (`DocumentsHeader.tsx`): o antigo grupo separado "Módulos" foi absorvido no grupo **"Documentos e módulos"**, que passa a listar CAT, Investigação de Acidente, Aferições, Permissão de Trabalho, **DDS**, **Ficha de EPI** e **APR** em uma única sequência — sem subtítulo extra no meio. A abertura direta do formulário (`?secao=…` + `openCreate`) continua igual.
  - **Barra de abas enxuta** (`/app/documentos`): as abas passaram a ser apenas **Todos os documentos** e **Documentos assinados**. As seções `dds`, `epi` e `apr` receberam a marcação `menuOnly`, ficando fora da barra visível mas ainda navegáveis por link (`?secao=dds|epi|apr`), sem quebrar atalhos existentes.
  - **Orientação ao entrar pela criação**: quando a seção ativa é uma dessas, a barra de abas exibe um **chip da seção aberta** (ícone + nome) com botão **X** para voltar à lista de documentos — assim não existe tela sem caminho de volta depois de criar o DDS, a Ficha de EPI ou a APR.
  - **Escopo preservado**: filtros por módulo habilitado (`isModuleEnabled`) e a renderização embutida das três páginas continuam iguais; nenhum dado ou permissão mudou.

### Fase 5.21: Menu "Criar documento" destravado — recorte do card escondia os módulos (CONCLUÍDA)
- Objetivo: corrigir o motivo real de DDS, Ficha de EPI e APR não aparecerem no menu "Criar documento" — eles já estavam na lista, mas o painel de abertura estava sendo **cortado** pelo recorte do card do cabeçalho.
- Entregável:
  - **Fim do recorte** (`/app/documentos`): o card do cabeçalho deixou de usar `overflow-hidden` (que cortava o menu logo após a CAT) e passou a receber os cantos arredondados diretamente na faixa superior e na barra de abas, mantendo o visual original e permitindo que o menu abra inteiro por cima do conteúdo (`z-30` no card).
  - **Grupo visível no menu** (`DocumentsHeader.tsx`): DDS, Ficha de EPI e APR ganharam o subtítulo **Módulos** dentro do menu "Criar documento", separados por uma divisória — agora fica explícito que eles estão ali, junto da CAT e dos demais registros estruturados.

### Fase 5.22: Visualizador de arquivo dos documentos — zoom, download e impressão (CONCLUÍDA)
- Objetivo: corrigir a sensação de que o botão "Abrir arquivo" (conferência rápida e lista) não funcionava. Diagnóstico: os registros não tinham arquivo anexado e o aviso de "sem arquivo" era renderizado **atrás** da camada da conferência rápida, então nada aparecia.
- Entregável:
  - **Novo visualizador** (`DocumentFileViewerModal.tsx`): abre em camada próprio (`z-[70]`), acima da conferência rápida e da pré-visualização lateral, com controle de **zoom** (diminuir, aumentar, ajustar à largura), **Baixar** e **Imprimir**.
  - **Ficha modelo** (`documentFileModel.ts`): quando o registro não tem PDF gerado, arquivo no Storage nem imagem digitalizada, o visualizador monta a ficha do documento a partir do cadastro (identificação + quadro de conferência) e sinaliza claramente que o original ainda não foi anexado — nunca uma tela vazia.
  - **Abertura em todos os pontos** (`page.tsx`): ícone de visualizar da tabela, botão "Abrir arquivo" da gaveta lateral e "Abrir arquivo" da conferência rápida passaram a abrir o visualizador; os botões de **Baixar** seguem baixando direto.
  - **Teclado sem conflito**: a conferência rápida e a gaveta ignoram `Esc` e setas enquanto o visualizador estiver aberto (`[data-file-viewer]`), para não fecharem junto.

### Fase 5.23: Navegação entre documentos no visualizador e substituição de documento (CONCLUÍDA)
- Objetivo: permitir percorrer a lista dentro do próprio visualizador (anterior/próximo, com setas do teclado) sem fechar e reabrir; e tornar explícito em cada envio se é **novo documento** ou **substituição**, exigindo a identificação do documento substituído e refletindo a troca no histórico.
- Entregável:
  - **Navegação no visualizador** (`DocumentFileViewerModal` + `/app/documentos`): barra "Anterior / X de Y / Próximo", setas ← → e estado desabilitado nas extremidades. A lista navegável é a lista filtrada/ordenada da tela e, quando o documento foi aberto fora dela (conferência rápida), a base completa.
  - **Envio com tipo declarado** (`UploadDocumentModal`): escolha obrigatória entre **Novo documento** e **Substituição**. Na substituição, busca por **nome do colaborador, nome do documento ou filial**, lista de candidatos com tipo, vínculo, unidade, validade e situação, e exigência de selecionar exatamente um documento-alvo (um arquivo por envio).
  - **Preenchimento completo preservado**: mesmo em substituição, todos os campos obrigatórios continuam exigidos (tipo, vínculo, colaborador, validade quando houver); o tipo e o vínculo do documento anterior são pré-preenchidos como ponto de partida.
  - **Reflexo no histórico**: novas colunas em `documents` (`replaces_ref`, `replaces_name`, `superseded_by_ref`, `superseded_at`), mapeadas no `DocumentRecord` e no store. O documento novo registra o que substituiu e o anterior passa a **Vencido**, com selo **Substituído** na lista, na gaveta e no visualizador, permanecendo consultável por colaborador, filial e filtros de vencidos. Documentos substituídos ficam fora da conferência de renovação, dos alertas de vencimento e dos avisos por e-mail (já estão resolvidos).

### Fase 5.24: Filtro Vencido, linha do tempo da cadeia e conferência lado a lado na substituição (CONCLUÍDA)
- Objetivo: tornar a troca de documentos auditável de ponta a ponta — encontrar os vencidos rapidamente, enxergar a cadeia antigo ↔ novo e exigir conferência explícita antes de registrar uma substituição.
- Entregável:
  - **Filtro rápido por situação** (`/app/documentos`): chips *Todos · Em dia · Vencendo · Vencido* com contagem em tempo real respeitando a aba atual, além do filtro já existente no painel avançado. Um clique em **Vencido** isola a lista; o parâmetro continua refletido em `?validade=Vencido`.
  - **Cadeia de substituição** (`documentChain.ts` + `ReplacementTimeline`): percorre `replacesRef` para trás e `supersededByRef` para frente e monta a linha do tempo do original ao mais recente (tipo, validade e situação em cada etapa). Exibida na gaveta e no visualizador, com clique em qualquer etapa para abrir aquele documento sem fechar a tela.
  - **Atalho "Substituir este documento"**: botão na gaveta e no visualizador que abre o envio já em modo **Substituição**, com o alvo preenchido (tipo, vínculo, colaborador e unidade), sem nova busca.
  - **Conferência lado a lado obrigatória** (`UploadDocumentModal`): tabela comparando **tipo, emissão e validade** do documento novo com o substituído, destacando divergência de tipo e validade que não avança. A confirmação por checkbox é obrigatória e o botão de registrar só libera com os dados do novo documento completos. Novo campo **Data de emissão** passa a alimentar o registro (antes ficava sempre vazio).

### Fase 5.25: Chip "Substituídos" e justificativa obrigatória da validade que não avança (CONCLUÍDA)
- Objetivo: permitir revisar o histórico das trocas sem sair da lista e registrar formalmente a justificativa quando a nova validade não avança em relação ao documento substituído.
- Entregável:
  - **Chip "Substituídos"** (`/app/documentos`): novo atalho na faixa de situação, com contador próprio, que isola apenas os documentos já trocados (`supersededByRef`), integrado ao filtro avançado (`?validade=Substituído`) e aos botões de limpar filtros. Por simetria, o chip **Vencido** passou a listar somente os vencidos **ativos** (sem os substituídos), evitando alarme falso.
  - **Justificativa obrigatória** (`UploadDocumentModal` + coluna `documents.replacement_reason`): quando a validade do documento novo é igual/anterior à do substituído — ou quando o anterior tinha validade e o novo é registrado como permanente — o envio exige uma justificativa de pelo menos 15 caracteres, com contador, texto de orientação e bloqueio do botão **Registrar substituição** até o preenchimento.
  - **Rastreabilidade**: a justificativa é gravada no registro do documento novo (`replacementReason`) e exibida na gaveta lateral, no bloco "Registrado como substituição", junto ao nome do documento substituído.

### Fase 5.26: Substituição direta a partir do documento aberto, sem lista e com destino travado (CONCLUÍDA)
- Objetivo: tornar a substituição imediata na conferência rápida (e na gaveta/visualizador) — quem já está com o arquivo aberto não precisa buscar o documento de novo — e garantir que o novo arquivo ocupe exatamente o mesmo lugar do anterior, passando a ser o vigente.
- Entregável:
  - **Alvo travado** (`UploadDocumentModal`, estado `lockedTarget`): quando o envio é aberto pelo atalho **"Substituir este documento"**, o modal entra em modo substituição **sem exibir a busca nem a lista de outros documentos** — só o cartão do documento que já estava aberto (tipo, vínculo, colaborador, unidade e validade atual). O seletor "Este envio é" também fica oculto, e a escolha de outro alvo só aparece se a pessoa pedir explicitamente ("Trocar o documento-alvo").
  - **Destino herdado (mesmo lugar)**: com o alvo travado, o novo documento herda **vínculo, tipo, colaborador e unidade** do substituído — a seção de vínculo/tipo/colaborador vira um resumo somente leitura ("Destino do documento novo") e o envio passa a exigir apenas o arquivo, a emissão, a validade e a conferência.
  - **Trâmites parametrizados preservados**: a conferência lado a lado (tipo/emissão/validade), a justificativa obrigatória quando a validade não avança e o bloqueio do botão **Registrar substituição** continuam valendo nesse fluxo.
  - **Documento vigente**: o registro anterior passa a **Vencido/Substituído** (histórico) e o novo entra no acervo ocupando o mesmo vínculo/tipo/unidade — visível na mesma aba e nos mesmos filtros.
  - **Conferência rápida emendada** (`/app/documentos`): ao concluir a substituição durante a conferência, o documento é marcado como renovado e a sequência avança automaticamente para o próximo vencido, sem repetir a navegação.

### Fase 5.27: Selo "Vigente" na cadeia de substituição e abertura automática do arquivo recém-registrado (CONCLUÍDA)
- Objetivo: deixar evidente qual documento é o vigente de cada cadeia de substituição (destacando-o do histórico) e fechar o fluxo com a conferência final do arquivo que acabou de entrar.
- Entregável:
  - **Selo "Vigente" na lista** (`/app/documentos`): o documento que substituiu outro e **não** foi substituído depois passa a exibir o selo sólido **Vigente** (ícone de verificação) na linha, com dica mostrando qual documento ele substituiu. O selo **Substituído** continua nos registros do histórico, e o chip **Substituição** fica apenas nos elos intermediários da cadeia (documentos que já substituíram e depois foram substituídos).
  - **Selo "Vigente" na gaveta lateral** (`DocumentPreviewDrawer`): além do chip no cabeçalho, o bloco "Registrado como substituição" passa a ser destacado (borda e anel primários) quando o documento é o vigente, com a etiqueta **Documento vigente da cadeia** e o título "Vigente — registrado como substituição".
  - **Selo "Vigente" no visualizador de arquivo** (`DocumentFileViewerModal`): o chip "Substitui documento anterior" foi substituído por **Vigente** quando é o elo atual da cadeia.
  - **Cadeia de substituição** (`ReplacementTimeline`): o último elo deixou de ser rotulado "Mais recente" e passou a **Vigente**, com selo primário sólido e cartão realçado — o histórico anterior (Original / Etapas) fica visualmente separado do documento atual.
  - **Abertura automática do arquivo novo** (`/app/documentos` → `handleUploaded`): ao registrar uma substituição, o arquivo recém-enviado abre automaticamente no visualizador (por cima da lista ou da conferência rápida), já com a cadeia atualizada, para a conferência final antes de seguir. A gaveta lateral passa a apontar para o novo documento, de modo que, ao fechar o visualizador, o usuário continua no documento vigente.

### Fase 5.28: Atalho "Ver vigente" e data da última troca na lista (CONCLUÍDA)
- Objetivo: encurtar a leitura do histórico de substituições — pular direto do documento vencido para o elo atual e enxergar a data da última troca sem abrir a gaveta.
- Entregável:
  - **Índice de cadeias** (`documentChain.ts`): `buildReplacementChainIndex` resume, por documento, o elo **vigente** e a data/hora da **última troca** da cadeia, com `formatSwapDay`/`formatSwapMoment` para exibição. Documentos fora de cadeia não entram no índice.
  - **Atalho "Ver vigente" na gaveta lateral** (`DocumentPreviewDrawer`): o aviso "Documento substituído" passa a mostrar quando a troca foi registrada e traz o botão **Ver vigente**, que abre o elo atual da cadeia na mesma gaveta.
  - **Atalho "Ver vigente" no visualizador de arquivo** (`DocumentFileViewerModal`): botão primário na barra de ferramentas quando o arquivo aberto já foi substituído, levando ao documento vigente sem fechar o visualizador; o cabeçalho também mostra "Trocado em data/hora".
  - **Data da última troca na linha da lista** (`/app/documentos`): cada documento de uma cadeia exibe "Última troca em dd/mm/aaaa" abaixo dos selos, com data e hora completas na dica — leitura rápida do histórico sem abrir detalhes.

### Fase 5.29: Ações da lista de documentos coherentes com o vínculo (CONCLUÍDA)
- Objetivo: remover ações que não fazem sentido para todos os registros — a lista mistura documentos da empresa e de colaboradores, então uma ação exclusiva de colaborador não pode ficar no menu de ações da linha.
- Entregável:
  - **Remoção do atalho "Imprimir QR-Code do colaborador"** da coluna **Ações** da tabela em `/app/documentos` (o ícone de QR na linha), já que documentos da empresa não possuem colaborador associado. As ações restantes na linha seguem: **Visualizar** e **Baixar**.
  - O QR-Code do colaborador continua disponível nos pontos em que o contexto é inequívoco (gaveta lateral / visualizador), sem atalho genérico na listagem.

### Fase 5.30: QR-Code de fiscalização aberto direto na linha do colaborador (CONCLUÍDA)
- Objetivo: o atalho de QR-Code na lista de Colaboradores deve mostrar o código daquele colaborador específico, e não levar para a página geral de QR-Codes de fiscalização.
- Entregável:
  - **Modal por colaborador** (`/app/colaboradores` → ação **QR-Code de fiscalização**): o clique abre a ficha do QR (`QrFichaModal`) já com o colaborador da linha — QR-Code real (3 × 3 cm), link de verificação, contador de escaneamentos, resumo de fiscalização (cursos e EPIs), além de **Imprimir adesivo** e **Abrir página de fiscalização**.
  - **Fim da navegação genérica**: a ação deixou de redirecionar para `/app/qrcodes`; o usuário permanece na lista de colaboradores.
  - **Aviso de impressão na própria tela**: o retorno da impressão do adesivo aparece em um aviso temporário (com fechamento manual e desaparecimento automático) no topo da lista.

### Fase 5.31: Seção de QR-Code na ficha do colaborador e selo "QR ativo" na lista (CONCLUÍDA)
- Objetivo: levar a prévia do QR-Code e o link de verificação para dentro da ficha do colaborador (modal de detalhe) e permitir ler na própria linha da lista se o QR daquela pessoa está ativo e quando foi lido pela última vez.
- Entregável:
  - **Helper compartilhado** (`src/pages/app/modules/qrcodes/qrScanStatus.ts`): `qrScanStatus(collaboratorId)` e `lastScanOf` calculam a leitura mais recente (por data/hora do escaneamento, tolerando formatos DD/MM/AAAA e ISO), o total de leituras e as datas curta (`DD/MM/AAAA`) e completa — a mesma regra usada na lista e na ficha, evitando divergência entre as duas telas.
  - **QR-Code na ficha do colaborador** (`CollaboratorDetailModal`): o bloco estático antigo virou uma seção completa com o **QR-Code real (3 × 3 cm)**, o **link de verificação** em fonte monoespaçada, o **total de escaneamentos**, a **data e a origem da última leitura** (fonte, dispositivo e local — ou o aviso de que ainda não foi lido) e os botões **Imprimir adesivo** (abre o `QrPrintDialog` com etiqueta/selo/folha A4 e confirmação em aviso interno) e **Abrir página de fiscalização**.
  - **Selo "QR ativo" na linha da lista** (`/app/colaboradores`): cada colaborador passou a exibir, abaixo do e-mail, um selo com o estado do QR e a **data do último escaneamento** (destaque em `primary` quando há leitura; estado neutro "sem leitura" quando nunca foi lido), com dica mostrando data/hora completas e a origem da leitura.

### Fase 5.32: Tipos de documento sem validade e sem substituição (CONCLUÍDA)
- Objetivo: impedir que registros datados sejam trocados por outro arquivo ou recebam data de validade, já que eles atestam um fato acontecido (reunião, eleição, serviço, exame) e não uma versão renovável de documento.
- Tipos abrangidos: **qualquer Ata** (Ata da CIPA e Ata de Resultado Final), **Edital de Resultado**, **Termo de Posse**, **Dossiê do Processo Eleitoral**, **Ordem de Serviço**, **Aferições**, **DDS**, **Ficha de Presença**, **Inspeção de Campo** e **Atestado Médico**.
- Entregável:
  - **Regra única** (`documentUtils.ts`): `NO_VALIDITY_TYPE_IDS` + `isTypeWithoutValidity(typeId, typeName)` (reconhece também registros antigos pelo título) e `canBeReplaced(doc)`, usadas por todas as telas — nenhuma lista de exceções duplicada.
  - **Envio de arquivos** (`UploadDocumentModal`): ao escolher um desses tipos, o cartão **Substituição** desaparece, a validade é limpa e o bloco "possui validade?" vira o aviso **Documento sem data de validade**; o registro é sempre gravado com `expiresAt = "—"`. A busca de documentos substituíveis também ignora esses registros.
  - **Lista, gaveta e visualizador**: a coluna de validade mostra o selo estático **Sem validade** (sem botão "Definir validade"), e as ações **Substituir este documento** e **Solicitar renovação** não aparecem para esses tipos; tentativas fora da UI são bloqueadas com aviso no topo da lista.
  - **Fontes automáticas**: atas geradas pela CIPA passam a nascer sem validade (`buildAtaDocument`), assim como os exemplos de Ordem de Serviço e Atestado Médico. Fichas de Presença, Inspeções de Campo, Dossiê, Termo de Posse, Edital de Resultado e Aferições já eram gerados sem data.

### Fase 5.33: Substituição de documento na Conferência rápida (CONCLUÍDA)
- Objetivo: permitir resolver o documento vencido **durante** a conferência rápida, anexando o documento novo no lugar do antigo — o caminho que já existia na gaveta, no visualizador e na lista, mas faltava na sequência de conferência (afetava **ASO Periódico** e **Certificados de cursos e treinamentos**, entre outros renováveis).
- Entregável:
  - **Botão "Substituir este documento"** (`QuickReviewPanel`): primeira ação do rodapé do painel, abrindo o envio já no modo substituição com o documento da vez pré-selecionado. Segue a regra única `canBeReplaced`, então registros datados (atas, editais de resultado, termos de posse, dossiês, ordens de serviço, aferições, DDS, fichas de presença, inspeções de campo e atestados médicos) continuam **sem** a opção.
  - **Hierarquia das ações**: com a substituição disponível, "Solicitar renovação" passa a contorno (a tratativa vira alternativa) e um texto curto explica que o novo arquivo assume vínculo, tipo e unidade, com a conferência emendando no próximo vencido; quando o tipo não aceita substituição, a renovação segue como ação principal.
  - **Continuidade da conferência**: ao concluir o envio, o documento novo abre em conferência final e a sequência avança automaticamente para o próximo vencido (comportamento já existente em `handleUploaded`).
  - **Teclado**: a conferência ignora **Esc** e setas enquanto houver um modal aberto por cima (`data-modal-overlay` no componente `Modal`), para o envio/substituição não fechar o painel junto.

### Fase 5.34: Edital de Convocação da CIPA fora da renovação e da substituição (CONCLUÍDA)
- Objetivo: impedir que o **Edital de Convocação da CIPA** entre na renovação de documentos e na substituição — ele é peça de um pleito com data e hora para começar e terminar. Encerrado o processo, a próxima edição é um **novo edital, dentro de um novo processo eleitoral**.
- Entregável:
  - **Regra única** (`documentUtils.ts`): novo conjunto `ELECTION_DOSSIER_TYPE_IDS` (`edital-cipa`) + reconhecimento por título (`isElectionDossierDocument`), o helper `canRequestRenewal` (bloqueia registros datados e peças de pleito) e o `canBeReplaced` passando a recusar peças de pleito. Diferente dos registros datados, a peça de pleito **mantém a janela de validade** do processo.
  - **Envio de arquivos** (`UploadDocumentModal`): o modo **Substituição** desaparece para esse tipo e um aviso explica a regra; a validade continua podendo ser informada.
  - **Gaveta e visualizador** (`DocumentPreviewDrawer`): sem **Solicitar renovação** e sem **Substituir este documento**, com o bloco "Peça de processo eleitoral — sem renovação" orientando a abrir um novo pleito.
  - **Conferência rápida** (`QuickReviewPanel`): sem o botão de renovação quando o documento é peça de pleito, com a mesma orientação no rodapé.
  - **Alertas de vencimento** (`ExpiryAlertsPanel`): a linha do edital troca os botões por um selo **Pleito encerrado · sem renovação**.
  - **Fila e avisos** (`page.tsx`, `renewalStore.ts`, `NewRenewalRequestModal`): a abertura automática de tratativa para vencidos, a criação manual de solicitação e os avisos de vencimento por e-mail passam a ignorar peças de pleito.

### Fase 5.35: Perfis & permissões por empresa (CONCLUÍDA)
- Objetivo: permitir que o administrador de cada empresa crie perfis próprios, parametrize as permissões por recurso e aloque os usuários nesses perfis, com isolamento total por tenant.
- Entregável:
  - **Catálogo único de permissões** (`permissionCatalog.ts`): todos os recursos e ações do sistema (subir arquivo, visualizar, substituir, excluir, incluir colaborador, criar CIPA, DDS, lista de presença, inspeção, imprimir em lote etc.) declarados em um só lugar — todo recurso novo entra aqui.
  - **Perfis por empresa** (tabela `company_access_profiles` + `accessProfileStore.ts`) e **vínculo de usuários** (tabela `company_access_members`), com RLS: só o administrador daquela empresa lê, cria, edita ou exclui, e o vínculo só aceita usuário e perfil da mesma empresa.
  - **Tela “Perfis & permissões”** (`/app/perfis`): lista de perfis, editor de permissões agrupado por recurso com liberar/bloquear tudo, criação de perfil (em branco ou copiando outro), exclusão com confirmação e painel de alocação dos usuários.
  - **Perfis padrão semeados**: **Administrador** (protegido, acesso integral) e **Colaborador**.
  - **Acesso efetivo no servidor** (`tenant_effective_access`): o perfil atribuído passa a resolver menu, rota e permissões; permissão não marcada = bloqueada.

### Fase 5.36: Perfil de exemplo “Técnico de Segurança” pré-parametrizado (CONCLUÍDA)
- Objetivo: oferecer um perfil de exemplo já parametrizado para a função de SESMT de campo, aplicável em um clique pela empresa, sem que o administrador precise montar 25 permissões na mão.
- Entregável:
  - **Modelo de perfil** (`accessProfileTemplates.ts`): `accessProfileTemplates` com o perfil **Técnico de Segurança** (ícone `ri-stethoscope-line`, descrição da função e lista `granted`), e o helper `templatePermissions` que devolve o catálogo completo com as faltantes desmarcadas.
  - **Permissões do modelo** (25 liberadas): exportar relatórios, assinar documentos, Acervo de Documentos (visualizar, subir, substituir, validade, lista de presença, inspeção de campo, impressão em lote), CIPA (atas, ações e inspeções — **sem** abrir pleito nem conduzir eleição), DDS (criar e relatório), EPI (entrega, substituição e consulta de CA — **sem** exclusão), resultado de pesquisas e QR-Codes de fiscalização. **Sem** gestão de perfis, configurações da empresa, auditoria, exclusão de documentos e administração de colaboradores.
  - **Painel “Perfis de exemplo”** (`ExampleProfilesPanel`): bloco no topo da tela de Perfis com o cartão do modelo, as permissões liberadas em chips, contador e botão **Criar este perfil**; quando o perfil já existe na empresa o botão vira o selo **Já criado**.
  - **Criação na empresa**: aplicar o modelo cria um **perfil normal** do tenant (editável e excluível), com o perfil novo já selecionado e aviso de sucesso.
  - **Semeadura nas empresas existentes**: o perfil **Técnico de Segurança** foi criado nas empresas já cadastradas (25 permissões cada), aparecendo imediatamente em Perfis & permissões.

### Fase 5.37: Ícone do perfil como seletor visual de desenhos (CONCLUÍDA)
- Objetivo: substituir a lista de nomes do campo **Ícone** (que mostrava o nome técnico do arquivo) por um seletor visual com os próprios desenhos, cobrindo várias profissões — inclusive capacete de obra.
- Entregável:
  - **Catálogo visual de ícones** (`src/pages/app/permissions/profileIconCatalog.ts`): `profileIconGroups` com três grupos — **Governança e acessos**, **Saúde e segurança do trabalho** e **Operação e campo** — totalizando ~30 ícones, cada um com rótulo humano (`profileIconLabel`), e `defaultProfileIcon` como padrão.
  - **Capacete e demais profissões**: o ícone **Capacete — obra e indústria** usa Font Awesome (`fa-solid fa-helmet-safety`, que o Remix Icon não possui); os demais seguem o traço linear do Remix Icon (`ri-*`). O catálogo inclui estetoscópio (SESMT), coração/pulso (medicina do trabalho), maleta de primeiros socorros, extintor/brigada, alarme, ferramentas (manutenção), martelo (obra civil), prédio industrial, caminhão (logística), laboratório/química, restaurante (alimentação), folha (meio ambiente), prancheta (inspeção), documentos, computador (TI), gráfico (indicadores), maleta (RH), liderança, equipe, pessoas, medalha (responsável técnico), distintivo (fiscalização), escudo, estrela (gestão), engrenagem (administração), cadeado, olho (somente leitura) e escudo com check (auditoria).
  - **Seletor visual** (`ProfileIconPicker`): grade de botões quadrados mostrando o **desenho de cada ícone** (o nome vira apenas dica no `title`/`aria-label`), agrupados por categoria, com destaque e check no selecionado e uma legenda curta “Selecionado: …”.
  - **Aplicado em dois lugares** (`ProfileEditor` e `NewProfileModal`): o `select` de nomes foi substituído pelo seletor visual; o formulário do editor foi reorganizado (Nome e Descrição na mesma linha, ícone em largura total abaixo). Perfis antigos continuam válidos (os ícones anteriores estão no catálogo).

### Fase 5.38: QR-Code de fiscalização em endereço real e ficha pública lendo o cadastro real (CONCLUÍDA)
- Objetivo: fazer o QR-Code do colaborador funcionar de verdade ao ser escaneado por um celular (sem login), em vez de apontar para um subdomínio que ainda não existe na internet.
- Diagnóstico: o QR gravava `https://<subdominio>.sstek.com/fiscalizacao/<id>`, mas o subdomínio está com DNS/HTTPS pendentes — o celular tentava abrir um endereço inexistente e nada carregava. Além disso a página pública só conhecia os colaboradores de demonstração.
- Entregável:
  - **Endereço real no QR** (`fiscalizacaoUrl` em `QrCode.tsx`): o endereço passa a ser montado a partir da **origem atual** do sistema (pré-visualização ou domínio publicado) + **prefixo de publicação** (`__BASE_PATH__`), com o subdomínio da empresa levado como parâmetro (`?empresa=<subdominio>`). Vale para a grade de QR-Codes, ficha do colaborador, ficha de EPI, adesivos e impressão em lote — sem mudar a assinatura da função.
  - **Edge function `fiscalizacao-publica`** (pública, `verify_jwt: false`, service role): resolve a empresa pelo subdomínio e devolve **apenas** o necessário para a fiscalização — identificação do trabalhador, empresa/CNPJ, responsável técnico, telefone do SESMT, papel timbrado e a **ficha de EPI real** (`epi_deliveries`) com a validade de cada CA vinda do catálogo CAEPI ativo. **Privacidade:** CPF sai mascarado (só os 2 últimos dígitos); PIS, CTPS, e-mail e telefone do trabalhador nunca saem. Sem fallback para outra empresa.
  - **Página `/fiscalizacao/:id` lendo o cadastro real**: passou a consultar a função acima, com estados de **carregando**, **erro com “Tentar novamente”** e **QR não encontrado**; a ficha mostra os números reais do cadastro (cursos ativos/vencidos, EPIs em uso), a lista de EPIs entregues com status por validade do CA e o capacete em uso destacado. As fichas de demonstração (ids `c-001`…) continuam funcionando como antes.

### Fase 5.39: QR-Code do colaborador recém-cadastrado (grade com cadastro real) (CONCLUÍDA)
- Objetivo: permitir testar o QR-Code de um colaborador recém-cadastrado conferindo se a ficha pública abre com os dados dele.
- Diagnóstico: a tela **QR-Codes** ainda montava a grade com os colaboradores de **demonstração** (`mocks`), então um colaborador recém-cadastrado não aparecia ali e não era possível gerar/testar o QR dele. Além disso, o botão **Abrir página de fiscalização** do modal do QR levava para `/fiscalizacao/:id` **sem** o parâmetro `empresa`, e a ficha pública respondia “QR-Code não identifica a empresa” para colaboradores reais. Por fim, o salvamento do cadastro fechava o formulário mesmo quando o insert falhava (ex.: CPF já cadastrado na empresa).
- Entregável:
  - **Grade de QR-Codes com o cadastro real** (`/app/qrcodes`): a lista passa a vir do `collaboratorsStore` (`useCollaborators`), com fallback à base de demonstração apenas enquanto o cadastro carrega. As **áreas** do filtro são derivadas dos colaboradores reais, a situação (Conforme/Com pendência) usa os contadores do cadastro quando não há perfil de demonstração, e o endereço exibido no card é o **link real** gravado no QR (não mais `<subdominio>.sstek.com`).
  - **Link de teste correto** (`QrFichaModal`): o botão **Abrir página de fiscalização** passa a incluir `?empresa=<subdominio>`, fazendo a ficha pública buscar o colaborador real da empresa correta.
  - **Salvamento do colaborador com retorno real** (`Colaboradores` + `CollaboratorFormModal`): `handleSave` passou a devolver sucesso/falha; o formulário **não fecha** quando o banco recusa o cadastro e exibe o motivo (CPF já cadastrado etc.), e ao concluir mostra o aviso de que o QR-Code do novo colaborador já está disponível na lista e na tela de QR-Codes.
  - **Privacidade mantida**: a ficha pública continua mascarando o CPF e não expõe PIS/CTPS, conforme a Fase 5.38.

### Fase 5.40: QR-Code apontando para o endereço público real (fim do “invalid authorization”) (CONCLUÍDA)
- Objetivo: fazer o QR-Code de fiscalização abrir a ficha no celular de quem fiscaliza, sem depender de sessão logada.
- Diagnóstico: ao escanear o adesivo, o celular recebia `{"code":"UnAuthorized","meta":{"message":"invalid authorization"}}` do gateway — não era o colaborador nem o QR: o endereço gravado dentro do QR era o **endereço do ambiente onde o adesivo foi impresso** (origem do navegador, ex.: editor de pré-visualização), que exige sessão da plataforma. Fora do navegador logado, esse endereço responde erro de autorização em vez de abrir a página.
- Entregável:
  - **Campo “Endereço público”** (`system_settings.public_base_url`, migração `20261031100000_system_settings_public_base_url_up/down`): guarda o domínio onde o sistema está publicado (ex.: `https://sstek.suaempresa.com.br`), lido/gravado pelo `settingsStore` (com auditoria).
  - **Resolução única do endereço** (`src/pages/app/modules/qrcodes/publicBase.ts`): prioriza o endereço configurado e, quando vazio, usa a origem atual + caminho de publicação (`__BASE_PATH__`). `fiscalizacaoUrl` (reexportada por `QrCode.tsx`) passa a usá-la, então **grade, ficha do QR, ficha do colaborador, ficha de EPI e folha de impressão** geram o mesmo link corrigido.
  - **Painel “Endereço público dos adesivos”** (`QrPublicBaseCard`) na tela **QR-Codes**: mostra o endereço em uso, avisa em destaque quando ele **exige login** (pré-visualização/localhost/IP) explicando que o celular receberá “invalid authorization”, permite salvar o endereço publicado (exige `tenant.settings`), exibe o **link de exemplo** gerado e permite copiá-lo. A grade é remontada ao salvar, redesenhando os QR-Codes na hora.
  - **Função pública sem JWT** (`fiscalizacao-publica`): redeployada com `verify_jwt: false`, coerente com a página aberta sem login (a função não lê JWT e continua mascarando CPF e omitindo PIS/CTPS).

### Fase 5: Portal do Colaborador
- Objetivo: autonomia do colaborador.
- Entregável: edição de dados, troca de senha, download de documentos e alertas.

### Fase 6: Pesquisas e Avaliações
- Objetivo: clima diário, psicossocial (40 perguntas) e avaliações customizadas.
- Entregável: formulários, regras de anonimato/alvo e dashboards dinâmicos.

### Fase 7: Licenças, Subdomínios e Parametrização (Super Administrador)
- Objetivo: gestão comercial e de tenants.
- Entregável: planos S1/S2/S3, cobrança recorrente, bloqueio por inadimplência e parametrização por perfil.