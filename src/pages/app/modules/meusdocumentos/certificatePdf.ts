import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import {
  getMedicalCertificateImage,
  type MedicalCertificate,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import { fetchFollowup } from "@/pages/app/modules/meusdocumentos/followupStore";

/**
 * PDF do atestado médico.
 *
 * Reúne a foto anexada pelo colaborador e o resumo do afastamento (data de
 * emissão, dias, período de afastamento e retorno previsto). É emitido pela
 * ficha do colaborador e pode ser reimpresso quantas vezes for necessário —
 * o registro é permanente e não pode ser editado nem excluído.
 */

function brDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Soma dias a uma data ISO (YYYY-MM-DD) e devolve no formato brasileiro. */
function addDaysBr(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("pt-BR");
}

function stampBr(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface CertificatePdfOptions {
  /** Função do colaborador no cadastro. */
  role?: string;
  /** Unidade do cadastro (usada quando o atestado não guardou unidade). */
  unit?: string;
}

export async function printMedicalCertificatePdf(
  certificate: MedicalCertificate,
  options: CertificatePdfOptions = {}
): Promise<void> {
  const imageUrl = await getMedicalCertificateImage(certificate);
  const followup = await fetchFollowup(certificate.id);
  const leaveDays = certificate.leaveDays > 0 ? certificate.leaveDays : 0;
  const start = brDate(certificate.issuedOn);
  const end = leaveDays > 0 ? addDaysBr(certificate.issuedOn, leaveDays - 1) : "—";
  const backToWork = leaveDays > 0 ? addDaysBr(certificate.issuedOn, leaveDays) : "Sem afastamento";
  const unit = certificate.establishment || options.unit || "—";

  const photoBlock = imageUrl
    ? `<div class="photo-grid"><figure>
        <img src="${escapeHtml(imageUrl)}" alt="Foto do atestado médico de ${escapeHtml(
          certificate.collaboratorName
        )}" style="height:auto;max-height:520px;object-fit:contain;background:#f4f8f6;" />
        <figcaption>Imagem anexada pelo colaborador · ${escapeHtml(
          certificate.fileName || "atestado"
        )} · cadastrado em ${escapeHtml(stampBr(certificate.createdAt))}</figcaption>
      </figure></div>`
    : `<p class="muted">A imagem do atestado não pôde ser carregada neste momento. O registro permanece íntegro e disponível para nova emissão.</p>`;

  const body = `
    ${pdfHeader(`Atestado médico · ${certificate.collaboratorName}`)}
    <h1>Atestado médico — resumo do afastamento</h1>
    <p class="muted">Documento emitido a partir do registro permanente do atestado enviado pelo colaborador. Uso interno do SESMT e do RH.</p>

    <div class="kpis">
      <div class="kpi"><b>${leaveDays}</b><span>Dia(s) de afastamento</span></div>
      <div class="kpi"><b>${escapeHtml(start)}</b><span>Data do atestado</span></div>
      <div class="kpi"><b>${escapeHtml(backToWork)}</b><span>Retorno previsto</span></div>
    </div>

    <h2>Identificação</h2>
    <div class="grid">
      <div><strong>Colaborador:</strong> ${escapeHtml(certificate.collaboratorName)}</div>
      <div><strong>Função:</strong> ${escapeHtml(options.role || "—")}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(unit)}</div>
      <div><strong>Área / setor:</strong> ${escapeHtml(certificate.area || "—")}</div>
      <div><strong>Documento:</strong> ${escapeHtml(certificate.certificateType)}</div>
      <div><strong>CID:</strong> ${escapeHtml(certificate.cid || "—")}</div>
    </div>

    <h2>Resumo do afastamento</h2>
    <table>
      <thead>
        <tr>
          <th>Data do atestado</th>
          <th>Dias de afastamento</th>
          <th>Início do afastamento</th>
          <th>Término do afastamento</th>
          <th>Retorno previsto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(start)}</td>
          <td>${leaveDays}</td>
          <td>${escapeHtml(start)}</td>
          <td>${escapeHtml(end)}</td>
          <td>${escapeHtml(backToWork)}</td>
        </tr>
      </tbody>
    </table>

    ${
      certificate.notes
        ? `<h2>Observações do registro</h2><p class="muted">${escapeHtml(certificate.notes)}</p>`
        : ""
    }

    <h2>Acompanhamento do afastamento</h2>
    ${
      followup
        ? `<div class="grid">
            <div><strong>Retorno previsto:</strong> ${escapeHtml(brDate(followup.expectedReturn))}</div>
            <div><strong>Registrado por:</strong> ${escapeHtml(followup.updatedBy || "Gestão")}</div>
            <div><strong>Atualizado em:</strong> ${escapeHtml(stampBr(followup.updatedAt))}</div>
          </div>
          ${
            followup.note
              ? `<p class="muted">${escapeHtml(followup.note)}</p>`
              : `<p class="muted">Sem observação registrada.</p>`
          }`
        : `<p class="muted">Sem acompanhamento registrado até a emissão deste documento.</p>`
    }

    <h2>Foto do atestado</h2>
    ${photoBlock}

    <p class="muted" style="margin-top:14px;">Registro imutável: após o cadastro, este atestado não pode ser editado nem excluído por nenhum perfil — nem pelo colaborador, nem pela gestão.</p>

    ${pdfFooter()}
  `;

  printHtml(`Atestado médico — ${certificate.collaboratorName}`, body);
}