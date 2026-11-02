import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import { collaborators as seedCollaborators } from "@/mocks/collaborators";
import {
  surveyStatus,
  surveyTargetsCollaborator,
  type Survey,
  type SurveyAnswer,
  type SurveyAudienceType,
  type SurveyQuestion,
  type SurveyResponse,
} from "@/pages/app/modules/pesquisas/surveyTypes";

/**
 * Pesquisas internas (formulários) da empresa.
 *
 * - Cada pesquisa recebe um ID automático sequencial por empresa/ano.
 * - A situação (agendada / vigente / encerrada) é sempre derivada das datas.
 * - Pesquisas anônimas NÃO gravam nenhum vínculo com o colaborador: nem id,
 *   nem nome, nem função. A resposta é armazenada apenas com as alternativas
 *   escolhidas, garantindo o anonimato das respostas.
 * - Pesquisas identificadas gravam quem respondeu e impedem resposta duplicada.
 */

export interface SurveyStoreState {
  surveys: Survey[];
  responses: SurveyResponse[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: SurveyStoreState = {
  surveys: [],
  responses: [],
  loaded: false,
  loading: false,
  error: null,
};

let seeding = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<SurveyStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapSurvey(row: Record<string, unknown>): Survey {
  return {
    id: String(row.ref ?? ""),
    companyRef: String(row.company_ref ?? ""),
    title: String(row.title ?? "Pesquisa"),
    description: (row.description as string) ?? "",
    startAt: String(row.start_at ?? ""),
    endAt: String(row.end_at ?? ""),
    audienceType: row.audience_type === "function" ? "function" : "all",
    audienceFunctions: Array.isArray(row.audience_functions)
      ? (row.audience_functions as string[])
      : [],
    anonymous: row.anonymous !== false,
    questions: Array.isArray(row.questions) ? (row.questions as SurveyQuestion[]) : [],
    createdBy: (row.created_by as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
  };
}

function mapResponse(row: Record<string, unknown>): SurveyResponse {
  return {
    id: String(row.id ?? ""),
    surveyId: String(row.survey_ref ?? ""),
    anonymous: row.anonymous === true,
    collaboratorId: (row.collaborator_ref as string) ?? null,
    collaboratorName: (row.collaborator_name as string) ?? null,
    collaboratorRole: (row.collaborator_role as string) ?? null,
    answers: Array.isArray(row.answers) ? (row.answers as SurveyAnswer[]) : [],
    submittedAt: String(row.submitted_at ?? ""),
  };
}

/* ------------------------------ Seed demo --------------------------- */

function q(
  id: string,
  text: string,
  type: SurveyQuestion["type"],
  options: string[],
  required = true
): SurveyQuestion {
  return { id, text, type, options, required };
}

const SEED_SURVEYS: Survey[] = [
  {
    id: "PESQ-2026-0001",
    companyRef: "vega",
    title: "Clima organizacional 2026",
    description:
      "Pesquisa anônima de clima para entender bem-estar, comunicação e segurança psicológica. Nenhuma resposta é vinculada ao seu nome.",
    startAt: "2026-09-15T11:00:00.000Z",
    endAt: "2026-12-20T23:59:00.000Z",
    audienceType: "all",
    audienceFunctions: [],
    anonymous: true,
    questions: [
      q("q1-1", "Como você avalia o clima de trabalho na sua área?", "unica", [
        "Muito bom",
        "Bom",
        "Regular",
        "Ruim",
        "Muito ruim",
      ]),
      q("q1-2", "Quais fatores mais impactam seu bem-estar no trabalho?", "multipla", [
        "Carga de trabalho",
        "Relacionamento com a liderança",
        "Reconhecimento",
        "Ambiente físico",
        "Horários e pausas",
      ]),
      q("q1-3", "Como você avalia a comunicação entre os setores?", "escala", []),
      q("q1-4", "Você se sente seguro para relatar um problema de segurança?", "unica", [
        "Sempre",
        "Na maioria das vezes",
        "Às vezes",
        "Raramente",
        "Nunca",
      ]),
      q("q1-5", "Deixe uma sugestão para melhorarmos o ambiente de trabalho.", "texto", [], false),
    ],
    createdBy: "Marina Alves",
    publishedAt: "2026-09-15T11:00:00.000Z",
  },
  {
    id: "PESQ-2026-0002",
    companyRef: "vega",
    title: "EPIs da operação — outubro",
    description:
      "Pesquisa identificada para acompanhar a qualidade e a reposição dos EPIs entregues às funções operacionais.",
    startAt: "2026-10-01T11:00:00.000Z",
    endAt: "2026-10-31T23:59:00.000Z",
    audienceType: "function",
    audienceFunctions: [
      "Soldador",
      "Operador de Empilhadeira",
      "Operadora de Máquinas",
      "Mecânico Industrial",
    ],
    anonymous: false,
    questions: [
      q("q2-1", "Os EPIs entregues atendem às necessidades da sua função?", "unica", [
        "Sim, totalmente",
        "Parcialmente",
        "Não atendem",
      ]),
      q("q2-2", "Com que frequência você encontra EPI danificado?", "unica", [
        "Nunca",
        "Raramente",
        "Às vezes",
        "Sempre",
      ]),
      q("q2-3", "Quais EPIs precisam de reposição na sua área?", "multipla", [
        "Luvas",
        "Botinas",
        "Óculos",
        "Protetor auricular",
        "Capacete",
      ]),
      q("q2-4", "Como você avalia a agilidade da troca de EPI?", "escala", []),
    ],
    createdBy: "Marina Alves",
    publishedAt: "2026-10-01T12:10:00.000Z",
  },
  {
    id: "PESQ-2026-0003",
    companyRef: "vega",
    title: "Avaliação do treinamento NR-35",
    description:
      "Pesquisa anônima sobre a qualidade e a aplicabilidade do treinamento de trabalho em altura.",
    startAt: "2026-11-01T11:00:00.000Z",
    endAt: "2026-11-30T23:59:00.000Z",
    audienceType: "function",
    audienceFunctions: ["Técnica de Segurança", "Engenheira de Segurança"],
    anonymous: true,
    questions: [
      q("q3-1", "O conteúdo do treinamento foi aplicável à sua rotina?", "unica", [
        "Totalmente aplicável",
        "Parcialmente aplicável",
        "Pouco aplicável",
      ]),
      q("q3-2", "Como você avalia o material e os instrutores?", "escala", []),
      q("q3-3", "O que poderia ser melhorado no próximo treinamento?", "texto", [], false),
    ],
    createdBy: "Marina Alves",
    publishedAt: "2026-10-10T09:30:00.000Z",
  },
  {
    id: "PESQ-2026-0004",
    companyRef: "vega",
    title: "Satisfação com o refeitório",
    description:
      "Pesquisa identificada sobre qualidade das refeições, atendimento e estrutura do refeitório.",
    startAt: "2026-08-01T11:00:00.000Z",
    endAt: "2026-08-31T23:59:00.000Z",
    audienceType: "all",
    audienceFunctions: [],
    anonymous: false,
    questions: [
      q("q4-1", "Como você avalia a qualidade das refeições?", "unica", [
        "Ótima",
        "Boa",
        "Regular",
        "Ruim",
      ]),
      q("q4-2", "O atendimento da equipe do refeitório é adequado?", "unica", [
        "Sim",
        "Parcialmente",
        "Não",
      ]),
      q("q4-3", "Como você avalia a limpeza e a estrutura do refeitório?", "escala", []),
    ],
    createdBy: "Marina Alves",
    publishedAt: "2026-08-01T11:00:00.000Z",
  },
];

function buildSeedAnswers(survey: Survey, index: number): SurveyAnswer[] {
  return survey.questions.map((question) => {
    if (question.type === "unica") {
      const value = question.options[index % Math.max(1, question.options.length)];
      return { questionId: question.id, values: value ? [value] : [] };
    }
    if (question.type === "multipla") {
      const length = Math.max(1, question.options.length);
      const first = question.options[index % length];
      const second = question.options[(index + 2) % length];
      return {
        questionId: question.id,
        values: Array.from(new Set([first, second].filter(Boolean))),
      };
    }
    if (question.type === "escala") {
      return { questionId: question.id, values: [String((index % 5) + 1)] };
    }
    return { questionId: question.id, values: [], text: "" };
  });
}

function buildSeedResponse(
  survey: Survey,
  index: number,
  person: { id: string; name: string; role: string } | null
): Record<string, unknown> {
  return {
    company_ref: companyRef,
    survey_ref: survey.id,
    anonymous: survey.anonymous,
    collaborator_ref: survey.anonymous ? null : person?.id ?? null,
    collaborator_name: survey.anonymous ? null : person?.name ?? null,
    collaborator_role: survey.anonymous ? null : person?.role ?? null,
    answers: buildSeedAnswers(survey, index),
    submitted_at: new Date(
      new Date(survey.startAt).getTime() + index * 3600 * 1000 + 90 * 60 * 1000
    ).toISOString(),
  };
}

async function seedDemo(): Promise<void> {
  if (seeding) return;
  seeding = true;
  try {
    const surveyRows = SEED_SURVEYS.map((survey) => ({
      company_ref: companyRef,
      ref: survey.id,
      title: survey.title,
      description: survey.description,
      start_at: survey.startAt,
      end_at: survey.endAt,
      audience_type: survey.audienceType,
      audience_functions: survey.audienceFunctions,
      anonymous: survey.anonymous,
      questions: survey.questions,
      status: "publicada",
      created_by: survey.createdBy,
      published_at: survey.publishedAt,
    }));
    const { error } = await supabase
      .from("surveys")
      .upsert(surveyRows, { onConflict: "company_ref,ref" });
    if (error) throw error;

    const people = seedCollaborators.filter((person) => person.status !== "Desligado");
    const responseRows: Record<string, unknown>[] = [];

    const climate = SEED_SURVEYS[0];
    for (let i = 0; i < 38; i += 1) {
      responseRows.push(buildSeedResponse(climate, i, null));
    }

    const epi = SEED_SURVEYS[1];
    const operational = people.filter((person) =>
      epi.audienceFunctions.includes(person.role)
    );
    operational.slice(0, 5).forEach((person, index) => {
      responseRows.push(buildSeedResponse(epi, index, person));
    });

    const cafeteria = SEED_SURVEYS[3];
    people.slice(0, 9).forEach((person, index) => {
      responseRows.push(buildSeedResponse(cafeteria, index, person));
    });

    await supabase.from("survey_responses").insert(responseRows);
  } finally {
    seeding = false;
  }
}

/* ------------------------------- Load -------------------------------- */

async function fetchAll(): Promise<{ surveys: Survey[]; responses: SurveyResponse[] }> {
  const [surveyRes, responseRes] = await Promise.all([
    supabase
      .from("surveys")
      .select("*")
      .eq("company_ref", companyRef)
      .order("published_at", { ascending: false }),
    supabase
      .from("survey_responses")
      .select("*")
      .eq("company_ref", companyRef)
      .order("submitted_at", { ascending: false }),
  ]);
  if (surveyRes.error) throw surveyRes.error;
  return {
    surveys: ((surveyRes.data as Record<string, unknown>[]) ?? []).map(mapSurvey),
    responses:
      responseRes.error || !responseRes.data
        ? []
        : (responseRes.data as Record<string, unknown>[]).map(mapResponse),
  };
}

async function loadAll(force = false): Promise<void> {
  if (!force && (state.loading || state.loaded)) return;
  setState({ loading: true });
  try {
    let data = await fetchAll();
    if (data.surveys.length === 0) {
      await seedDemo();
      data = await fetchAll();
    }
    setState({
      surveys: data.surveys,
      responses: data.responses,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({
      surveys: [],
      responses: [],
      loaded: true,
      loading: false,
      error: "Não foi possível carregar as pesquisas do servidor.",
    });
  }
}

export function setSurveyCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef && (state.loaded || state.loading)) return;
  const changed = next !== companyRef;
  companyRef = next;
  if (changed) {
    state = { surveys: [], responses: [], loaded: false, loading: false, error: null };
    void Promise.resolve().then(() => loadAll(true));
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadAll();
  return () => {
    listeners.delete(listener);
  };
}

export function getSurveys(): Survey[] {
  return state.surveys;
}

export function useSurveys(): Survey[] {
  const { subdomain } = useAppSession();
  setSurveyCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getSurveys, getSurveys);
}

function getResponses(): SurveyResponse[] {
  return state.responses;
}

export function useSurveyResponses(): SurveyResponse[] {
  const { subdomain } = useAppSession();
  setSurveyCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getResponses, getResponses);
}

function getStoreState(): SurveyStoreState {
  return state;
}

export function useSurveyStoreState(): SurveyStoreState {
  const { subdomain } = useAppSession();
  setSurveyCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getStoreState, getStoreState);
}

/* ------------------------------- Helpers ----------------------------- */

/** Próximo ID sequencial por ano. Ex.: PESQ-2026-0005 */
export function nextSurveyRef(surveys: Survey[], year = new Date().getFullYear()): string {
  const prefix = `PESQ-${year}-`;
  const max = surveys
    .filter((survey) => survey.id.startsWith(prefix))
    .reduce((acc, survey) => Math.max(acc, Number(survey.id.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function responsesForSurvey(
  responses: SurveyResponse[],
  surveyId: string
): SurveyResponse[] {
  return responses.filter((response) => response.surveyId === surveyId);
}

export function generateQuestionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------------- Respostas salvas no navegador ---------------- */

const answeredKey = (ref: string, collaboratorId: string) =>
  `sstek:pesquisas-respondidas:${ref}:${collaboratorId}`;

/** Guarda localmente que o usuário respondeu (sem expor isso à gestão). */
export function readAnsweredSurveyIds(ref: string, collaboratorId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(answeredKey(ref, collaboratorId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function markAnsweredLocally(ref: string, collaboratorId: string, surveyId: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = readAnsweredSurveyIds(ref, collaboratorId);
    if (current.includes(surveyId)) return;
    window.localStorage.setItem(
      answeredKey(ref, collaboratorId),
      JSON.stringify([...current, surveyId])
    );
  } catch {
    // Sem persistência local: a resposta continua registrada no servidor.
  }
}

/** Pesquisas abertas para um colaborador, considerando público e respostas. */
export function openSurveysFor(
  surveys: Survey[],
  responses: SurveyResponse[],
  collaborator: { id: string; role: string } | null | undefined,
  ref: string
): Survey[] {
  if (!collaborator) return [];
  const locallyAnswered = readAnsweredSurveyIds(ref, collaborator.id);
  return surveys.filter((survey) => {
    if (surveyStatus(survey) !== "vigente") return false;
    if (!surveyTargetsCollaborator(survey, collaborator)) return false;
    if (locallyAnswered.includes(survey.id)) return false;
    if (!survey.anonymous && responses.some(
      (response) =>
        response.surveyId === survey.id && response.collaboratorId === collaborator.id
    )) {
      return false;
    }
    return true;
  });
}

/* -------------------------------- Ações ------------------------------ */

export interface CreateSurveyInput {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  audienceType: SurveyAudienceType;
  audienceFunctions: string[];
  anonymous: boolean;
  questions: SurveyQuestion[];
  createdBy: string | null;
}

export async function createSurvey(input: CreateSurveyInput): Promise<string> {
  const ref = nextSurveyRef(state.surveys);
  const { error } = await supabase.from("surveys").insert({
    company_ref: companyRef,
    ref,
    title: input.title.trim(),
    description: input.description.trim(),
    start_at: input.startAt,
    end_at: input.endAt,
    audience_type: input.audienceType,
    audience_functions: input.audienceType === "function" ? input.audienceFunctions : [],
    anonymous: input.anonymous,
    questions: input.questions,
    status: "publicada",
    created_by: input.createdBy,
    published_at: new Date().toISOString(),
  });
  if (error) throw new Error("Não foi possível publicar a pesquisa. Tente novamente.");
  await loadAll(true);
  return ref;
}

export interface SubmitSurveyInput {
  survey: Survey;
  answers: SurveyAnswer[];
  collaboratorId: string | null;
  collaboratorName: string | null;
  collaboratorRole: string | null;
}

export async function submitSurveyResponse(input: SubmitSurveyInput): Promise<void> {
  const { survey } = input;
  const anonymous = survey.anonymous;
  const { error } = await supabase.from("survey_responses").insert({
    company_ref: companyRef,
    survey_ref: survey.id,
    anonymous,
    // Anonimato total: nada que identifique o colaborador é gravado.
    collaborator_ref: anonymous ? null : input.collaboratorId,
    collaborator_name: anonymous ? null : input.collaboratorName,
    collaborator_role: anonymous ? null : input.collaboratorRole,
    answers: input.answers,
    submitted_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Você já respondeu esta pesquisa.");
    }
    throw new Error("Não foi possível enviar suas respostas. Tente novamente.");
  }
  if (input.collaboratorId) {
    markAnsweredLocally(companyRef, input.collaboratorId, survey.id);
  }
  await loadAll(true);
}

/** Encerra a pesquisa imediatamente, mantendo todo o histórico. */
export async function closeSurveyNow(surveyId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("surveys")
    .update({ end_at: now, status: "encerrada", updated_at: now })
    .eq("company_ref", companyRef)
    .eq("ref", surveyId);
  if (error) throw new Error("Não foi possível encerrar a pesquisa.");
  await loadAll(true);
}