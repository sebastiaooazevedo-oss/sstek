import type { Collaborator } from "@/mocks/collaborators";
import type { Survey, SurveyQuestion, SurveyResponse } from "@/pages/app/modules/pesquisas/surveyTypes";

/**
 * Cálculos de acompanhamento das pesquisas: público-alvo real, adesão por
 * colaborador e quebra de resultados por pergunta e por função.
 */

export type SurveyPerson = Pick<Collaborator, "id" | "name" | "role" | "area"> & {
  status?: string;
};

export function activeRoster(roster: SurveyPerson[]): SurveyPerson[] {
  return roster.filter((person) => person.status !== "Desligado");
}

/** Colaboradores ativos que fazem parte do público-alvo da pesquisa. */
export function surveyAudience(survey: Survey, roster: SurveyPerson[]): SurveyPerson[] {
  const base = activeRoster(roster);
  if (survey.audienceType === "all") return base;
  return base.filter((person) => survey.audienceFunctions.includes(person.role));
}

export interface SurveyAdherence {
  audience: SurveyPerson[];
  responded: SurveyPerson[];
  pending: SurveyPerson[];
  percent: number;
}

/** Quem já respondeu e quem ainda falta responder (somente pesquisas identificadas). */
export function adherenceForSurvey(
  survey: Survey,
  responses: SurveyResponse[],
  roster: SurveyPerson[]
): SurveyAdherence {
  const audience = surveyAudience(survey, roster);
  const answered = new Set(
    responses
      .filter((response) => response.collaboratorId)
      .map((response) => response.collaboratorId as string)
  );
  const responded = audience.filter((person) => answered.has(person.id));
  const pending = audience.filter((person) => !answered.has(person.id));
  const percent = audience.length
    ? Math.round((responded.length / audience.length) * 100)
    : 0;
  return { audience, responded, pending, percent };
}

export interface SurveyOptionStat {
  label: string;
  count: number;
  percent: number;
}

/** Distribuição de respostas de uma pergunta (alternativas ou escala 1–5). */
export function questionOptionStats(
  question: SurveyQuestion,
  responses: SurveyResponse[]
): SurveyOptionStat[] {
  const total = responses.length;
  const values = question.type === "escala" ? ["1", "2", "3", "4", "5"] : question.options;
  return values.map((label) => {
    const count = responses.filter((response) =>
      response.answers
        .find((answer) => answer.questionId === question.id)
        ?.values.includes(label)
    ).length;
    return {
      label,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    };
  });
}

export function questionAnsweredCount(
  question: SurveyQuestion,
  responses: SurveyResponse[]
): number {
  return responses.filter((response) => {
    const answer = response.answers.find((item) => item.questionId === question.id);
    if (!answer) return false;
    return answer.values.length > 0 || Boolean(answer.text && answer.text.trim());
  }).length;
}

export interface SurveyFunctionStat {
  role: string;
  audience: number;
  responded: number;
  percent: number;
}

/**
 * Quebra por função. Só existe em pesquisas identificadas, porque nas anônimas
 * nenhuma informação de função é gravada (garantia de anonimato).
 */
export function functionBreakdown(
  survey: Survey,
  responses: SurveyResponse[],
  roster: SurveyPerson[]
): SurveyFunctionStat[] {
  if (survey.anonymous) return [];
  const audience = surveyAudience(survey, roster);
  const answered = new Set(
    responses
      .filter((response) => response.collaboratorId)
      .map((response) => response.collaboratorId as string)
  );
  const roles = Array.from(new Set(audience.map((person) => person.role))).sort((a, b) =>
    a.localeCompare(b)
  );
  return roles.map((role) => {
    const people = audience.filter((person) => person.role === role);
    const responded = people.filter((person) => answered.has(person.id)).length;
    return {
      role,
      audience: people.length,
      responded,
      percent: people.length ? Math.round((responded / people.length) * 100) : 0,
    };
  });
}