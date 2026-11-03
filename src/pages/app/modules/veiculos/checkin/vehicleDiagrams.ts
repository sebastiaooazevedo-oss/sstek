/**
 * Desenhos (vista de cima) usados no mapa de avarias do check-in.
 *
 * Cada tipo de veículo tem um conjunto de áreas clicáveis. O id da área é o
 * que fica gravado na avaria (`zone`) — por isso NÃO renomeie ids existentes.
 * Coordenadas no viewBox 240 × 440, frente para cima; o lado esquerdo do
 * desenho é o lado do motorista.
 */

export type DiagramKind = "carro" | "utilitario" | "van" | "caminhao" | "onibus" | "moto" | "maquina";
export type ZoneTone = "body" | "glass" | "wheel" | "light" | "trim" | "cargo";

export interface DiagramZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  tone: ZoneTone;
}

export interface VehicleDiagram {
  kind: DiagramKind;
  label: string;
  icon: string;
  /** Contorno da carroceria (desenhado atrás das áreas). */
  outline: { x: number; y: number; w: number; h: number; rx: number }[];
  zones: DiagramZone[];
}

export const DIAGRAM_VIEWBOX = { width: 240, height: 440 };

export const diagramKindMeta: Record<DiagramKind, { label: string; icon: string }> = {
  carro: { label: "Carro", icon: "ri-car-line" },
  utilitario: { label: "Picape / utilitário", icon: "ri-truck-line" },
  van: { label: "Van", icon: "ri-bus-2-line" },
  caminhao: { label: "Caminhão", icon: "ri-truck-line" },
  onibus: { label: "Ônibus", icon: "ri-bus-line" },
  moto: { label: "Moto", icon: "ri-motorbike-line" },
  maquina: { label: "Máquina", icon: "ri-steering-2-line" },
};

