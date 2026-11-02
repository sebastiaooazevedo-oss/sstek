/**
 * Catálogo ÚNICO de permissões dos perfis de acesso da empresa (tenant).
 *
 * Regra de ouro: todo recurso novo do sistema (tela, botão de envio, exclusão,
 * criação de CIPA, DDS, lista de presença etc.) precisa ser declarado aqui.
 * O painel "Perfis & permissões" monta os botões de ativar/desativar a partir
 * desta lista, e as telas consultam a mesma chave por meio de `usePermissions`.
 *
 * As chaves `tenant.*` governam o acesso à tela/módulo (o item desaparece do
 * menu e a rota não abre). As demais governam ações dentro do módulo.
 */

export interface PermissionAction {
  key: string;
  label: string;
  description: string;
}

export interface PermissionResource {
  id: string;
  name: string;
  description: string;
  icon: string;
  actions: PermissionAction[];
}

export const permissionResources: PermissionResource[] = [
  {
    id: "access",
    name: "Acessos e governança",
    description: "Quem administra a empresa, os perfis e as evidências.",
    icon: "ri-shield-user-line",
    actions: [
      {
        key: "tenant.permissions",
        label: "Gerenciar perfis e permissões",
        description: "Criar perfis, liberar permissões e alocar colaboradores nos perfis.",
      },
      {
        key: "tenant.settings",
        label: "Acessar Configurações da empresa",
        description: "Dados da empresa, identidade visual, políticas e módulos contratados.",
      },
      {
        key: "tenant.audit",
        label: "Consultar auditoria da empresa",
        description: "Ver a trilha de operações e acessos do tenant.",
      },
      {
        key: "tenant.reports",
        label: "Exportar relatórios",
        description: "Gerar PDF e planilhas das listas e relatórios.",
      },
      {
        key: "tenant.signature",
        label: "Assinar documentos",
        description: "Assinar termos, fichas, APRs e atas em nome próprio.",
      },
    ],
  },
  {
    id: "collaborators",
    name: "Colaboradores",
    description: "Cadastro e manutenção da equipe da empresa.",
    icon: "ri-team-line",
    actions: [
      {
        key: "tenant.collaborators",
        label: "Acessar o módulo de colaboradores",
        description: "Abrir a lista de colaboradores da empresa.",
      },
      {
        key: "collaborators.create",
        label: "Incluir novos colaboradores",
        description: "Cadastrar colaboradores um a um.",
      },
      {
        key: "collaborators.edit",
        label: "Editar colaboradores",
        description: "Alterar cargo, setor, matrícula e dados de contato.",
      },
      {
        key: "collaborators.delete",
        label: "Excluir colaboradores",
        description: "Remover colaboradores da empresa.",
      },
      {
        key: "collaborators.import",
        label: "Importar planilha de colaboradores",
        description: "Subir arquivo .xlsx com vários colaboradores de uma vez.",
      },
    ],
  },
  {
    id: "documents",
    name: "Documentos",
    description: "Acervo documental, validade, substituição, listas e inspeções.",
    icon: "ri-file-list-3-line",
    actions: [
      {
        key: "tenant.documents",
        label: "Acessar o módulo de documentos",
        description: "Abrir o acervo de documentos da empresa.",
      },
      {
        key: "documents.view",
        label: "Visualizar e baixar documentos",
        description: "Somente leitura do acervo, com download dos arquivos.",
      },
      {
        key: "documents.upload",
        label: "Subir arquivos de documentos",
        description: "Enviar novos documentos e arquivos para o acervo.",
      },
      {
        key: "documents.replace",
        label: "Substituir documentos",
        description: "Trocar o arquivo de um documento existente mantendo o vínculo.",
      },
      {
        key: "documents.delete",
        label: "Excluir documentos",
        description: "Remover documentos do acervo da empresa.",
      },
      {
        key: "documents.validity",
        label: "Definir validade e renovação",
        description: "Informar data de validade e solicitar renovação de documentos.",
      },
      {
        key: "documents.attendance",
        label: "Criar lista de presença",
        description: "Emitir folhas de presença para treinamentos e eventos.",
      },
      {
        key: "documents.inspection",
        label: "Criar inspeção de campo",
        description: "Registrar inspeções de campo com checklist e evidências.",
      },
      {
        key: "documents.batchPrint",
        label: "Imprimir documentos em lote",
        description: "Montar lotes de impressão e conferência em massa.",
      },
    ],
  },
  {
    id: "vehicles",
    name: "Veículos e frota",
    description:
      "Frota da empresa, documentação veicular versionada, vencimentos e exigências por categoria.",
    icon: "ri-truck-line",
    actions: [
      {
        key: "tenant.vehicles",
        label: "Acessar o módulo de Veículos",
        description: "Abrir a frota, os documentos e as exigências documentais da empresa.",
      },
      {
        key: "vehicles.create",
        label: "Cadastrar veículos",
        description: "Incluir um veículo novo na frota da empresa.",
      },
      {
        key: "vehicles.edit",
        label: "Editar e inativar veículos",
        description:
          "Alterar cadastro, situação e hodômetro, e inativar veículo preservando todo o histórico.",
      },
      {
        key: "vehicles.documents",
        label: "Gerir documentos e exigências do veículo",
        description:
          "Anexar e substituir documentos (mantendo versões), registrar avisos e configurar exigências por categoria.",
      },
      {
        key: "vehicles.checklists",
        label: "Gerir checklists de inspeção",
        description:
          "Criar e versionar checklists por categoria do veículo, definir itens, criticidade, foto obrigatória e regra de bloqueio.",
      },
      {
        key: "vehicles.inspections",
        label: "Realizar e tratar inspeções",
        description:
          "Executar inspeções de segurança com evidências e registrar a tratativa dos achados encontrados.",
      },
      {
        key: "vehicles.unblock",
        label: "Desbloquear veículos",
        description:
          "Liberar veículo bloqueado por não conformidade crítica, exigindo justificativa e evidência registradas.",
      },
      {
        key: "vehicles.epc",
        label: "Vincular e movimentar EPCs",
        description:
          "Vincular equipamentos e acessórios ao veículo, registrar retirada e transferir entre veículos sem duplicar.",
      },
      {
        key: "vehicles.checkin",
        label: "Registrar entrega e devolução (check-in)",
        description:
          "Registrar a entrega do veículo ao condutor e a devolução à empresa, com dupla conferência, hodômetro, combustível e fotos obrigatórias.",
      },
    ],
  },
  {
    id: "cipa",
    name: "CIPA",
    description: "Comissões, processos eleitorais, atas, ações e inspeções.",
    icon: "ri-government-line",
    actions: [
      {
        key: "tenant.cipa",
        label: "Acessar o módulo de CIPA",
        description: "Abrir comissões, pleitos eleitorais e histórico da CIPA.",
      },
      {
        key: "cipa.create",
        label: "Criar CIPA e processo eleitoral",
        description: "Cadastrar comissão e abrir um novo pleito eleitoral.",
      },
      {
        key: "cipa.elections",
        label: "Conduzir eleições",
        description: "Voto, urna, candidatos, apuração e dossiê do pleito.",
      },
      {
        key: "cipa.minutes",
        label: "Criar e assinar atas",
        description: "Registrar atas de reunião e atas de resultado final.",
      },
      {
        key: "cipa.actions",
        label: "Gerenciar ações corretivas",
        description: "Abrir, acompanhar e encerrar ações da CIPA.",
      },
      {
        key: "cipa.inspections",
        label: "Registrar inspeções da CIPA",
        description: "Inspeções de segurança com checklist e relatório.",
      },
    ],
  },
  {
    id: "dds",
    name: "DDS",
    description: "Diálogos Diários de Segurança e presença dos participantes.",
    icon: "ri-presentation-line",
    actions: [
      {
        key: "tenant.dds",
        label: "Acessar o módulo de DDS",
        description: "Abrir o histórico de Diálogos Diários de Segurança.",
      },
      {
        key: "dds.create",
        label: "Criar DDS",
        description: "Registrar um novo diálogo com tema, facilitador e participantes.",
      },
      {
        key: "dds.report",
        label: "Emitir relatório mensal de DDS",
        description: "Gerar o consolidado mensal dos diálogos realizados.",
      },
    ],
  },
  {
    id: "epi",
    name: "Ficha de EPI",
    description: "Entregas, substituições e consulta de CA.",
    icon: "ri-shirt-line",
    actions: [
      {
        key: "tenant.epi",
        label: "Acessar o módulo de EPI",
        description: "Abrir as fichas de EPI da empresa.",
      },
      {
        key: "epi.deliver",
        label: "Registrar entrega de EPI",
        description: "Lançar novas entregas e colher a assinatura do colaborador.",
      },
      {
        key: "epi.replacements",
        label: "Gerenciar pedidos de substituição",
        description: "Analisar, atender e encerrar solicitações de troca de EPI.",
      },
      {
        key: "epi.caQuery",
        label: "Consultar CA no portal oficial",
        description: "Consultar situação do Certificado de Aprovação.",
      },
      {
        key: "epi.delete",
        label: "Excluir fichas e entregas de EPI",
        description: "Remover registros de entrega e termos assinados.",
      },
    ],
  },
  {
    id: "surveys",
    name: "Pesquisas e treinamentos",
    description: "Pesquisas internas, treinamentos obrigatórios e resultados.",
    icon: "ri-survey-line",
    actions: [
      {
        key: "tenant.surveys",
        label: "Acessar pesquisas e treinamentos",
        description: "Abrir a área de pesquisas e treinamentos da empresa.",
      },
      {
        key: "surveys.create",
        label: "Criar pesquisas",
        description: "Montar formulários, perguntas e público-alvo.",
      },
      {
        key: "surveys.publish",
        label: "Publicar e encerrar pesquisas",
        description: "Colocar a pesquisa no ar e encerrar a coleta.",
      },
      {
        key: "surveys.results",
        label: "Ver resultados e comparações",
        description: "Analisar respostas, comparar ciclos e exportar dados.",
      },
    ],
  },
  {
    id: "mood",
    name: "Sentimento da equipe",
    description: "Humor diário, tendências e atenção ao bem-estar.",
    icon: "ri-emotion-line",
    actions: [
      {
        key: "tenant.mood",
        label: "Acessar sentimento da equipe",
        description: "Abrir o painel de humor e tendências da equipe.",
      },
      {
        key: "mood.viewTeam",
        label: "Ver humor por pessoa",
        description: "Detalhar o humor individual dos liderados.",
      },
    ],
  },
  {
    id: "qrcodes",
    name: "QR-Codes de fiscalização",
    description: "Fichas públicas, adesivos e histórico de leituras.",
    icon: "ri-qr-scan-2-line",
    actions: [
      {
        key: "tenant.qrcodes",
        label: "Acessar QR-Codes de fiscalização",
        description: "Gerar QR-Codes e imprimir adesivos por colaborador.",
      },
      {
        key: "qrcodes.logs",
        label: "Consultar histórico de leituras",
        description: "Ver quem leu cada ficha pública e quando.",
      },
      {
        key: "qrcodes.consultas",
        label: "Consultar o relatório de consultas externas",
        description:
          "Ver o relatório com nome, órgão, CPF, finalidade e data/hora de quem consultou as fichas pelo QR-Code. Expõe dados pessoais do consultante.",
      },
      {
        key: "qrcodes.renew",
        label: "Renovar QR-code do colaborador",
        description:
          "Substituir o identificador do QR de um colaborador, com motivo obrigatório e registro em log. Não concede permissão para administrar perfis.",
      },
    ],
  },
];

