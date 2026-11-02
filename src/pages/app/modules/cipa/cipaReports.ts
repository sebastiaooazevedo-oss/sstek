import { escapeHtml, pdfFooter, pdfHeader, todayBr } from "@/pages/app/utils/exportPdf";
import type { Cipa, CipaAta, CipaElection } from "@/mocks/cipa";
import type { DossierParts } from "@/mocks/documents";
import type { BuData } from "@/pages/app/modules/cipa/ballotResult";
import { buildDossierPdfBody, defaultDossierParts } from "@/pages/app/modules/cipa/editalPdf";
import {
  buildAttendanceReportPdfBody,
  buildBuPdfBody,
  buildCandidateFichaPdfBody,
  buildResultFinalAtaPdfBody,
} from "@/pages/app/modules/cipa/ballotPdf";
import { electionWindowLabel } from "@/pages/app/modules/cipa/cipaUtils";

/**
 * PDFs de arquivo e de relatórios consolidados da CIPA.
 *
 * - Arquivo do pleito: reúne, por processo eleitoral ENCERRADO, a capa do
 *   pleito, o dossiê completo (convocação, ata, resultado e posse), o Boletim
 *   de Urna, a Ata de Resultado Final e o relatório de comparecimento.
 * - Lote de pleitos concluídos: encadeia o arquivo completo de cada processo
 *   selecionado, precedido de uma capa-resumo.
 * - Relatório consolidado por unidade: apresenta, por estabelecimento, o
 *   período vigente, os eleitos, as indicações da empresa e a composição final.
 */

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function wrap(html: string): string {
  return `<div class="batch-page">${html}</div>`;
}

export interface ClosedElectionEntry {
  election: CipaElection;
  cipa?: Cipa;
  cipaName: string;
  ata?: CipaAta;
  bu: BuData;
  absentees: string[];
  finalizedAt: string | null;
  finalizedBy: string | null;
  finalHash: string;
  dossierParts?: DossierParts;
  dossierAttachments?: string[];
}

/* ----------------------- Arquivo de um único pleito ---------------------- */

function buildClosedElectionCover(entry: ClosedElectionEntry, sealHtml = "", validationUrl = ""): string {
  const { election, cipaName, bu } = entry;
  const elected = bu.ranking.filter((r) => r.seat === "titular" || r.seat === "suplente").length;

  return wrap(`${pdfHeader("Arquivo do Pleito — Eleição da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Eleições encerradas · Arquivo do pleito</p>
      <h1 class="cover-title">${escapeHtml(election.title) || "Eleição da CIPA"}</h1>
      <p class="cover-sub">${escapeHtml(cipaName)} · Processo ${escapeHtml(election.processNumber) || "—"}</p>
      <p class="cover-date">Janela de votação: ${escapeHtml(electionWindowLabel(election))} · Encerrado em ${escapeHtml(
    fmtDateTime(entry.finalizedAt)
  )}</p>
    </div>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${bu.eligible}</b><span>Habilitados a votar</span></div>
      <div class="cover-kpi"><b>${bu.voted}</b><span>Compareceram e votaram</span></div>
      <div class="cover-kpi"><b>${elected}</b><span>Eleitos (titulares/suplentes)</span></div>
      <div class="cover-kpi is-alert"><b>${bu.absent}</b><span>Ausentes</span></div>
    </div>

    <div class="grid">
      <div><strong>Comissão:</strong> ${escapeHtml(cipaName)}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(entry.cipa?.unit || election.establishment || "—")}</div>
      <div><strong>Mandato:</strong> ${escapeHtml(entry.cipa?.mandateNumber || "—")}</div>
      <div><strong>Responsável pelo aceite:</strong> ${escapeHtml(entry.finalizedBy || "—")}</div>
    </div>

    <h2>Conteúdo deste arquivo</h2>
    <ul class="cover-list">
      <li><strong>Dossiê do processo eleitoral</strong> — convocação, ata da comissão, resultado e posse.</li>
      <li><strong>Fichas de cadastro dos candidatos</strong> — uma ficha por candidato inscrito (${entry.election.candidates.filter((c) => c.name.trim()).length}).</li>
      <li><strong>Boletim de Urna (BU)</strong> — apuração completa, eleitos e não eleitos.</li>
      <li><strong>Ata de Resultado Final</strong> — declaração oficial do resultado.</li>
      <li><strong>Relatório de comparecimento</strong> — habilitados, votantes e ausentes.</li>
    </ul>

    ${
      entry.finalHash
        ? `<div class="cover-note">Processo encerrado e <strong>inviolável</strong>. Hash de integridade (SHA-256): <span style="word-break:break-all">${escapeHtml(
            entry.finalHash
          )}</span></div>`
        : ""
    }

    ${pdfFooter(sealHtml, validationUrl)}`);
}

