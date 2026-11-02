import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import {
  countChecklist,
  structuredKindLabel,
  type ChecklistEntry,
} from "@/pages/app/modules/documentos/structured/structuredData";
import type {
  AccidentPayload,
  CatPayload,
  MeasurementPayload,
  StructuredRecord,
  StructuredSigner,
  WorkPermitPayload,
} from "@/pages/app/modules/documentos/structured/structuredTypes";

/** dd/mm/aaaa a partir de yyyy-mm-dd. */
export function toBrDate(value: string): string {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function info(pairs: [string, string][]): string {
  return `<div class="grid">${pairs
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || "—")}</div>`)
    .join("")}</div>`;
}

function paragraph(title: string, value: string): string {
  return `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(value.trim()) || "—"}</p>`;
}

function checklistTable(rows: { label: string; ref: string; status: string; note: string }[] | undefined): string {
  if (!rows || rows.length === 0) return `<p class="muted">Nenhum item de verificação registrado.</p>`;
  return `<table>
    <thead><tr><th>Item verificado</th><th>Referência</th><th>Situação</th><th>Observação</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.ref || "—")}</td><td>${escapeHtml(
          r.status || "Não avaliado"
        )}</td><td>${escapeHtml(r.note.trim()) || "—"}</td></tr>`
      )
      .join("")}</tbody>
  </table>`;
}

function photosBlock(photos: { url: string; name: string }[] | undefined): string {
  if (!photos || photos.length === 0) return `<p class="muted">Sem registro fotográfico anexado.</p>`;
  return `<div class="photo-grid">${photos
    .map(
      (p) =>
        `<figure><img src="${p.url}" alt="Registro fotográfico do documento" /><figcaption>${escapeHtml(
          p.name
        )}</figcaption></figure>`
    )
    .join("")}</div>`;
}

function signersBlock(signers: StructuredSigner[]): string {
  return `<div class="sign-block">${signers
    .map(
      (s) => `<div class="sign-field">
        <div class="sign-line"></div>
        <span class="sign-caption">${escapeHtml(s.name || "—")}</span>
        <span class="sign-meta">${escapeHtml(s.label)}${s.detail ? ` · ${escapeHtml(s.detail)}` : ""}</span>
      </div>`
    )
    .join("")}</div>`;
}

function checklistKpis(payload: { checklist?: ChecklistEntry[] }): string {
  const counts = countChecklist(payload.checklist ?? []);
  return `<div class="kpis">
    <div class="kpi"><b>${counts.total}</b><span>Itens verificados</span></div>
    <div class="kpi"><b>${counts.conforme}</b><span>Conformes</span></div>
    <div class="kpi"><b>${counts.naoConforme}</b><span>Não conformes</span></div>
    <div class="kpi"><b>${counts.aplicavel}</b><span>Itens aplicáveis</span></div>
  </div>`;
}

/* -------------------------- Investigação ---------------------------- */

