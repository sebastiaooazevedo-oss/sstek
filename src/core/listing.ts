/**
 * Utilidades de listagem compartilhadas pelos relatórios do sistema:
 * filtro por período (atalhos ou intervalo De/Até) e paginação.
 */

/** Atalhos de período dos relatórios. `custom` usa as datas De/Até. */
export type ConsultaPeriodo = "all" | "today" | "7d" | "30d" | "custom";

export const periodoLabels: Record<ConsultaPeriodo, string> = {
  all: "Todo o período",
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  custom: "Período escolhido",
};

/** Início do período em timestamp local. `null` = sem corte (tudo). */
export function periodoInicio(periodo: ConsultaPeriodo): number | null {
  if (periodo === "all" || periodo === "custom") return null;
  const now = new Date();
  if (periodo === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  const days = periodo === "7d" ? 7 : 30;
  return now.getTime() - days * 86400000;
}

/** Data "aaaa-mm-dd" → início (00:00) ou fim (23:59:59.999) do dia, no fuso do navegador. */
function limiteDoDia(value: string, fim: boolean): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), fim ? 23 : 0, fim ? 59 : 0, fim ? 59 : 0, fim ? 999 : 0);
  return d.getTime();
}

/**
 * `true` quando a consulta está dentro do período escolhido.
 * Em `custom`, `de` e `ate` ("aaaa-mm-dd") são inclusivos; qualquer um pode ficar vazio.
 */
export function dentroDoPeriodo(value: string, periodo: ConsultaPeriodo, de = "", ate = ""): boolean {
  if (periodo === "custom") {
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return false;
    const ini = limiteDoDia(de, false);
    const fim = limiteDoDia(ate, true);
    return (ini === null || t >= ini) && (fim === null || t <= fim);
  }
  const inicio = periodoInicio(periodo);
  if (inicio === null) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= inicio;
}


/* ------------------------------------------------------------------ */
/* Paginação                                                           */
/* ------------------------------------------------------------------ */

/** Quantidades por página oferecidas no relatório. */
export const TAMANHOS_PAGINA = [10, 30, 50] as const;
export type TamanhoPagina = (typeof TAMANHOS_PAGINA)[number];

export interface Pagina<T> {
  itens: T[];
  /** Página efetiva (corrigida para o intervalo válido), começando em 1. */
  pagina: number;
  totalPaginas: number;
  /** Posição do primeiro e do último item exibido (1-based; 0 quando vazio). */
  de: number;
  ate: number;
  total: number;
}

export function paginar<T>(lista: T[], pagina: number, tamanho: number): Pagina<T> {
  const total = lista.length;
  const porPagina = Math.max(1, Math.floor(tamanho) || 1);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(Math.max(1, Math.floor(pagina) || 1), totalPaginas);
  const inicio = (atual - 1) * porPagina;
  const itens = lista.slice(inicio, inicio + porPagina);
  return { itens, pagina: atual, totalPaginas, de: total ? inicio + 1 : 0, ate: inicio + itens.length, total };
}

/** Nome genérico do período (mesmo tipo). */
export type Periodo = ConsultaPeriodo;