/**
 * Arquivo completo de um pleito concluído (capa + dossiê + fichas + peças
 * oficiais). Recebe opcionalmente a chancela em HTML e o endereço de
 * validação: sem ela o arquivo ainda é impresso, só que sem selo.
 */
export function buildClosedElectionPdfBody(
  entry: ClosedElectionEntry,
  sealHtml = "",
  validationUrl = ""
): string {
  const dossier = buildDossierPdfBody(
    entry.election,
    entry.cipaName,
    entry.ata,
    entry.dossierParts ?? defaultDossierParts,
    entry.dossierAttachments ?? []
  );
  // Fichas de cadastro dos candidatos: uma por candidato inscrito no pleito.
  const fichas = entry.election.candidates
    .filter((c) => c.name.trim())
    .map((c) => wrap(buildCandidateFichaPdfBody(c, entry.election, entry.cipaName)))
    .join("");
  const bu = wrap(buildBuPdfBody(entry.election, entry.cipaName, entry.bu));
  const ataFinal = wrap(buildResultFinalAtaPdfBody(entry.election, entry.cipaName, entry.bu));
  const comparecimento = wrap(buildAttendanceReportPdfBody(entry.election, entry.cipaName, entry.bu, entry.absentees));

  return `${buildClosedElectionCover(entry, sealHtml, validationUrl)}${dossier}${fichas}${bu}${ataFinal}${comparecimento}`;
}

