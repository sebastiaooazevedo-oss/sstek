import { useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { getMoodOption } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate, moodTime } from "@/pages/app/mood/moodUtils";
import type { MoodEntry } from "@/pages/app/mood/moodStore";
import {
  areaTrend,
  buildComparisonTrend,
  buildDailyTrend,
  CONSOLIDATED_KEY,
  trendSubjects,
  trendSummary,
} from "@/pages/app/modules/sentimento/moodTrend";
import type { ChartRow, ChartSeries, MoodTrendExport } from "@/pages/app/modules/sentimento/moodTrend";
import MoodTrendChart from "@/pages/app/modules/sentimento/components/MoodTrendChart";
import { escapeHtml } from "@/pages/app/utils/exportPdf";

interface MoodTrendSectionProps {
  entries: MoodEntry[];
  periodText: string;
  exportRef?: { current: MoodTrendExport | null };
}

type TrendMode = "single" | "compare";

const SERIES_COLORS = [
  "oklch(var(--primary-500))",
  "oklch(var(--accent-500))",
  "oklch(var(--secondary-700))",
];

const MAX_COMPARE = 3;

/** Formata a variação entre o início e o fim do período. */
function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "estável";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

function deltaArrow(delta: number | null): string {
  if (delta === null || delta === 0) return "ri-subtract-line";
  return delta > 0 ? "ri-arrow-up-line" : "ri-arrow-down-line";
}

/**
 * Seção de evolução do sentimento no painel do gestor.
 * Mostra a média diária do time (ou de colaboradores selecionados) em linha,
 * permite comparar 2 ou 3 pessoas ao mesmo tempo, sinaliza os dias com alerta
 * negativo e resume a tendência por área/setor.
 */
