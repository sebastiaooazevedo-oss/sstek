import type { DocumentRecord } from "@/mocks/documents";
import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";

/**
 * Ficha de visualização de um documento que ainda não tem arquivo anexado.
 *
 * Muitos registros do acervo existem apenas com os dados do cadastro (nome,
 * tipo, vínculo, validade). Quando o usuário pede para abrir o arquivo, não dá
 * para mostrar uma tela vazia: montamos esta ficha com o layout de impressão do
 * próprio sistema, deixando explícito que o arquivo original ainda não foi
 * anexado.
 */

export interface DocumentFileModelContext {
  /** Unidade/estabelecimento efetivo do documento. */
  unit?: string;
}

export function buildDocumentFileModel(
  doc: DocumentRecord,
  context: DocumentFileModelContext = {}
): string {
  const unit = context.unit?.trim() || "Corporativo";

  const rows: Array<[string, string]> = [
    ["Documento", doc.name],
    ["Tipo documental", doc.typeName || "—"],
    ["Vínculo", doc.scope === "empresa" ? "Empresa (corporativo)" : "Colaborador"],
    ["Colaborador", doc.collaboratorName || "—"],
    ["Função", doc.collaboratorRole || "—"],
    ["Unidade / estabelecimento", unit],
    ["Data de emissão", doc.issuedAt || "—"],
    ["Validade", doc.expiresAt || "Sem validade"],
    ["Situação", doc.status],
    ["Formato previsto", doc.fileType.toUpperCase()],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><th style="width:36%">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return `${pdfHeader(`Ficha do documento — ${doc.typeName || "Documento"}`)}
  <h1>${escapeHtml(doc.name)}</h1>
  <p class="muted">Registro do acervo documental da empresa, mantido para consulta, conferência de validade e rastreabilidade.</p>
  <div class="cover-note">
    <strong>Documento modelo.</strong> O arquivo original deste registro ainda não foi anexado ao sistema.
    Esta ficha é gerada automaticamente com os dados do cadastro para que a conferência não fique sem referência.
    Anexe o arquivo original para que a visualização, o download e a impressão tragam o conteúdo oficial.
  </div>
  <h2>Identificação do registro</h2>
  <table><tbody>${rowsHtml}</tbody></table>
  <h2>Conferência</h2>
  <table>
    <thead>
      <tr><th style="width:38%">Item conferido</th><th style="width:32%">Situação</th><th>Observação</th></tr>
    </thead>
    <tbody>
      <tr><td>Arquivo original anexado</td><td>Pendente</td><td></td></tr>
      <tr><td>Legibilidade e assinatura</td><td></td><td></td></tr>
      <tr><td>Validade conferida</td><td></td><td></td></tr>
      <tr><td>Responsável pela conferência</td><td></td><td></td></tr>
    </tbody>
  </table>
  ${pdfFooter()}`;
}