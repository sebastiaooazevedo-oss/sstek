import type { RoleId } from "@/mocks/app";

/**
 * Liga cada tela do app interno à capacidade da matriz "Perfis & permissões".
 *
 * Só entram aqui as telas de GESTÃO. As telas de dados próprios do colaborador
 * (meu painel, meus dados, minha ficha de EPI, meus documentos, alertas) não
 * dependem da matriz: elas já são limitadas pelo vínculo do próprio usuário no
 * banco e não existe permissão que faça sentido revogar sem quebrar o acesso.
 */
interface ScreenRule {
  /** Primeiro segmento da rota (`/app/<navId>`) e id do item de menu. */
  navId: string;
  /** Chave da capacidade em `permissionCatalog`. */
  permission: string;
  /** Perfis em que a regra realmente se aplica. */
  roles: RoleId[];
}

const screenRules: ScreenRule[] = [
  { navId: "colaboradores", permission: "tenant.collaborators", roles: ["admin"] },
  { navId: "documentos", permission: "tenant.documents", roles: ["admin"] },
  { navId: "veiculos", permission: "tenant.vehicles", roles: ["admin"] },
  { navId: "epi", permission: "tenant.epi", roles: ["admin"] },
  { navId: "cipa", permission: "tenant.cipa", roles: ["admin"] },
  { navId: "dds", permission: "tenant.dds", roles: ["admin"] },
  { navId: "qrcodes", permission: "tenant.qrcodes", roles: ["admin"] },
  { navId: "qrlogs", permission: "tenant.qrcodes", roles: ["admin"] },
  { navId: "perfis", permission: "tenant.permissions", roles: ["admin"] },
  { navId: "pesquisas", permission: "tenant.surveys", roles: ["admin"] },
  { navId: "treinamentos", permission: "tenant.surveys", roles: ["admin"] },
  { navId: "sentimento", permission: "tenant.mood", roles: ["admin"] },
  { navId: "config", permission: "tenant.settings", roles: ["admin"] },
  { navId: "politicas", permission: "tenant.settings", roles: ["admin"] },
  { navId: "assinaturas", permission: "tenant.signature", roles: ["admin", "colaborador"] },
];

/** Capacidade que governa um item do menu (ou `null` quando não é governado). */
export function permissionForNav(navId: string, role: RoleId): string | null {
  const rule = screenRules.find((item) => item.navId === navId && item.roles.includes(role));
  return rule ? rule.permission : null;
}

/** Capacidade que governa a rota atual (ou `null` quando não é governada). */
export function permissionForPath(pathname: string, role: RoleId): string | null {
  const segment = pathname.replace(/^\/app\/?/, "").split("/")[0];
  if (!segment) return null;
  return permissionForNav(segment, role);
}