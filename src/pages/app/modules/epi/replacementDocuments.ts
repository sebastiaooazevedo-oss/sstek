import type { DocumentRecord } from "@/mocks/documents";
import type { EpiDelivery } from "@/mocks/epi";
import {
  addDocuments,
  buildEpiDocument,
} from "@/pages/app/modules/documentos/documentsStore";
import { buildEpiAcceptanceBody } from "@/pages/app/modules/epi/epiUtils";
import type { EpiReplacementRequest } from "@/pages/app/modules/epi/replacementStore";
import {
  formatDeadlineMoment,
  formatSlaHours,
  replacementDeadline,
} from "@/pages/app/modules/epi/replacementSla";
import { getSettings } from "@/pages/app/settings/settingsStore";
import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";

/**
 * Anexos gerados quando um pedido de substituição de EPI é concluído.
 *
 * Todo atendimento concluído deixa rastro em Documentos:
 * 1. o registro fotográfico do EPI que motivou o pedido (imagem);
 * 2. a devolução do EPI antigo, com a foto do equipamento devolvido e o
 *    histórico completo do pedido (abertura, prazo, atendimento e nova entrega);
 * 3. a nova Ficha de EPI, quando houve nova entrega — já com o termo de aceite
 *    e o histórico do pedido embutidos e vinculada ao colaborador.
 *
 * As peças usam ids determinísticos por pedido (e por entrega), de modo que
 * reabrir/concluir novamente atualiza o registro em vez de duplicar.
 */

