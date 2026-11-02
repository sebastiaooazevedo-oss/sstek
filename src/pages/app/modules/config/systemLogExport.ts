import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import {
  actionLabels,
  areaLabels,
  EXPORT_LIMIT,
  fetchSystemLogs,
  formatLogDateTime,
  moduleLabels,
  type SystemLogEntry,
  type SystemLogFilters,
} from "@/pages/app/modules/config/systemLogStore";

/**
 * Exportação dos logs de auditoria filtrados.
 *
 * Os PDFs saem no papel timbrado da empresa (cabeçalho com logo/razão social e
 * rodapé com responsável técnico) e o CSV abre direto no Excel brasileiro.
 * A exportação sempre relê os dados com o mesmo filtro da tela, garantindo que
 * o arquivo reflita exatamente o período/tipo escolhidos.
 */

const HEADERS = [
  "Data/Hora",
  "Autor",
  "Módulo",
  "Tipo de registro",
  "Ação",
  "Campo",
  "Valor anterior",
  "Novo valor",
  "Detalhe",
];

function toRows(entries: SystemLogEntry[]): string[][] {
  return entries.map((entry) => [
    formatLogDateTime(entry.createdAt),
    entry.actorName || "Sistema",
    moduleLabels[entry.module] ?? entry.module,
    areaLabels[entry.area ?? ""] ?? "Sistema",
    actionLabels[entry.action] ?? entry.action,
    entry.field ?? "",
    entry.oldValue ?? "",
    entry.newValue ?? "",
    entry.detail,
  ]);
}

function fileStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** Exporta os logs filtrados como planilha CSV (separador ";" compatível com Excel BR). */
export async function exportSystemLogsCsv(filters: SystemLogFilters): Promise<number> {
  const entries = await fetchSystemLogs(filters, EXPORT_LIMIT);
  downloadCsv(`logs-sistema-${fileStamp()}.csv`, HEADERS, toRows(entries));
  return entries.length;
}

/** Exporta os logs filtrados em PDF, com o papel timbrado da empresa. */
export async function exportSystemLogsPdf(filters: SystemLogFilters, caption: string): Promise<number> {
  const entries = await fetchSystemLogs(filters, EXPORT_LIMIT);
  const rows = toRows(entries);

  const emptyMsg = rows.length
    ? ""
    : `<p class="muted">Nenhum registro encontrado para o filtro selecionado.</p>`;

  const body = `
    ${pdfHeader("Logs do sistema")}
    <h1>Logs do sistema</h1>
    <p class="muted">Registro de auditoria de tudo que altera dados no banco.</p>
    <div class="grid">
      <div><strong>Filtro:</strong> ${escapeHtml(caption)}</div>
      <div><strong>Total de registros:</strong> ${rows.length}</div>
      <div><strong>Emitido em:</strong> ${new Date().toLocaleString("pt-BR")}</div>
    </div>
    ${emptyMsg}
    ${rows.length ? tableHtml(HEADERS, rows) : ""}
    ${pdfFooter()}
  `;

  printHtml("Logs do sistema", body);
  return entries.length;
}