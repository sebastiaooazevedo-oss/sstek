import { useState, type ReactNode } from "react";

export type ChartTone = "primary" | "accent" | "secondary";

const toneBar: Record<ChartTone, string> = {
  primary: "bg-primary-500",
  accent: "bg-accent-500",
  secondary: "bg-secondary-500",
};

const toneSoft: Record<ChartTone, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-800",
  secondary: "bg-secondary-100 text-secondary-800",
};

const toneVar: Record<ChartTone, string> = {
  primary: "var(--primary-500)",
  accent: "var(--accent-500)",
  secondary: "var(--secondary-500)",
};

/* ---------------------------------------------------------------- */
/* Card wrapper for charts                                          */
/* ---------------------------------------------------------------- */

interface ChartCardProps {
  title: string;
  subtitle?: string;
  hint?: string;
  action?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, hint, action, legend, children, className = "" }: ChartCardProps) {
  return (
    <section className={`flex flex-col rounded-xl border border-background-200 bg-background-50 p-4 md:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-bold tracking-tight text-foreground-950 md:text-base">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500 md:text-xs">{subtitle}</p>}
        </div>
        {action}
      </div>
      {legend && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">{legend}</div>}
      <div className="mt-4 flex-1">{children}</div>
      {hint && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-foreground-400">
          <i className="ri-cursor-line text-sm"></i>
          {hint}
        </p>
      )}
    </section>
  );
}

export function ChartLegend({ items }: { items: { label: string; tone: ChartTone; value?: string }[] }) {
  return (
    <>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-600">
          <span className={`h-2 w-2 rounded-full ${
            item.tone === "primary" ? "bg-primary-500" : item.tone === "accent" ? "bg-accent-500" : "bg-secondary-500"
          }`}></span>
          {item.label}
          {item.value && <span className="font-bold text-foreground-900">{item.value}</span>}
        </span>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Interactive KPI tile                                             */
/* ---------------------------------------------------------------- */

interface StatTileProps {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: ChartTone;
  onClick?: () => void;
}

export function StatTile({ icon, label, value, detail, tone, onClick }: StatTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneSoft[tone]}`}>
          <i className={`${icon} text-lg`}></i>
        </span>
        {onClick && (
          <i className="ri-arrow-right-up-line text-base text-foreground-300 transition-colors group-hover:text-primary-600"></i>
        )}
      </div>
      <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-foreground-600">{label}</p>
      <p className="mt-1 text-[11px] text-foreground-400">{detail}</p>
    </>
  );

  if (!onClick) {
    return <div className="rounded-xl border border-background-200 bg-background-50 p-4 md:p-5">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-background-200 bg-background-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-background-100 md:p-5"
    >
      {content}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Column chart (grouped or stacked)                                */
/* ---------------------------------------------------------------- */

export interface ChartCategory {
  key: string;
  label: string;
}

export interface ChartSeries {
  id: string;
  label: string;
  tone: ChartTone;
  values: number[];
}

interface ColumnChartProps {
  categories: ChartCategory[];
  series: ChartSeries[];
  stacked?: boolean;
  height?: number;
  suffix?: string;
  onSelect?: (categoryKey: string) => void;
  emptyLabel?: string;
}

export function ColumnChart({
  categories,
  series,
  stacked = false,
  height = 208,
  suffix = "",
  onSelect,
  emptyLabel = "Sem dados no período selecionado.",
}: ColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (categories.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 text-center">
        <i className="ri-bar-chart-2-line text-2xl text-foreground-300"></i>
        <p className="text-xs text-foreground-500">{emptyLabel}</p>
      </div>
    );
  }

  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] || 0), 0));
  const max = Math.max(...(stacked ? totals : series.flatMap((s) => s.values)), 1);

  return (
    <div className="relative">
      <div className="relative" style={{ height }}>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <span key={line} className="block w-full border-t border-dashed border-background-200"></span>
          ))}
        </div>

        <div className="relative flex h-full items-end gap-1 sm:gap-2">
          {categories.map((category, index) => {
            const active = hovered === index;
            return (
              <button
                key={category.key}
                type="button"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(category.key)}
                aria-label={`${category.label}: ${totals[index]}${suffix ? ` ${suffix}` : ""}`}
                className={`group relative flex h-full flex-1 cursor-pointer flex-col justify-end rounded-md px-0.5 transition-colors sm:px-1 ${
                  active ? "bg-background-100" : ""
                } ${onSelect ? "" : "cursor-default"}`}
              >
                {stacked ? (
                  <div className="flex h-full w-full flex-col justify-end gap-[2px]">
                    {series.map((s) => {
                      const value = s.values[index] || 0;
                      const pct = (value / max) * 100;
                      return (
                        <div
                          key={s.id}
                          className={`w-full rounded-[2px] ${toneBar[s.tone]} transition-opacity ${active ? "opacity-100" : "opacity-90"}`}
                          style={{ height: `${pct}%`, minHeight: value > 0 ? 3 : 0 }}
                        ></div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full w-full items-end justify-center gap-[3px]">
                    {series.map((s) => {
                      const value = s.values[index] || 0;
                      const pct = (value / max) * 100;
                      return (
                        <div
                          key={s.id}
                          className={`w-full max-w-[16px] rounded-t-[3px] ${toneBar[s.tone]} transition-all ${
                            active ? "opacity-100" : "opacity-85"
                          }`}
                          style={{ height: `${pct}%`, minHeight: value > 0 ? 3 : 0 }}
                        ></div>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-1 z-20 min-w-[140px] -translate-x-1/2 rounded-lg border border-background-200 bg-background-50 px-3 py-2 shadow-sm"
            style={{ left: `${((hovered + 0.5) / categories.length) * 100}%` }}
          >
            <p className="text-[11px] font-bold text-foreground-950">{categories[hovered].label}</p>
            <div className="mt-1 flex flex-col gap-0.5">
              {series.map((s) => (
                <span key={s.id} className="flex items-center justify-between gap-3 text-[11px] text-foreground-600">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.tone === "primary" ? "bg-primary-500" : s.tone === "accent" ? "bg-accent-500" : "bg-secondary-500"
                      }`}
                    ></span>
                    {s.label}
                  </span>
                  <span className="font-bold text-foreground-900">
                    {s.values[hovered] || 0}
                    {suffix}
                  </span>
                </span>
              ))}
            </div>
            {onSelect && (
              <p className="mt-1.5 border-t border-background-200 pt-1 text-[10px] font-semibold text-primary-600">
                Clique para ver detalhes
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-end gap-1 sm:gap-2">
        {categories.map((category, index) => (
          <span
            key={category.key}
            className={`flex-1 truncate text-center text-[10px] font-semibold transition-colors ${
              hovered === index ? "text-foreground-900" : "text-foreground-500"
            }`}
          >
            {category.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Donut chart                                                      */
/* ---------------------------------------------------------------- */

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  tone: ChartTone;
}

interface DonutChartProps {
  data: DonutSlice[];
  centerLabel: string;
  onSelect?: (id: string) => void;
}

export function DonutChart({ data, centerLabel, onSelect }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 text-center">
        <i className="ri-donut-chart-line text-2xl text-foreground-300"></i>
        <p className="text-xs text-foreground-500">Nenhum documento monitorado.</p>
      </div>
    );
  }

  let cursor = 0;
  const gradient = data
    .map((item) => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `oklch(${toneVar[item.tone]}) ${start}% ${cursor}%`;
    })
    .join(", ");

  const hoveredItem = data.find((item) => item.id === hovered) ?? null;
  const percentOf = (value: number) => Math.round((value / total) * 100);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    const target = (angle / 360) * total;
    let acc = 0;
    const found = data.find((item) => {
      acc += item.value;
      return target <= acc;
    });
    setHovered(found ? found.id : null);
  };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div
        role="presentation"
        className={`relative flex h-[168px] w-[168px] shrink-0 items-center justify-center rounded-full transition-transform ${
          onSelect ? "cursor-pointer" : ""
        }`}
        style={{ background: `conic-gradient(${gradient})` }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHovered(null)}
        onClick={() => hoveredItem && onSelect?.(hoveredItem.id)}
      >
        <div className="flex h-[122px] w-[122px] flex-col items-center justify-center rounded-full bg-background-50 text-center">
          {hoveredItem ? (
            <>
              <span className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
                {percentOf(hoveredItem.value)}%
              </span>
              <span className="mt-0.5 max-w-[100px] text-[10px] font-semibold leading-tight text-foreground-500">
                {hoveredItem.label} · {hoveredItem.value}
              </span>
            </>
          ) : (
            <>
              <span className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{total}</span>
              <span className="mt-0.5 max-w-[100px] text-[10px] font-semibold leading-tight text-foreground-500">
                {centerLabel}
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1.5">
        {data.map((item) => {
          const active = hovered === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect?.(item.id)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  active ? "bg-background-100" : "hover:bg-background-100"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground-700">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.tone === "primary" ? "bg-primary-500" : item.tone === "accent" ? "bg-accent-500" : "bg-secondary-500"
                    }`}
                  ></span>
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-foreground-900">
                  {item.value}
                  <span className="ml-1 text-[10px] font-semibold text-foreground-400">{percentOf(item.value)}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Horizontal bar chart                                             */
/* ---------------------------------------------------------------- */

export interface HBarItem {
  id: string;
  label: string;
  value: number;
  tone?: ChartTone;
  hint?: string;
}

interface HBarChartProps {
  data: HBarItem[];
  suffix?: string;
  onSelect?: (id: string) => void;
  emptyLabel?: string;
}

export function HBarChart({ data, suffix = "", onSelect, emptyLabel = "Sem dados no período." }: HBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 text-center">
        <i className="ri-bar-chart-horizontal-line text-2xl text-foreground-300"></i>
        <p className="text-xs text-foreground-500">{emptyLabel}</p>
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex flex-col gap-1">
      {data.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect?.(item.id)}
          className={`group cursor-pointer rounded-md px-1.5 py-2 text-left transition-colors hover:bg-background-100 ${
            onSelect ? "" : "cursor-default"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-xs font-medium text-foreground-700">{item.label}</span>
            <span className="shrink-0 text-xs font-bold text-foreground-900">
              {item.value}
              {suffix}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-background-200">
            <div
              className={`h-full rounded-full transition-all ${toneBar[item.tone ?? "primary"]}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            ></div>
          </div>
          {item.hint && (
            <p className="mt-1 truncate text-[10px] text-foreground-400 opacity-0 transition-opacity group-hover:opacity-100">
              {item.hint}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Progress metric                                                  */
/* ---------------------------------------------------------------- */

interface ProgressMetricProps {
  label: string;
  value: number;
  total: number;
  tone?: ChartTone;
  suffix?: string;
  detail?: string;
  onClick?: () => void;
}

export function ProgressMetric({ label, value, total, tone = "primary", suffix, detail, onClick }: ProgressMetricProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-foreground-700">{label}</span>
        <span className="shrink-0 text-xs font-bold text-foreground-950">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
        <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${pct}%` }}></div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-foreground-400">
          {value}
          {suffix} de {total}
          {suffix}
        </span>
        {detail && <span className="shrink-0 text-[10px] font-semibold text-foreground-400">{detail}</span>}
      </div>
    </>
  );

  if (!onClick) {
    return <div className="rounded-lg border border-background-200 bg-background-100 p-3.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-background-200 bg-background-100 p-3.5 text-left transition-colors hover:border-primary-300 hover:bg-background-50"
    >
      {body}
      <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
        Ver detalhes <i className="ri-arrow-right-line"></i>
      </span>
    </button>
  );
}