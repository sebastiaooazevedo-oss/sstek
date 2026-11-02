import { useMemo, useState } from "react";

export type PeriodMode = "todos" | "semana" | "mes" | "periodo";

export interface PeriodValue {
  mode: PeriodMode;
  month: string;
  from: string;
  to: string;
}

const MONTH_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Converte uma data no formato "DD/MM/YYYY" em um objeto Date (meia-noite local).
 * Aceita também valores com hora anexada (ex.: "29/09/2026 09:14:22").
 */
export function parseBrDate(date: string): Date | null {
  const datePart = date.split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y || Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

/** Retorna a chave de mês "YYYY-MM" a partir de "DD/MM/YYYY" (ignora hora anexada). */
function monthKeyOf(date: string): string {
  const [d, m, y] = date.split(" ")[0].split("/");
  if (!d || !m || !y) return "—";
  return `${y}-${m}`;
}

/** Converte um objeto Date em "YYYY-MM-DD" (formato aceito por input[type=date]). */
function toInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calcula o intervalo dos últimos N dias (incluindo hoje). */
function quickRange(days: number): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  return { from: toInputValue(from), to: toInputValue(today) };
}

/** Primeiro e último dia do mês atual. */
function currentMonthRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: toInputValue(from), to: toInputValue(to) };
}

/** Primeiro e último dia do mês anterior. */
function lastMonthRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: toInputValue(from), to: toInputValue(to) };
}

const QUICK_RANGES: { id: string; label: string; range: () => { from: string; to: string } }[] = [
  { id: "7", label: "Últimos 7 dias", range: () => quickRange(7) },
  { id: "30", label: "Últimos 30 dias", range: () => quickRange(30) },
  { id: "mes-atual", label: "Mês atual", range: currentMonthRange },
  { id: "mes-passado", label: "Mês passado", range: lastMonthRange },
];

/** Início da semana (segunda-feira) para uma data base. */
function startOfWeek(base: Date): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - day);
  return d;
}

export interface PeriodMonthOption {
  key: string;
  label: string;
}

export function usePeriodFilter(dates: string[], initialValue?: PeriodValue) {
  const [value, setValue] = useState<PeriodValue>(
    () => initialValue ?? { mode: "todos", month: "", from: "", to: "" }
  );

  const months = useMemo<PeriodMonthOption[]>(() => {
    const set = new Set<string>();
    dates.forEach((d) => {
      const key = monthKeyOf(d);
      if (key !== "—") set.add(key);
    });
    return Array.from(set)
      .sort()
      .reverse()
      .map((key) => {
        const [y, m] = key.split("-");
        return { key, label: `${MONTH_FULL[Number(m) - 1] || m} ${y}` };
      });
  }, [dates]);

  const effectiveMonth = value.month || months[0]?.key || "";

  const matches = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return (date: string): boolean => {
      const parsed = parseBrDate(date);
      if (!parsed) return true;
      switch (value.mode) {
        case "semana":
          return parsed >= weekStart && parsed <= weekEnd;
        case "mes":
          return monthKeyOf(date) === effectiveMonth;
        case "periodo": {
          if (value.from) {
            const from = new Date(`${value.from}T00:00:00`);
            if (parsed < from) return false;
          }
          if (value.to) {
            const to = new Date(`${value.to}T23:59:59`);
            if (parsed > to) return false;
          }
          return true;
        }
        default:
          return true;
      }
    };
  }, [value, effectiveMonth]);

  const isActive = value.mode !== "todos";
  const reset = () => setValue({ mode: "todos", month: "", from: "", to: "" });

  return { value, setValue, months, effectiveMonth, matches, isActive, reset };
}

/** Gera um rótulo legível do período selecionado (usado em títulos e PDFs). */
export function periodLabel(value: PeriodValue, months: PeriodMonthOption[]): string {
  switch (value.mode) {
    case "semana":
      return "Semana atual (seg a dom)";
    case "mes": {
      const key = value.month || months[0]?.key || "";
      const found = months.find((m) => m.key === key);
      return found ? found.label : "Mês selecionado";
    }
    case "periodo": {
      const fmt = (v: string) => {
        const [y, m, d] = v.split("-");
        return `${d}/${m}/${y}`;
      };
      if (value.from && value.to) return `${fmt(value.from)} a ${fmt(value.to)}`;
      if (value.from) return `a partir de ${fmt(value.from)}`;
      if (value.to) return `até ${fmt(value.to)}`;
      return "Período selecionado";
    }
    default:
      return "Todos os registros";
  }
}

interface PeriodFilterBarProps {
  value: PeriodValue;
  onChange: (next: PeriodValue) => void;
  months: PeriodMonthOption[];
  effectiveMonth: string;
  className?: string;
}

const MODES: { id: PeriodMode; label: string; icon: string }[] = [
  { id: "todos", label: "Tudo", icon: "ri-list-check-2" },
  { id: "semana", label: "Semana", icon: "ri-calendar-event-line" },
  { id: "mes", label: "Mês", icon: "ri-calendar-line" },
  { id: "periodo", label: "Período", icon: "ri-calendar-2-line" },
];

export function PeriodFilterBar({
  value,
  onChange,
  months,
  effectiveMonth,
  className = "",
}: PeriodFilterBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      <div className="inline-flex items-center gap-1 rounded-full bg-background-100 p-1">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange({ ...value, mode: mode.id })}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              value.mode === mode.id
                ? "bg-primary-500 text-background-50"
                : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className={`${mode.icon} text-base`}></i>
            {mode.label}
          </button>
        ))}
      </div>

      {value.mode === "semana" && (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary-100 px-3 py-2 text-xs font-semibold text-secondary-900">
          <i className="ri-information-line text-sm"></i>
          Semana atual (seg a dom)
        </span>
      )}

      {value.mode === "mes" &&
        (months.length > 0 ? (
          <div className="relative">
            <select
              value={effectiveMonth}
              onChange={(e) => onChange({ ...value, month: e.target.value })}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-56"
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        ) : (
          <span className="text-xs text-foreground-500">Sem registros com data.</span>
        ))}

      {value.mode === "periodo" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-background-100 p-1">
            {QUICK_RANGES.map((range) => {
              const r = range.range();
              const active = value.from === r.from && value.to === r.to;
              return (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => onChange({ ...value, from: r.from, to: r.to })}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  <i className="ri-history-line text-sm"></i>
                  {range.label}
                </button>
              );
            })}
          </div>
          <label className="inline-flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2 focus-within:border-primary-400">
            <span className="text-xs font-semibold text-foreground-500">De</span>
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="bg-transparent text-sm text-foreground-900 outline-none"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2 focus-within:border-primary-400">
            <span className="text-xs font-semibold text-foreground-500">Até</span>
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="bg-transparent text-sm text-foreground-900 outline-none"
            />
          </label>
          {(value.from || value.to) && (
            <button
              type="button"
              onClick={() => onChange({ ...value, from: "", to: "" })}
              title="Limpar datas"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-line text-sm"></i>
              Limpar datas
            </button>
          )}
        </div>
      )}
    </div>
  );
}