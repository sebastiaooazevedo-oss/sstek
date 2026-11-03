/**
 * Regras do check-in de segurança de veículos (retirada e devolução), usadas
 * pela função de servidor `veiculos` e pelas telas do sistema.
 *
 * Arquivo PURO (sem Deno, sem banco): testado pelo `npm test` (checkin.test.ts).
 * O servidor sempre revalida tudo — a tela só antecipa os mesmos erros.
 */

export const DAMAGE_TYPES = ["risco", "amassado", "quebrado", "trincado", "faltante", "desgaste", "outro"] as const;
export const DAMAGE_SEVERITIES = ["leve", "moderada", "grave"] as const;
export const REPAIR_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
export const REPAIR_STATUSES = ["aberta", "em_andamento", "concluida", "cancelada"] as const;

export const MAX_CHECKIN_DAMAGES = 40;
export const MAX_CHECKIN_REPAIRS = 20;
export const MAX_REPAIR_PHOTOS = 4;
/** Fotos gerais + 1 por avaria + reparos: limite total por check-in. */
export const MAX_CHECKIN_PHOTOS_TOTAL = 12;

/** Fotos obrigatórias do check-in de segurança (o painel mostra hodômetro e combustível). */
export const CHECKIN_REQUIRED_PHOTOS: { key: string; label: string; hint: string }[] = [
  { key: "frente", label: "Frente", hint: "Diagonal da frente, placa visível" },
  { key: "traseira", label: "Traseira", hint: "Diagonal da traseira, placa visível" },
  { key: "lateral_esquerda", label: "Lateral esquerda", hint: "Lado do motorista" },
  { key: "lateral_direita", label: "Lateral direita", hint: "Lado do passageiro" },
  { key: "painel", label: "Painel", hint: "Hodômetro e combustível legíveis" },
];

/** Prefixo do caminho do arquivo das fotos obrigatórias (`.../veiculos/ck-frente-<ts>-...`). */
export function checkinPhotoTag(slotKey: string): string {
  return `ck_${slotKey}`;
}

/** Foto obrigatória a que um caminho pertence, ou `null`. */
export function checkinPhotoSlotOf(path: string): string | null {
  const match = String(path ?? "").match(/\/veiculos\/ck-([a-z-]+?)-\d{10,}-/);
  if (!match) return null;
  const key = match[1].replace(/-/g, "_");
  return CHECKIN_REQUIRED_PHOTOS.some((slot) => slot.key === key) ? key : null;
}

/** Rótulos das fotos obrigatórias ainda sem imagem. */
export function fotosObrigatoriasFaltando(photos: string[]): string[] {
  const presentes = new Set(photos.map(checkinPhotoSlotOf).filter(Boolean));
  return CHECKIN_REQUIRED_PHOTOS.filter((slot) => !presentes.has(slot.key)).map((slot) => slot.label);
}

/** Placa só com letras e números, em maiúsculas (`abc-1d23` → `ABC1D23`). */
export function normalizarPlaca(value: string): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** O condutor digitou a placa do veículo que está retirando/devolvendo. */
export function placaConfere(digitada: string, cadastrada: string): boolean {
  const a = normalizarPlaca(digitada);
  return a.length >= 7 && a === normalizarPlaca(cadastrada);
}

/**
 * Valida o hodômetro informado. `referencia` é o último valor conhecido:
 * na devolução, o da retirada; na retirada, o do cadastro do veículo.
 * Devolve a mensagem de erro, ou `null` quando está tudo certo.
 */
export function validarHodometro(valor: number | null, referencia: number | null, kind: string): string | null {
  if (valor === null || !Number.isInteger(valor) || valor < 0) return "Informe o hodômetro do veículo (número inteiro em km).";
  if (valor > 9_999_999) return "Hodômetro acima do limite aceito.";
  if (referencia !== null && valor < referencia) {
    return kind === "devolucao"
      ? `O hodômetro da devolução não pode ser menor que o da retirada (${referencia.toLocaleString("pt-BR")} km).`
      : `O hodômetro não pode ser menor que o último registrado (${referencia.toLocaleString("pt-BR")} km).`;
  }
  return null;
}

