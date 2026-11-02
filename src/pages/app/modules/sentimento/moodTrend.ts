import type { MoodEntry } from "@/pages/app/mood/moodStore";
import { isNegativeMood } from "@/pages/app/mood/moodOptions";

/**
 * Tendência de sentimento — agregação diária para o gráfico de evolução.
 * A média do dia é a média simples das notas (1 a 5) registradas naquele dia.
 * Quando o período é longo demais, o eixo passa a mostrar apenas os dias com registro.
 */
export interface TrendPoint {
  date: string;
  label: string;
  avg: number | null;
  count: number;
  hasAlert: boolean;
  entries: MoodEntry[];
}

export interface TrendSubject {
  key: string;
  name: string;
  area: string;
  count: number;
}

export interface TrendSummary {
  avg: number | null;
  total: number;
  days: number;
  best: TrendPoint | null;
  worst: TrendPoint | null;
  first: TrendPoint | null;
  last: TrendPoint | null;
  delta: number | null;
}

/** Série comparativa: valores por dia para cada colaborador (ou consolidado). */
export interface ComparisonPoint {
  date: string;
  label: string;
  hasAlert: boolean;
  count: number;
  entries: MoodEntry[];
  values: Record<string, number | null>;
}

/** Série desenhada no gráfico (campo "achatado" na linha de dados). */
export interface ChartSeries {
  key: string;
  field: string;
  name: string;
  color: string;
}

/** Linha de dados entregue ao gráfico (uma por dia, com um campo por série). */
export interface ChartRow {
  date: string;
  label: string;
  hasAlert: boolean;
  count: number;
  entries: MoodEntry[];
  [field: string]: unknown;
}

/** Resumo de tendência por área/setor no período. */
export interface AreaTrend {
  area: string;
  count: number;
  avg: number | null;
  negatives: number;
  positivePct: number;
  days: number;
  delta: number | null;
}

/** Conteúdo da evolução capturado para a exportação em PDF. */
export interface MoodTrendExport {
  chartSvg: string | null;
  summaryHtml: string;
  areaRows: string[][];
  hasData: boolean;
}

/** Chave especial que representa o time inteiro (visão consolidada). */
export const CONSOLIDATED_KEY = "__all__";

