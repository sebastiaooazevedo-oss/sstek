import { escapeHtml } from "@/pages/app/utils/exportPdf";
import { addExportEntry } from "@/pages/app/utils/exportHistory";

/**
 * Monta uma tabela HTML simples a partir de cabeçalhos e linhas,
 * pronta para ser injetada no documento de impressão (PDF).
 */
export function tableHtml(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Baixa uma planilha no formato CSV (separador ";" compatível com o Excel brasileiro),
 * com BOM UTF-8 para acentuação correta.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
  options?: { record?: boolean }
): void {
  if (options?.record !== false) {
    addExportEntry({
      label: filename,
      kind: "csv",
      replay: () => downloadCsv(filename, headers, rows, { record: false }),
    });
  }

  const escapeCell = (value: string) => {
    const text = String(value ?? "");
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(";"));
  const csv = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}