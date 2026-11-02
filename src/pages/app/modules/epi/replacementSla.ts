import type { EpiReplacementReason } from "@/pages/app/modules/epi/replacementStore";

/**
 * Prazo de atendimento dos pedidos de substituição de EPI.
 *
 * Cada motivo tem um prazo próprio (em horas) porque a urgência muda: um CA
 * vencido ou um EPI perdido expõem o colaborador imediatamente, enquanto um
 * desgaste pode aguardar a próxima reposição. A empresa pode ajustar cada prazo
 * em Configurações → Prazos de atendimento de EPI; o que não for ajustado usa
 * o padrão abaixo.
 */

export const defaultReplacementSlaHours: Record<EpiReplacementReason, number> = {
  "CA vencido": 24,
  Perda: 24,
  Dano: 48,
  Desgaste: 72,
  "Tamanho inadequado": 72,
  Outro: 72,
};

export interface ReplacementDeadline {
  /** Prazo aplicado ao motivo, em horas. */
  hours: number;
  /** Momento limite para o atendimento do pedido. */
  dueAt: Date;
  /** Pedido já passou do prazo? */
  overdue: boolean;
  /** Horas restantes (negativas quando o pedido está atrasado). */
  remainingHours: number;
  /** Horas de atraso (0 quando dentro do prazo). */
  overdueHours: number;
  /** Atrasado ou faltando 12h ou menos para vencer. */
  critical: boolean;
}

/** Prazo aplicado a um motivo, respeitando o que a empresa parametrizou. */
export function slaHoursFor(
  reason: string,
  overrides?: Record<string, number> | null
): number {
  const custom = overrides?.[reason];
  const parsed = typeof custom === "number" ? custom : Number(custom);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const fallback = defaultReplacementSlaHours[reason as EpiReplacementReason];
  return fallback ?? 72;
}

/** Calcula o prazo de atendimento de um pedido a partir da data de abertura. */
export function replacementDeadline(
  createdAt: string,
  reason: string,
  overrides?: Record<string, number> | null
): ReplacementDeadline | null {
  if (!createdAt) return null;
  const opened = new Date(createdAt);
  if (Number.isNaN(opened.getTime())) return null;

  const hours = slaHoursFor(reason, overrides);
  const dueAt = new Date(opened.getTime() + hours * 60 * 60 * 1000);
  const remainingHours = (dueAt.getTime() - Date.now()) / (60 * 60 * 1000);
  const overdue = remainingHours < 0;

  return {
    hours,
    dueAt,
    overdue,
    remainingHours,
    overdueHours: overdue ? Math.abs(remainingHours) : 0,
    critical: overdue || remainingHours <= 12,
  };
}

/** "24h" · "72h (3 dias)" — leitura humana dos prazos parametrizados. */
export function formatSlaHours(hours: number): string {
  const safe = Math.max(0, hours);
  if (safe < 1) return "menos de 1h";
  if (safe < 24) return `${Math.round(safe)}h`;
  const days = Math.floor(safe / 24);
  const rest = Math.round(safe % 24);
  const dayLabel = `${days} ${days === 1 ? "dia" : "dias"}`;
  return rest > 0 ? `${dayLabel} e ${rest}h` : dayLabel;
}

/** Data + hora limite, ex.: "22/10/2026 às 14:30". */
export function formatDeadlineMoment(value: Date): string {
  const date = value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

/** Texto curto do estado do prazo, usado nos selos de acompanhamento. */
export function deadlineLabel(deadline: ReplacementDeadline): string {
  if (deadline.overdue) return `Atrasado há ${formatSlaHours(deadline.overdueHours)}`;
  return `Vence em ${formatSlaHours(deadline.remainingHours)}`;
}