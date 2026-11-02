import { escapeHtml, pdfFooter, pdfHeader, todayBr } from "@/pages/app/utils/exportPdf";
import {
  candidatePhotoGuidelines,
  candidateRequirements,
  type CipaElection,
  type ElectionCandidate,
} from "@/mocks/cipa";
import { electionWindowLabel, electionSeatLabel, toDisplayDate } from "@/pages/app/modules/cipa/cipaUtils";
import type { BuData } from "@/pages/app/modules/cipa/ballotResult";

/**
 * PDFs oficiais do pleito da CIPA: Boletim de Urna (apuração completa), Ata de
 * Resultado Final, Relatório de comparecimento (habilitados × votantes ×
 * ausentes) e a Ficha de Cadastro de Candidato. Todos reaproveitam o cabeçalho
 * (papel timbrado) e o rodapé de assinatura padrão do sistema.
 */

function seatsOf(bu: BuData) {
  const titular = bu.ranking.filter((r) => r.seat === "titular");
  const suplente = bu.ranking.filter((r) => r.seat === "suplente");
  return { titular, suplente };
}

function pct(votes: number, total: number): number {
  return total ? Math.round((votes / total) * 100) : 0;
}

/* ------------------------- Boletim de Urna (BU) ------------------------- */

export function buildBuPdfBody(election: CipaElection, cipaName: string, bu: BuData): string {
  const { titular, suplente } = seatsOf(bu);

  const electedRows = [...titular, ...suplente]
    .map(
      (r, i) =>
        `<tr><td>${i + 1}º</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.roleFunction || "—")}</td><td>${escapeHtml(
          r.area || "—"
        )}</td><td>${r.votes}</td><td>${pct(r.votes, bu.total)}%</td><td>${
          r.seat === "titular" ? "Titular" : "Suplente"
        }</td></tr>`
    )
    .join("");

  const fullRows = bu.ranking
    .map(
      (r) =>
        `<tr><td>${r.position}º</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.roleFunction || "—")}</td><td>${escapeHtml(
          r.area || "—"
        )}</td><td>${r.votes}</td><td>${pct(r.votes, bu.total)}%</td><td>${escapeHtml(electionSeatLabel(r.seat))}</td></tr>`
    )
    .join("");

  return `${pdfHeader("Boletim de Urna — Eleição da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Boletim de Urna</h1>
      <p class="cover-sub">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)}</p>
      <p class="cover-date">Processo ${escapeHtml(election.processNumber) || "—"} · Janela de votação: ${escapeHtml(
    bu.windowLabel
  )}</p>
    </div>

    <p>Boletim oficial da apuração do processo eleitoral da CIPA, emitido em conformidade com a NR-5. O voto é
    <strong>secreto</strong>: constam apenas as contagens por candidato, sem qualquer vínculo entre eleitor e voto.</p>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${bu.eligible}</b><span>Habilitados a votar</span></div>
      <div class="cover-kpi"><b>${bu.voted}</b><span>Compareceram e votaram</span></div>
      <div class="cover-kpi"><b>${bu.blank}</b><span>Votos em branco</span></div>
      <div class="cover-kpi is-alert"><b>${bu.absent}</b><span>Ausentes</span></div>
    </div>

    <div class="grid">
      <div><strong>Início da votação:</strong> ${bu.openedAt ? new Date(bu.openedAt).toLocaleString("pt-BR") : "—"}</div>
      <div><strong>Encerramento:</strong> ${bu.closedAt ? new Date(bu.closedAt).toLocaleString("pt-BR") : "—"}</div>
      <div><strong>Votos válidos:</strong> ${bu.total}</div>
      <div><strong>Candidatos:</strong> ${bu.ranking.length}</div>
      <div><strong>Vagas:</strong> ${Number(election.titularVacancies) || 0} titular(es) · ${
    Number(election.suplenteVacancies) || 0
  } suplente(s)</div>
    </div>

    <h2>1. Eleitos (titulares e suplentes)</h2>
    ${
      electedRows
        ? `<table><thead><tr><th>#</th><th>Nome</th><th>Função</th><th>Área</th><th>Votos</th><th>%</th><th>Situação</th></tr></thead><tbody>${electedRows}</tbody></table>`
        : "<p>Não houve candidatos eleitos nesta apuração.</p>"
    }

    <h2>2. Resultado completo da apuração</h2>
    ${
      fullRows
        ? `<table><thead><tr><th>#</th><th>Candidato</th><th>Função</th><th>Área</th><th>Votos</th><th>%</th><th>Situação</th></tr></thead><tbody>${fullRows}</tbody></table>`
        : "<p>Nenhuma cédula registrada.</p>"
    }

    ${
      bu.integrityHash
        ? `<h2>3. Integridade da urna</h2><p class="muted" style="word-break:break-all">Hash SHA-256 do conjunto de cédulas (ordem cronológica): ${escapeHtml(
            bu.integrityHash
          )}</p>`
        : ""
    }

    <div class="cover-note">
      Este boletim é emitido a partir das cédulas anônimas registradas na urna eletrônica e do controle de participação,
      preservando o sigilo do voto. Eventual recurso deve observar o prazo previsto no edital de convocação.
    </div>

    ${pdfFooter()}`;
}

/* ---------------------- Relatório de comparecimento --------------------- */

export function buildAttendanceReportPdfBody(
  election: CipaElection,
  cipaName: string,
  bu: BuData,
  absentees: string[]
): string {
  const rows = absentees
    .map((name, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(name)}</td><td>Não</td></tr>`)
    .join("");

  return `${pdfHeader("CIPA · Relatório de comparecimento ao pleito")}
    <h1>Relatório de comparecimento</h1>
    <p class="muted">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)} · ${escapeHtml(
    electionWindowLabel(election)
  )}</p>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${bu.eligible}</b><span>Habilitados</span></div>
      <div class="cover-kpi"><b>${bu.voted}</b><span>Votaram</span></div>
      <div class="cover-kpi is-alert"><b>${bu.absent}</b><span>Não compareceram</span></div>
    </div>

    <h2>Colaboradores que não compareceram (${
      absentees.length
    })</h2>
    ${
      rows
        ? `<table><thead><tr><th>#</th><th>Colaborador</th><th>Compareceu</th></tr></thead><tbody>${rows}</tbody></table>`
        : "<p>Nenhum ausente registrado (a base eleitoral pode ainda não ter sido fechada).</p>"
    }

    <p class="muted">O voto é secreto: este relatório informa apenas o comparecimento, sem qualquer vínculo com a escolha
    do eleitor.</p>

    ${pdfFooter()}`;
}

/* ------------------------- Ata de Resultado Final ----------------------- */

export function buildResultFinalAtaPdfBody(election: CipaElection, cipaName: string, bu: BuData): string {
  const { titular, suplente } = seatsOf(bu);
  const elected = [...titular, ...suplente];
  const electedNames = elected.length ? elected.map((r) => escapeHtml(r.name)).join("; ") : "—";

  const rows = bu.ranking
    .map(
      (r) =>
        `<tr><td>${r.position}º</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.roleFunction || "—")}</td><td>${escapeHtml(
          r.area || "—"
        )}</td><td>${r.votes}</td><td>${escapeHtml(electionSeatLabel(r.seat))}</td></tr>`
    )
    .join("");

  return `${pdfHeader("Ata de Resultado Final — Eleição da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Ata de Resultado Final</h1>
      <p class="cover-sub">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)}</p>
      <p class="cover-date">Processo ${escapeHtml(election.processNumber) || "—"} · Data da votação: ${escapeHtml(
    toDisplayDate(election.voteDate)
  )}</p>
    </div>

    <p>Aos ${escapeHtml(todayBr())}, a Comissão Eleitoral da CIPA, no uso de suas atribuições e em conformidade com a
    NR-5, encerrou a votação do processo eleitoral e procedeu à apuração dos votos, registrando o seguinte resultado
    final.</p>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${bu.eligible}</b><span>Habilitados a votar</span></div>
      <div class="cover-kpi"><b>${bu.voted}</b><span>Votaram</span></div>
      <div class="cover-kpi"><b>${bu.total}</b><span>Votos válidos</span></div>
      <div class="cover-kpi is-alert"><b>${bu.blank}</b><span>Brancos</span></div>
    </div>

    <h2>1. Apuração</h2>
    ${
      rows
        ? `<table><thead><tr><th>#</th><th>Candidato</th><th>Função</th><th>Área</th><th>Votos</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table>`
        : "<p>Nenhuma cédula registrada.</p>"
    }

    <h2>2. Resultado declarado</h2>
    <p>Foram declarados eleitos <strong>${titular.length}</strong> titular(es) e <strong>${
    suplente.length
  }</strong> suplente(s), a saber: <strong>${electedNames}</strong>.</p>
    <p class="muted">Fica consignado que o voto é secreto e que a urna eletrônica preserva o sigilo, registrando apenas
    as contagens por candidato. Encerrada a apuração, o resultado é publicado para conhecimento de todos os empregados.</p>

    ${pdfFooter()}`;
}

/* ----------------------- Ficha de cadastro do candidato ----------------- */

export function buildCandidateFichaPdfBody(candidate: ElectionCandidate, election: CipaElection, cipaName: string): string {
  const photo = candidate.photoUrl
    ? `<img src="${escapeHtml(candidate.photoUrl)}" alt="Foto de ${escapeHtml(candidate.name)}" style="width:120px;height:160px;object-fit:cover;border:1px solid #c9d3d7;border-radius:6px" />`
    : `<div style="width:120px;height:160px;border:1px dashed #c9d3d7;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#9aa6ac;font-size:10px">Sem foto</div>`;

  return `${pdfHeader("Ficha de Cadastro de Candidato — CIPA")}
    <h1>Ficha de Cadastro de Candidato</h1>
    <p class="muted">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)} · Processo ${escapeHtml(
    election.processNumber
  ) || "—"}</p>

    <div style="display:flex;gap:18px;margin:16px 0 4px">
      ${photo}
      <div class="grid" style="display:block;flex:1">
        <div style="margin-bottom:6px"><strong>Nome:</strong> ${escapeHtml(candidate.name)}</div>
        <div style="margin-bottom:6px"><strong>Matrícula:</strong> ${escapeHtml(candidate.registration || "—")}</div>
        <div style="margin-bottom:6px"><strong>Função / cargo:</strong> ${escapeHtml(candidate.roleFunction || "—")}</div>
        <div style="margin-bottom:6px"><strong>Área / setor:</strong> ${escapeHtml(candidate.area || "—")}</div>
        <div style="margin-bottom:6px"><strong>Contato:</strong> ${escapeHtml(candidate.contact || "—")}</div>
        <div><strong>Data da inscrição:</strong> ${escapeHtml(toDisplayDate(candidate.declaredAt || ""))}</div>
      </div>
    </div>

    <h2>Requisitos de elegibilidade (NR-5)</h2>
    <ul class="cover-list">${candidateRequirements.map((req) => `<li>${escapeHtml(req)}</li>`).join("")}</ul>

    <h2>Regras da foto 3x4</h2>
    <ul class="cover-list">${candidatePhotoGuidelines.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>

    <div class="cover-note">
      O candidato declara que atende a todos os requisitos de elegibilidade e que as informações e a foto enviadas são
      verdadeiras, autorizando a divulgação do seu nome na lista pública de candidatos.
    </div>

    ${pdfFooter()}`;
}