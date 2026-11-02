import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import {
  declarationTextFor,
  documentStatusLabels,
  documentTypeLabels,
  signatureLevelLabels,
  type SignatureDocument,
} from "./documentService";
import type { SignatureDisplay } from "./signatureDisplay";
import { formatSignatureTimestamp } from "./signatureDisplay";
import { sealPrintHtml, type SealDisplay } from "./authenticitySeal";

/**
 * Monta o corpo do documento assinavel (usado na previa em tela e na
 * exportacao em PDF). As assinaturas ja registradas entram como imagem,
 * tomadas da representacao exata usada no momento da assinatura.
 */

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function shortHash(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 16)}…${hash.slice(-12)}`;
}

function contentRows(doc: SignatureDocument): { label: string; value: string }[] {
  const content = doc.content ?? {};
  const rows: { label: string; value: string }[] = [];
  const fields = (content as { fields?: { label: string; value: string }[] }).fields;
  if (Array.isArray(fields)) {
    fields.forEach((f) => {
      if (f && f.label) rows.push({ label: String(f.label), value: String(f.value ?? "") });
    });
  }
  const description = (content as { description?: string }).description;
  if (description) rows.push({ label: "Descrição", value: String(description) });
  return rows;
}

/**
 * Chancela de autenticidade do documento (QR-Code no rodapé).
 * Só existe depois que o documento foi congelado e tem ao menos uma assinatura.
 */
export function documentSealFor(doc: SignatureDocument): SealDisplay | null {
  const signedCount = doc.signatories.filter((s) => s.status === "assinado").length;
  if (!doc.validationToken || signedCount === 0) return null;
  return {
    token: doc.validationToken,
    label: doc.title,
    scope: "assinatura",
    signerCount: signedCount,
    sealedAt: doc.completedAt || doc.submittedAt,
    contentHash: doc.contentHash,
  };
}

/** Bloco de assinatura na ordem obrigatoria (HTML para impressao). */
export function signatureBlockHtml(display: SignatureDisplay): string {
  const name = (display.signerName || "—").toUpperCase();
  const image = display.representationSnapshot
    ? `<img src="${display.representationSnapshot}" alt="Representação visual preservada" />`
    : `<div class="esign-empty">Representação visual preservada</div>`;
  return `<div class="esign">
    ${image}
    <div class="esign-cap">Assinado eletronicamente por</div>
    <div class="esign-name">${escapeHtml(name)}</div>
    <div class="esign-meta">Data: ${escapeHtml(
      formatSignatureTimestamp(display.signedAt, display.timezoneDisplay)
    )}</div>
    <div class="esign-meta">ID da assinatura: ${escapeHtml(display.signatureUid || "—")}</div>
  </div>`;
}

export function buildDocumentPrintBody(
  doc: SignatureDocument,
  signaturesBySignatory: Record<string, SignatureDisplay>
): string {
  const rows = contentRows(doc);
  const rowsHtml = rows.length
    ? `<div class="grid">${rows
        .map((r) => `<div><strong>${escapeHtml(r.label)}:</strong> ${escapeHtml(r.value)}</div>`)
        .join("")}</div>`
    : "";

  const signaturesHtml = doc.signatories
    .map((s) => {
      const display = signaturesBySignatory[s.id];
      if (display) return `<div class="esign-cell">${signatureBlockHtml(display)}</div>`;
      return `<div class="esign-cell">
        <div class="esign">
          <div class="esign-empty">(assinatura pendente)</div>
          <div class="esign-cap">Assinado eletronicamente por</div>
          <div class="esign-name">${escapeHtml(s.name.toUpperCase())}</div>
          <div class="esign-meta">${escapeHtml(s.roleLabel || "—")}</div>
        </div>
      </div>`;
    })
    .join("");

  const declaration = doc.declarationText || declarationTextFor(doc.declarationType);

  return `
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="muted">
      ${escapeHtml(documentTypeLabels[doc.docType])} · Versão ${doc.version} ·
      Situação: ${escapeHtml(documentStatusLabels[doc.status])}
    </p>
    <div class="grid">
      <div><strong>Documento:</strong> ${escapeHtml(doc.documentUid || doc.id)}</div>
      <div><strong>Congelado em:</strong> ${escapeHtml(formatDateTime(doc.submittedAt))}</div>
      <div><strong>Prazo:</strong> ${escapeHtml(formatDateTime(doc.dueAt))}</div>
      <div><strong>Classificação exigida:</strong> ${escapeHtml(
        signatureLevelLabels[(doc.requiredLevel || "simples") as keyof typeof signatureLevelLabels]
      )}${doc.certificateRequired ? " (certificado ICP-Brasil exigido)" : ""}</div>
    </div>
    ${rowsHtml}
    <h2>Declaração do signatário</h2>
    <p>${escapeHtml(declaration)}</p>
    <h2>Assinaturas</h2>
    <div class="esign-grid">${signaturesHtml}</div>
    <h2>Integridade e preservação</h2>
    <table>
      <tbody>
        <tr><th>Hash do conteúdo (SHA-256)</th><td>${escapeHtml(shortHash(doc.contentHash))}</td></tr>
        <tr><th>Hash do PDF-base (SHA-256)</th><td>${escapeHtml(shortHash(doc.basePdfHash))}</td></tr>
        <tr><th>Hash do PDF final (SHA-256)</th><td>${escapeHtml(shortHash(doc.finalPdfHash))}</td></tr>
        <tr><th>Hash do relatório de evidências (SHA-256)</th><td>${escapeHtml(shortHash(doc.evidenceReportHash))}</td></tr>
      </tbody>
    </table>
    <p class="muted" style="margin-top:6px">
      PDF-base, PDF final e relatório de evidências são preservados separadamente. O hash do PDF final
      não é inserido no próprio arquivo que o contém.
    </p>
  `;
}

export function exportDocumentPdf(
  doc: SignatureDocument,
  signaturesBySignatory: Record<string, SignatureDisplay>
): void {
  const title = `Documento — ${doc.title} (v${doc.version})`;
  const cancelled = doc.status === "cancelado";
  // Documento cancelado nunca sai com chancela apresentada como vigente.
  const cancellationNotice = cancelled
    ? `<div style="margin:0 0 14px;padding:10px 12px;border:1px solid #c2410c;background:#fff7ed;color:#7c2d12;font-size:12px;line-height:1.5">
        <strong>DOCUMENTO CANCELADO.</strong> Esta versão não está vigente${
          doc.cancelledAt ? ` desde ${escapeHtml(formatDateTime(doc.cancelledAt))}` : ""
        }${doc.cancelledReason ? ` (motivo: ${escapeHtml(doc.cancelledReason)})` : ""}. As assinaturas e o bloco de
        autenticidade impressos abaixo são registro histórico e NÃO comprovam mais o documento.
      </div>`
    : "";
  printHtml(
    title,
    pdfHeader(title) +
      cancellationNotice +
      buildDocumentPrintBody(doc, signaturesBySignatory) +
      pdfFooter(
        sealPrintHtml(documentSealFor(doc), {
          headline: cancelled ? "Documento cancelado — chancela sem validade" : undefined,
        })
      )
  );
}

export { contentRows, formatDateTime, shortHash };