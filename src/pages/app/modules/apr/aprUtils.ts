import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import type { AprRecord } from "@/mocks/apr";
import { requestDocumentSeal, sealPrintHtml, type DocumentSeal } from "@/pages/app/signature/authenticitySeal";

export interface RiskLevel {
  label: string;
  tone: "primary" | "secondary" | "accent";
}

/** Classifica o risco a partir da severidade x probabilidade (matriz 5x5). */
export function riskLevel(severity: number, probability: number): RiskLevel {
  const score = severity * probability;
  if (score >= 15) return { label: "Crítico", tone: "accent" };
  if (score >= 8) return { label: "Moderado", tone: "secondary" };
  return { label: "Baixo", tone: "primary" };
}

export function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/**
 * Chancela de autenticidade da APR. Só é gerada quando existem aceites
 * assinados pelos executantes.
 */
export async function aprSeal(record: AprRecord): Promise<DocumentSeal | null> {
  const signed = record.signatures.filter((s) => Boolean(s.signature));
  if (signed.length === 0) return null;
  return requestDocumentSeal({
    scope: "apr",
    referenceRef: record.id,
    referenceLabel: `APR — ${record.title} (${record.date})`,
    signers: signed.map((s) => ({ name: s.collaboratorName, role: s.collaboratorRole || null })),
    content: {
      id: record.id,
      title: record.title,
      activity: record.activity,
      area: record.area,
      location: record.location,
      date: record.date,
      responsible: record.responsible,
      risks: record.risks,
      notes: record.notes,
      signed: signed.map((s) => ({ name: s.collaboratorName, role: s.collaboratorRole })),
    },
  });
}

/** Bloco de chancela em HTML, usado no rodapé do PDF da APR. */
export async function aprSealHtml(record: AprRecord): Promise<string> {
  return sealPrintHtml(await aprSeal(record));
}

/** Monta o corpo HTML da APR (usado no PDF/impressão). */
export function buildAprBody(record: AprRecord, sealHtml = ""): string {
  const riskRows = record.risks
    .map((risk, index) => {
      const level = riskLevel(risk.severity, risk.probability);
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(risk.hazard)}</td>
        <td>${escapeHtml(risk.risk)}</td>
        <td>${risk.severity}</td>
        <td>${risk.probability}</td>
        <td>${escapeHtml(level.label)}</td>
        <td>${escapeHtml(risk.control)}</td>
      </tr>`;
    })
    .join("");

  const signRows = record.signatures
    .map(
      (sign) => `<tr>
        <td>${escapeHtml(sign.collaboratorName)}</td>
        <td>${escapeHtml(sign.collaboratorRole) || "—"}</td>
        <td class="sign">${
          sign.signature
            ? `<img src="${sign.signature}" alt="Assinatura de ${escapeHtml(sign.collaboratorName)}" />`
            : '<span class="empty">(pendente)</span>'
        }</td>
      </tr>`
    )
    .join("");

  return `${pdfHeader("APR · Análise Preliminar de Risco")}
    <h1>Análise Preliminar de Risco (APR)</h1>
    <p class="muted">
      Documento que identifica os perigos, avalia os riscos e define as medidas de controle para a
      atividade descrita, com a ciência e o aceite dos colaboradores executantes.
    </p>
    <div class="grid">
      <div><strong>Nº da solicitação:</strong> ${escapeHtml(record.requestNumber) || "—"}</div>
      <div><strong>Título:</strong> ${escapeHtml(record.title)}</div>
      <div><strong>Atividade:</strong> ${escapeHtml(record.activity)}</div>
      <div><strong>Setor:</strong> ${escapeHtml(record.area)}</div>
      <div><strong>Local:</strong> ${escapeHtml(record.location) || "—"}</div>
      <div><strong>Data:</strong> ${escapeHtml(record.date)}</div>
      <div><strong>Responsável:</strong> ${escapeHtml(record.responsible)}</div>
    </div>
    <h2>Riscos identificados e medidas de controle</h2>
    <table>
      <thead><tr><th>#</th><th>Perigo</th><th>Risco</th><th>Sev.</th><th>Prob.</th><th>Nível</th><th>Medidas de controle</th></tr></thead>
      <tbody>${riskRows || '<tr><td colspan="7">Nenhum risco informado.</td></tr>'}</tbody>
    </table>
    ${record.notes ? `<h2>Observações</h2><p>${escapeHtml(record.notes)}</p>` : ""}
    <h2>Aceite dos executantes</h2>
    <p class="muted">
      Os colaboradores abaixo declaram ter participado da análise e estarem cientes dos riscos e das
      medidas de controle aplicáveis à atividade.
    </p>
    <table>
      <thead><tr><th>Colaborador</th><th>Função</th><th>Assinatura</th></tr></thead>
      <tbody>${signRows || '<tr><td colspan="3">Nenhum participante informado.</td></tr>'}</tbody>
    </table>
    ${pdfFooter(sealHtml)}`;
}