/** Todas as chaves válidas, na ordem em que aparecem no painel. */
export const allPermissionKeys: string[] = permissionResources.flatMap((resource) =>
  resource.actions.map((action) => action.key)
);

export function permissionLabel(key: string): string {
  for (const resource of permissionResources) {
    const action = resource.actions.find((item) => item.key === key);
    if (action) return action.label;
  }
  return key;
}

/** Quantidade de permissões liberadas em um mapa. */
export function countGranted(permissions: Record<string, boolean>): number {
  return allPermissionKeys.filter((key) => permissions[key] === true).length;
}

/** Permissões padrão de um novo perfil em branco. */
export function blankPermissions(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  allPermissionKeys.forEach((key) => {
    map[key] = false;
  });
  return map;
}

/**
 * Padrões usados apenas como ponto de partida do formulário de novo perfil.
 * Perfis já existentes usam exatamente o que está gravado no banco.
 */
export function defaultPermissionsFor(kind: "admin" | "colaborador"): Record<string, boolean> {
  const map = blankPermissions();
  if (kind === "admin") {
    allPermissionKeys.forEach((key) => {
      map[key] = true;
    });
    return map;
  }
  map["tenant.signature"] = true;
  return map;
}

/**
 * Normaliza um mapa vindo do banco: mantém apenas chaves conhecidas e garante
 * que todo o catálogo exista no objeto (o que não estiver marcado fica falso).
 */
export function normalizePermissions(raw: unknown): Record<string, boolean> {
  const map = blankPermissions();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return map;
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === "boolean") map[key] = value;
  });
  return map;
}