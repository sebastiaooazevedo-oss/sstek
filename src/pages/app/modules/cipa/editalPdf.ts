import { escapeHtml, pdfFooter, pdfHeader, type TechnicalSignatureInfo } from "@/pages/app/utils/exportPdf";
import { candidatePhotoGuidelines, candidateRequirements, type CipaAta, type CipaElection } from "@/mocks/cipa";
import type { DossierParts } from "@/mocks/documents";
import { candidacyState, electionSeatLabel, rankCandidates, toDisplayDate } from "@/pages/app/modules/cipa/cipaUtils";
import { buildAtaPdfBody } from "@/pages/app/modules/cipa/ataPdf";

/**
 * Monta o corpo HTML (layout do PDF) do Edital de Convocação de um processo
 * eleitoral da CIPA. Reaproveita os dados já preenchidos no painel da eleição
 * (prazo, votação, eleitores) e os requisitos/regras de foto padronizados.
 * É usado tanto na pré-visualização quanto no anexo automático em Documentos.
 */
export function buildEditalPdfBody(election: CipaElection, cipaName: string): string {
  const st = candidacyState(election);
  const candidates = election.candidates.filter((c) => c.name.trim());
  const todayStr = new Date().toLocaleDateString("pt-BR");

  const candidatesBlock = candidates.length
    ? `<h2>Relação de candidatos inscritos</h2>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Matrícula</th><th>Função</th><th>Área</th></tr></thead>
        <tbody>${candidates
          .map(
            (c, i) =>
              `<tr><td>${i + 1}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.registration || "—")}</td><td>${escapeHtml(
                c.roleFunction || "—"
              )}</td><td>${escapeHtml(c.area || "—")}</td></tr>`
          )
          .join("")}</tbody>
      </table>`
    : "";

  const intro = election.notice?.trim()
    ? escapeHtml(election.notice.trim())
    : `${escapeHtml(cipaName)} torna público, para conhecimento de todos os empregados, o presente <strong>Edital de Convocação</strong> do processo eleitoral da Comissão Interna de Prevenção de Acidentes e Assédio (CIPA), em conformidade com a NR-5, aprovado pelo quadro da comissão.`;

  return `${pdfHeader("Edital de Convocação — Eleição da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Edital de Convocação</h1>
      <p class="cover-sub">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)}</p>
      <p class="cover-date">Processo ${escapeHtml(election.processNumber) || "—"} · Ano ${
    escapeHtml(election.year) || "—"
  } · Emitido em ${todayStr}</p>
    </div>

    <p>${intro}</p>

    <div class="grid">
      <div><strong>Prazo de inscrição:</strong> ${st.start} a ${st.end}</div>
      <div><strong>Data da votação:</strong> ${toDisplayDate(election.voteDate)}</div>
      <div><strong>Eleitores aptos:</strong> ${election.eligibleVoters}</div>
      <div><strong>Situação do processo:</strong> ${escapeHtml(election.status)}</div>
    </div>

    <h2>1. Do objeto</h2>
    <p>Constitui objeto deste edital a convocação dos empregados interessados em concorrer às vagas de representantes da CIPA, bem como a divulgação das regras e do calendário do processo eleitoral.</p>

    <h2>2. Das inscrições</h2>
    <p>As inscrições ficam abertas no período de <strong>${st.start}</strong> a <strong>${
    st.end
  }</strong> e poderão ser realizadas presencialmente junto à Comissão Eleitoral ou por meio da ficha eletrônica de inscrição, acompanhadas da foto 3x4 conforme as regras do item 4 deste edital. A relação de candidatos inscritos é pública e fica disponível a todos os empregados.</p>

    <h2>3. Dos requisitos para concorrer às vagas</h2>
    <ul class="cover-list">${candidateRequirements.map((req) => `<li>${escapeHtml(req)}</li>`).join("")}</ul>

    <h2>4. Das regras para a foto 3x4</h2>
    <ul class="cover-list">${candidatePhotoGuidelines.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>

    ${candidatesBlock}

    <div class="cover-note">
      O candidato declara, ao se inscrever, que atende a todos os requisitos de elegibilidade deste edital e que as informações e a foto
      enviadas são verdadeiras, autorizando a divulgação do seu nome na lista pública de candidatos. A ausência de qualquer requisito
      ou documento implica o indeferimento da inscrição.
    </div>

    ${pdfFooter()}`;
}

