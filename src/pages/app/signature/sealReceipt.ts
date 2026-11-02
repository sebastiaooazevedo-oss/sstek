import { escapeHtml, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { sealCodeOf } from "./authenticitySeal";
import { buildValidationUrl, validationQrDataUrl } from "./validationQr";

/**
 * Comprovante de validação de chancela.
 *
 * Documento avulso emitido pelo painel administrativo que registra os dados
 * da chancela: empresa, documento, código, hash do conteudo, signatarios e o
 * endereco publico de conferencia. Serve como prova de que, na data de
 * emissao, o selo conferia com o registro do servidor.
 */

export interface SealReceiptSigner {
  name: string;
  role?: string | null;
  signedAt?: string | null;
}

export interface SealReceiptData {
  token: string;
  code?: string | null;
  label?: string | null;
  scopeLabel?: string | null;
  companyName?: string | null;
  contentHash?: string | null;
  signerCount?: number | null;
  signers?: SealReceiptSigner[];
  /** Gestor que emitiu o relatório chancelado (relatórios consolidados). */
  issuer?: string | null;
  sealedAt?: string | null;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Dados do comprovante de validação de um documento assinavel. */
export interface DocumentReceiptData {
  token: string;
  title?: string | null;
  docTypeLabel?: string | null;
  statusLabel?: string | null;
  companyName?: string | null;
  documentUid?: string | null;
  version?: number | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  contentHash?: string | null;
  finalPdfHash?: string | null;
  signatures?: { name: string; role?: string | null; signedAt?: string | null }[];
}

/**
 * Comprovante de validacao de documento assinado.
 *
 * Emitido pela pagina publica `/validar/:token` sem exigir login: prova que,
 * na data da impressao, o documento conferia com o registro do servidor.
 */
export function printDocumentReceipt(data: DocumentReceiptData): void {
  const url = buildValidationUrl(data.token);
  const qr = validationQrDataUrl(data.token, 160);
  const signatures = Array.isArray(data.signatures) ? data.signatures : [];

  const signaturesHtml = signatures.length
    ? `<table>
        <thead><tr><th style="width:52%">Signatário</th><th style="width:24%">Papel</th><th>Assinado em</th></tr></thead>
        <tbody>
          ${signatures
            .map(
              (s) =>
                `<tr><td><strong>${escapeHtml(s.name || "—")}</strong></td><td>${escapeHtml(
                  s.role || "—"
                )}</td><td>${escapeHtml(formatDateTime(s.signedAt))}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : `<p class="muted">Documento validado sem assinatura concluída registrada.</p>`;

  const body = `<div class="doc-head">
      <div class="brand">SST<span>EK</span><small>GESTÃO INTELIGENTE EM SEGURANÇA DO TRABALHO</small></div>
      <div class="meta">Comprovante de validação de documento assinado<br/>Emitido em ${todayBr()}</div>
    </div>

    <h1>Comprovante de validação de documento assinado</h1>
    <p class="muted">Registro emitido pela página pública de validação, sem necessidade de acesso autenticado.</p>

    <h2>Identificação do documento</h2>
    <div class="grid">
      <div><strong>Empresa:</strong> ${escapeHtml(data.companyName || "—")}</div>
      <div><strong>Tipo:</strong> ${escapeHtml(data.docTypeLabel || "Documento")}</div>
      <div><strong>Documento:</strong> ${escapeHtml(data.title || "—")}</div>
      <div><strong>Versão:</strong> ${escapeHtml(String(data.version ?? "—"))}</div>
      <div><strong>Identificador:</strong> ${escapeHtml(data.documentUid || "—")}</div>
      <div><strong>Situação:</strong> ${escapeHtml(data.statusLabel || "—")}</div>
      <div><strong>Congelado em:</strong> ${escapeHtml(formatDateTime(data.submittedAt))}</div>
      <div><strong>Concluído em:</strong> ${escapeHtml(formatDateTime(data.completedAt))}</div>
      ${
        data.cancelledAt
          ? `<div><strong>Cancelado em:</strong> ${escapeHtml(formatDateTime(data.cancelledAt))}${
              data.cancelledReason ? ` · ${escapeHtml(data.cancelledReason)}` : ""
            }</div>`
          : ""
      }
    </div>

    <h2>Conferência independente</h2>
    <div class="qr-box">
      <img class="qr-img" src="${qr}" alt="QR-Code de validação do documento" />
      <div>
        <p class="muted" style="margin:0 0 6px">Aponte a câmera para o QR-Code ou abra o endereço abaixo. A página pública confere o registro direto no servidor, sem digitar código.</p>
        <p class="qr-url">${escapeHtml(url)}</p>
      </div>
    </div>

    <h2>Assinaturas registradas</h2>
    ${signaturesHtml}

    <h2>Integridade do conteúdo</h2>
    <p style="font-size:10px;color:#3c4a51;margin:6px 0 0"><strong>Hash do conteúdo:</strong> <span style="font-family:monospace;word-break:break-all">${escapeHtml(
      data.contentHash || "—"
    )}</span></p>
    <p style="font-size:10px;color:#3c4a51;margin:6px 0 0"><strong>Hash do PDF final:</strong> <span style="font-family:monospace;word-break:break-all">${escapeHtml(
      data.finalPdfHash || "—"
    )}</span></p>

    <div class="cover-note">
      Este comprovante atesta que, no momento da emissão, as assinaturas eletrônicas apresentadas correspondiam ao
      registro mantido no servidor. Qualquer alteração no conteúdo do documento faz o hash deixar de conferir e a
      validação pública passa a apontar a divergência. Dados pessoais, documentos de saúde, contatos e endereços IP
      não fazem parte deste comprovante.
    </div>

    <div class="foot"><span>SSTEK · Comprovante de validação de documento assinado</span><span>${
      data.documentUid ? `ID ${escapeHtml(data.documentUid)}` : ""
    }</span></div>`;

  printHtml("Comprovante de validação de documento assinado", body);
}

export function printSealReceipt(data: SealReceiptData): void {
  const url = buildValidationUrl(data.token);
  const qr = validationQrDataUrl(data.token, 160);
  const code = data.code || sealCodeOf(data.token);
  const signers = Array.isArray(data.signers) ? data.signers : [];

  const signersHtml = signers.length
    ? `<table>
        <thead><tr><th style="width:52%">Signatário</th><th style="width:24%">Papel</th><th>Assinado em</th></tr></thead>
        <tbody>
          ${signers
            .map(
              (s) =>
                `<tr><td><strong>${escapeHtml(s.name || "—")}</strong></td><td>${escapeHtml(
                  s.role || "—"
                )}</td><td>${escapeHtml(formatDateTime(s.signedAt))}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : `<p class="muted">Chancela emitida sem assinatura nominal registrada.</p>`;

  const body = `<div class="doc-head">
      <div class="brand">SST<span>EK</span><small>GESTÃO INTELIGENTE EM SEGURANÇA DO TRABALHO</small></div>
      <div class="meta">Comprovante de validação de chancela<br/>Emitido em ${todayBr()}</div>
    </div>

    <h1>Comprovante de validação de chancela</h1>
    <p class="muted">Registro emitido a partir do painel administrativo da plataforma.</p>

    <h2>Identificação da chancela</h2>
    <div class="grid">
      <div><strong>Empresa:</strong> ${escapeHtml(data.companyName || "—")}</div>
      <div><strong>Tipo de documento:</strong> ${escapeHtml(data.scopeLabel || "Documento")}</div>
      <div><strong>Documento:</strong> ${escapeHtml(data.label || "—")}</div>
      <div><strong>Código de verificação:</strong> ${escapeHtml(code)}</div>
      <div><strong>Chancela emitida em:</strong> ${escapeHtml(formatDateTime(data.sealedAt))}</div>
      <div><strong>Signatários:</strong> ${Number(data.signerCount ?? signers.length ?? 0)}</div>
      <div><strong>Emitido por:</strong> ${escapeHtml(data.issuer || "—")}</div>
    </div>

    <h2>Conferência independente</h2>
    <div class="qr-box">
      <img class="qr-img" src="${qr}" alt="QR-Code de validação da chancela" />
      <div>
        <p class="muted" style="margin:0 0 6px">Aponte a câmera para o QR-Code ou abra o endereço abaixo. A página pública confere a chancela direto no servidor, sem digitar código.</p>
        <p class="qr-url">${escapeHtml(url)}</p>
      </div>
    </div>

    <h2>Signatários registrados</h2>
    ${signersHtml}

    <h2>Hash SHA-256 do conteúdo chancelado</h2>
    <p style="font-family:monospace;font-size:10px;word-break:break-all;color:#3c4a51;margin:6px 0 0">${escapeHtml(
      data.contentHash || "—"
    )}</p>

    <div class="cover-note">
      Este comprovante atesta que, no momento da emissão, a chancela apresentada correspondia ao registro mantido no
      servidor. Qualquer alteração no conteúdo do documento faz o hash deixar de conferir, e a validação pública passa a
      apontar a divergência. Dados pessoais, documentos de saúde, contatos e endereços IP não fazem parte deste
      comprovante.
    </div>

    <div class="foot"><span>SSTEK · Comprovante de validação de chancela</span><span>Código ${escapeHtml(
      code
    )}</span></div>`;

  printHtml("Comprovante de validação de chancela", body);
}