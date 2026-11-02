import type { Collaborator } from "@/mocks/collaborators";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import type { MedicalCertificate } from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import {
  certificateLeaveMonth,
  certificateUnit,
  type AbsenteeismSummary,
} from "@/pages/app/modules/meusdocumentos/certificateInsights";

/**
 * PDF do resumo de absenteísmo.
 *
 * Sai com a mesma leitura do card do dashboard: KPIs, gráfico de colunas dos
 * dias de afastamento por período (mês) e a matriz unidade × mês. O gráfico é
 * um SVG montado direto no HTML do documento, portanto imprime nítido em
 * qualquer versão do navegador — sem depender de imagem externa.
 */

export interface AbsenteeismPdfInput {
  summary: AbsenteeismSummary;
  /** Atestados já recortados por período/unidade. */
  certificates: MedicalCertificate[];
  collaboratorsById: Map<string, Collaborator>;
  periodText: string;
  unitLabel: string;
  threshold: number;
  longLeaves: number;
}

interface ChartPoint {
  label: string;
  value: number;
}

/** Gráfico de colunas (SVG) dos dias de afastamento por período. */
function columnsChartSvg(points: ChartPoint[]): string {
  const W = 720;
  const H = 250;
  const left = 48;
  const right = 16;
  const top = 28;
  const bottom = 44;
  const plotW = W - left - right;
  const plotH = H - top - bottom;

  const max = Math.max(1, ...points.map((p) => p.value));
  const step = max <= 4 ? 1 : max <= 12 ? 2 : Math.ceil(max / 5 / 5) * 5;
  const ceiling = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= ceiling; value += step) ticks.push(value);

  const yOf = (value: number) => top + plotH - (value / ceiling) * plotH;

  const grid = ticks
    .map(
      (value) => `<line x1="${left}" y1="${yOf(value).toFixed(1)}" x2="${left + plotW}" y2="${yOf(
        value
      ).toFixed(1)}" stroke="#e3e9ec" stroke-width="1" />
      <text x="${left - 8}" y="${(yOf(value) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#6b7a80">${value}</text>`
    )
    .join("");

  const band = plotW / points.length;
  const barW = Math.max(14, Math.min(58, band * 0.52));

  const bars = points
    .map((point, index) => {
      const value = Math.max(0, point.value);
      const height = (value / ceiling) * plotH;
      const x = left + band * index + (band - barW) / 2;
      const y = top + plotH - height;
      const labelY = value > 0 ? y - 7 : top + plotH - 7;
      const fill = value > 0 ? "#d97706" : "#dde5e8";
      const textFill = value > 0 ? "#8a4a06" : "#9aa6ac";
      return `<g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(
        1
      )}" height="${Math.max(2, height).toFixed(1)}" rx="3" fill="${fill}" />
        <text x="${(x + barW / 2).toFixed(1)}" y="${labelY.toFixed(
        1
      )}" text-anchor="middle" font-size="10" font-weight="700" fill="${textFill}">${value}</text>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(top + plotH + 18).toFixed(
        1
      )}" text-anchor="middle" font-size="10" fill="#5b6b73">${escapeHtml(point.label)}</text>
      </g>`;
    })
    .join("");

  return `<div class="chart">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Dias de afastamento por período">
      ${grid}
      <line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="#c9d3d7" stroke-width="1" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="#c9d3d7" stroke-width="1" />
      ${bars}
      <text x="${left}" y="${H - 8}" font-size="9" fill="#6b7a80" text-anchor="start">Período de referência: mês de emissão do atestado · dias de afastamento</text>
    </svg>
  </div>`;
}

export function printAbsenteeismPdf(input: AbsenteeismPdfInput): void {
  const { summary, certificates, collaboratorsById, periodText, unitLabel, threshold, longLeaves } = input;

  const unitLabelOf = (cert: MedicalCertificate) =>
    certificateUnit(cert, collaboratorsById) || "Sem unidade cadastrada";

  const monthHeaders = summary.months.map((month) => `<th>${escapeHtml(month.label)}</th>`).join("");
  const matrixRows = summary.units
    .map((unit) => {
      const cells = summary.months
        .map((month) => {
          const days = certificates
            .filter(
              (cert) => unitLabelOf(cert) === unit.unit && certificateLeaveMonth(cert) === month.key
            )
            .reduce((sum, cert) => sum + (cert.leaveDays || 0), 0);
          return `<td>${days > 0 ? days : "—"}</td>`;
        })
        .join("");
      return `<tr><td>${escapeHtml(unit.unit)}</td>${cells}<td><b>${unit.days}</b></td><td>${unit.people}</td></tr>`;
    })
    .join("");
  const monthTotals = summary.months.map((month) => `<td><b>${month.days}</b></td>`).join("");

  const chartSection =
    summary.months.length > 0
      ? `${columnsChartSvg(summary.months.map((month) => ({ label: month.label, value: month.days })))}
         <p class="muted">Colunas: total de dias de afastamento em cada período. O período é o mês de emissão do atestado, ou seja, o mês de início do afastamento.</p>`
      : `<p class="muted">Nenhum atestado no recorte selecionado, portanto não há período a representar no gráfico.</p>`;

  const body = `${pdfHeader(`Absenteísmo · ${unitLabel || "Todas as unidades"} · ${periodText}`)}
    <h1>Resumo de absenteísmo</h1>
    <p class="muted">Dias de afastamento apurados a partir dos atestados médicos recebidos no período. Unidade: ${escapeHtml(
      unitLabel || "Todas as unidades"
    )}.</p>

    <div class="kpis">
      <div class="kpi"><b>${summary.totalDays}</b><span>dias de afastamento</span></div>
      <div class="kpi"><b>${summary.people}</b><span>colaboradores com atestado</span></div>
      <div class="kpi"><b>${summary.certificates}</b><span>atestados recebidos</span></div>
      <div class="kpi"><b>${String(summary.daysPerPerson).replace(".", ",")}</b><span>média de dias por colaborador afastado</span></div>
    </div>

    <h2>Dias de afastamento por período</h2>
    ${chartSection}

    <h2>Dias de afastamento por unidade e por mês</h2>
    <table>
      <thead><tr><th>Unidade</th>${monthHeaders}<th>Total</th><th>Colaboradores</th></tr></thead>
      <tbody>${matrixRows}<tr><td><b>Total</b></td>${monthTotals}<td><b>${summary.totalDays}</b></td><td>${summary.people}</td></tr></tbody>
    </table>

    <p class="muted">Maior afastamento individual: ${summary.longestLeave} dia(s). Atestados com afastamento igual ou superior a ${threshold} dia(s): ${longLeaves}.</p>

    ${pdfFooter()}`;

  printHtml("Resumo de absenteísmo — SSTEK", body);
}