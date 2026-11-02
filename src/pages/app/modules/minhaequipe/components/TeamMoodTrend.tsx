import { useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import MoodTrendChart from "@/pages/app/modules/sentimento/components/MoodTrendChart";
import {
  buildComparisonTrend,
  buildDailyTrend,
  CONSOLIDATED_KEY,
  trendSummary,
} from "@/pages/app/modules/sentimento/moodTrend";
import type { ChartRow, ChartSeries } from "@/pages/app/modules/sentimento/moodTrend";
import type { MoodEntry } from "@/pages/app/mood/moodStore";
import { escapeHtml } from "@/pages/app/utils/exportPdf";

/** Conteúdo capturado do gráfico de evolução da equipe para o PDF do líder. */
export interface TeamTrendCapture {
  chartSvg: string | null;
  summaryHtml: string;
}

interface TeamMoodTrendProps {
  entries: MoodEntry[];
  capture: { current: TeamTrendCapture | null };
}

/** Linha de dados do gráfico com a média consolidada da equipe já tipada. */
interface TeamChartRow extends ChartRow {
  avg: number | null;
}

const SERIES: ChartSeries[] = [
  { key: CONSOLIDATED_KEY, field: "avg", name: "Equipe (consolidado)", color: "oklch(var(--primary-500))" },
];

/**
 * "Evolução do sentimento da equipe" — o mesmo gráfico do painel do gestor,
 * embutido no painel do líder. Além de exibir a média diária do time, captura o
 * SVG renderizado para ser anexado como visual ao PDF exportado pelo líder.
 */
export default function TeamMoodTrend({ entries, capture }: TeamMoodTrendProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const data = useMemo<TeamChartRow[]>(
    () =>
      buildComparisonTrend(entries, [CONSOLIDATED_KEY]).map((row) => ({
        date: row.date,
        label: row.label,
        hasAlert: row.hasAlert,
        count: row.count,
        entries: row.entries,
        avg: row.values[CONSOLIDATED_KEY] ?? null,
      })),
    [entries]
  );

  const summary = useMemo(() => trendSummary(buildDailyTrend(entries, null)), [entries]);
  const hasData = data.some((row) => row.avg !== null);

  const selectedRow = useMemo(
    () => (selectedDay ? data.find((row) => row.date === selectedDay) ?? null : null),
    [selectedDay, data]
  );

  // Mantém a captura (SVG + resumo) sempre atualizada para o PDF do líder.
  useEffect(() => {
    const svgEl = chartRef.current?.querySelector("svg") ?? null;
    let chartSvg: string | null = null;
    if (svgEl) {
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      const width = Number(svgEl.getAttribute("width")) || svgEl.clientWidth || 900;
      const height = Number(svgEl.getAttribute("height")) || svgEl.clientHeight || 320;
      clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      chartSvg = clone.outerHTML;
    }

    const summaryHtml = `<div class="kpis">
      <div class="kpi"><b>${summary.avg !== null ? `${summary.avg.toFixed(1)} / 5` : "—"}</b><span>Média do período</span></div>
      <div class="kpi"><b>${summary.days}</b><span>Dias com registro</span></div>
      <div class="kpi"><b>${escapeHtml(summary.best?.label ?? "—")}</b><span>Melhor dia</span></div>
      <div class="kpi"><b>${escapeHtml(summary.worst?.label ?? "—")}</b><span>Dia mais baixo</span></div>
    </div>
    <p class="muted">Média diária da equipe (escala 1 a 5). O marcador abaixo do dia indica alerta de sentimento negativo.</p>`;

    capture.current = { chartSvg, summaryHtml };
  });

  return (
    <SectionCard
      title="Evolução do sentimento da equipe"
      subtitle="Média diária do time — o mesmo gráfico do painel de gestão, anexado ao PDF do líder"
    >
      {hasData ? (
        <>
          <div ref={chartRef}>
            <MoodTrendChart
              data={data}
              series={SERIES}
              selectedDay={selectedDay}
              onSelectDay={(date) => setSelectedDay((prev) => (prev === date ? null : date))}
            />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-cursor-line text-xs"></i>
              Clique num ponto do gráfico para ver a nota do dia.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500"></span>
              Marcador abaixo do dia = alerta de sentimento negativo.
            </span>
            <span>Escala: 1 Muito Triste → 5 Muito Feliz.</span>
          </p>

          {selectedRow && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-xs text-foreground-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-calendar-event-line"></i>
              </span>
              <span className="font-semibold text-foreground-950">{selectedRow.label}</span>
              <span>{selectedRow.count} registro(s)</span>
              {selectedRow.avg !== null && <span>· média {selectedRow.avg.toFixed(1)}/5</span>}
              {selectedRow.hasAlert && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 font-bold text-accent-900">
                  <i className="ri-alert-line"></i>
                  Alerta
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-line-chart-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Ainda sem dados de sentimento</p>
          <p className="text-xs text-foreground-500">
            Quando a equipe registrar o sentimento do dia, a evolução aparece aqui.
          </p>
        </div>
      )}
    </SectionCard>
  );
}