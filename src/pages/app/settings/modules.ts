/**
 * Catálogo dos módulos que a empresa contratante pode habilitar ou desabilitar.
 *
 * A ausência de uma chave no mapa `enabledModules` significa módulo habilitado —
 * assim o sistema continua com todos os módulos ativos por padrão e nada muda
 * para quem já usava a plataforma antes desta parametrização existir.
 */
export interface SystemModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Itens do menu lateral que pertencem a este módulo. */
  navIds: string[];
  /** Rota principal do módulo (usada nas mensagens de aviso). */
  path: string;
  /** Módulos obrigatórios não podem ser desativados (ex.: níveis de segurança). */
  required?: boolean;
}

export const systemModules: SystemModule[] = [
  {
    id: "cipa",
    name: "CIPA",
    description:
      "Comissão Interna de Prevenção de Acidentes: eleições, atas, dossiês, inspeções de campo e ações corretivas.",
    icon: "ri-government-line",
    navIds: ["cipa"],
    path: "/app/cipa",
  },
  {
    id: "dds",
    name: "DDS",
    description: "Diálogos Diários de Segurança, registros de participação e relatórios mensais.",
    icon: "ri-presentation-line",
    navIds: ["dds"],
    path: "/app/dds",
  },
  {
    id: "epi",
    name: "Ficha de EPI",
    description: "Entregas de equipamentos de proteção, consulta de CA e termo de recebimento assinado.",
    icon: "ri-shirt-line",
    navIds: ["epi", "minhaepi"],
    path: "/app/epi",
  },
  {
    id: "apr",
    name: "APR",
    description: "Análise Preliminar de Risco por atividade, com assinatura dos colaboradores envolvidos.",
    icon: "ri-clipboard-line",
    navIds: ["apr"],
    path: "/app/apr",
  },
  {
    id: "assinaturas",
    name: "Assinaturas",
    description: "Assinaturas eletrônicas, documentos assinados e políticas de assinatura.",
    icon: "ri-file-shield-2-line",
    navIds: ["assinaturas", "documentos-assinados", "politicas"],
    path: "/app/assinaturas",
  },
  {
    id: "sentimento",
    name: "Sentimento da equipe",
    description: "Pesquisa diária de humor da equipe, tendências e alertas de bem-estar.",
    icon: "ri-emotion-line",
    navIds: ["sentimento"],
    path: "/app/sentimento",
  },
  {
    id: "veiculos",
    name: "Veículos e frota",
    description:
      "Frota da empresa: cadastro, documentação veicular com versões, vencimentos e exigências por categoria.",
    icon: "ri-truck-line",
    navIds: ["veiculos"],
    path: "/app/veiculos",
  },
  {
    id: "qrcodes",
    name: "QR-Codes de fiscalização",
    description: "QR-Codes por colaborador, fichas públicas de fiscalização e histórico de leituras.",
    icon: "ri-qr-scan-2-line",
    navIds: ["qrcodes", "qrlogs"],
    path: "/app/qrcodes",
  },
  {
    id: "treinamentos",
    name: "Treinamentos e pesquisas",
    description:
      "Treinamentos obrigatórios, certificados e pesquisas internas (formulários anônimos ou identificados).",
    icon: "ri-award-line",
    navIds: ["treinamentos", "pesquisas"],
    path: "/app/treinamentos",
  },
];

/** Mapa rápido: item do menu -> módulo que o controla. */
export const moduleIdByNavId: Record<string, string> = systemModules.reduce<Record<string, string>>(
  (acc, module) => {
    module.navIds.forEach((navId) => {
      acc[navId] = module.id;
    });
    return acc;
  },
  {}
);