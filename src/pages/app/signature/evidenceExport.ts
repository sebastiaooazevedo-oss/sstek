import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import type { DocumentEvidence } from "./documentService";
import {
  declarationLabelFor,
  documentStatusLabels,
  documentTypeLabels,
  signatureLevelLabels,
} from "./documentService";
import { formatSignatureTimestamp } from "./signatureDisplay";
import { buildValidationUrl, validationQrDataUrl } from "./validationQr";

const DISPLAY_TZ = "UTC\u221203:00";

function shortHash(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 16)}…${hash.slice(-12)}`;
}

/** Relatório de evidências em PDF (auditoria, fiscalização e preservação). */
export function exportEvidencePdf(evidence: DocumentEvidence): void {
  const d = evidence.document;
  const title = `Evidências — ${d.title} (v${d.version})`;

  const rows = evidence.signatures.map((s, i) => [
    String(i + 1),
    s.signatureUid || "—",
    s.signerName || "—",
    formatSignatureTimestamp(s.signedAt, s.timezoneDisplay),
    declarationLabelFor((s.declarationType || "content_acknowledgement") as never),
    `${s.authMethod || "—"} / ${s.authResult || "—"}`,
    String(s.representationVersion ?? "—"),
    (s.evidence?.ip as string) || "—",
  ]);

  const signaturesTable = tableHtml(
    ["#", "ID da assinatura (UUID)", "Signatário", `Data/hora (${DISPLAY_TZ})`, "Declaração", "Autenticação", "Repr. v", "IP"],
    rows
  );

  const integrity = tableHtml(
    ["Arquivo/registro", "Hash SHA-256"],
    [
      ["Conteúdo congelado", shortHash(d.contentHash)],
      ["PDF-base", shortHash(d.basePdfHash)],
      ["PDF final", shortHash(d.finalPdfHash)],
      ["Relatório de evidências", shortHash(d.evidenceReportHash)],
    ]
  );

  const divergencesHtml =
    evidence.divergences.length > 0
      ? `<h2>Divergências reportadas</h2>
         <ul>${evidence.divergences
           .map((dv) => `<li>${escapeHtml(dv.message)} · ${escapeHtml(formatSignatureTimestamp(dv.createdAt, DISPLAY_TZ))}</li>`)
           .join("")}</ul>`
      : "";

  const qrHtml = d.validationToken
    ? `<h2>Validação pública</h2>
       <div class="qr-box">
         <img class="qr-img" src="${validationQrDataUrl(d.validationToken, 132)}" alt="QR-Code de validação" />
         <div>
           <p class="qr-url">${escapeHtml(buildValidationUrl(d.validationToken))}</p>
           <p class="muted" style="margin:6px 0 0">Token aleatório não enumerável.</p>
         </div>
       </div>`
    : "";

  const body = `
    <h1>Relatório de evidências da assinatura eletrônica</h1>
    <p class="muted">
      ${escapeHtml(documentTypeLabels[d.docType])} · Versão ${d.version} ·
      Situação: ${escapeHtml(documentStatusLabels[d.status])}
    </p>
    <div class="grid">
      <div><strong>Documento (UUID):</strong> ${escapeHtml(d.documentUid || d.id)}</div>
      <div><strong>Congelado em:</strong> ${escapeHtml(formatSignatureTimestamp(d.submittedAt, DISPLAY_TZ))}</div>
      <div><strong>Concluído em:</strong> ${escapeHtml(formatSignatureTimestamp(d.completedAt, DISPLAY_TZ))}</div>
      <div><strong>Classificação exigida:</strong> ${escapeHtml(
        signatureLevelLabels[(d.requiredLevel || "simples") as keyof typeof signatureLevelLabels]
      )}${d.certificateRequired ? " (certificado ICP-Brasil exigido)" : ""}</div>
    </div>
    <h2>Confirmações registradas</h2>
    ${signaturesTable}
    <h2>Integridade e arquivos preservados</h2>
    ${integrity}
    <p class="muted" style="margin-top:6px">
      Cada confirmação registra identidade, empresa, documento, versão, hash do PDF-base, data/hora UTC do servidor,
      fuso de exibição, declaração aceita, método e resultado da autenticação e a versão da representação visual.
      Senhas, códigos de autenticação e chaves privadas não são armazenados.
    </p>
    ${divergencesHtml}
    ${qrHtml}
  `;

  printHtml(title, pdfHeader(title) + body + pdfFooter());
}

/** Planilha (CSV) com as evidências de cada confirmação. */
export function exportEvidenceCsv(evidence: DocumentEvidence): void {
  const d = evidence.document;
  const headers = [
    "ID da assinatura",
    "Signatário",
    "Perfil (profile_id)",
    "Documento (UUID)",
    "Versão",
    "Hash do PDF-base",
    "Data/hora (UTC-03:00)",
    "Declaração",
    "Método de autenticação",
    "Resultado da autenticação",
    "Versão da representação",
    "Nível da assinatura",
    "Hash da assinatura",
    "IP",
  ];
  const rows = evidence.signatures.map((s) => [
    s.signatureUid || "",
    s.signerName || "",
    String((s.evidence?.profile_id as string) || ""),
    d.documentUid || d.id,
    String(d.version),
    d.basePdfHash || "",
    formatSignatureTimestamp(s.signedAt, s.timezoneDisplay),
    declarationLabelFor((s.declarationType || "content_acknowledgement") as never),
    s.authMethod || "",
    s.authResult || "",
    String(s.representationVersion ?? ""),
    signatureLevelLabels[(s.signatureLevel || "simples") as keyof typeof signatureLevelLabels],
    s.signatureHash || "",
    (s.evidence?.ip as string) || "",
  ]);
  downloadCsv(`evidencias-${d.documentUid || d.id}.csv`, headers, rows);
}

/** Pacote JSON para preservação independente do SaaS. */
export function exportEvidenceJson(evidence: DocumentEvidence): void {
  const d = evidence.document;
  const payload = {
    exportedAt: new Date().toISOString(),
    note: "Pacote de preservação independente. Contém o registro do documento e as evidências de cada confirmação.",
    document: d,
    signatories: evidence.signatories,
    signatures: evidence.signatures,
    divergences: evidence.divergences,
    validationUrl: d.validationToken ? buildValidationUrl(d.validationToken) : null,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `documento-${d.documentUid || d.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}