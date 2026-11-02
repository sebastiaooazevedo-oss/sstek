import { downloadCsv } from "@/pages/app/utils/exportTable";
import {
  formatSurveyDate,
  type Survey,
  type SurveyResponse,
} from "@/pages/app/modules/pesquisas/surveyTypes";

/**
 * Comparação de resultados entre pesquisas (evolução das notas de escala).
 *
 * - Cada pesquisa gera um "índice geral" (média de todas as respostas de escala).
 * - Perguntas com o mesmo enunciado são agrupadas para mostrar a evolução da
 *   nota ao longo do tempo, independentemente do ID da pesquisa.
 */

export function normalizeQuestionText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scaleQuestionIds(survey: Survey): Set<string> {
  return new Set(
    survey.questions.filter((question) => question.type === "escala").map((question) => question.id)
  );
}

function scaleValues(survey: Survey, responses: SurveyResponse[]): number[] {
  const ids = scaleQuestionIds(survey);
  if (ids.size === 0) return [];
  const values: number[] = [];
  responses.forEach((response) => {
    response.answers.forEach((answer) => {
      if (!ids.has(answer.questionId)) return;
      answer.values.forEach((value) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) values.push(numeric);
      });
    });
  });
  return values;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((acc, value) => acc + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export interface ComparisonPoint {
  surveyId: string;
  average: number | null;
  answers: number;
}

export interface ComparisonRow {
  key: string;
  text: string;
  values: ComparisonPoint[];
  delta: number | null;
}

export interface SurveyComparison {
  index: ComparisonPoint[];
  rows: ComparisonRow[];
}

interface QuestionGroup {
  key: string;
  text: string;
  buckets: Map<string, { sum: number; count: number }>;
}

export function buildSurveyComparison(
  ordered: Survey[],
  responses: SurveyResponse[]
): SurveyComparison {
  const bySurvey = new Map<string, SurveyResponse[]>();
  responses.forEach((response) => {
    const list = bySurvey.get(response.surveyId) ?? [];
    list.push(response);
    bySurvey.set(response.surveyId, list);
  });

  const index: ComparisonPoint[] = ordered.map((survey) => {
    const values = scaleValues(survey, bySurvey.get(survey.id) ?? []);
    return { surveyId: survey.id, average: mean(values), answers: values.length };
  });

  const groups = new Map<string, QuestionGroup>();

  ordered.forEach((survey) => {
    const surveyResponses = bySurvey.get(survey.id) ?? [];
    survey.questions
      .filter((question) => question.type === "escala")
      .forEach((question) => {
        const key = normalizeQuestionText(question.text);
        if (!key) return;
        const group: QuestionGroup =
          groups.get(key) ?? { key, text: question.text, buckets: new Map() };

        surveyResponses.forEach((response) => {
          const answer = response.answers.find((item) => item.questionId === question.id);
          if (!answer) return;
          answer.values.forEach((value) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return;
            const bucket = group.buckets.get(survey.id) ?? { sum: 0, count: 0 };
            bucket.sum += numeric;
            bucket.count += 1;
            group.buckets.set(survey.id, bucket);
          });
        });

        // Garante que a pergunta apareça mesmo sem respostas ainda.
        if (!group.buckets.has(survey.id)) {
          group.buckets.set(survey.id, { sum: 0, count: 0 });
        }

        groups.set(key, group);
      });
  });

  const rows: ComparisonRow[] = Array.from(groups.values())
    .map((group) => {
      const values: ComparisonPoint[] = ordered.map((survey) => {
        const bucket = group.buckets.get(survey.id);
        const count = bucket?.count ?? 0;
        return {
          surveyId: survey.id,
          average: count > 0 && bucket ? Math.round((bucket.sum / count) * 10) / 10 : null,
          answers: count,
        };
      });
      const answered = values.filter((value) => value.average !== null);
      const delta =
        answered.length >= 2
          ? Math.round(
              ((answered[answered.length - 1].average as number) -
                (answered[0].average as number)) *
                10
            ) / 10
          : null;
      return { key: group.key, text: group.text, values, delta };
    })
    .sort((a, b) => {
      const countA = a.values.filter((value) => value.average !== null).length;
      const countB = b.values.filter((value) => value.average !== null).length;
      if (countB !== countA) return countB - countA;
      return a.text.localeCompare(b.text);
    });

  return { index, rows };
}

/** Exporta a comparação em planilha (índice geral + notas por pergunta). */
export function exportComparisonCsv(ordered: Survey[], comparison: SurveyComparison): void {
  const headers = [
    "Bloco",
    "Item",
    ...ordered.map((survey) => `${survey.id} (${formatSurveyDate(survey.startAt)})`),
  ];

  const rows: string[][] = [
    [
      "Índice geral",
      "Média das notas de escala",
      ...comparison.index.map((point) =>
        point.average === null ? "—" : point.average.toFixed(1)
      ),
    ],
  ];

  comparison.rows.forEach((row) => {
    rows.push([
      "Por pergunta",
      row.text,
      ...row.values.map((value) => (value.average === null ? "—" : value.average.toFixed(1))),
    ]);
  });

  downloadCsv("comparativo-pesquisas.csv", headers, rows);
}