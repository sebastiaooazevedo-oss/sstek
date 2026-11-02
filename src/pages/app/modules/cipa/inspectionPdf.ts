import { escapeHtml, pdfFooter, pdfHeader, type TechnicalSignatureInfo } from "@/pages/app/utils/exportPdf";
import type { CipaInspection } from "@/mocks/cipa";

/**
 * Monta o corpo HTML (layout do PDF) do relatório de uma Inspeção da CIPA.
 *
 * É o mesmo documento usado na emissão definitiva e na pré-visualização de
 * conferência dentro do modal de assinatura do Responsável Técnico — assim o
 * RT confere exatamente o que será emitido.
 */
export function buildInspectionPdfBody(
  inspection: CipaInspection,
  cipaName: string,
  technical?: TechnicalSignatureInfo
): string {
  const nonConforming = inspection.checklist.filter((i) => i.status === "Não conforme").length;
  const conforming = inspection.checklist.filter((i) => i.status === "Conforme").length;

  const rows = inspection.checklist
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.label)}</td><td>${escapeHtml(i.status) || "Não avaliado"}</td><td>${
          escapeHtml(i.note) || "—"
        }</td></tr>`
    )
    .join("");

  const photoBlock = inspection.photos.length
    ? `<h2>Registro fotográfico</h2><div class="photo-grid">${inspection.photos
        .map(
          (p) =>
            `<figure><img src="${p.url}" alt="Registro da inspeção" /><figcaption>${escapeHtml(
              p.name
            )}</figcaption></figure>`
        )
        .join("")}</div>`
    : "";

  return `${pdfHeader("Inspeção da CIPA")}
    <h1>${escapeHtml(inspection.title)}</h1>
    <p class="muted">${escapeHtml(cipaName)} · Inspeção vinculada à CIPA</p>
    <div class="grid">
      <div><strong>Data:</strong> ${escapeHtml(inspection.date) || "—"}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(inspection.establishment) || "—"}</div>
      <div><strong>Área:</strong> ${escapeHtml(inspection.area) || "—"}</div>
      <div><strong>Local:</strong> ${escapeHtml(inspection.location) || "—"}</div>
      <div><strong>Responsável:</strong> ${escapeHtml(inspection.responsible) || "—"}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${conforming}</b><span>Itens conformes</span></div>
      <div class="kpi"><b>${nonConforming}</b><span>Itens não conformes</span></div>
      <div class="kpi"><b>${inspection.photos.length}</b><span>Registros fotográficos</span></div>
    </div>
    <h2>Itens verificados</h2>
    <table><thead><tr><th>Item</th><th>Situação</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Não conformidades e ação</h2>
    <div class="grid"><div><strong>Grau de risco:</strong> ${escapeHtml(inspection.risk)}</div><div><strong>Responsável:</strong> ${
      escapeHtml(inspection.actionOwner) || "—"
    }</div><div><strong>Prazo:</strong> ${escapeHtml(inspection.actionDue) || "—"}</div></div>
    <p><strong>Desvios:</strong> ${escapeHtml(inspection.nonConformities) || "—"}</p>
    <p><strong>Ação corretiva:</strong> ${escapeHtml(inspection.action) || "—"}</p>
    ${photoBlock}
    ${pdfFooter("", "", technical)}`;
}