import { useMemo } from "react";
import Modal from "@/pages/app/components/Modal";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { buildRenewalReport, formatDays } from "@/pages/app/modules/documentos/renewalReport";
import type { RenewalRequest } from "@/pages/app/modules/documentos/renewalStore";
import { escapeHtml, pdfFooter, pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

interface RenewalReportModalProps {
  open: boolean;
  requests: RenewalRequest[];
  companyName: string;
  onClose: () => void;
}

const CSV_HEADERS = [
  "Unidade",
  "Solicitações",
  "Em andamento",
  "SLA estourado",
  "Paradas (sem movimentação)",
  "Concluídas",
  "Concluídas no prazo",
  "Concluídas fora do prazo",
  "Tempo médio de conclusão (dias)",
  "Aderência ao SLA (%)",
];

/**
 * Relatório de renovações por unidade e tempo médio de conclusão.
 *
 * Responde a duas perguntas de gestão: qual unidade concentra as renovações
 * atrasadas e quanto tempo a equipe leva, em média, para concluir uma
 * tratativa desde a abertura.
 */
export default function RenewalReportModal({
  open,
  requests,
  companyName,
  onClose,
}: RenewalReportModalProps) {
  const settings = useSystemSettings();
  const idleDays = Math.max(1, Math.round(settings.documentRenewalIdleDays));
  const report = useMemo(
    () => buildRenewalReport(requests, new Date(), idleDays),
    [requests, idleDays]
  );

  const rows = useMemo(
    () =>
      report.units.map((row) => [
        row.unit,
        String(row.total),
        String(row.open),
        String(row.overdue),
        String(row.stalled),
        String(row.completed),
        String(row.onTime),
        String(row.late),
        row.avgDays === null ? "—" : row.avgDays.toFixed(1).replace(".", ","),
        row.adherence === null ? "—" : String(row.adherence),
      ]),
    [report.units]
  );

  const handleCsv = () => {
    downloadCsv("renovacoes-por-unidade.csv", CSV_HEADERS, rows);
  };

  const handlePdf = () => {
    const body = `
      ${pdfHeader("Renovações de documentos · por unidade")}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${report.total}</b><span>Solicitações registradas</span></div>
        <div class="kpi"><b>${report.avgDays === null ? "—" : report.avgDays.toFixed(1).replace(".", ",")}</b><span>Tempo médio de conclusão (dias)</span></div>
        <div class="kpi"><b>${report.adherence === null ? "—" : `${report.adherence}%`}</b><span>Concluídas dentro do SLA</span></div>
        <div class="kpi"><b>${report.overdue}</b><span>Em andamento com SLA estourado</span></div>
        <div class="kpi"><b>${report.stalled}</b><span>Tratativas paradas (${report.idleDays}+ dias)</span></div>
      </div>
      <h2>Renovações por unidade (${report.units.length})</h2>
      ${tableHtml(
        CSV_HEADERS,
        report.units.map((row) => [
          row.unit,
          String(row.total),
          String(row.open),
          String(row.overdue),
          String(row.stalled),
          String(row.completed),
          String(row.onTime),
          String(row.late),
          row.avgDays === null ? "—" : row.avgDays.toFixed(1).replace(".", ","),
          row.adherence === null ? "—" : `${row.adherence}%`,
        ])
      )}
      <p style="font-size:11px;color:#555">Empresa: ${escapeHtml(companyName)} · Emitido em ${todayBr()}. O tempo médio considera os dias corridos entre a abertura da solicitação e a conclusão da renovação.</p>
      ${pdfFooter()}
    `;
    printHtml("Renovações por unidade — SSTEK", body);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-bar-chart-box-line"
      title="Relatório de renovações"
      subtitle="Por unidade, com tratativas paradas, SLA estourado e tempo médio de conclusão."
      footer={
        <>
          <button
            type="button"
            onClick={handleCsv}
            disabled={report.units.length === 0}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-file-excel-2-line"></i>
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={report.units.length === 0}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-printer-line"></i>
            Imprimir PDF
          </button>
        </>
      }
    >
      {report.total === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-bar-chart-box-line text-xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Ainda não há renovações registradas</p>
          <p className="max-w-md text-xs leading-relaxed text-foreground-500">
            O relatório é montado a partir das solicitações de renovação. Assim que um documento vencido
            entrar na fila, os indicadores por unidade aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-lg border border-background-200 bg-background-50 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                <i className="ri-timer-flash-line"></i>
                Tempo médio
              </p>
              <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">
                {report.avgDays === null ? "—" : formatDays(report.avgDays)}
              </p>
              <p className="mt-0.5 text-[10px] text-foreground-500">
                {report.completed > 0
                  ? `${report.completed} conclusão(ões) · melhor ${formatDays(report.bestDays)} · pior ${formatDays(report.worstDays)}`
                  : "Nenhuma conclusão ainda"}
              </p>
            </div>

            <div className="rounded-lg border border-background-200 bg-background-50 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                <i className="ri-shield-check-line"></i>
                Aderência ao SLA
              </p>
              <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">
                {report.adherence === null ? "—" : `${report.adherence}%`}
              </p>
              <p className="mt-0.5 text-[10px] text-foreground-500">
                {report.onTime} no prazo · {report.late} fora do prazo
              </p>
            </div>

            <div className="rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-danger-700">
                <i className="ri-alarm-warning-line"></i>
                SLA estourado
              </p>
              <p className="mt-1 font-heading text-xl font-extrabold text-danger-800">{report.overdue}</p>
              <p className="mt-0.5 text-[10px] text-danger-700/80">
                {report.overdue === 0 ? "Nenhuma tratativa atrasada" : "Em andamento fora do prazo"}
              </p>
            </div>

            <div className="rounded-lg border border-accent-200 bg-accent-50 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-accent-800">
                <i className="ri-pause-circle-line"></i>
                Tratativas paradas
              </p>
              <p className="mt-1 font-heading text-xl font-extrabold text-accent-900">{report.stalled}</p>
              <p className="mt-0.5 text-[10px] text-accent-900/80">
                {report.stalled === 0
                  ? "Toda tratativa em andamento tem movimentação"
                  : `Sem movimentação há ${report.idleDays}+ dia(s)`}
              </p>
            </div>

            <div className="rounded-lg border border-background-200 bg-background-50 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                <i className="ri-folder-open-line"></i>
                Em andamento
              </p>
              <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{report.open}</p>
              <p className="mt-0.5 text-[10px] text-foreground-500">
                {report.total} solicitação(ões) no total
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-background-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="border-b border-background-200 bg-background-100 text-left">
                    <th className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Unidade
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Solicitações
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Em andamento
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      SLA estourado
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Paradas
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Concluídas
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Tempo médio
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Aderência ao SLA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.units.map((row) => {
                    const adherence = row.adherence;
                    const tone =
                      adherence === null
                        ? "bg-background-300"
                        : adherence >= 90
                          ? "bg-primary-500"
                          : adherence >= 70
                            ? "bg-secondary-500"
                            : "bg-danger-500";
                    return (
                      <tr key={row.unit} className="border-b border-background-100 bg-background-50 last:border-0">
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                              <i className="ri-building-line text-xs"></i>
                            </span>
                            <span className="truncate text-[12px] font-semibold text-foreground-900">
                              {row.unit}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-[12px] font-semibold text-foreground-800">
                          {row.total}
                        </td>
                        <td className="px-3 py-3 text-center text-[12px] font-semibold text-foreground-700">
                          {row.open}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex min-w-[24px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                              row.overdue > 0
                                ? "bg-danger-100 text-danger-800"
                                : "bg-background-100 text-foreground-400"
                            }`}
                          >
                            {row.overdue}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex min-w-[24px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                              row.stalled > 0
                                ? "bg-accent-100 text-accent-900"
                                : "bg-background-100 text-foreground-400"
                            }`}
                          >
                            {row.stalled}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-[12px] font-semibold text-foreground-700">
                          {row.completed}
                        </td>
                        <td className="px-3 py-3 text-center text-[12px] font-medium text-foreground-800">
                          {row.avgDays === null ? "—" : formatDays(row.avgDays)}
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-full max-w-[130px] overflow-hidden rounded-full bg-background-200">
                              <div
                                className={`h-full rounded-full ${tone}`}
                                style={{ width: `${adherence ?? 0}%` }}
                              ></div>
                            </div>
                            <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-foreground-600">
                              {adherence === null ? "—" : `${adherence}%`}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[9px] text-foreground-400">
                            {row.onTime} no prazo · {row.late} fora
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-background-200 bg-background-100 px-3.5 py-2.5 text-[10px] leading-relaxed text-foreground-600">
            <i className="ri-information-line mt-0.5 text-sm text-secondary-700"></i>
            <span>
              O tempo médio é a média de dias corridos entre a abertura da solicitação e a conclusão da
              renovação. A aderência compara a conclusão com o prazo (SLA) parametrizado por tipo de
              documento. <strong className="font-semibold text-foreground-700">SLA estourado</strong> conta as
              tratativas em andamento fora do prazo e{" "}
              <strong className="font-semibold text-foreground-700">Paradas</strong> as sem movimentação há{" "}
              {report.idleDays}+ dia(s). Unidades com mais pendências aparecem primeiro.
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}