export default function MoodTrendSection({ entries, periodText, exportRef }: MoodTrendSectionProps) {
  const [mode, setMode] = useState<TrendMode>("single");
  const [subjectKey, setSubjectKey] = useState("");
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const subjects = useMemo(() => trendSubjects(entries), [entries]);

  const seriesKeys = useMemo(
    () => (mode === "compare" ? compareKeys : [subjectKey || CONSOLIDATED_KEY]),
    [mode, compareKeys, subjectKey]
  );

  const series = useMemo<ChartSeries[]>(
    () =>
      seriesKeys.map((key, index) => ({
        key,
        field: `s${index}`,
        name:
          key === CONSOLIDATED_KEY
            ? "Equipe (consolidado)"
            : subjects.find((subject) => subject.key === key)?.name ?? "Colaborador",
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      })),
    [seriesKeys, subjects]
  );

  const chartData = useMemo<ChartRow[]>(() => {
    if (seriesKeys.length === 0) return [];
    const raw = buildComparisonTrend(entries, seriesKeys);
    return raw.map((row) => {
      const flat: ChartRow = {
        date: row.date,
        label: row.label,
        hasAlert: row.hasAlert,
        count: row.count,
        entries: row.entries,
      };
      series.forEach((s) => {
        flat[s.field] = row.values[s.key] ?? null;
      });
      return flat;
    });
  }, [entries, seriesKeys, series]);

  const summaryPoints = useMemo(() => {
    if (mode === "compare") {
      const scoped = entries.filter((entry) => compareKeys.includes(entry.userKey));
      return buildDailyTrend(scoped, null);
    }
    return buildDailyTrend(entries, subjectKey || null);
  }, [entries, mode, compareKeys, subjectKey]);

  const summary = useMemo(() => trendSummary(summaryPoints), [summaryPoints]);
  const area = useMemo(() => areaTrend(entries), [entries]);

  const selectedRow = useMemo(
    () => (selectedDay ? chartData.find((row) => row.date === selectedDay) ?? null : null),
    [selectedDay, chartData]
  );

  useEffect(() => {
    setSelectedDay(null);
  }, [subjectKey, mode, compareKeys]);

  const subjectName =
    mode === "compare"
      ? `${series.length} colaborador${series.length === 1 ? "" : "es"}`
      : subjectKey
        ? subjects.find((subject) => subject.key === subjectKey)?.name ?? "Colaborador"
        : "Equipe (consolidado)";

  const subjectNameFull =
    mode === "compare"
      ? `Comparativo (${series.map((s) => s.name).join(", ")})`
      : subjectName;

  const hasChartData = chartData.some((row) =>
    series.some((s) => row[s.field] !== null && row[s.field] !== undefined)
  );

  // Mantém a captura para o PDF sempre atualizada (gráfico + resumo + áreas).
  useEffect(() => {
    if (!exportRef) return;
    const svgEl = chartRef.current?.querySelector("svg") ?? null;
    let chartSvg: string | null = null;
    if (svgEl) {
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      const width = Number(svgEl.getAttribute("width")) || svgEl.clientWidth || 900;
      const height = Number(svgEl.getAttribute("height")) || svgEl.clientHeight || 360;
      clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      chartSvg = clone.outerHTML;
    }

    const summaryHtml = `<div class="kpis">
      <div class="kpi"><b>${summary.avg !== null ? `${summary.avg.toFixed(1)} / 5` : "—"}</b><span>Média no período</span></div>
      <div class="kpi"><b>${summary.days}</b><span>Dias com registro</span></div>
      <div class="kpi"><b>${escapeHtml(summary.best?.label ?? "—")}</b><span>Melhor dia</span></div>
      <div class="kpi"><b>${escapeHtml(summary.worst?.label ?? "—")}</b><span>Dia mais baixo</span></div>
    </div>
    <p class="muted">Visão: ${escapeHtml(subjectNameFull)} · Variação no período: ${formatDelta(summary.delta)}</p>`;

    const areaRows = area.map((item) => [
      item.area,
      String(item.count),
      item.avg !== null ? item.avg.toFixed(1) : "—",
      String(item.negatives),
      `${item.positivePct}%`,
      formatDelta(item.delta),
    ]);

    exportRef.current = { chartSvg, summaryHtml, areaRows, hasData: hasChartData };
  });

  const handleMode = (next: TrendMode) => {
    setMode(next);
    if (next === "compare" && compareKeys.length === 0) {
      setCompareKeys(subjects.slice(0, Math.min(2, subjects.length)).map((subject) => subject.key));
    }
  };

  const toggleCompareKey = (key: string) => {
    setCompareKeys((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, key];
    });
  };

  const delta = summary.delta;
  const deltaTone = delta === null || delta === 0 ? "secondary" : delta > 0 ? "primary" : "accent";
  const deltaToneClass: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    accent: "bg-accent-100 text-accent-800",
    secondary: "bg-secondary-100 text-secondary-800",
  };

  const stats = [
    { label: "Média no período", value: summary.avg !== null ? `${summary.avg.toFixed(1)} / 5` : "—", icon: "ri-line-chart-line" },
    { label: "Dias com registro", value: `${summary.days}`, icon: "ri-calendar-check-line" },
    { label: "Melhor dia", value: summary.best ? `${summary.best.label}` : "—", hint: summary.best?.avg != null ? `${summary.best.avg.toFixed(1)} / 5` : undefined, icon: "ri-emotion-happy-line" },
    { label: "Dia mais baixo", value: summary.worst ? `${summary.worst.label}` : "—", hint: summary.worst?.avg != null ? `${summary.worst.avg.toFixed(1)} / 5` : undefined, icon: "ri-emotion-unhappy-line" },
  ];

  return (
    <SectionCard
      title="Evolução do sentimento"
      subtitle={`Média diária por dia · ${subjectName} · ${periodText}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-background-100 p-1">
            <button
              type="button"
              onClick={() => handleMode("single")}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                mode === "single" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              <i className="ri-line-chart-line text-base"></i>
              Individual
            </button>
            <button
              type="button"
              onClick={() => handleMode("compare")}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                mode === "compare" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              <i className="ri-git-branch-line text-base"></i>
              Comparar
            </button>
          </div>

          {mode === "single" ? (
            <label className="inline-flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2 focus-within:border-primary-400">
              <span className="flex h-6 w-6 items-center justify-center text-foreground-400">
                <i className="ri-user-search-line text-base"></i>
              </span>
              <span className="hidden text-xs font-semibold text-foreground-500 sm:block">Ver evolução de</span>
              <div className="relative">
                <select
                  value={subjectKey}
                  onChange={(event) => setSubjectKey(event.target.value)}
                  className="w-full appearance-none bg-transparent py-0.5 pl-1 pr-7 text-sm font-semibold text-foreground-900 outline-none sm:w-64"
                >
                  <option value="">Equipe (consolidado) · {entries.length} registro(s)</option>
                  {subjects.map((subject) => (
                    <option key={subject.key} value={subject.key}>
                      {subject.name}
                      {subject.area ? ` · ${subject.area}` : ""} — {subject.count} registro(s)
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </label>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                compareKeys.length >= 2 ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-800"
              }`}
            >
              <i className="ri-git-branch-line"></i>
              {compareKeys.length}/{MAX_COMPARE} selecionado(s)
            </span>
          )}
        </div>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${deltaToneClass[deltaTone]}`}
        >
          <i className={deltaArrow(delta)}></i>
          Variação no período: {formatDelta(delta)}
        </span>
      </div>

      {mode === "compare" && (
        <div className="mt-3 rounded-lg border border-background-200 bg-background-100 p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-user-add-line"></i>
            Escolha 2 ou 3 colaboradores para sobrepor as linhas
          </p>
          {subjects.length === 0 ? (
            <p className="text-xs text-foreground-500">Sem colaboradores com registro neste período.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const active = compareKeys.includes(subject.key);
                const disabled = !active && compareKeys.length >= MAX_COMPARE;
                return (
                  <button
                    key={subject.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleCompareKey(subject.key)}
                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-primary-300 bg-primary-500 text-background-50"
                        : disabled
                          ? "cursor-not-allowed border-background-200 bg-background-50 text-foreground-300"
                          : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                    }`}
                  >
                    <i className={active ? "ri-checkbox-circle-line" : "ri-add-circle-line"}></i>
                    {subject.name}
                    {subject.area && <span className={active ? "text-background-50/80" : "text-foreground-400"}>· {subject.area}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {hasChartData ? (
        <div className="mt-4">
          <div ref={chartRef}>
            <MoodTrendChart
              data={chartData}
              series={series}
              selectedDay={selectedDay}
              onSelectDay={(date) => setSelectedDay((prev) => (prev === date ? null : date))}
            />
          </div>

          {series.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {series.map((s) => (
                <span key={s.field} className="inline-flex items-center gap-2 text-xs font-semibold text-foreground-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-cursor-line text-xs"></i>
              Clique num ponto do gráfico para ver a nota do dia.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500"></span>
              Marcador abaixo do dia = alerta de sentimento negativo.
            </span>
            <span>Escala: 1 Muito Triste → 5 Muito Feliz · linha pontilhada = Neutro</span>
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-line-chart-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">
            {mode === "compare" && compareKeys.length < 2 ? "Selecione ao menos 2 colaboradores" : "Sem dados para o gráfico"}
          </p>
          <p className="text-xs text-foreground-500">
            {mode === "compare"
              ? "Escolha de 2 a 3 colaboradores no painel acima para comparar as evoluções."
              : "Ajuste o período ou selecione outro colaborador para ver a evolução."}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-background-200 bg-background-100 p-3.5">
            <div className="flex items-center gap-2 text-foreground-400">
              <i className={`${stat.icon} text-sm`}></i>
              <span className="text-[11px] font-medium">{stat.label}</span>
            </div>
            <p className="mt-2 font-heading text-lg font-extrabold tracking-tight text-foreground-950">{stat.value}</p>
            {stat.hint && <p className="mt-0.5 text-[11px] text-foreground-500">{stat.hint}</p>}
          </div>
        ))}
      </div>

      {selectedRow && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-calendar-event-line text-base"></i>
              </span>
              <div>
                <p className="text-sm font-bold text-foreground-950">
                  {friendlyMoodDate(selectedRow.date)}
                  {selectedRow.count > 0 && <span className="ml-2 text-xs font-semibold text-primary-700">{selectedRow.count} registro(s)</span>}
                  {selectedRow.hasAlert && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-900">
                      <i className="ri-alert-line"></i>
                      Alerta
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-foreground-500">{subjectName} · detalhe do dia</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-line"></i>
              Fechar dia
            </button>
          </div>

          {selectedRow.entries.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {selectedRow.entries.map((entry) => {
                const option = getMoodOption(entry.mood);
                return (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5"
                  >
                    <span className="text-2xl">{option?.emoji ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground-950">{entry.userName}</p>
                        <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                          {option?.label ?? "—"}
                        </span>
                        {entry.area && <span className="text-[11px] text-foreground-400">{entry.area}</span>}
                      </div>
                      {entry.reason && (
                        <p className="mt-1 text-xs italic leading-relaxed text-foreground-600">“{entry.reason}”</p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-foreground-400">
                      {moodTime(entry.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-foreground-500">Sem registro neste dia.</p>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-background-200 bg-background-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-community-line text-secondary-700"></i>
            Tendência por área/setor
          </p>
          <span className="text-[11px] text-foreground-500">Média, alertas e variação no período</span>
        </div>

        {area.length > 0 ? (
          <div className="mt-3 flex flex-col divide-y divide-background-200">
            {area.map((item) => {
              const tone = item.delta === null || item.delta === 0 ? "secondary" : item.delta > 0 ? "primary" : "accent";
              const toneClass: Record<string, string> = {
                primary: "bg-primary-100 text-primary-700",
                accent: "bg-accent-100 text-accent-800",
                secondary: "bg-secondary-100 text-secondary-800",
              };
              return (
                <div key={item.area} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                      <i className="ri-building-2-line text-base"></i>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground-950">{item.area}</p>
                      <p className="text-[11px] text-foreground-500">
                        {item.count} registro(s) · {item.days} dia(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
                      <i className="ri-line-chart-line"></i>
                      {item.avg !== null ? `${item.avg.toFixed(1)} / 5` : "—"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.negatives > 0 ? "bg-accent-100 text-accent-800" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      <i className="ri-alert-line"></i>
                      {item.negatives} alerta(s)
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
                      {item.positivePct}% positivo
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass[tone]}`}>
                      <i className={deltaArrow(item.delta)}></i>
                      {formatDelta(item.delta)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-foreground-500">Sem registros por área neste período.</p>
        )}
      </div>
    </SectionCard>
  );
}