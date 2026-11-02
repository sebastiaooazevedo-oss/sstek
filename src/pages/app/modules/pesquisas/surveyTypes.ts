export type SurveyQuestionType = "unica" | "multipla" | "escala" | "texto";
export type SurveyAudienceType = "all" | "function";
export type SurveyStatus = "agendada" | "vigente" | "encerrada";

export interface SurveyQuestion {
  id: string;
  text: string;
  type: SurveyQuestionType;
  options: string[];
  required: boolean;
}

export interface Survey {
  id: string;
  companyRef: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  audienceType: SurveyAudienceType;
  audienceFunctions: string[];
  anonymous: boolean;
  questions: SurveyQuestion[];
  createdBy: string | null;
  publishedAt: string | null;
}

export interface SurveyAnswer {
  questionId: string;
  values: string[];
  text?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  anonymous: boolean;
  collaboratorId: string | null;
  collaboratorName: string | null;
  collaboratorRole: string | null;
  answers: SurveyAnswer[];
  submittedAt: string;
}

export const surveyQuestionTypeLabels: Record<SurveyQuestionType, string> = {
  unica: "Escolha única",
  multipla: "Múltipla escolha",
  escala: "Escala de 1 a 5",
  texto: "Resposta livre",
};

export const surveyQuestionTypeIcons: Record<SurveyQuestionType, string> = {
  unica: "ri-radio-button-line",
  multipla: "ri-checkbox-multiple-line",
  escala: "ri-bar-chart-line",
  texto: "ri-text",
};

export const surveyStatusMeta: Record<
  SurveyStatus,
  { label: string; icon: string; chip: string }
> = {
  vigente: {
    label: "Vigente",
    icon: "ri-play-circle-line",
    chip: "bg-primary-500 text-background-50",
  },
  agendada: {
    label: "Agendada",
    icon: "ri-calendar-schedule-line",
    chip: "bg-secondary-500 text-background-50",
  },
  encerrada: {
    label: "Encerrada",
    icon: "ri-stop-circle-line",
    chip: "bg-background-200 text-foreground-600",
  },
};

/** A situação é sempre derivada das datas, nunca digitada à mão. */
export function surveyStatus(survey: Survey, now: number = Date.now()): SurveyStatus {
  const start = new Date(survey.startAt).getTime();
  const end = new Date(survey.endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "encerrada";
  if (now < start) return "agendada";
  if (now > end) return "encerrada";
  return "vigente";
}

export function surveyAudienceLabel(survey: Survey): string {
  if (survey.audienceType === "all") return "Todos os colaboradores";
  if (survey.audienceFunctions.length === 0) return "Funções não definidas";
  if (survey.audienceFunctions.length <= 2) return survey.audienceFunctions.join(", ");
  return `${survey.audienceFunctions.length} funções`;
}

export function formatSurveyDateTime(iso: string): string {
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

export function formatSurveyDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formata uma data para o input datetime-local (sem fuso). */
export function toDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Verifica se um colaborador é público-alvo da pesquisa. */
export function surveyTargetsCollaborator(
  survey: Survey,
  collaborator: { role: string } | null | undefined
): boolean {
  if (!collaborator) return false;
  if (survey.audienceType === "all") return true;
  return survey.audienceFunctions.includes(collaborator.role);
}