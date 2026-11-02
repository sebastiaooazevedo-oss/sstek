import type { RoleId } from "@/mocks/app";
import { screenRules } from "@/core/modules/registry";

/**
 * Liga cada tela do app interno à capacidade da matriz "Perfis & permissões".
 *
 * As regras vêm dos manifestos dos módulos (`screens` em cada `module.ts`).
 * Só entram telas de GESTÃO. As telas de dados próprios do colaborador
 * (meu painel, meus dados, minha ficha de EPI, meus documentos, alertas) não
 * dependem da matriz: elas já são limitadas pelo vínculo do próprio usuário no
 * banco e não existe permissão que faça sentido revogar sem quebrar o acesso.
 */

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