function accidentBody(payload: AccidentPayload): string {
  const witnessRows = payload.witnesses?.length
    ? `<table>
        <thead><tr><th>Testemunha</th><th>Função / setor</th></tr></thead>
        <tbody>${payload.witnesses
          .map((w) => `<tr><td>${escapeHtml(w.name || "—")}</td><td>${escapeHtml(w.role || "—")}</td></tr>`)
          .join("")}</tbody>
      </table>`
    : `<p class="muted">Nenhuma testemunha registrada.</p>`;

  const actionRows = payload.actions.length
    ? `<table>
        <thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
        <tbody>${payload.actions
          .map(
            (a) =>
              `<tr><td>${escapeHtml(a.description || "—")}</td><td>${escapeHtml(a.responsible || "—")}</td><td>${escapeHtml(
                toBrDate(a.due)
              )}</td><td>${escapeHtml(a.status || "—")}</td></tr>`
          )
          .join("")}</tbody>
      </table>`
    : `<p class="muted">Nenhuma ação registrada.</p>`;

  return `${pdfHeader("Investigação de Acidente")}
    <h1>${escapeHtml(payload.protocol ? `Investigação de Acidente nº ${payload.protocol}` : "Investigação de Acidente")}</h1>
    <p class="muted">Registro de investigação e análise de acidente conforme NR-1 (item 1.5.4.4.6), com registro de CAT (Lei 8.213/91) e evento S-2210 do eSocial.</p>
    ${info([
      ["Tipo de ocorrência", payload.occurrenceType],
      ["Gravidade", payload.severity],
      ["Data", toBrDate(payload.occurrenceDate)],
      ["Hora", payload.occurrenceTime],
      ["Turno", payload.shift],
      ["Unidade / estabelecimento", payload.establishment],
      ["Área / setor", payload.area],
      ["Local específico", payload.location],
      ["CID", payload.cid],
    ])}
    <h2>Acidentado</h2>
    ${info([
      ["Nome", payload.victimName],
      ["CPF", payload.victimCpf],
      ["Matrícula", payload.victimRegistration],
      ["Função", payload.victimRole],
      ["Admissão", toBrDate(payload.victimAdmission)],
      ["Data de nascimento", toBrDate(payload.victimBirth)],
      ["Sexo", payload.victimSex],
    ])}
    <h2>Comunicações e afastamento</h2>
    ${info([
      ["CAT emitida", payload.catIssued],
      ["Nº da CAT", payload.catNumber],
      ["Data da CAT", toBrDate(payload.catDate)],
      ["Evento S-2210 enviado", payload.esocialSent],
      ["CIPA notificada", payload.cipaNotified],
      ["Dias de afastamento", payload.leaveDays],
      ["Retorno previsto", toBrDate(payload.returnDate)],
    ])}
    ${paragraph("Atividade desenvolvida no momento do evento", payload.activity)}
    ${paragraph("Descrição do acidente", payload.description)}
    <h2>Agente causador e lesão</h2>
    ${info([
      ["Agente causador / fonte da lesão", payload.agent],
      ["Parte do corpo atingida", payload.bodyPart],
      ["Natureza da lesão", payload.injuryNature],
    ])}
    <h2>Análise de causa raiz</h2>
    ${info([["Método de análise", payload.rootCauseMethod]])}
    ${paragraph("Causa raiz identificada", payload.rootCause)}
    ${paragraph("Fatores contribuintes", payload.contributingFactors)}
    ${paragraph("Ato inseguro", payload.unsafeAct)}
    ${paragraph("Condição insegura", payload.unsafeCondition)}
    ${paragraph("Falha de gestão", payload.managementFailure)}
    <h2>Requisitos de segurança aplicáveis</h2>
    ${info([
      ["NRs relacionadas", payload.nrsRelated],
      ["EPIs em uso", payload.episUsed],
      ["Treinamentos", payload.trainings],
    ])}
    ${paragraph("Ações imediatas adotadas", payload.immediateActions)}
    ${paragraph("Conclusão da investigação", payload.conclusion)}
    <h2>Plano de ação (${payload.actions?.length ?? 0})</h2>
    ${actionRows}
    <h2>Testemunhas (${payload.witnesses?.length ?? 0})</h2>
    ${witnessRows}
    <h2>Checklist de verificação pós-acidente</h2>
    ${checklistKpis(payload)}
    ${checklistTable(payload.checklist)}
    <h2>Registro fotográfico (${payload.photos.length})</h2>
    ${photosBlock(payload.photos)}
    ${paragraph("Observações gerais", payload.notes)}
    <h2>Responsáveis pela investigação</h2>
    ${signersBlock([
      {
        label: "Investigador responsável",
        name: payload.investigatorName,
        detail: [payload.investigatorRole, payload.investigatorRegistration].filter(Boolean).join(" · "),
      },
      { label: "Representante da CIPA", name: payload.cipaRepresentative, detail: "NR-5" },
      { label: "Representante do empregador", name: payload.employerRepresentative, detail: "NR-1" },
    ])}
    ${pdfFooter()}`;
}

