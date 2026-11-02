import { blankPermissions } from "@/pages/app/permissions/permissionCatalog";

/**
 * Perfis de exemplo prontos para uso.
 *
 * Cada item é apenas um PONTO DE PARTIDA: ao aplicar, o sistema cria um perfil
 * normal dentro da empresa (company_access_profiles), que pode ser renomeado,
 * ajustado ou excluído como qualquer outro. Nada aqui é compartilhado entre
 * empresas — o modelo só existe no código, a cópia pertence ao tenant.
 */
export interface AccessProfileTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Chaves do catálogo que nascem liberadas neste modelo. */
  granted: string[];
}

function buildPermissions(granted: string[]): Record<string, boolean> {
  const map = blankPermissions();
  granted.forEach((key) => {
    map[key] = true;
  });
  return map;
}

const tecnicoDeSeguranca: AccessProfileTemplate = {
  key: "tecnico-seguranca",
  name: "Técnico de Segurança",
  description:
    "SESMT de campo: sobe e substitui documentos, controla validade, cria DDS, lista de presença, inspeções e conduz ações da CIPA. Não mexe em perfis, configurações da empresa nem exclui registros.",
  icon: "ri-stethoscope-line",
  granted: [
    // Acessos e governança — só o que o SESMT precisa no dia a dia
    "tenant.reports",
    "tenant.signature",
    // Documentos — operação completa, sem exclusão
    "tenant.documents",
    "documents.view",
    "documents.upload",
    "documents.replace",
    "documents.validity",
    "documents.attendance",
    "documents.inspection",
    "documents.batchPrint",
    // CIPA — acompanha, registra ata e ação, inspeciona; não abre pleito nem conduz eleição
    "tenant.cipa",
    "cipa.minutes",
    "cipa.actions",
    "cipa.inspections",
    // DDS
    "tenant.dds",
    "dds.create",
    "dds.report",
    // EPI — entrega, substituição e consulta de CA
    "tenant.epi",
    "epi.deliver",
    "epi.replacements",
    "epi.caQuery",
    // Pesquisas e treinamentos — só lê resultado
    "tenant.surveys",
    "surveys.results",
    // QR-Codes de fiscalização
    "tenant.qrcodes",
    "qrcodes.logs",
  ],
};

export const accessProfileTemplates: AccessProfileTemplate[] = [tecnicoDeSeguranca];

/** Permissões finais de um modelo (catálogo completo, faltantes desmarcadas). */
export function templatePermissions(template: AccessProfileTemplate): Record<string, boolean> {
  return buildPermissions(template.granted);
}