/**
 * Monta o corpo HTML (layout do PDF) do Edital de Resultado / Publicação de um
 * processo eleitoral da CIPA. É emitido após a apuração e publica oficialmente
 * a lista de eleitos (ordenada por votos), com o resumo da votação.
 * Usado tanto na pré-visualização quanto no anexo automático em Documentos.
 */
export function buildResultadoEditalPdfBody(election: CipaElection, cipaName: string): string {
  const todayStr = new Date().toLocaleDateString("pt-BR");
  const ranking = rankCandidates(election);
  const total = ranking.reduce((sum, r) => sum + (Number(r.candidate.votes) || 0), 0);
  const elected = ranking.filter((r) => r.seat === "titular" || r.seat === "suplente");
  const titulares = ranking.filter((r) => r.seat === "titular");
  const suplentes = ranking.filter((r) => r.seat === "suplente");

  const pct = (votes: number) => (total ? Math.round((votes / total) * 100) : 0);

  const electedRows = elected
    .map(
      (r, i) =>
        `<tr><td>${i + 1}º</td><td>${escapeHtml(r.candidate.name)}</td><td>${escapeHtml(
          r.candidate.roleFunction || "—"
        )}</td><td>${escapeHtml(r.candidate.area || "—")}</td><td>${escapeHtml(
          r.candidate.registration || "—"
        )}</td><td>${r.candidate.votes}</td><td>${pct(r.candidate.votes)}%</td><td>${
          r.seat === "titular" ? "Titular" : "Suplente"
        }</td></tr>`
    )
    .join("");

  const electedBlock = elected.length
    ? `<h2>1. Relação dos eleitos</h2>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Função</th><th>Área</th><th>Matrícula</th><th>Votos</th><th>%</th><th>Situação</th></tr></thead>
        <tbody>${electedRows}</tbody>
      </table>`
    : `<h2>1. Relação dos eleitos</h2><p>Não houve candidatos eleitos nesta apuração.</p>`;

  const fullRows = ranking
    .map(
      (r) =>
        `<tr><td>${r.position}º</td><td>${escapeHtml(r.candidate.name)}</td><td>${escapeHtml(
          r.candidate.roleFunction || "—"
        )}</td><td>${escapeHtml(r.candidate.area || "—")}</td><td>${r.candidate.votes}</td><td>${pct(
          r.candidate.votes
        )}%</td><td>${escapeHtml(electionSeatLabel(r.seat))}</td></tr>`
    )
    .join("");

  const fullBlock = ranking.length
    ? `<h2>2. Resultado completo da apuração</h2>
      <table>
        <thead><tr><th>#</th><th>Candidato</th><th>Função</th><th>Área</th><th>Votos</th><th>%</th><th>Situação</th></tr></thead>
        <tbody>${fullRows}</tbody>
      </table>`
    : "";

  const vacancyText = `${
    titulares.length || suplentes.length
      ? `As vagas deste processo foram preenchidas por <strong>${titulares.length} titular(es)</strong> e <strong>${
          suplentes.length
        } suplente(s)</strong>.`
      : ""
  }`;

  return `${pdfHeader("Edital de Resultado / Publicação — Eleição da CIPA")}
    <div class="cover-head">
      <div class="publish-stamp">
        <span class="publish-stamp-label">Publicado</span>
        <span class="publish-stamp-date">${todayStr}</span>
      </div>
      <div class="cover-hero">
        <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
        <h1 class="cover-title">Edital de Resultado / Publicação</h1>
        <p class="cover-sub">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)}</p>
        <p class="cover-date">Processo ${escapeHtml(election.processNumber) || "—"} · Ano ${
    escapeHtml(election.year) || "—"
  } · Publicado em ${todayStr}</p>
      </div>
    </div>

    <p>${escapeHtml(
      cipaName
    )} torna público o <strong>resultado final</strong> do processo eleitoral da CIPA, em conformidade com a NR-5. Encerrada a votação e realizada a apuração, os votos foram conferidos pela Comissão Eleitoral e são divulgados a seguir, em ordem decrescente de votação. ${vacancyText}</p>

    <div class="grid">
      <div><strong>Situação do processo:</strong> ${escapeHtml(election.status)}</div>
      <div><strong>Data da votação:</strong> ${toDisplayDate(election.voteDate)}</div>
      <div><strong>Eleitores aptos:</strong> ${election.eligibleVoters}</div>
      <div><strong>Votos válidos:</strong> ${total}</div>
      <div><strong>Candidatos:</strong> ${ranking.length}</div>
      <div><strong>Vagas:</strong> ${Number(election.titularVacancies) || 0} titular(es) · ${
    Number(election.suplenteVacancies) || 0
  } suplente(s)</div>
      <div><strong>Eleitos:</strong> ${elected.length}</div>
    </div>

    ${electedBlock}
    ${fullBlock}

    <div class="cover-note">
      O presente resultado é definitivo, ressalvado o prazo recursal previsto no edital de convocação. Os eleitos serão convocados para a posse e para o cumprimento do mandato, nos termos da NR-5 e do calendário eleitoral. A lista de eleitos fica publicada para conhecimento de todos os empregados.
    </div>

    ${pdfFooter()}`;
}

