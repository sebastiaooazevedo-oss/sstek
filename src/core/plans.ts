/**
 * Planos comerciais do SSTEK e o que cada um liga por padrão.
 *
 * São SUGESTÕES aplicadas no assistente de nova empresa: o Superadministrador
 * pode ligar/desligar qualquer módulo antes de criar a empresa (e depois, em
 * Empresas → Módulos). Os textos públicos dos planos estão em `src/mocks/site.ts`.
 *
 * Política comercial a confirmar: CIPA, DDS, APR, Assinaturas e Veículos não
 * aparecem na página de planos; os padrões abaixo são uma proposta inicial.
 */

export type PlanId = "S1" | "S2" | "S3";

export interface PlanPreset {
  id: PlanId;
  name: string;
  description: string;
  /** Valor mensal sugerido (0 = sob consulta). */
  monthlyValue: number;
  /** Limite de colaboradores (0 = ilimitado). */
  seats: number;
  /** Liga/desliga por chave de módulo (mesmas chaves de `toggleableModules`). */
  modules: Record<string, boolean>;
}

const ALL_ON: Record<string, boolean> = {
  cipa: true,
  dds: true,
  epi: true,
  apr: true,
  assinaturas: true,
  sentimento: true,
  veiculos: true,
  qrcodes: true,
  treinamentos: true,
};

export const PLAN_PRESETS: Record<PlanId, PlanPreset> = {
  S1: {
    id: "S1",
    name: "Licença S1",
    description: "Pequenas operações: documentos, EPI, QR-Code e clima diário.",
    monthlyValue: 149,
    seats: 10,
    modules: { ...ALL_ON, cipa: false, assinaturas: false, veiculos: false, treinamentos: false },
  },
  S2: {
    id: "S2",
    name: "Licença S2",
    description: "Operações em crescimento: S1 + pesquisas, CIPA e assinatura eletrônica.",
    monthlyValue: 449,
    seats: 50,
    modules: { ...ALL_ON, veiculos: false },
  },
  S3: {
    id: "S3",
    name: "Licença S3",
    description: "Multiunidades: todos os módulos, sem limite de colaboradores.",
    monthlyValue: 0,
    seats: 0,
    modules: { ...ALL_ON },
  },
};

export const PLAN_IDS: PlanId[] = ["S1", "S2", "S3"];
