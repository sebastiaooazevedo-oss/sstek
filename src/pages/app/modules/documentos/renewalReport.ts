import {
  renewalDurationDays,
  renewalIdleInfo,
  renewalOnTime,
  type RenewalRequest,
} from "@/pages/app/modules/documentos/renewalStore";

/** Consolidação por unidade usada no relatório de renovações. */
export interface RenewalUnitRow {
  unit: string;
  total: number;
  open: number;
  completed: number;
  /** Solicitações abertas com o prazo (SLA) estourado. */
  overdue: number;
  /** Solicitações abertas sem movimentação além do limite parametrizado. */
  stalled: number;
  /** Concluídas dentro do prazo. */
  onTime: number;
  /** Concluídas depois do prazo. */
  late: number;
  /** Tempo médio de conclusão, em dias corridos. */
  avgDays: number | null;
  /** Percentual de conclusões dentro do prazo (0–100). */
  adherence: number | null;
}

export interface RenewalReport {
  units: RenewalUnitRow[];
  total: number;
  open: number;
  completed: number;
  overdue: number;
  stalled: number;
  onTime: number;
  late: number;
  avgDays: number | null;
  adherence: number | null;
  /** Maior tempo de conclusão registrado (dias). */
  worstDays: number | null;
  /** Menor tempo de conclusão registrado (dias). */
  bestDays: number | null;
  /** Limite de dias sem movimentação usado no cálculo. */
  idleDays: number;
}

interface Bucket {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  stalled: number;
  onTime: number;
  late: number;
  durations: number[];
}

function emptyBucket(): Bucket {
  return {
    total: 0,
    open: 0,
    completed: 0,
    overdue: 0,
    stalled: 0,
    onTime: 0,
    late: 0,
    durations: [],
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function adherenceOf(bucket: Bucket): number | null {
  const evaluated = bucket.onTime + bucket.late;
  if (evaluated === 0) return null;
  return Math.round((bucket.onTime / evaluated) * 100);
}

function addToBucket(
  bucket: Bucket,
  request: RenewalRequest,
  now: Date,
  idleDays: number
): void {
  bucket.total += 1;
  if (request.status === "concluida") {
    bucket.completed += 1;
    const days = renewalDurationDays(request);
    if (days !== null) bucket.durations.push(days);
    const onTime = renewalOnTime(request);
    if (onTime === true) bucket.onTime += 1;
    else if (onTime === false) bucket.late += 1;
    return;
  }
  bucket.open += 1;
  const due = new Date(request.dueAt || "").getTime();
  if (!Number.isNaN(due) && due < now.getTime()) bucket.overdue += 1;
  if (renewalIdleInfo(request, idleDays, now)?.idle) bucket.stalled += 1;
}

/**
 * Relatório de renovações por unidade.
 *
 * Cada unidade mostra volume, o que está em andamento, o que estourou o prazo,
 * o que está parado (sem movimentação), o tempo médio de conclusão e a
 * aderência ao SLA. As unidades com mais pendências aparecem primeiro.
 */
export function buildRenewalReport(
  requests: RenewalRequest[],
  now = new Date(),
  idleDays = 5
): RenewalReport {
  const byUnit = new Map<string, Bucket>();
  const overall = emptyBucket();
  const limit = Math.max(1, Math.round(idleDays));

  requests.forEach((request) => {
    const unit = (request.unit || "").trim() || "Corporativo";
    const bucket = byUnit.get(unit) || emptyBucket();
    addToBucket(bucket, request, now, limit);
    addToBucket(overall, request, now, limit);
    byUnit.set(unit, bucket);
  });

  const units: RenewalUnitRow[] = Array.from(byUnit.entries())
    .map(([unit, bucket]) => ({
      unit,
      total: bucket.total,
      open: bucket.open,
      completed: bucket.completed,
      overdue: bucket.overdue,
      stalled: bucket.stalled,
      onTime: bucket.onTime,
      late: bucket.late,
      avgDays: average(bucket.durations),
      adherence: adherenceOf(bucket),
    }))
    .sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.stalled !== a.stalled) return b.stalled - a.stalled;
      if ((b.avgDays ?? -1) !== (a.avgDays ?? -1)) return (b.avgDays ?? -1) - (a.avgDays ?? -1);
      return b.total - a.total || a.unit.localeCompare(b.unit, "pt-BR");
    });

  return {
    units,
    total: overall.total,
    open: overall.open,
    completed: overall.completed,
    overdue: overall.overdue,
    stalled: overall.stalled,
    onTime: overall.onTime,
    late: overall.late,
    avgDays: average(overall.durations),
    adherence: adherenceOf(overall),
    worstDays: overall.durations.length ? Math.max(...overall.durations) : null,
    bestDays: overall.durations.length ? Math.min(...overall.durations) : null,
    idleDays: limit,
  };
}

/** Tempo médio no formato "12,4 dias". */
export function formatDays(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} dia(s)`;
}