/* ---------------------------- Aferições ----------------------------- */

function measurementBody(payload: MeasurementPayload): string {
  const rows = payload.rows.length
    ? `<table>
        <thead><tr><th>Ponto / local</th><th>Tempo de amostragem</th><th>Valor medido</th><th>Limite (NR-15)</th><th>Resultado</th></tr></thead>
        <tbody>${payload.rows
          .map(
            (r) =>
              `<tr><td>${escapeHtml(r.point || "—")}</td><td>${escapeHtml(r.duration || "—")}</td><td>${escapeHtml(
                r.value || "—"
              )} ${escapeHtml(r.unit || "")}</td><td>${escapeHtml(r.limit || "—")}</td><td>${escapeHtml(
                r.result || "—"
              )}</td></tr>`
          )
          .join("")}</tbody>
      </table>`
    : `<p class="muted">Nenhuma medição registrada.</p>`;

  const aboveLimit = payload.rows.filter((r) => r.result === "Acima do limite").length;
  const attention = payload.rows.filter((r) => r.result === "Atenção").length;

  return `${pdfHeader("Aferições")}
    <h1>Aferição com ${escapeHtml(payload.equipmentName || "equipamento de medição")}</h1>
    <p class="muted">Registro de avaliação quantitativa de agente ocupacional. Normas de referência: ${escapeHtml(
      payload.norms.join(" · ") || payload.equipmentRefs || "NR-9"
    )}.</p>
    ${info([
      ["Protocolo", payload.protocol],
      ["Data da aferição", toBrDate(payload.measurementDate)],
      ["Hora", payload.measurementTime],
      ["Turno", payload.shift],
      ["Unidade / estabelecimento", payload.establishment],
      ["Área / setor", payload.area],
      ["Local da medição", payload.location],
      ["Atividade / função avaliada", payload.activity],
      ["Trabalhador avaliado", payload.workerName],
    ])}
    <h2>Equipamento utilizado</h2>
    ${info([
      ["Equipamento", payload.equipmentName],
      ["Unidade de medida", payload.equipmentUnit],
      ["Marca", payload.brand],
      ["Modelo", payload.model],
      ["Nº de série", payload.serial],
      ["Faixa de medição", payload.measurementRange],
      ["Resolução", payload.resolution],
      ["Incerteza de medição", payload.uncertainty],
    ])}
    <h2>Calibração</h2>
    ${info([
      ["Certificado nº", payload.calibrationCertificate],
      ["Laboratório / RBC", payload.calibrationLab],
      ["Data da calibração", toBrDate(payload.calibrationDate)],
      ["Validade da calibração", toBrDate(payload.calibrationExpiry)],
    ])}
    <h2>Condições ambientais</h2>
    ${info([
      ["Temperatura", payload.temperature ? `${payload.temperature} °C` : ""],
      ["Umidade relativa", payload.humidity ? `${payload.humidity} %` : ""],
      ["Pressão atmosférica", payload.pressure ? `${payload.pressure} hPa` : ""],
      ["Velocidade do ar", payload.airVelocity ? `${payload.airVelocity} m/s` : ""],
      ["Taxa metabólica / atividade", payload.metabolicRate],
    ])}
    <h2>Medições (${payload.rows.length})</h2>
    <div class="kpis">
      <div class="kpi"><b>${payload.rows.length}</b><span>Pontos avaliados</span></div>
      <div class="kpi"><b>${aboveLimit}</b><span>Acima do limite</span></div>
      <div class="kpi"><b>${attention}</b><span>Em atenção</span></div>
      <div class="kpi"><b>${payload.photos.length}</b><span>Registros fotográficos</span></div>
    </div>
    ${rows}
    <h2>Conclusão técnica</h2>
    <p>${escapeHtml(payload.conclusion.trim()) || "—"}</p>
    <h2>Checklist de verificação da aferição</h2>
    ${checklistKpis(payload)}
    ${checklistTable(payload.checklist)}
    <h2>Registro fotográfico (${payload.photos.length})</h2>
    ${photosBlock(payload.photos)}
    ${paragraph("Local e observações", payload.notes)}
    <h2>Responsável pela aferição</h2>
    ${signersBlock([
      {
        label: "Responsável pela aferição",
        name: payload.technicianName,
        detail: [payload.technicianRole, payload.technicianRegistration, payload.technicianCompany]
          .filter(Boolean)
          .join(" · "),
      },
      { label: "Testemunha / acompanhante", name: payload.witnessName, detail: "Acompanhamento da medição" },
    ])}
    ${pdfFooter()}`;
}