function todayBr(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function addOneYear(dateBr: string): string {
  const match = dateBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "—";
  const [, day, month, year] = match;
  return `${day}/${month}/${Number(year) + 1}`;
}

function formatMoment(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Histórico do pedido de substituição em HTML, usado nos PDFs anexados em
 * Documentos. Reúne abertura, prazo de atendimento, registro de perda,
 * atendimento pela gestão e a nova entrega (quando houver).
 */
export function buildReplacementHistoryBody(
  request: EpiReplacementRequest,
  delivery?: EpiDelivery
): string {
  const { replacementSlaHours } = getSettings();
  const deadline = replacementDeadline(request.createdAt, request.reason, replacementSlaHours);
  const deliveredItems = delivery
    ? delivery.items
        .map((item) => `${escapeHtml(item.name)} (CA ${escapeHtml(item.ca)}) — ${item.quantity}x`)
        .join("<br/>")
    : "";

  const rows: string[] = [
    `<tr><td><strong>Pedido</strong></td><td>${escapeHtml(request.id)}</td></tr>`,
    `<tr><td><strong>Abertura</strong></td><td>${escapeHtml(formatMoment(request.createdAt))} · ${
      request.origin === "colaborador" ? "aberto pelo colaborador" : "aberto pelo SESMT"
    }${request.requestedBy ? ` · ${escapeHtml(request.requestedBy)}` : ""}</td></tr>`,
    `<tr><td><strong>Equipamento</strong></td><td>${escapeHtml(request.epiName)} · CA ${escapeHtml(request.ca || "—")}${
      request.validity ? ` · validade do certificado ${escapeHtml(request.validity)}` : ""
    }</td></tr>`,
    `<tr><td><strong>Motivo</strong></td><td>${escapeHtml(request.reason)}</td></tr>`,
  ];

  if (deadline) {
    rows.push(
      `<tr><td><strong>Prazo de atendimento</strong></td><td>${escapeHtml(
        formatSlaHours(deadline.hours)
      )} após a abertura · limite ${escapeHtml(formatDeadlineMoment(deadline.dueAt))}${
        deadline.overdue ? " · atendido após o prazo" : ""
      }</td></tr>`
    );
  }

  if (request.lossDetail) {
    rows.push(`<tr><td><strong>Registro de perda</strong></td><td>${escapeHtml(request.lossDetail)}</td></tr>`);
  }
  if (request.notes) {
    rows.push(`<tr><td><strong>Observações</strong></td><td>${escapeHtml(request.notes)}</td></tr>`);
  }

  rows.push(
    `<tr><td><strong>Situação</strong></td><td>${escapeHtml(request.status)}${
      request.resolvedAt ? ` · concluído em ${escapeHtml(formatMoment(request.resolvedAt))}` : ""
    }${request.resolvedBy ? ` por ${escapeHtml(request.resolvedBy)}` : ""}</td></tr>`
  );
  if (request.resolutionNotes) {
    rows.push(
      `<tr><td><strong>Atendimento</strong></td><td>${escapeHtml(request.resolutionNotes)}</td></tr>`
    );
  }
  if (delivery) {
    rows.push(
      `<tr><td><strong>Nova entrega</strong></td><td>${escapeHtml(delivery.date)} · ${
        delivery.items.length
      } item(ns)<br/>${deliveredItems}</td></tr>`
    );
  }

  const photos: string[] = [];
  if (request.photo) {
    photos.push(
      `<div style="text-align:center;display:inline-block;margin:0 8px;"><div class="muted">EPI no pedido</div><img src="${request.photo}" alt="Foto do EPI no pedido" style="max-width:240px;max-height:200px;border:1px solid #c9d3d7;border-radius:6px;" /></div>`
    );
  }
  if (request.returnPhoto) {
    photos.push(
      `<div style="text-align:center;display:inline-block;margin:0 8px;"><div class="muted">EPI antigo devolvido</div><img src="${request.returnPhoto}" alt="Foto do EPI antigo devolvido" style="max-width:240px;max-height:200px;border:1px solid #c9d3d7;border-radius:6px;" /></div>`
    );
  }

  return `<h2>Histórico do pedido de substituição</h2>
    <table>
      <tbody>${rows.join("")}</tbody>
    </table>
    ${photos.length ? `<h2>Registro fotográfico</h2><div style="text-align:center;">${photos.join("")}</div>` : ""}`;
}

/** Registro fotográfico do EPI anexado ao pedido de substituição. */
export function buildReplacementPhotoDocument(request: EpiReplacementRequest): DocumentRecord | null {
  if (!request.photo) return null;
  return {
    id: `doc-substituicao-foto-${request.id}`,
    name: `Registro fotográfico — ${request.epiName} (${request.collaboratorName})`,
    typeId: "foto-epi",
    typeName: "Registro fotográfico de EPI",
    scope: "colaborador",
    collaboratorId: request.collaboratorId || undefined,
    collaboratorName: request.collaboratorName,
    collaboratorRole: request.collaboratorRole || undefined,
    issuedAt: todayBr(),
    expiresAt: "—",
    status: "Em dia",
    size: "—",
    fileType: "img",
    visibleToCollaborator: true,
    establishment: request.establishment || undefined,
    previewDataUrl: request.photo,
    attachedAt: new Date().toISOString(),
  };
}

/**
 * Documento da devolução: foto do EPI antigo devolvido + histórico completo do
 * pedido, anexado em Documentos junto da nova Ficha de EPI.
 */
export function buildReturnedEpiDocument(
  request: EpiReplacementRequest,
  delivery?: EpiDelivery
): DocumentRecord | null {
  // Com nova entrega e sem foto do equipamento devolvido, o histórico já vai
  // embutido na nova Ficha de EPI — não duplicamos o registro em Documentos.
  if (!request.returnPhoto && delivery) return null;
  if (!request.returnPhoto && !request.photo) return null;
  return {
    id: `doc-substituicao-devolucao-${request.id}`,
    name: `Devolução do EPI antigo — ${request.epiName} (${request.collaboratorName})`,
    typeId: "foto-epi",
    typeName: "Registro fotográfico de EPI",
    scope: "colaborador",
    collaboratorId: request.collaboratorId || undefined,
    collaboratorName: request.collaboratorName,
    collaboratorRole: request.collaboratorRole || undefined,
    issuedAt: todayBr(),
    expiresAt: "—",
    status: "Em dia",
    size: "—",
    fileType: "img",
    visibleToCollaborator: true,
    establishment: request.establishment || undefined,
    previewDataUrl: request.returnPhoto || request.photo,
    attachedPdfHtml: `${pdfHeader("Devolução de EPI · substituição")}
      <h1>Registro de devolução do EPI substituído</h1>
      <p class="muted">Equipamento devolvido ao almoxarifado no atendimento do pedido de substituição, com o histórico completo da solicitação.</p>
      ${buildReplacementHistoryBody(request, delivery)}
      ${pdfFooter()}`,
    attachedAt: new Date().toISOString(),
  };
}

/**
 * Anexa em Documentos a foto do pedido, a devolução do EPI antigo e a nova
 * Ficha de EPI (quando houver entrega). Chamado no momento em que a gestão
 * conclui o atendimento.
 */
export function attachReplacementDocuments(
  request: EpiReplacementRequest,
  delivery?: EpiDelivery
): DocumentRecord[] {
  const docs: DocumentRecord[] = [];
  const photoDoc = buildReplacementPhotoDocument(request);
  if (photoDoc) docs.push(photoDoc);

  const returnedDoc = buildReturnedEpiDocument(request, delivery);
  if (returnedDoc) docs.push(returnedDoc);

  if (delivery) {
    const ficha = buildEpiDocument(delivery);
    docs.push({
      ...ficha,
      issuedAt: delivery.date || todayBr(),
      expiresAt: delivery.date ? addOneYear(delivery.date) : "—",
      previewDataUrl: delivery.photo || request.photo || undefined,
      attachedPdfHtml: buildEpiAcceptanceBody(delivery, "", buildReplacementHistoryBody(request, delivery)),
      attachedAt: new Date().toISOString(),
    });
  }

  if (docs.length) addDocuments(docs);
  return docs;
}