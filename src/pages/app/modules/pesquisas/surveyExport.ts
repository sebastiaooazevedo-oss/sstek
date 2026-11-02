import { escapeHtml, pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import {
  formatSurveyDateTime,
  surveyAudienceLabel,
  surveyQuestionTypeLabels,
  surveyStatus,
  surveyStatusMeta,
  type Survey,
  type SurveyResponse,
} from "@/pages/app/modules/pesquisas/surveyTypes";
import {
  adherenceForSurvey,
  functionBreakdown,
  questionAnsweredCount,
  questionOptionStats,
  type SurveyPerson,
} from "@/pages/app/modules/pesquisas/surveyAnalysis";

const MAX_TEXT_SAMPLES = 15;

function kpiBlock(survey: Survey, responses: SurveyResponse[], roster: SurveyPerson[]): string {
  const adherence = adherenceForSurvey(survey, responses, roster);
  const last = survey.anonymous
    ? `<div class="cover-kpi"><b>Anônima</b><span>Sem vínculo com o respondente</span></div>`
    : `<div class="cover-kpi ${adherence.pending.length ? "is-alert" : ""}"><b>${adherence.percent}%</b><span>Adesão · ${adherence.pending.length} pendente(s)</span></div>`;
  return `<div class="cover-kpis">
    <div class="cover-kpi"><b>${responses.length}</b><span>Respostas recebidas</span></div>
    <div class="cover-kpi"><b>${survey.questions.length}</b><span>Perguntas</span></div>
    <div class="cover-kpi"><b>${adherence.audience.length}</b><span>Público-alvo</span></div>
    ${last}
  </div>`;
}

function questionsBlock(survey: Survey, responses: SurveyResponse[]): string {
  if (survey.questions.length === 0) {
    return `<p class="muted">Esta pesquisa não possui perguntas.</p>`;
  }

  return survey.questions
    .map((question, index) => {
      const answered = questionAnsweredCount(question, responses);
      const heading = `<h2>${index + 1}. ${escapeHtml(question.text)}</h2>
        <p class="muted">${escapeHtml(surveyQuestionTypeLabels[question.type])} · ${answered} resposta(s) de ${responses.length} participante(s)</p>`;

      if (question.type === "texto") {
        const texts = survey.anonymous
          ? []
          : responses
              .map((response) => ({
                name: response.collaboratorName || "Colaborador",
                text:
                  response.answers.find((answer) => answer.questionId === question.id)?.text ?? "",
              }))
              .filter((item) => item.text.trim())
              .slice(0, MAX_TEXT_SAMPLES);

        if (survey.anonymous) {
          return `${heading}<p class="muted">Respostas livres mantidas em sigilo para garantir o anonimato. Apenas a contagem é exibida.</p>`;
        }
        if (texts.length === 0) {
          return `${heading}<p class="muted">Nenhuma resposta livre registrada.</p>`;
        }
        return `${heading}${tableHtml(
          ["Colaborador", "Resposta"],
          texts.map((item) => [item.name, item.text])
        )}`;
      }

      const stats = questionOptionStats(question, responses);
      const rows = stats.map((stat) => [
        question.type === "escala" ? `Nota ${stat.label}` : stat.label,
        String(stat.count),
        `${stat.percent}%`,
      ]);
      return `${heading}${tableHtml(["Alternativa", "Respostas", "%"], rows)}`;
    })
    .join("");
}

function functionBlock(
  survey: Survey,
  responses: SurveyResponse[],
  roster: SurveyPerson[]
): string {
  if (survey.anonymous) {
    return `<h2>Resultados por função</h2>
      <p class="muted">Pesquisa anônima: nenhuma informação de função é gravada, portanto este recorte não é disponibilizado.</p>`;
  }
  const stats = functionBreakdown(survey, responses, roster);
  if (stats.length === 0) {
    return `<h2>Resultados por função</h2><p class="muted">Nenhuma função no público-alvo desta pesquisa.</p>`;
  }
  return `<h2>Resultados por função</h2>${tableHtml(
    ["Função", "Público", "Responderam", "Adesão"],
    stats.map((stat) => [
      stat.role,
      String(stat.audience),
      String(stat.responded),
      `${stat.percent}%`,
    ])
  )}`;
}

function adherenceBlock(
  survey: Survey,
  responses: SurveyResponse[],
  roster: SurveyPerson[]
): string {
  if (survey.anonymous) return "";
  const adherence = adherenceForSurvey(survey, responses, roster);
  const rows = adherence.pending.map((person) => [
    person.name,
    person.role,
    person.area || "—",
    "Aguardando resposta",
  ]);
  if (rows.length === 0) {
    return `<h2>Pendentes de resposta</h2><p class="muted">Todos os colaboradores do público-alvo já responderam.</p>`;
  }
  return `<h2>Pendentes de resposta (${adherence.pending.length})</h2>${tableHtml(
    ["Colaborador", "Função", "Área", "Situação"],
    rows
  )}`;
}

/** Exporta o dossiê completo da pesquisa (perguntas, função e pendentes) em PDF. */
export function exportSurveyPdf(
  survey: Survey,
  responses: SurveyResponse[],
  roster: SurveyPerson[]
): void {
  const status = surveyStatus(survey);
  const meta = surveyStatusMeta[status];

  const body = `${pdfHeader("Resultados da pesquisa")}
    <h1>${escapeHtml(survey.title)}</h1>
    <p class="muted">Pesquisa ${escapeHtml(survey.id)} · ${escapeHtml(meta.label)} · ${
      survey.anonymous ? "Anônima" : "Identificada"
    }</p>

    <div class="grid">
      <div><strong>Período:</strong> ${escapeHtml(formatSurveyDateTime(survey.startAt))} até ${escapeHtml(
        formatSurveyDateTime(survey.endAt)
      )}</div>
      <div><strong>Público-alvo:</strong> ${escapeHtml(surveyAudienceLabel(survey))}</div>
      <div><strong>Criada por:</strong> ${escapeHtml(survey.createdBy || "—")}</div>
      <div><strong>Emitido em:</strong> ${todayBr()}</div>
    </div>

    ${kpiBlock(survey, responses, roster)}
    ${questionsBlock(survey, responses)}
    ${functionBlock(survey, responses, roster)}
    ${adherenceBlock(survey, responses, roster)}

    <div class="foot">
      <span>SSTEK · Gestão Inteligente em Segurança do Trabalho</span>
      <span>Pesquisa ${escapeHtml(survey.id)} · Emitido em ${todayBr()}</span>
    </div>`;

  printHtml(`${survey.id} · Resultados da pesquisa`, body);
}

/** Exporta os mesmos resultados em planilha CSV (por pergunta e por função). */
export function exportSurveyCsv(
  survey: Survey,
  responses: SurveyResponse[],
  roster: SurveyPerson[]
): void {
  const rows: string[][] = [];

  survey.questions.forEach((question, index) => {
    const label = `P${index + 1}. ${question.text}`;
    if (question.type === "texto") {
      rows.push([
        "Por pergunta",
        label,
        surveyQuestionTypeLabels[question.type],
        "Respostas livres",
        String(questionAnsweredCount(question, responses)),
        "",
      ]);
      return;
    }
    questionOptionStats(question, responses).forEach((stat) => {
      rows.push([
        "Por pergunta",
        label,
        surveyQuestionTypeLabels[question.type],
        question.type === "escala" ? `Nota ${stat.label}` : stat.label,
        String(stat.count),
        `${stat.percent}%`,
      ]);
    });
  });

  if (survey.anonymous) {
    rows.push([
      "Por função",
      "—",
      "Anônima",
      "Recorte por função indisponível (anonimato garantido)",
      String(responses.length),
      "",
    ]);
  } else {
    functionBreakdown(survey, responses, roster).forEach((stat) => {
      rows.push([
        "Por função",
        stat.role,
        "Adesão",
        `${stat.responded} de ${stat.audience} responderam`,
        String(stat.responded),
        `${stat.percent}%`,
      ]);
    });
    adherenceForSurvey(survey, responses, roster).pending.forEach((person) => {
      rows.push([
        "Pendentes",
        person.name,
        person.role,
        person.area || "—",
        "0",
        "Aguardando resposta",
      ]);
    });
  }

  downloadCsv(`pesquisa-${survey.id}-resultados.csv`, [
    "Bloco",
    "Item",
    "Tipo",
    "Detalhe",
    "Respostas",
    "Percentual",
  ], rows);
}