import type { RoleId } from "@/mocks/app";
import { NAV_SECTIONS, type AppModule, type ModuleNavItem, type ModuleScreenRule, type ModuleToggle } from "./types";

import inicio from "@/pages/app/inicio.module";
import colaboradores from "@/pages/app/modules/colaboradores/module";
import documentos from "@/pages/app/modules/documentos/module";
import veiculos from "@/pages/app/modules/veiculos/module";
import assinaturas from "@/pages/app/modules/assinaturas/module";
import cipa from "@/pages/app/modules/cipa/module";
import regulamento from "@/pages/app/modules/regulamento/module";
import sentimento from "@/pages/app/modules/sentimento/module";
import pesquisas from "@/pages/app/modules/pesquisas/module";
import dds from "@/pages/app/modules/dds/module";
import epi from "@/pages/app/modules/epi/module";
import apr from "@/pages/app/modules/apr/module";
import qrcodes from "@/pages/app/modules/qrcodes/module";
import portal from "@/pages/app/modules/perfil/module";
import perfis from "@/pages/app/modules/perfis/module";
import config from "@/pages/app/modules/config/module";
import plataforma from "@/pages/app/modules/plataforma/module";

/**
 * Lista única de módulos do sistema.
 * Para criar um módulo novo: crie a pasta com `module.ts` e acrescente uma linha aqui.
 */
export const appModules: AppModule[] = [
  inicio,
  colaboradores,
  documentos,
  veiculos,
  assinaturas,
  cipa,
  regulamento,
  sentimento,
  pesquisas,
  dds,
  epi,
  apr,
  qrcodes,
  portal,
  perfis,
  config,
  plataforma,
];

/* ---------------------------------------------------------------- */
/* Menu lateral                                                       */
/* ---------------------------------------------------------------- */

export interface NavSection {
  title: string;
  items: ModuleNavItem[];
}

/** Menu lateral de um perfil, montado a partir dos manifestos. */
export function navSectionsFor(role: RoleId, modules: AppModule[] = appModules): NavSection[] {
  const items = modules.flatMap((m) => m.nav ?? []).filter((item) => item.role === role);
  return NAV_SECTIONS[role]
    .map((title) => ({
      title,
      items: items.filter((i) => i.section === title).sort((a, b) => a.order - b.order),
    }))
    .filter((section) => section.items.length > 0);
}

/* ---------------------------------------------------------------- */
/* Módulos contratáveis (liga/desliga por empresa)                    */
/* ---------------------------------------------------------------- */

export interface ToggleableModule extends ModuleToggle {
  /** Compatibilidade com o catálogo antigo (`systemModules`). */
  id: string;
  /** Itens de menu e segmentos de endereço controlados pelo liga/desliga. */
  navIds: string[];
  path: string;
}

function firstSegment(path: string): string {
  return path.replace(/^\/?(app\/?)?/, "").split("/")[0];
}

/** Segmentos de endereço (`/app/<segmento>`) que pertencem a um módulo. */
export function segmentsOf(module: AppModule): string[] {
  const set = new Set<string>();
  module.routes.forEach((r) => {
    const seg = firstSegment(r.path);
    if (seg) set.add(seg);
  });
  module.nav?.forEach((n) => {
    const seg = firstSegment(n.id);
    if (seg && seg !== "dashboard") set.add(seg);
  });
  module.extraSegments?.forEach((s) => set.add(s));
  return Array.from(set);
}

export const toggleableModules: ToggleableModule[] = appModules
  .filter((m): m is AppModule & { toggle: ModuleToggle } => Boolean(m.toggle))
  .map((m) => ({
    ...m.toggle,
    id: m.toggle.key,
    navIds: segmentsOf(m),
    path: `/app/${m.routes[0]?.path ?? ""}`,
  }))
  .sort((a, b) => a.order - b.order);

/** Segmento do endereço → chave de liga/desliga do módulo que o controla. */
export const toggleKeyBySegment: Record<string, string> = toggleableModules.reduce<Record<string, string>>(
  (acc, module) => {
    module.navIds.forEach((seg) => {
      acc[seg] = module.key;
    });
    return acc;
  },
  {}
);

/** Chave de liga/desliga que governa um endereço (ou `null` para telas do núcleo). */
export function toggleKeyForPath(pathname: string): string | null {
  const seg = firstSegment(pathname);
  return (seg && toggleKeyBySegment[seg]) || null;
}

/* ---------------------------------------------------------------- */
/* Permissões por tela                                                 */
/* ---------------------------------------------------------------- */

export const screenRules: ModuleScreenRule[] = appModules.flatMap((m) => m.screens ?? []);
