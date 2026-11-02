import { escapeHtml, pdfFooter, pdfHeader, type TechnicalSignatureInfo } from "@/pages/app/utils/exportPdf";
import { nrsDimensioning, toDisplayDate } from "@/pages/app/modules/cipa/cipaUtils";
import type { Cipa } from "@/mocks/cipa";

interface NrsSeal {
  cls: "is-ok" | "is-alert" | "is-dispensa";
  glyph: string;
  label: string;
}

/**
 * Monta o corpo HTML (layout do PDF) da Ficha de Cadastro da comissão da CIPA.
 * Reúne a identificação do estabelecimento, o mandato, a composição e o
 * enquadramento no Quadro I da NR-5 (com o selo Conforme / Fora do Quadro I /
 * Dispensa), além do bloco de assinaturas. É usada na impressão a partir do
 * cadastro da comissão.
 */
export function buildCipaFichaPdfBody(cipa: Cipa, technical?: TechnicalSignatureInfo): string {
  const todayStr = new Date().toLocaleDateString("pt-BR");
  const suggestion = cipa.employeesCount ? nrsDimensioning(cipa.employeesCount, cipa.riskGrade) : null;

  const empTitulares = cipa.members.filter(
    (m) => m.name.trim() && m.representation === "Empregado" && m.memberRole === "Titular"
  ).length;
  const empSuplentes = cipa.members.filter(
    (m) => m.name.trim() && m.representation === "Empregado" && m.memberRole === "Suplente"
  ).length;

  let seal: NrsSeal | null = null;
  if (suggestion) {
    if (!suggestion.required) {
      seal = { cls: "is-dispensa", glyph: "i", label: "Dispensa de CIPA" };
    } else if (empTitulares === suggestion.titulares && empSuplentes === suggestion.suplentes) {
      seal = { cls: "is-ok", glyph: "\u2713", label: "Conforme" };
    } else {
      seal = { cls: "is-alert", glyph: "!", label: "Fora do Quadro I" };
    }
  }

  let nrsText = "";
  if (suggestion && seal) {
    if (seal.cls === "is-dispensa") {
      nrsText = `O porte do estabelecimento (${escapeHtml(suggestion.rangeLabel)} · ${escapeHtml(
        suggestion.group
      )}) <strong>dispensa a constituição de CIPA</strong> — basta um trabalhador designado.`;
    } else if (seal.cls === "is-ok") {
      nrsText = `A composição está <strong>conforme</strong> o Quadro I da NR-5: o porte exige <strong>${
        suggestion.titulares
      } titular(es)</strong> e <strong>${suggestion.suplentes} suplente(s)</strong> por parte, e há ${empTitulares} titular(es) e ${empSuplentes} suplente(s) como representantes dos empregados.`;
    } else {
      nrsText = `A composição está <strong>fora do Quadro I da NR-5</strong>: o porte exige <strong>${
        suggestion.titulares
      } titular(es)</strong> e <strong>${suggestion.suplentes} suplente(s)</strong> por parte, mas há ${empTitulares} titular(es) e ${empSuplentes} suplente(s) lançados como representantes dos empregados.`;
    }
  }

  const nrsBlock = suggestion && seal
    ? `<div class="nrs-box ${seal.cls}">
      <div class="nrs-box-head">
        <span class="nrs-seal ${seal.cls}">${seal.glyph}&nbsp;&nbsp;NR-5: ${escapeHtml(seal.label)}</span>
        <span class="nrs-box-scale">${escapeHtml(suggestion.rangeLabel)} · ${escapeHtml(suggestion.group)}</span>
      </div>
      <p class="nrs-box-text">${nrsText}</p>
    </div>`
    : `<div class="nrs-box is-dispensa">
      <p class="nrs-box-text">Informe o nº de empregados e o grau de risco do estabelecimento para verificar o enquadramento no Quadro I da NR-5.</p>
    </div>`;

  const memberRows = cipa.members
    .filter((m) => m.name.trim())
    .map(
      (m, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.roleFunction || "—")}</td><td>${escapeHtml(
          m.area || "—"
        )}</td><td>${escapeHtml(m.registration || "—")}</td><td>${escapeHtml(m.memberRole)}</td><td>${escapeHtml(
          m.representation
        )}</td></tr>`
    )
    .join("");

  const compositionBlock = memberRows
    ? `<table>
        <thead><tr><th>#</th><th>Nome</th><th>Função</th><th>Área</th><th>Matrícula</th><th>Cargo na CIPA</th><th>Representação</th></tr></thead>
        <tbody>${memberRows}</tbody>
      </table>`
    : `<p class="muted">Nenhum membro informado na composição desta comissão.</p>`;

  return `${pdfHeader("Ficha de Cadastro da CIPA")}
    <div class="cover-hero">
      <p class="cover-eyebrow">Comissão Interna de Prevenção de Acidentes e Assédio</p>
      <h1 class="cover-title">Ficha de Cadastro da CIPA</h1>
      <p class="cover-sub">${escapeHtml(cipa.name)} · ${escapeHtml(cipa.unit)}</p>
      <p class="cover-date">Mandato ${escapeHtml(cipa.mandateNumber) || "—"} · Emitido em ${todayStr}</p>
    </div>

    <p>Esta ficha registra os dados de constituição da comissão, o mandato vigente, a composição de representantes
    dos empregados e do empregador e o enquadramento no dimensionamento do Quadro I da NR-5.</p>

    <h2>1. Identificação do estabelecimento</h2>
    <div class="grid">
      <div><strong>Comissão:</strong> ${escapeHtml(cipa.name)}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(cipa.unit || "—")}</div>
      <div><strong>Cidade / UF:</strong> ${escapeHtml(cipa.city || "—")}</div>
      <div><strong>CNPJ:</strong> ${escapeHtml(cipa.cnpj || "—")}</div>
      <div><strong>Grau de risco (NR-4):</strong> ${escapeHtml(cipa.riskGrade || "—")}</div>
      <div><strong>Nº de empregados:</strong> ${cipa.employeesCount || "—"}</div>
      <div><strong>Situação:</strong> ${escapeHtml(cipa.status)}</div>
      <div><strong>Mandato:</strong> ${escapeHtml(cipa.mandateNumber || "—")}</div>
      <div><strong>Início:</strong> ${toDisplayDate(cipa.mandateStart)}</div>
      <div><strong>Fim:</strong> ${toDisplayDate(cipa.mandateEnd)}</div>
      <div><strong>Membros:</strong> ${cipa.members.filter((m) => m.name.trim()).length}</div>
    </div>

    <h2>2. Enquadramento no Quadro I da NR-5</h2>
    ${nrsBlock}

    <h2>3. Composição da comissão</h2>
    ${compositionBlock}

    <div class="cover-note">
      O dimensionamento da CIPA observa o Quadro I da NR-5, que cruza o nº de empregados do estabelecimento com o
      grau de risco da atividade para definir o nº de representantes titulares e suplentes de cada parte. Esta ficha
      deve ser mantida à disposição da fiscalização do trabalho e atualizada a cada novo mandato.
    </div>

    ${pdfFooter("", "", technical)}`;
}