/**
 * Monta o corpo HTML (layout do PDF) do Termo de Posse dos eleitos de um
 * processo eleitoral da CIPA. Relaciona os eleitos (titulares e suplentes)
 * que tomarão posse no mandato, com espaço para assinatura de cada um.
 */
export function buildPossePdfBody(election: CipaElection, cipaName: string): string {
  const todayStr = new Date().toLocaleDateString("pt-BR");
  const ranking = rankCandidates(election);
  const elected = ranking.filter((r) => r.seat === "titular" || r.seat === "suplente");

  const rows = elected
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(r.candidate.name)}</td><td>${escapeHtml(
          r.candidate.roleFunction || "—"
        )}</td><td>${escapeHtml(r.candidate.area || "—")}</td><td>${escapeHtml(
          r.candidate.registration || "—"
        )}</td><td>${r.seat === "titular" ? "Titular" : "Suplente"}</td></tr>`
    )
    .join("");

  const tableBlock = elected.length
    ? `<h2>1. Relação dos empossados</h2>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Função</th><th>Área</th><th>Matrícula</th><th>Condição</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<h2>1. Relação dos empossados</h2><p>Não constam eleitos para posse nesta apuração.</p>`;

  const signatureCells = elected
    .map(
      (r) =>
        `<div class="esign-cell"><div class="sign-line"></div><div class="esign-cap">${
          r.seat === "titular" ? "Titular" : "Suplente"
        }</div><div class="esign-name">${escapeHtml(r.candidate.name)}</div></div>`
    )
    .join("");

  return `${pdfHeader("Termo de Posse — Eleição da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Termo de Posse</h1>
      <p class="cover-sub">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)}</p>
      <p class="cover-date">Processo ${escapeHtml(election.processNumber) || "—"} · Ano ${
    escapeHtml(election.year) || "—"
  } · Emitido em ${todayStr}</p>
    </div>

    <p>${escapeHtml(
      cipaName
    )} dá posse aos empregados eleitos no processo eleitoral da CIPA, em conformidade com a NR-5. Os eleitos a seguir declaram assumir o mandato de <strong>1 (um) ano</strong>, na condição de titulares e suplentes, comprometendo-se a atuar na prevenção de acidentes e de assédio e a cumprir as atribuições previstas na norma.</p>

    <div class="grid">
      <div><strong>Situação do processo:</strong> ${escapeHtml(election.status)}</div>
      <div><strong>Data da votação:</strong> ${toDisplayDate(election.voteDate)}</div>
      <div><strong>Vagas:</strong> ${Number(election.titularVacancies) || 0} titular(es) · ${
    Number(election.suplenteVacancies) || 0
  } suplente(s)</div>
      <div><strong>Empossados:</strong> ${elected.length}</div>
    </div>

    ${tableBlock}

    <div class="cover-note">
      A posse ocorre após a publicação do resultado e observa o mandato de 1 (um) ano permitido pela NR-5, sendo admitida
      uma reeleição consecutiva. O presente termo é assinado pelos empossados para o registro e a posse dos eleitos.
    </div>

    ${signatureCells ? `<h2>2. Assinaturas dos empossados</h2><div class="esign-grid">${signatureCells}</div>` : ""}

    ${pdfFooter()}`;
}

/** Peças que podem compor o dossiê; por padrão todas entram. */
export const defaultDossierParts: DossierParts = {
  convocacao: true,
  ata: true,
  resultado: true,
  posse: true,
};

/**
 * Monta o corpo HTML (layout do PDF) do Dossiê do Processo Eleitoral da CIPA.
 * Reúne, em um único documento, as peças oficiais selecionadas do processo: o
 * Edital de Convocação, a Ata da Comissão Eleitoral, o Edital de
 * Resultado/Publicação e o Termo de Posse — cada qual em sua página, com capa e
 * índice. As peças opcionais são controladas por `parts` (ex.: excluir a ata
 * quando ainda não aprovada). Os arquivos externos anexados (ex.: edital
 * assinado em papel) são referenciados no índice de "Anexos externos".
 */
export function buildDossierPdfBody(
  election: CipaElection,
  cipaName: string,
  ata?: CipaAta,
  parts: DossierParts = defaultDossierParts,
  attachments: string[] = [],
  sealHtml = "",
  validationUrl = "",
  technical?: TechnicalSignatureInfo
): string {
  const todayStr = new Date().toLocaleDateString("pt-BR");
  const ranking = rankCandidates(election);
  const elected = ranking.filter((r) => r.seat === "titular" || r.seat === "suplente");
  const inscribed = election.candidates.filter((c) => c.name.trim()).length;
  const st = candidacyState(election);

  const includeConvocacao = parts.convocacao;
  const includeAta = parts.ata && Boolean(ata);
  const includeResultado = parts.resultado;
  const includePosse = parts.posse;

  const contentItems: string[] = [];
  let order = 0;
  if (includeConvocacao) {
    order += 1;
    contentItems.push(
      `<li><strong>${order}. Edital de Convocação</strong> — convocação, prazo de inscrição (${st.start} a ${st.end}) e regras.</li>`
    );
  }
  if (includeAta && ata) {
    order += 1;
    contentItems.push(
      `<li><strong>${order}. Ata da Comissão Eleitoral</strong> — registro "${escapeHtml(ata.title)}" de ${escapeHtml(
        ata.date
      )}.</li>`
    );
  }
  if (includeResultado) {
    order += 1;
    contentItems.push(
      `<li><strong>${order}. Edital de Resultado / Publicação</strong> — apuração e relação oficial dos eleitos.</li>`
    );
  }
  if (includePosse) {
    order += 1;
    contentItems.push(`<li><strong>${order}. Termo de Posse</strong> — posse dos eleitos para o mandato de 1 (um) ano.</li>`);
  }
  const contentList = contentItems.length
    ? contentItems.join("")
    : `<li>Nenhuma peça foi selecionada para compor este dossiê.</li>`;

  const externalAttachments = attachments.map((name) => name.trim()).filter(Boolean);
  const attachmentsBlock = externalAttachments.length
    ? `<h2>Anexos externos (${externalAttachments.length})</h2>
    <ul class="cover-list">${externalAttachments
      .map((name) => `<li>${escapeHtml(name)} — arquivado junto a este dossiê.</li>`)
      .join("")}</ul>`
    : "";

  const cover = `<div class="batch-page">
    ${pdfHeader("Dossiê do Processo Eleitoral da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Dossiê do Processo Eleitoral</h1>
      <p class="cover-sub">${escapeHtml(election.title) || "Eleição da CIPA"} · ${escapeHtml(cipaName)}</p>
      <p class="cover-date">Processo ${escapeHtml(election.processNumber) || "—"} · Ano ${
    escapeHtml(election.year) || "—"
  } · Emitido em ${todayStr}</p>
    </div>

    <p>Este dossiê reúne, em um único documento, as peças oficiais do processo eleitoral da CIPA selecionadas para
    arquivamento conjunto da convocação, da ata da comissão, do resultado publicado e da posse dos eleitos, em
    conformidade com a NR-5.</p>

    <div class="cover-kpis">
      <div class="cover-kpi"><b>${inscribed}</b><span>Candidatos inscritos</span></div>
      <div class="cover-kpi"><b>${elected.length}</b><span>Eleitos (titulares/suplentes)</span></div>
      <div class="cover-kpi"><b>${Number(election.titularVacancies) || 0}</b><span>Vagas de titulares</span></div>
      <div class="cover-kpi is-alert"><b>${escapeHtml(election.status)}</b><span>Situação do processo</span></div>
    </div>

    <h2>Conteúdo do dossiê</h2>
    <ul class="cover-list">${contentList}</ul>

    ${attachmentsBlock}

    ${pdfFooter(sealHtml, validationUrl, technical)}
  </div>`;

  const partList = [
    includeConvocacao ? `<div class="batch-page">${buildEditalPdfBody(election, cipaName)}</div>` : "",
    includeAta && ata ? `<div class="batch-page">${buildAtaPdfBody(ata, cipaName)}</div>` : "",
    includeResultado ? `<div class="batch-page">${buildResultadoEditalPdfBody(election, cipaName)}</div>` : "",
    includePosse ? `<div class="batch-page">${buildPossePdfBody(election, cipaName)}</div>` : "",
  ].filter(Boolean);

  return [cover, ...partList].join("");
}