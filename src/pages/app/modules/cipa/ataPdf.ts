import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";
import { requestDocumentSeal, sealPrintHtml, type DocumentSeal } from "@/pages/app/signature/authenticitySeal";
import type { CipaAta, CipaAtaSignature } from "@/mocks/cipa";

/**
 * Chancela de autenticidade da ata. Só é gerada quando a ata tem aprovação
 * assinada eletronicamente (presidente e/ou secretário).
 */
export async function ataSeal(ata: CipaAta, cipaName: string): Promise<DocumentSeal | null> {
  const approvals = ata.approvals.filter((a) => Boolean(a.representationSnapshot || a.signedAt));
  if (approvals.length === 0) return null;
  return requestDocumentSeal({
    scope: "cipa",
    referenceRef: ata.id,
    referenceLabel: `Ata da CIPA nº ${ata.number || "—"} — ${ata.title || cipaName}`,
    signers: approvals.map((a) => ({ name: a.name, role: a.role, signedAt: a.signedAt })),
    content: {
      id: ata.id,
      cipaId: ata.cipaId,
      number: ata.number,
      date: ata.date,
      title: ata.title,
      content: ata.content,
      decisions: ata.decisions,
      participants: ata.participants,
      approvals: approvals.map((a) => ({ name: a.name, role: a.role, signedAt: a.signedAt })),
    },
  });
}

/** Bloco de chancela em HTML, usado no rodapé do PDF da ata. */
export async function ataSealHtml(ata: CipaAta, cipaName: string): Promise<string> {
  return sealPrintHtml(await ataSeal(ata, cipaName));
}

/** Cartão de assinatura de um aprovador da ata (assinatura eletrônica). */
function approvalCell(approval: CipaAtaSignature, image: string): string {
  const imageHtml = image
    ? `<img src="${image}" alt="Assinatura de ${escapeHtml(approval.name)}" />`
    : `<div class="esign-fallback">${escapeHtml(approval.name)}</div>`;
  const role = escapeHtml(approval.role);
  const name = escapeHtml(approval.name);
  const signedAt = escapeHtml(formatSignatureTimestamp(approval.signedAt));
  const uid = escapeHtml(approval.signatureUid || "—");
  return `<div class="esign-cell"><div class="esign">${imageHtml}<div class="esign-cap">Assinado eletronicamente por</div><div class="esign-name">${name}</div><div class="esign-meta">${role}</div><div class="esign-meta">Data: ${signedAt}</div><div class="esign-meta">ID da assinatura: ${uid}</div></div></div>`;
}

/**
 * Monta o corpo HTML (layout do PDF) de uma ata da CIPA.
 * É reaproveitado tanto pela exportação manual da lista de atas quanto
 * pelo anexo automático gerado no registro de Documentos quando a ata é
 * aprovada por completo (presidente + secretário).
 */
export function buildAtaPdfBody(
  ata: CipaAta,
  cipaName: string,
  cipaUnit = "",
  sealHtml = "",
  signatureImages: Record<string, string> = {}
): string {
  const photoBlock = ata.photos.length
    ? `<h2>Registro fotográfico</h2><div class="photo-grid">${ata.photos
        .map(
          (p) =>
            `<figure><img src="${p.url}" alt="Registro da reunião" /><figcaption>${escapeHtml(
              p.name
            )}</figcaption></figure>`
        )
        .join("")}</div>`
    : "";

  const approvalBlock = ata.approvals.length
    ? `<h2>Aprovação da ata</h2><div class="esign-grid">${ata.approvals
        .map((a) => approvalCell(a, a.representationSnapshot || signatureImages[a.id] || ""))
        .join("")}</div>`
    : "";

  // Bloco do rodapé: assinatura eletrônica do Responsável Técnico, quando já
  // coletada na aprovação da ata.
  const technical = ata.approvals.find((a) => a.role === "Responsável Técnico");
  const technicalSignature = technical
    ? {
        name: technical.name,
        image: technical.representationSnapshot || signatureImages[technical.id] || null,
        signedAt: technical.signedAt,
        signatureUid: technical.signatureUid,
      }
    : undefined;

  return `${pdfHeader("Ata de Reunião da CIPA")}
    <h1>${escapeHtml(ata.title) || "Ata de reunião da CIPA"}</h1>
    <p class="muted">${escapeHtml(cipaName)} · Ata nº ${escapeHtml(ata.number) || "—"}</p>
    <div class="grid"><div><strong>Data:</strong> ${escapeHtml(ata.date) || "—"}</div><div><strong>CIPA:</strong> ${escapeHtml(
      cipaName
    )}</div>${cipaUnit ? `<div><strong>Unidade:</strong> ${escapeHtml(cipaUnit)}</div>` : ""}</div>
    <h2>Registro</h2>
    <p>${escapeHtml(ata.content) || "—"}</p>
    <h2>Deliberações</h2>
    <ul class="cover-list">${ata.decisions.map((d) => `<li>${escapeHtml(d)}</li>`).join("") || "<li>—</li>"}</ul>
    <h2>Participantes</h2>
    <ul class="cover-list">${ata.participants.map((p) => `<li>${escapeHtml(p)}</li>`).join("") || "<li>—</li>"}</ul>
    ${approvalBlock}
    ${photoBlock}
    ${pdfFooter(sealHtml, "", technicalSignature)}`;
}