/* ----------------------- Permissão de Trabalho ---------------------- */

function permitBody(payload: WorkPermitPayload): string {
  const riskRows = payload.risks.length
    ? `<table>
        <thead><tr><th>Perigo</th><th>Risco</th><th>Medida de controle</th><th>EPI / EPC</th></tr></thead>
        <tbody>${payload.risks
          .map(
            (r) =>
              `<tr><td>${escapeHtml(r.hazard || "—")}</td><td>${escapeHtml(r.risk || "—")}</td><td>${escapeHtml(
                r.control || "—"
              )}</td><td>${escapeHtml(r.epi || "—")}</td></tr>`
          )
          .join("")}</tbody>
      </table>`
    : `<p class="muted">Nenhum risco registrado.</p>`;

  const hasAtmosphere =
    payload.atmosphericO2 || payload.atmosphericLel || payload.atmosphericH2s || payload.atmosphericCo;

  return `${pdfHeader("Permissão de Trabalho")}
    <h1>Permissão de Trabalho ${escapeHtml(payload.ptNumber ? `nº ${payload.ptNumber}` : "")}</h1>
    <p class="muted">Documento de liberação de atividade de risco, conforme NR-1 (gestão de riscos), NR-33, NR-35 e demais NRs aplicáveis.</p>
    ${info([
      ["Protocolo", payload.protocol],
      ["Data da permissão", toBrDate(payload.permitDate)],
      ["Início", payload.startTime],
      ["Término", payload.endTime],
      ["Válida até", toBrDate(payload.validUntil)],
      ["Unidade / estabelecimento", payload.establishment],
      ["Área / setor", payload.area],
      ["Local / equipamento", payload.location],
      ["Ordem de serviço", payload.workOrder],
    ])}
    <h2>Atividades autorizadas</h2>
    <p>${escapeHtml(payload.activityIds.join(" · ")) || "—"}</p>
    <h2>Executante</h2>
    ${info([
      ["Solicitante", payload.requester],
      ["Empresa executante", payload.executorCompany],
      ["Responsável no local", payload.executorResponsible],
      ["Função", payload.executorRole],
      ["Nº de trabalhadores", payload.workerCount],
    ])}
    <h2>Riscos e medidas de controle (${payload.risks.length})</h2>
    ${riskRows}
    <h2>Recursos de segurança</h2>
    ${info([
      ["EPIs exigidos", payload.epiList],
      ["Ferramentas e equipamentos", payload.tools],
      ["Isolamento / bloqueio", payload.isolation],
    ])}
    ${
      hasAtmosphere
        ? `<h2>Teste atmosférico</h2>${info([
            ["Oxigênio (O₂)", payload.atmosphericO2 ? `${payload.atmosphericO2} %` : ""],
            ["Inflamáveis (%LEL)", payload.atmosphericLel ? `${payload.atmosphericLel} %` : ""],
            ["Ácido sulfídrico (H₂S)", payload.atmosphericH2s ? `${payload.atmosphericH2s} ppm` : ""],
            ["Monóxido de carbono (CO)", payload.atmosphericCo ? `${payload.atmosphericCo} ppm` : ""],
            ["Hora do teste", payload.atmosphericTime],
          ])}`
        : ""
    }
    <h2>Checklist de liberação</h2>
    ${checklistKpis(payload)}
    ${checklistTable(payload.checklist)}
    <h2>Registro fotográfico (${payload.photos.length})</h2>
    ${photosBlock(payload.photos)}
    ${paragraph("Observações", payload.notes)}
    <h2>Encerramento</h2>
    ${info([
      ["Hora do encerramento", payload.closureTime],
      ["Pendências", payload.pending],
    ])}
    ${paragraph("Condições de encerramento", payload.closureNotes)}
    <h2>Liberação e assinaturas</h2>
    ${signersBlock([
      {
        label: "Emissor da permissão",
        name: payload.issuerName,
        detail: [payload.issuerRole, payload.issuerRegistration].filter(Boolean).join(" · "),
      },
      { label: "Aprovador", name: payload.approverName, detail: payload.approverRole },
      { label: "Executante responsável", name: payload.executorResponsible, detail: payload.executorCompany },
      { label: "Vigia / observador", name: payload.watcher, detail: "Acompanhamento da atividade" },
    ])}
    ${pdfFooter()}`;
}