const MAX_CONTINUOUS_DAYS = 45;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1, d + days);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dayDiff(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

function labelOf(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Monta o eixo de dias do período (contínuo quando curto, senão só os dias com registro). */
function buildAxis(dates: string[]): string[] {
  if (dates.length === 0) return [];
  const min = dates[0];
  const max = dates[dates.length - 1];
  const span = dayDiff(min, max);
  if (span > MAX_CONTINUOUS_DAYS) return [...dates];
  const axis: string[] = [];
  let cursor = min;
  while (dayDiff(cursor, max) >= 0) {
    axis.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return axis;
}

/**
 * Monta a série diária do período. Se `subjectKey` for informado, considera
 * apenas os registros daquele colaborador (visão individual).
 */
export function buildDailyTrend(entries: MoodEntry[], subjectKey?: string | null): TrendPoint[] {
  const scoped = subjectKey ? entries.filter((entry) => entry.userKey === subjectKey) : entries;
  if (scoped.length === 0) return [];

  const dates = Array.from(new Set(scoped.map((entry) => entry.moodDate))).sort();
  const axis = buildAxis(dates);

  return axis.map((date) => {
    const dayEntries = scoped.filter((entry) => entry.moodDate === date);
    const count = dayEntries.length;
    const avg = count > 0 ? dayEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / count : null;
    return {
      date,
      label: labelOf(date),
      avg: avg === null ? null : round(avg),
      count,
      hasAlert: dayEntries.some((entry) => isNegativeMood(entry.mood)),
      entries: dayEntries,
    };
  });
}

/**
 * Monta a série comparativa para 1 a 3 colaboradores (ou o consolidado).
 * Cada dia traz, por série, a média do colaborador, além do marcador de alerta
 * negativo e a lista de registros do dia.
 */
export function buildComparisonTrend(entries: MoodEntry[], subjectKeys: string[]): ComparisonPoint[] {
  if (subjectKeys.length === 0) return [];
  const consolidated = subjectKeys.includes(CONSOLIDATED_KEY);
  const keySet = new Set(subjectKeys);
  const scoped = consolidated ? entries : entries.filter((entry) => keySet.has(entry.userKey));
  if (scoped.length === 0) return [];

  const dates = Array.from(new Set(scoped.map((entry) => entry.moodDate))).sort();
  const axis = buildAxis(dates);

  return axis.map((date) => {
    const dayEntries = scoped.filter((entry) => entry.moodDate === date);
    const values: Record<string, number | null> = {};
    subjectKeys.forEach((key) => {
      const subset = key === CONSOLIDATED_KEY ? dayEntries : dayEntries.filter((entry) => entry.userKey === key);
      values[key] = subset.length > 0 ? round(subset.reduce((sum, entry) => sum + entry.moodScore, 0) / subset.length) : null;
    });
    return {
      date,
      label: labelOf(date),
      hasAlert: dayEntries.some((entry) => isNegativeMood(entry.mood)),
      count: dayEntries.length,
      entries: dayEntries,
      values,
    };
  });
}

/** Colaboradores presentes nos registros do período (para o seletor individual). */
export function trendSubjects(entries: MoodEntry[]): TrendSubject[] {
  const map = new Map<string, TrendSubject>();
  entries.forEach((entry) => {
    const existing = map.get(entry.userKey);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(entry.userKey, {
        key: entry.userKey,
        name: entry.userName,
        area: entry.area,
        count: 1,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Resumo do período: média geral, melhor/pior dia e variação entre primeiro e último. */
export function trendSummary(points: TrendPoint[]): TrendSummary {
  const withData = points.filter((point) => point.avg !== null);
  const total = points.reduce((sum, point) => sum + point.count, 0);

  const avg =
    total > 0
      ? withData.reduce((sum, point) => sum + (point.avg ?? 0) * point.count, 0) / total
      : null;

  let best: TrendPoint | null = null;
  let worst: TrendPoint | null = null;
  withData.forEach((point) => {
    if (!best || (point.avg ?? 0) > (best.avg ?? 0)) best = point;
    if (!worst || (point.avg ?? 0) < (worst.avg ?? 0)) worst = point;
  });

  const first = withData.length > 0 ? withData[0] : null;
  const last = withData.length > 0 ? withData[withData.length - 1] : null;
  const delta = first && last && withData.length > 1 ? (last.avg ?? 0) - (first.avg ?? 0) : null;

  return {
    avg: avg === null ? null : round(avg),
    total,
    days: withData.length,
    best,
    worst,
    first,
    last,
    delta: delta === null ? null : round(delta),
  };
}

/**
 * Resumo de tendência por área/setor.
 * Para cada área calcula média, quantidade, alertas negativos, % de positivos
 * e a variação entre o primeiro e o último dia registrado (seta de tendência).
 */
export function areaTrend(entries: MoodEntry[]): AreaTrend[] {
  const map = new Map<string, MoodEntry[]>();
  entries.forEach((entry) => {
    const area = entry.area && entry.area.trim() ? entry.area.trim() : "Sem área";
    const list = map.get(area);
    if (list) list.push(entry);
    else map.set(area, [entry]);
  });

  return Array.from(map.entries())
    .map(([area, list]) => {
      const count = list.length;
      const avg = count > 0 ? round(list.reduce((sum, entry) => sum + entry.moodScore, 0) / count) : null;
      const negatives = list.filter((entry) => isNegativeMood(entry.mood)).length;
      const positives = list.filter((entry) => entry.moodScore >= 4).length;
      const positivePct = count > 0 ? Math.round((positives / count) * 100) : 0;

      const dates = Array.from(new Set(list.map((entry) => entry.moodDate))).sort();
      const days = dates.length;
      let delta: number | null = null;
      if (days > 1) {
        const firstDay = list.filter((entry) => entry.moodDate === dates[0]);
        const lastDay = list.filter((entry) => entry.moodDate === dates[dates.length - 1]);
        const firstAvg = firstDay.reduce((sum, entry) => sum + entry.moodScore, 0) / firstDay.length;
        const lastAvg = lastDay.reduce((sum, entry) => sum + entry.moodScore, 0) / lastDay.length;
        delta = round(lastAvg - firstAvg);
      }

      return { area, count, avg, negatives, positivePct, days, delta };
    })
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area, "pt-BR"));
}