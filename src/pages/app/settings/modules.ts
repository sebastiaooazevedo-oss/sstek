/**
 * Catálogo dos módulos que a empresa contratante pode habilitar ou desabilitar.
 *
 * A fonte da verdade agora são os manifestos (`module.ts` de cada pasta),
 * reunidos em `@/core/modules/registry`. Este arquivo mantém os nomes antigos
 * (`systemModules`, `moduleIdByNavId`) para as telas que já os usavam.
 *
 * A ausência de uma chave no mapa `enabledModules` significa módulo habilitado —
 * assim o sistema continua com todos os módulos ativos por padrão.
 */
import { toggleKeyBySegment, toggleableModules, type ToggleableModule } from "@/core/modules/registry";

export type SystemModule = ToggleableModule;

export const systemModules: SystemModule[] = toggleableModules;

/** Mapa rápido: item do menu / segmento de endereço -> módulo que o controla. */
export const moduleIdByNavId: Record<string, string> = toggleKeyBySegment;