/** Km rodados entre a retirada e a devolução (`null` se não der para calcular). */
export function kmRodados(retirada: number | null, devolucao: number | null): number | null {
  if (retirada === null || devolucao === null) return null;
  const diff = devolucao - retirada;
  return diff >= 0 ? diff : null;
}

export interface AvariaEntrada {
  id?: unknown;
  zone?: unknown;
  zoneLabel?: unknown;
  type?: unknown;
  severity?: unknown;
  description?: unknown;
  photo?: unknown;
  preexisting?: unknown;
  repair?: unknown;
}

export interface ReparoEntrada {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  photos?: unknown;
  damageId?: unknown;
}

const str = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T =>
  (list as readonly string[]).includes(String(value)) ? (value as T) : fallback;

/**
 * Mensagem de erro de uma avaria, ou `null`.
 * Avaria NOVA exige foto (é a evidência do estado do veículo); avaria
 * pré-existente já tem foto no check-in anterior.
 */
export function validarAvaria(avaria: AvariaEntrada, numero: number): string | null {
  if (!str(avaria.zone, 60)) return `Avaria ${numero}: marque o local no desenho do veículo.`;
  if (!(DAMAGE_TYPES as readonly string[]).includes(String(avaria.type))) return `Avaria ${numero}: escolha o tipo.`;
  if (!(DAMAGE_SEVERITIES as readonly string[]).includes(String(avaria.severity))) {
    return `Avaria ${numero}: escolha a gravidade.`;
  }
  if (avaria.preexisting !== true && !str(avaria.photo, 400)) {
    return `Avaria ${numero} (${str(avaria.zoneLabel, 80) || "sem local"}): registre uma foto da avaria.`;
  }
  if (avaria.severity === "grave" && str(avaria.description, 500).length < 3) {
    return `Avaria ${numero}: descreva a avaria grave.`;
  }
  return null;
}

/** Mensagem de erro de uma solicitação de reparo, ou `null`. */
export function validarReparo(reparo: ReparoEntrada, numero: number): string | null {
  if (str(reparo.title, 120).length < 3) return `Reparo ${numero}: informe o que deve ser reparado.`;
  if (!(REPAIR_PRIORITIES as readonly string[]).includes(String(reparo.priority))) {
    return `Reparo ${numero}: escolha a prioridade.`;
  }
  const fotos = Array.isArray(reparo.photos) ? reparo.photos.filter((item) => str(item, 400)) : [];
  if (fotos.length === 0) return `Reparo ${numero} (${str(reparo.title, 60)}): registre ao menos uma foto do que deve ser reparado.`;
  return null;
}

/** Avaria limpa e com tamanho limitado, pronta para gravar. */
export function sanitizarAvaria(avaria: AvariaEntrada, index: number) {
  return {
    id: str(avaria.id, 40) || `av-${index + 1}`,
    zone: str(avaria.zone, 60),
    zoneLabel: str(avaria.zoneLabel, 80),
    type: oneOf(avaria.type, DAMAGE_TYPES, "outro"),
    severity: oneOf(avaria.severity, DAMAGE_SEVERITIES, "leve"),
    description: str(avaria.description, 500),
    photo: str(avaria.photo, 400),
    preexisting: avaria.preexisting === true,
    repair: avaria.repair === true,
  };
}

/** Pedido de reparo limpo e com tamanho limitado, pronto para gravar. */
export function sanitizarReparo(reparo: ReparoEntrada, index: number) {
  const fotos = Array.isArray(reparo.photos) ? reparo.photos.map((item) => str(item, 400)).filter(Boolean) : [];
  return {
    id: str(reparo.id, 40) || `rp-${index + 1}`,
    title: str(reparo.title, 120),
    description: str(reparo.description, 1000),
    priority: oneOf(reparo.priority, REPAIR_PRIORITIES, "media"),
    photos: fotos.slice(0, MAX_REPAIR_PHOTOS),
    damageId: str(reparo.damageId, 40),
  };
}

/** Transições permitidas no andamento de um reparo. */
export function transicaoReparoPermitida(de: string, para: string): boolean {
  if (de === para) return false;
  if (de === "concluida" || de === "cancelada") return para === "aberta"; // reabrir
  return (REPAIR_STATUSES as readonly string[]).includes(para);
}