/** Categoria do cadastro (`+ Novo veículo`) → desenho usado no mapa. */
export function diagramKindFor(category: string): DiagramKind {
  const value = String(category ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (value.startsWith("moto")) return "moto";
  if (value.startsWith("van") || value.includes("furgao")) return "van";
  if (value.startsWith("caminh") || value.startsWith("carreta") || value.includes("cavalo")) return "caminhao";
  if (value.startsWith("onibus") || value.includes("micro")) return "onibus";
  if (value.startsWith("utilit") || value.includes("picape") || value.includes("pickup")) return "utilitario";
  if (value.startsWith("maquina") || value.includes("empilhadeira") || value.includes("trator")) return "maquina";
  return "carro";
}

const wheel = (id: string, label: string, x: number, y: number, h = 44): DiagramZone => ({
  id,
  label,
  x,
  y,
  w: 16,
  h,
  rx: 5,
  tone: "wheel",
});

/** Rodas de um eixo (esquerda + direita). */
function axle(prefix: string, label: string, y: number, left: number, right: number, h = 44): DiagramZone[] {
  return [
    wheel(`roda_${prefix}e`, `Roda ${label} esquerda`, left - 16, y, h),
    wheel(`roda_${prefix}d`, `Roda ${label} direita`, right, y, h),
  ];
}

function mirrors(y: number, left: number, right: number): DiagramZone[] {
  return [
    { id: "retrovisor_e", label: "Retrovisor esquerdo", x: left - 14, y, w: 14, h: 10, rx: 3, tone: "trim" },
    { id: "retrovisor_d", label: "Retrovisor direito", x: right, y, w: 14, h: 10, rx: 3, tone: "trim" },
  ];
}

function carro(): VehicleDiagram {
  const L = 62;
  const R = 178;
  const w = R - L;
  return {
    kind: "carro",
    ...diagramKindMeta.carro,
    outline: [{ x: L, y: 34, w, h: 372, rx: 34 }],
    zones: [
      { id: "farol_e", label: "Farol esquerdo", x: L + 8, y: 40, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "farol_d", label: "Farol direito", x: R - 32, y: 40, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "para_choque_dia", label: "Para-choque dianteiro", x: L + 34, y: 36, w: w - 68, h: 18, rx: 6, tone: "trim" },
      { id: "capo", label: "Capô", x: L + 20, y: 58, w: w - 40, h: 76, rx: 10, tone: "body" },
      { id: "para_brisa", label: "Para-brisa", x: L + 20, y: 138, w: w - 40, h: 34, rx: 8, tone: "glass" },
      { id: "teto", label: "Teto", x: L + 20, y: 176, w: w - 40, h: 100, rx: 8, tone: "body" },
      { id: "vidro_tras", label: "Vidro traseiro", x: L + 20, y: 280, w: w - 40, h: 26, rx: 8, tone: "glass" },
      { id: "porta_malas", label: "Porta-malas / tampa", x: L + 20, y: 310, w: w - 40, h: 62, rx: 10, tone: "body" },
      { id: "para_choque_tras", label: "Para-choque traseiro", x: L + 34, y: 386, w: w - 68, h: 18, rx: 6, tone: "trim" },
      { id: "lanterna_e", label: "Lanterna esquerda", x: L + 8, y: 390, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "lanterna_d", label: "Lanterna direita", x: R - 32, y: 390, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "paralama_de", label: "Paralama dianteiro esquerdo", x: L, y: 58, w: 18, h: 80, rx: 6, tone: "body" },
      { id: "porta_de", label: "Porta dianteira esquerda", x: L, y: 142, w: 18, h: 82, rx: 4, tone: "body" },
      { id: "porta_te", label: "Porta traseira esquerda", x: L, y: 228, w: 18, h: 78, rx: 4, tone: "body" },
      { id: "paralama_te", label: "Paralama traseiro esquerdo", x: L, y: 310, w: 18, h: 72, rx: 6, tone: "body" },
      { id: "paralama_dd", label: "Paralama dianteiro direito", x: R - 18, y: 58, w: 18, h: 80, rx: 6, tone: "body" },
      { id: "porta_dd", label: "Porta dianteira direita", x: R - 18, y: 142, w: 18, h: 82, rx: 4, tone: "body" },
      { id: "porta_td", label: "Porta traseira direita", x: R - 18, y: 228, w: 18, h: 78, rx: 4, tone: "body" },
      { id: "paralama_td", label: "Paralama traseiro direito", x: R - 18, y: 310, w: 18, h: 72, rx: 6, tone: "body" },
      ...mirrors(150, L, R),
      ...axle("d", "dianteira", 76, L, R),
      ...axle("t", "traseira", 318, L, R),
    ],
  };
}

function utilitario(): VehicleDiagram {
  const L = 58;
  const R = 182;
  const w = R - L;
  return {
    kind: "utilitario",
    ...diagramKindMeta.utilitario,
    outline: [{ x: L, y: 30, w, h: 380, rx: 26 }],
    zones: [
      { id: "farol_e", label: "Farol esquerdo", x: L + 8, y: 36, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "farol_d", label: "Farol direito", x: R - 34, y: 36, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "para_choque_dia", label: "Para-choque dianteiro", x: L + 36, y: 32, w: w - 72, h: 18, rx: 6, tone: "trim" },
      { id: "capo", label: "Capô", x: L + 20, y: 54, w: w - 40, h: 66, rx: 10, tone: "body" },
      { id: "para_brisa", label: "Para-brisa", x: L + 20, y: 124, w: w - 40, h: 30, rx: 8, tone: "glass" },
      { id: "teto", label: "Teto da cabine", x: L + 20, y: 158, w: w - 40, h: 66, rx: 8, tone: "body" },
      { id: "vidro_tras", label: "Vidro traseiro da cabine", x: L + 20, y: 228, w: w - 40, h: 14, rx: 5, tone: "glass" },
      { id: "cacamba", label: "Caçamba", x: L + 20, y: 248, w: w - 40, h: 122, rx: 6, tone: "cargo" },
      { id: "tampa_cacamba", label: "Tampa da caçamba", x: L + 20, y: 374, w: w - 40, h: 14, rx: 4, tone: "trim" },
      { id: "para_choque_tras", label: "Para-choque traseiro", x: L + 36, y: 392, w: w - 72, h: 16, rx: 6, tone: "trim" },
      { id: "lanterna_e", label: "Lanterna esquerda", x: L + 6, y: 392, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "lanterna_d", label: "Lanterna direita", x: R - 32, y: 392, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "paralama_de", label: "Paralama dianteiro esquerdo", x: L, y: 54, w: 18, h: 72, rx: 6, tone: "body" },
      { id: "porta_de", label: "Porta dianteira esquerda", x: L, y: 130, w: 18, h: 60, rx: 4, tone: "body" },
      { id: "porta_te", label: "Porta traseira esquerda", x: L, y: 194, w: 18, h: 50, rx: 4, tone: "body" },
      { id: "lateral_cacamba_e", label: "Lateral da caçamba esquerda", x: L, y: 248, w: 18, h: 140, rx: 4, tone: "body" },
      { id: "paralama_dd", label: "Paralama dianteiro direito", x: R - 18, y: 54, w: 18, h: 72, rx: 6, tone: "body" },
      { id: "porta_dd", label: "Porta dianteira direita", x: R - 18, y: 130, w: 18, h: 60, rx: 4, tone: "body" },
      { id: "porta_td", label: "Porta traseira direita", x: R - 18, y: 194, w: 18, h: 50, rx: 4, tone: "body" },
      { id: "lateral_cacamba_d", label: "Lateral da caçamba direita", x: R - 18, y: 248, w: 18, h: 140, rx: 4, tone: "body" },
      ...mirrors(136, L, R),
      ...axle("d", "dianteira", 68, L, R),
      ...axle("t", "traseira", 318, L, R),
    ],
  };
}

function van(): VehicleDiagram {
  const L = 56;
  const R = 184;
  const w = R - L;
  return {
    kind: "van",
    ...diagramKindMeta.van,
    outline: [{ x: L, y: 28, w, h: 384, rx: 22 }],
    zones: [
      { id: "farol_e", label: "Farol esquerdo", x: L + 8, y: 34, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "farol_d", label: "Farol direito", x: R - 34, y: 34, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "para_choque_dia", label: "Para-choque dianteiro", x: L + 36, y: 30, w: w - 72, h: 16, rx: 6, tone: "trim" },
      { id: "capo", label: "Capô", x: L + 20, y: 50, w: w - 40, h: 40, rx: 10, tone: "body" },
      { id: "para_brisa", label: "Para-brisa", x: L + 20, y: 94, w: w - 40, h: 34, rx: 8, tone: "glass" },
      { id: "teto_dia", label: "Teto dianteiro", x: L + 20, y: 132, w: w - 40, h: 110, rx: 8, tone: "body" },
      { id: "teto_tras", label: "Teto traseiro", x: L + 20, y: 246, w: w - 40, h: 120, rx: 8, tone: "body" },
      { id: "portas_tras", label: "Portas traseiras", x: L + 20, y: 370, w: w - 40, h: 20, rx: 5, tone: "body" },
      { id: "para_choque_tras", label: "Para-choque traseiro", x: L + 36, y: 394, w: w - 72, h: 16, rx: 6, tone: "trim" },
      { id: "lanterna_e", label: "Lanterna esquerda", x: L + 6, y: 394, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "lanterna_d", label: "Lanterna direita", x: R - 32, y: 394, w: 26, h: 10, rx: 4, tone: "light" },
      { id: "porta_de", label: "Porta do motorista", x: L, y: 50, w: 18, h: 110, rx: 5, tone: "body" },
      { id: "lateral_e_meio", label: "Lateral esquerda (meio)", x: L, y: 164, w: 18, h: 110, rx: 4, tone: "body" },
      { id: "lateral_e_tras", label: "Lateral esquerda (traseira)", x: L, y: 278, w: 18, h: 112, rx: 5, tone: "body" },
      { id: "porta_dd", label: "Porta do passageiro", x: R - 18, y: 50, w: 18, h: 110, rx: 5, tone: "body" },
      { id: "porta_lateral", label: "Porta lateral corrediça", x: R - 18, y: 164, w: 18, h: 110, rx: 4, tone: "body" },
      { id: "lateral_d_tras", label: "Lateral direita (traseira)", x: R - 18, y: 278, w: 18, h: 112, rx: 5, tone: "body" },
      ...mirrors(104, L, R),
      ...axle("d", "dianteira", 58, L, R),
      ...axle("t", "traseira", 322, L, R),
    ],
  };
}

function caminhao(): VehicleDiagram {
  const L = 54;
  const R = 186;
  const w = R - L;
  return {
    kind: "caminhao",
    ...diagramKindMeta.caminhao,
    outline: [
      { x: L + 4, y: 24, w: w - 8, h: 104, rx: 14 },
      { x: L, y: 136, w, h: 282, rx: 6 },
    ],
    zones: [
      { id: "farol_e", label: "Farol esquerdo", x: L + 10, y: 28, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "farol_d", label: "Farol direito", x: R - 34, y: 28, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "para_choque_dia", label: "Para-choque dianteiro", x: L + 38, y: 24, w: w - 76, h: 16, rx: 6, tone: "trim" },
      { id: "para_brisa", label: "Para-brisa", x: L + 18, y: 44, w: w - 36, h: 26, rx: 6, tone: "glass" },
      { id: "teto_cabine", label: "Teto da cabine", x: L + 18, y: 74, w: w - 36, h: 50, rx: 8, tone: "body" },
      { id: "cabine_e", label: "Porta / cabine esquerda", x: L + 4, y: 44, w: 12, h: 80, rx: 4, tone: "body" },
      { id: "cabine_d", label: "Porta / cabine direita", x: R - 16, y: 44, w: 12, h: 80, rx: 4, tone: "body" },
      { id: "carroceria_frente", label: "Carroceria / baú (frente)", x: L + 18, y: 138, w: w - 36, h: 130, rx: 4, tone: "cargo" },
      { id: "carroceria_tras", label: "Carroceria / baú (fundo)", x: L + 18, y: 272, w: w - 36, h: 110, rx: 4, tone: "cargo" },
      { id: "portas_tras", label: "Portas traseiras / tampa", x: L + 18, y: 386, w: w - 36, h: 14, rx: 4, tone: "trim" },
      { id: "para_choque_tras", label: "Para-choque traseiro", x: L + 30, y: 404, w: w - 60, h: 12, rx: 4, tone: "trim" },
      { id: "lanterna_e", label: "Lanterna esquerda", x: L + 4, y: 404, w: 22, h: 10, rx: 4, tone: "light" },
      { id: "lanterna_d", label: "Lanterna direita", x: R - 26, y: 404, w: 22, h: 10, rx: 4, tone: "light" },
      { id: "lateral_e", label: "Lateral esquerda da carroceria", x: L, y: 138, w: 16, h: 262, rx: 4, tone: "body" },
      { id: "lateral_d", label: "Lateral direita da carroceria", x: R - 16, y: 138, w: 16, h: 262, rx: 4, tone: "body" },
      { id: "tanque", label: "Tanque de combustível", x: L - 14, y: 160, w: 12, h: 46, rx: 5, tone: "trim" },
      ...mirrors(48, L + 4, R - 4),
      ...axle("d", "dianteira", 80, L + 4, R - 4, 38),
      ...axle("t1", "traseira (1º eixo)", 296, L, R, 38),
      ...axle("t2", "traseira (2º eixo)", 340, L, R, 38),
    ],
  };
}

function onibus(): VehicleDiagram {
  const L = 58;
  const R = 182;
  const w = R - L;
  return {
    kind: "onibus",
    ...diagramKindMeta.onibus,
    outline: [{ x: L, y: 20, w, h: 402, rx: 16 }],
    zones: [
      { id: "farol_e", label: "Farol esquerdo", x: L + 6, y: 24, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "farol_d", label: "Farol direito", x: R - 30, y: 24, w: 24, h: 10, rx: 4, tone: "light" },
      { id: "para_choque_dia", label: "Para-choque dianteiro", x: L + 32, y: 22, w: w - 64, h: 14, rx: 5, tone: "trim" },
      { id: "para_brisa", label: "Para-brisa", x: L + 18, y: 40, w: w - 36, h: 30, rx: 6, tone: "glass" },
      { id: "teto_dia", label: "Teto dianteiro", x: L + 18, y: 74, w: w - 36, h: 110, rx: 6, tone: "body" },
      { id: "teto_meio", label: "Teto central", x: L + 18, y: 188, w: w - 36, h: 100, rx: 6, tone: "body" },
      { id: "teto_tras", label: "Teto traseiro", x: L + 18, y: 292, w: w - 36, h: 100, rx: 6, tone: "body" },
      { id: "traseira", label: "Traseira / motor", x: L + 18, y: 396, w: w - 36, h: 22, rx: 5, tone: "trim" },
      { id: "lanterna_e", label: "Lanterna esquerda", x: L + 4, y: 404, w: 12, h: 14, rx: 4, tone: "light" },
      { id: "lanterna_d", label: "Lanterna direita", x: R - 16, y: 404, w: 12, h: 14, rx: 4, tone: "light" },
      { id: "lateral_e_dia", label: "Lateral esquerda (frente)", x: L, y: 40, w: 16, h: 120, rx: 4, tone: "body" },
      { id: "lateral_e_meio", label: "Lateral esquerda (meio)", x: L, y: 164, w: 16, h: 120, rx: 4, tone: "body" },
      { id: "lateral_e_tras", label: "Lateral esquerda (traseira)", x: L, y: 288, w: 16, h: 112, rx: 4, tone: "body" },
      { id: "porta_dianteira", label: "Porta de embarque", x: R - 16, y: 40, w: 16, h: 70, rx: 4, tone: "glass" },
      { id: "lateral_d_meio", label: "Lateral direita (meio)", x: R - 16, y: 114, w: 16, h: 150, rx: 4, tone: "body" },
      { id: "porta_meio", label: "Porta de desembarque", x: R - 16, y: 268, w: 16, h: 56, rx: 4, tone: "glass" },
      { id: "lateral_d_tras", label: "Lateral direita (traseira)", x: R - 16, y: 328, w: 16, h: 72, rx: 4, tone: "body" },
      ...mirrors(44, L, R),
      ...axle("d", "dianteira", 78, L, R, 40),
      ...axle("t", "traseira", 318, L, R, 40),
    ],
  };
}

function moto(): VehicleDiagram {
  return {
    kind: "moto",
    ...diagramKindMeta.moto,
    outline: [{ x: 98, y: 40, w: 44, h: 360, rx: 22 }],
    zones: [
      { id: "pneu_dia", label: "Pneu / roda dianteira", x: 108, y: 22, w: 24, h: 70, rx: 10, tone: "wheel" },
      { id: "farol", label: "Farol / carenagem", x: 102, y: 96, w: 36, h: 26, rx: 8, tone: "light" },
      { id: "guidao_e", label: "Manopla e manete esquerda", x: 50, y: 124, w: 52, h: 12, rx: 5, tone: "trim" },
      { id: "guidao_d", label: "Manopla e manete direita", x: 138, y: 124, w: 52, h: 12, rx: 5, tone: "trim" },
      { id: "retrovisor_e", label: "Retrovisor esquerdo", x: 56, y: 104, w: 18, h: 14, rx: 4, tone: "trim" },
      { id: "retrovisor_d", label: "Retrovisor direito", x: 166, y: 104, w: 18, h: 14, rx: 4, tone: "trim" },
      { id: "painel", label: "Painel de instrumentos", x: 108, y: 124, w: 24, h: 14, rx: 4, tone: "glass" },
      { id: "tanque", label: "Tanque", x: 98, y: 142, w: 44, h: 70, rx: 18, tone: "body" },
      { id: "banco", label: "Banco", x: 104, y: 216, w: 32, h: 86, rx: 12, tone: "cargo" },
      { id: "lateral_e", label: "Lateral / carenagem esquerda", x: 82, y: 168, w: 14, h: 110, rx: 6, tone: "body" },
      { id: "lateral_d", label: "Lateral / carenagem direita", x: 144, y: 168, w: 14, h: 110, rx: 6, tone: "body" },
      { id: "escapamento", label: "Escapamento", x: 160, y: 250, w: 14, h: 96, rx: 6, tone: "trim" },
      { id: "rabeta", label: "Rabeta / lanterna / placa", x: 104, y: 306, w: 32, h: 30, rx: 8, tone: "light" },
      { id: "pneu_tras", label: "Pneu / roda traseira", x: 108, y: 340, w: 24, h: 78, rx: 10, tone: "wheel" },
    ],
  };
}

function maquina(): VehicleDiagram {
  return {
    kind: "maquina",
    ...diagramKindMeta.maquina,
    outline: [{ x: 66, y: 96, w: 108, h: 282, rx: 12 }],
    zones: [
      { id: "implemento", label: "Implemento (lâmina, garfo ou caçamba)", x: 40, y: 26, w: 160, h: 34, rx: 6, tone: "trim" },
      { id: "braco", label: "Braço / torre / mastro", x: 96, y: 62, w: 48, h: 40, rx: 6, tone: "body" },
      { id: "cabine", label: "Cabine / posto do operador", x: 78, y: 106, w: 84, h: 92, rx: 10, tone: "glass" },
      { id: "capo_motor", label: "Capô / motor", x: 78, y: 202, w: 84, h: 110, rx: 10, tone: "body" },
      { id: "contrapeso", label: "Contrapeso / traseira", x: 72, y: 316, w: 96, h: 56, rx: 12, tone: "trim" },
      { id: "giroflex", label: "Giroflex / luzes de sinalização", x: 108, y: 120, w: 24, h: 12, rx: 6, tone: "light" },
      { id: "rodado_e", label: "Esteira / rodas esquerdas", x: 40, y: 110, w: 22, h: 260, rx: 8, tone: "wheel" },
      { id: "rodado_d", label: "Esteira / rodas direitas", x: 178, y: 110, w: 22, h: 260, rx: 8, tone: "wheel" },
    ],
  };
}

const builders: Record<DiagramKind, () => VehicleDiagram> = {
  carro,
  utilitario,
  van,
  caminhao,
  onibus,
  moto,
  maquina,
};

const cache = new Map<DiagramKind, VehicleDiagram>();

export function diagramFor(kind: DiagramKind): VehicleDiagram {
  let diagram = cache.get(kind);
  if (!diagram) {
    diagram = builders[kind]();
    cache.set(kind, diagram);
  }
  return diagram;
}

export const DIAGRAM_KINDS = Object.keys(builders) as DiagramKind[];

/** Nome da área (para avarias antigas, cai no próprio id). */
export function zoneLabelOf(kind: DiagramKind, zoneId: string): string {
  return diagramFor(kind).zones.find((zone) => zone.id === zoneId)?.label ?? zoneId;
}

/** Centro da área, onde o marcador numerado da avaria é desenhado. */
export function zoneCenter(kind: DiagramKind, zoneId: string): { x: number; y: number } | null {
  const zone = diagramFor(kind).zones.find((item) => item.id === zoneId);
  return zone ? { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 } : null;
}