/** Lote de vários pleitos concluídos, precedido de uma capa-resumo. */
export function buildClosedElectionsBatchPdfBody(
  entries: ClosedElectionEntry[],
  unitFilter: string,
  sealHtml = "",
  validationUrl = ""
): string {
  const totalEligible = entries.reduce((sum, e) => sum + e.bu.eligible, 0);
  const totalVoted = entries.reduce((sum, e) => sum + e.bu.voted, 0);
  const totalElected = entries.reduce(
    (sum, e) => sum + e.bu.ranking.filter((r) => r.seat === "titular" || r.seat === "suplente").length,
    0
  );

  const rows = entries
    .map(
      (e, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(e.election.title)}</td><td>${escapeHtml(e.cipaName)}</td><td>${
          e.bu.eligible
        }</td><td>${e.bu.voted}</td><td>${escapeHtml(fmtDateTime(e.finalizedAt))}</td></tr>`
    )
    .join("");

  const cover = wrap(`${pdfHeader(unitFilter ? `Arquivo de pleitos · ${unitFilter}` : "Arquivo de pleitos encerrados")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Eleições encerradas</p>
      <h1 class="cover-title">Lote de pleitos concluídos</h1>
      <p class="cover-sub">Arquivo consolidado dos processos eleitorais encerrados, com o dossiê completo de cada pleito.</p>
      <p class="cover-date">Unidade: ${escapeHtml(unitFilter || "Todas as unidades")} · Emitido em ${todayBr()}</p>
    </div>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${entries.length}</b><span>Pleitos no lote</span></div>
      <div class="cover-kpi"><b>${totalEligible}</b><span>Habilitados (soma)</span></div>
      <div class="cover-kpi"><b>${totalVoted}</b><span>Votaram (soma)</span></div>
      <div class="cover-kpi"><b>${totalElected}</b><span>Eleitos (soma)</span></div>
    </div>

    <h2>Pleitos incluídos (${entries.length})</h2>
    <table>
      <thead><tr><th>#</th><th>Pleito</th><th>Comissão</th><th>Habilitados</th><th>Votaram</th><th>Encerrado em</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="cover-note">Cada pleito é arquivado em bloco: capa do pleito, dossiê do processo eleitoral (convocação, ata, resultado e posse), fichas de cadastro de todos os candidatos inscritos, Boletim de Urna, Ata de Resultado Final e relatório de comparecimento. Todos os processos estão encerrados e são invioláveis.</div>

    ${pdfFooter(sealHtml, validationUrl)}`);

  const bodies = entries.map((entry) => buildClosedElectionPdfBody(entry)).join("");
  return cover + bodies;
}

/* ------------------ Relatório consolidado por unidade -------------------- */

export interface ConsolidatedElect {
  name: string;
  roleFunction: string;
  seat: string;
  votes: number;
}

export interface ConsolidatedIndication {
  name: string;
  memberRole: string;
  representation: string;
  confirmed: boolean;
}

export interface ConsolidatedMember {
  name: string;
  memberRole: string;
  representation: string;
  roleFunction: string;
}

export interface ConsolidatedUnit {
  cipaName: string;
  unit: string;
  status: string;
  mandate: string;
  mandateStart: string;
  mandateEnd: string;
  electionTitle: string;
  electionProcess: string;
  elected: ConsolidatedElect[];
  indications: ConsolidatedIndication[];
  composition: ConsolidatedMember[];
}

function buildUnitSection(u: ConsolidatedUnit, index: number): string {
  const electedRows = u.elected.length
    ? `<table><thead><tr><th>#</th><th>Nome</th><th>Função</th><th>Votos</th><th>Situação</th></tr></thead><tbody>${u.elected
        .map(
          (e, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.roleFunction || "—")}</td><td>${
              e.votes
            }</td><td>${escapeHtml(e.seat === "titular" ? "Titular" : "Suplente")}</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted">Nenhum processo eleitoral apurado para esta unidade.</p>`;

  const indicationRows = u.indications.length
    ? `<table><thead><tr><th>#</th><th>Nome</th><th>Cargo na CIPA</th><th>Representação</th><th>Situação</th></tr></thead><tbody>${u.indications
        .map(
          (n, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(n.name)}</td><td>${escapeHtml(n.memberRole)}</td><td>${escapeHtml(
              n.representation
            )}</td><td>${n.confirmed ? "Confirmada" : "Aguardando"}</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted">Nenhuma indicação da empresa registrada.</p>`;

  const compositionRows = u.composition.length
    ? `<table><thead><tr><th>#</th><th>Nome</th><th>Cargo na CIPA</th><th>Representação</th><th>Função</th></tr></thead><tbody>${u.composition
        .map(
          (m, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.memberRole)}</td><td>${escapeHtml(
              m.representation
            )}</td><td>${escapeHtml(m.roleFunction || "—")}</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted">Composição não informada.</p>`;

  return wrap(`<h1>${index}. ${escapeHtml(u.cipaName)}</h1>
    <p class="muted">${escapeHtml(u.unit)}${u.status ? ` · ${escapeHtml(u.status)}` : ""}</p>

    <h2>Período vigente</h2>
    <div class="grid">
      <div><strong>Mandato:</strong> ${escapeHtml(u.mandate || "—")}</div>
      <div><strong>Vigência:</strong> ${escapeHtml(u.mandateStart || "—")} a ${escapeHtml(u.mandateEnd || "—")}</div>
      <div><strong>Processo eleitoral:</strong> ${escapeHtml(u.electionProcess || "—")}</div>
      <div><strong>Situação:</strong> ${escapeHtml(u.status || "—")}</div>
    </div>

    <h2>Eleitos</h2>
    ${electedRows}

    <h2>Indicações da empresa</h2>
    ${indicationRows}

    <h2>Composição final da comissão</h2>
    ${compositionRows}`);
}

/** Relatório consolidado da CIPA por unidade (período vigente, eleitos, indicações e composição). */
export function buildConsolidatedCipaPdfBody(
  units: ConsolidatedUnit[],
  unitFilter: string,
  sealHtml = "",
  validationUrl = ""
): string {
  const totalElected = units.reduce((sum, u) => sum + u.elected.length, 0);
  const totalIndications = units.reduce((sum, u) => sum + u.indications.length, 0);
  const totalComposition = units.reduce((sum, u) => sum + u.composition.length, 0);

  const sections = units.map((u, i) => buildUnitSection(u, i + 1)).join("");

  return `${pdfHeader(unitFilter ? `Relatório consolidado da CIPA · ${unitFilter}` : "Relatório consolidado da CIPA por unidade")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Relatório consolidado por unidade</h1>
      <p class="cover-sub">Período vigente, eleitos, indicações da empresa e composição final de cada comissão.</p>
      <p class="cover-date">Unidade: ${escapeHtml(unitFilter || "Todas as unidades")} · Emitido em ${todayBr()}</p>
    </div>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${units.length}</b><span>Unidades com CIPA</span></div>
      <div class="cover-kpi"><b>${totalElected}</b><span>Eleitos</span></div>
      <div class="cover-kpi"><b>${totalIndications}</b><span>Indicações da empresa</span></div>
      <div class="cover-kpi"><b>${totalComposition}</b><span>Composição final</span></div>
    </div>

    <div class="cover-note">Cada unidade é apresentada em sua própria página, com o período vigente do mandato, a relação dos eleitos, as indicações da empresa (representantes do empregador) e a composição final da comissão.</div>

    ${sections}

    ${pdfFooter(sealHtml, validationUrl)}`;
}