import type { ComponentType } from "react";
import type { RoleId } from "@/mocks/app";

/**
 * Contrato de um módulo do SSTEK.
 *
 * Cada pasta de módulo (ex.: `src/pages/app/modules/epi/`) tem um `module.ts`
 * que exporta um `AppModule`. O núcleo lê esses manifestos e monta sozinho as
 * rotas, o menu lateral, as regras de permissão por tela e o catálogo de
 * módulos que a empresa pode contratar. Mexer num módulo = mexer só na pasta dele.
 */

/** Carregador preguiçoso: a tela só é baixada quando alguém a abre. */
export type PageLoader = () => Promise<{ default: ComponentType }>;

export interface ModuleRoute {
  /** Caminho relativo a `/app` ("" = página inicial do app). */
  path: string;
  /** Tela da rota. */
  load?: PageLoader;
  /** Alternativa a `load`: endereço antigo que redireciona para outro. */
  redirectTo?: string;
}

/** Seções do menu lateral, por perfil (a ordem aqui é a ordem na tela). */
export const NAV_SECTIONS: Record<RoleId, string[]> = {
  super: ["Plataforma", "Comercial", "Dados", "Sistema"],
  admin: ["Operação", "Conformidade", "Gestão"],
  colaborador: ["Meu espaço", "Desenvolvimento", "Conta"],
};

export interface ModuleNavItem {
  /** Id do item = caminho depois de `/app/` ("dashboard" = `/app`). */
  id: string;
  label: string;
  icon: string;
  role: RoleId;
  section: string;
  /** Posição dentro da seção (menor aparece primeiro). */
  order: number;
  /** Tela ainda não construída: abre a página "em breve". */
  soon?: boolean;
}

/** Permissão da matriz "Perfis & permissões" exigida para abrir uma tela. */
export interface ModuleScreenRule {
  /** Primeiro segmento da rota (`/app/<navId>`). */
  navId: string;
  permission: string;
  roles: RoleId[];
}

/** Dados do módulo no catálogo de módulos contratáveis (liga/desliga por empresa). */
export interface ModuleToggle {
  /**
   * Chave gravada em `system_settings.enabled_modules`. Não renomeie: empresas
   * existentes guardam o liga/desliga por esta chave.
   */
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Posição no catálogo de módulos. */
  order: number;
}

export interface AppModule {
  /** Identificador técnico do módulo (nome da pasta). */
  id: string;
  /** Rotas do módulo dentro de `/app`. */
  routes: ModuleRoute[];
  /** Itens do menu lateral que o módulo contribui. */
  nav?: ModuleNavItem[];
  /** Regras de permissão por tela. */
  screens?: ModuleScreenRule[];
  /**
   * Presente quando o módulo é contratável (a empresa pode desligar).
   * Ausente = módulo do núcleo, sempre ativo.
   */
  toggle?: ModuleToggle;
  /**
   * Outros segmentos de endereço controlados pelo liga/desliga deste módulo
   * além das rotas e itens de menu (ex.: telas "em breve").
   */
  extraSegments?: string[];
}