/* ------------------------------- CAT -------------------------------- */

function address(street: string, number: string, complement: string, district: string, city: string, uf: string, cep: string): string {
  const line1 = [street, number, complement].filter(Boolean).join(", ");
  const line2 = [district, [city, uf].filter(Boolean).join("/")].filter(Boolean).join(" — ");
  return [line1, line2, cep ? `CEP ${cep}` : ""].filter(Boolean).join(" · ");
}

function receiptBlock(payload: CatPayload): string {
  if (!payload.receiptName) return `<p class="muted">Recibo de entrega não anexado.</p>`;
  const preview = payload.receiptType.startsWith("image/")
    ? `<figure><img src="${payload.receiptDataUrl}" alt="Recibo de entrega da CAT" /><figcaption>${escapeHtml(payload.receiptName)}</figcaption></figure>`
    : `<p><strong>Arquivo anexado:</strong> ${escapeHtml(payload.receiptName)}</p>`;
  return `${preview}${info([
    ["Data de entrega", toBrDate(payload.receiptDeliveredDate)],
    ["Entregue a", payload.receiptDeliveredTo],
    ["Entregue ao sindicato da categoria", payload.receiptDeliveredToUnion],
  ])}`;
}

function catBody(payload: CatPayload): string {
  return `${pdfHeader("CAT — Comunicação de Acidente de Trabalho")}
    <h1>Comunicação de Acidente de Trabalho${payload.protocol ? ` — ${escapeHtml(payload.protocol)}` : ""}</h1>
    <p class="muted">Documento emitido conforme Lei 8.213/91, art. 22, com os dados necessários à transmissão do evento S-2210 ao eSocial.</p>
    ${info([
      ["Nº de controle interno", payload.protocol],
      ["Nº da CAT emitida", payload.catNumber],
    ])}
    <h2>1. Informações do empregador</h2>
    ${info([
      ["Razão social / nome", payload.employerName],
      ["Tipo e número do documento", [payload.employerDocType, payload.employerDoc].filter(Boolean).join(" ")],
      ["CNAE", payload.employerCnae],
      ["Unidade / estabelecimento", payload.employerUnit],
      ["Endereço", address(payload.employerStreet, payload.employerNumber, payload.employerComplement, payload.employerDistrict, payload.employerCity, payload.employerUf, payload.employerCep)],
      ["Telefone", payload.employerPhone],
    ])}
    <h2>2. Informações do trabalhador acidentado</h2>
    ${info([
      ["Nome completo", payload.workerName],
      ["CPF", payload.workerCpf],
      ["RG", payload.workerRg],
      ["Data de nascimento", toBrDate(payload.workerBirth)],
      ["Sexo", payload.workerSex],
      ["Estado civil", payload.workerMarital],
      ["Carteira de trabalho (CTPS)", payload.workerCtps],
      ["NIT / PIS / PASEP / NIS", payload.workerNit],
      ["Matrícula no eSocial", payload.workerEsocial],
      ["CBO", payload.workerCbo],
      ["Área / categoria de atuação", payload.workerCategory],
      ["Salário", payload.workerSalary],
      ["Data de admissão", toBrDate(payload.workerAdmission)],
      ["Endereço residencial", address(payload.workerStreet, payload.workerNumber, payload.workerComplement, payload.workerDistrict, payload.workerCity, payload.workerUf, payload.workerCep)],
      ["Telefone", payload.workerPhone],
    ])}
    <h2>3. Dados do acidente ou doença ocupacional</h2>
    ${info([
      ["Tipo / espécie", payload.accidentType],
      ["Data da ocorrência", toBrDate(payload.accidentDate)],
      ["Hora", payload.accidentTime],
      ["Após quantas horas de trabalho", payload.hoursWorked],
      ["Local exato", payload.accidentLocation],
      ["Agente causador", [payload.causalAgentCode, payload.causalAgent].filter(Boolean).join(" — ")],
      ["Parte do corpo atingida", [payload.bodyPartCode, payload.bodyPart].filter(Boolean).join(" — ")],
      ["Registro policial", payload.policeReport],
      ["Nº do boletim de ocorrência", payload.policeReportNumber],
      ["Delegacia / unidade", payload.policeReportUnit],
      ["Data do registro policial", toBrDate(payload.policeReportDate)],
    ])}
    ${paragraph("Descrição do acidente ou diagnóstico da doença", payload.accidentDescription)}
    <h2>4. Atendimento médico e consequências</h2>
    ${info([
      ["Houve atendimento médico", payload.medicalCare],
      ["Data do atendimento", toBrDate(payload.medicalDate)],
      ["Unidade de saúde", payload.medicalUnit],
      ["Profissional responsável", payload.medicalDoctor],
      ["CRM", payload.medicalCrm],
      ["Diagnóstico", payload.diagnosis],
      ["CID", payload.cid],
      ["Houve afastamento", payload.leaveWork],
      ["Último dia efetivamente trabalhado", toBrDate(payload.lastWorkedDay)],
      ["Consequência do acidente", payload.consequence],
      ["Data do óbito", payload.deathDate ? toBrDate(payload.deathDate) : ""],
    ])}
    <h2>Recibo de entrega da CAT</h2>
    ${receiptBlock(payload)}
    <h2>Checklist legal da CAT</h2>
    ${checklistKpis(payload)}
    ${checklistTable(payload.checklist)}
    ${paragraph("Observações e pendências", payload.notes)}
    ${signersBlock([
      { label: "Empregador", name: payload.employerName, detail: [payload.employerDocType, payload.employerDoc].filter(Boolean).join(" ") },
      { label: "Trabalhador (ciência da comunicação)", name: payload.workerName, detail: payload.workerCpf },
      { label: "Responsável pela emissão", name: "", detail: "SESMT / Recursos Humanos" },
    ])}
    ${pdfFooter()}`;
}

/** Monta o corpo HTML (PDF/impressão) de um documento estruturado. */
export function buildStructuredPdfBody(record: StructuredRecord): string {
  if (record.kind === "investigacao-acidente") return accidentBody(record.payload as AccidentPayload);
  if (record.kind === "afericoes") return measurementBody(record.payload as MeasurementPayload);
  if (record.kind === "permissao-trabalho") return permitBody(record.payload as WorkPermitPayload);
  if (record.kind === "cat") return catBody(record.payload as CatPayload);
  return `${pdfHeader(structuredKindLabel[record.kind])}<p>Documento não reconhecido.</p>${pdfFooter()}`;
}