import { useEffect, useMemo, useRef, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import {
  exportComparisonCsv,
  buildSurveyComparison,
} from "@/pages/app/modules/pesquisas/surveyComparison";
import {
  formatSurveyDate,
  surveyStatus,
  surveyStatusMeta,
  type Survey,
  type SurveyResponse,
} from "@/pages/app/modules/pesquisas/surveyTypes";

interface SurveyCompareModalProps {
  open: boolean;
  onClose: () => void;
  surveys: Survey[];
  responses: SurveyResponse[];
}

function scaleCount(survey: Survey): number {
  return survey.questions.filter((question) => question.type === "escala").length;
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export default function SurveyCompareModal({
  open,
  onClose,
  surveys,
  responses,
}: SurveyCompareModalProps) {
  const candidates = useMemo(
    () =>
      surveys
        .filter((survey) => scaleCount(survey) > 0)
        .slice()
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [surveys]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current || candidates.length === 0) return;
    initialized.current = true;
    setSelected(candidates.slice(0, 3).map((survey) => survey.id));
  }, [open, candidates]);

  const ordered = useMemo(
    () =>
      candidates
        .filter((survey) => selected.includes(survey.id))
        .slice()
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [candidates, selected]
  );

  const comparison = useMemo(
    () => buildSurveyComparison(ordered, responses),
    [ordered, responses]
  );

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const answeredSeries = comparison.index.filter((point) => point.average !== null);
  const indexDelta =
    answeredSeries.length >= 2
      ? Math.round(
          ((answeredSeries[answeredSeries.length - 1].average as number) -
            (answeredSeries[0].average as number)) *
            10
        ) / 10
      : null;
  const maxIndex = Math.max(...comparison.index.map((point) => point.average ?? 0), 5);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Comparar pesquisas de clima"
      subtitle="Evolução das notas de escala por pergunta ao longo do tempo."
      icon="ri-line-chart-line"
      size="xl"
      footer={
        <>
          <ModalButton
            variant="ghost"
            icon="ri-file-excel-2-line"
            onClick={() => exportComparisonCsv(ordered, comparison)}
            disabled={ordered.length === 0}
          >
            Exportar CSV
          </ModalButton>
          <ModalButton variant="ghost" onClick={onClose}>
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-3">
          <i className="ri-information-line mt-0.5 text-base text-secondary-900"></i>
          <p className="text-[11px] leading-relaxed text-secondary-900">
            Selecione duas ou mais pesquisas que tenham perguntas de escala (1 a 5). Perguntas com o
            mesmo enunciado são agrupadas para mostrar a evolução da nota. Pesquisas anônimas
            entram normalmente no comparativo, pois só usamos as médias — nunca quem respondeu.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-foreground-500">
              Pesquisas disponíveis ({candidates.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(candidates.map((survey) => survey.id))}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
              >
                <i className="ri-checkbox-multiple-line"></i>
                Selecionar todas
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
              >
                <i className="ri-close-circle-line"></i>
                Limpar
              </button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
              Nenhuma pesquisa possui pergunta de escala. Crie uma pesquisa com escala de 1 a 5 para
              começar a comparar.
            </p>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {candidates.map((survey) => {
                const active = selected.includes(survey.id);
                const status = surveyStatus(survey);
                const meta = surveyStatusMeta[status];
                const count = responses.filter(
                  (response) => response.surveyId === survey.id
                ).length;
                return (
                  <li key={survey.id}>
                    <button
                      type="button"
                      onClick={() => toggle(survey.id)}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-primary-400 bg-primary-50"
                          : "border-background-200 bg-background-50 hover:bg-background-100"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          active
                            ? "border-primary-500 bg-primary-500 text-background-50"
                            : "border-background-300 bg-background-50 text-transparent"
                        }`}
                      >
                        <i className="ri-check-line text-xs"></i>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground-950">
                          {survey.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-foreground-500">
                          <span className="font-mono">{survey.id}</span>
                          <span>·</span>
                          <span>{formatSurveyDate(survey.startAt)}</span>
                          <span>·</span>
                          <span>{count} resposta(s)</span>
                        </span>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${meta.chip}`}
                        >
                          <i className={meta.icon}></i>
                          {meta.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {ordered.length === 0 ? (
          <p className="rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
            Selecione ao menos uma pesquisa para visualizar a evolução das notas.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-background-200 bg-background-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-foreground-500">
                  Índice geral de clima
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                    <i className="ri-survey-line"></i>
                    {ordered.length} pesquisa(s)
                  </span>
                  {indexDelta !== null && (
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${
                        indexDelta >= 0
                          ? "bg-primary-100 text-primary-800"
                          : "bg-accent-100 text-accent-900"
                      }`}
                    >
                      <i
                        className={
                          indexDelta >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"
                        }
                      ></i>
                      {indexDelta > 0 ? "+" : ""}
                      {indexDelta.toFixed(1)} pts
                    </span>
                  )}
                </div>
              </div>

              <ul className="mt-3 flex flex-col gap-2.5">
                {comparison.index.map((point, index) => {
                  const survey = ordered[index];
                  const previous = index > 0 ? comparison.index[index - 1].average : null;
                  const delta =
                    point.average !== null && previous !== null
                      ? Math.round((point.average - previous) * 10) / 10
                      : null;
                  const width = point.average === null ? 0 : (point.average / maxIndex) * 100;
                  return (
                    <li key={point.surveyId}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground-900">
                          {survey.title}
                        </span>
                        <span className="flex items-center gap-2 whitespace-nowrap text-[11px] text-foreground-500">
                          <span className="font-mono text-[10px]">{survey.id}</span>
                          <span className="font-heading text-sm font-extrabold text-foreground-950">
                            {formatAverage(point.average)}
                          </span>
                          <span className="text-foreground-400">/ 5</span>
                          {delta !== null && (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                delta >= 0
                                  ? "bg-primary-100 text-primary-800"
                                  : "bg-accent-100 text-accent-900"
                              }`}
                            >
                              <i
                                className={
                                  delta >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"
                                }
                              ></i>
                              {delta > 0 ? "+" : ""}
                              {delta.toFixed(1)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-background-200">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${width}%` }}
                          ></div>
                        </div>
                        <span className="whitespace-nowrap text-[10px] text-foreground-400">
                          {formatSurveyDate(survey.startAt)} · {point.answers} nota(s)
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground-500">
                Evolução por pergunta
              </h3>
              {comparison.rows.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
                  As pesquisas selecionadas não possuem perguntas de escala respondidas.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-background-200">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-background-100 text-[10px] uppercase tracking-wide text-foreground-500">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Pergunta (escala 1–5)</th>
                        {ordered.map((survey) => (
                          <th key={survey.id} className="px-3 py-2.5 font-semibold">
                            <span className="block font-mono text-[10px] text-foreground-600">
                              {survey.id}
                            </span>
                            <span className="block text-[10px] font-normal normal-case text-foreground-400">
                              {formatSurveyDate(survey.startAt)}
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 font-semibold">Evolução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.rows.map((row) => (
                        <tr key={row.key} className="border-t border-background-200 bg-background-50">
                          <td className="max-w-[260px] px-3 py-2.5">
                            <p className="truncate text-xs font-medium text-foreground-900" title={row.text}>
                              {row.text}
                            </p>
                          </td>
                          {row.values.map((value) => (
                            <td key={value.surveyId} className="px-3 py-2.5">
                              {value.average === null ? (
                                <span className="text-[11px] text-foreground-400">—</span>
                              ) : (
                                <span className="inline-flex items-baseline gap-1">
                                  <span className="font-heading text-sm font-bold text-foreground-950">
                                    {value.average.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] text-foreground-400">
                                    ({value.answers})
                                  </span>
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2.5">
                            {row.delta === null ? (
                              <span className="text-[11px] text-foreground-400">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  row.delta >= 0
                                    ? "bg-primary-100 text-primary-800"
                                    : "bg-accent-100 text-accent-900"
                                }`}
                              >
                                <i
                                  className={
                                    row.delta >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"
                                  }
                                ></i>
                                {row.delta > 0 ? "+" : ""}
                                {row.delta.toFixed(1)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-[11px] text-foreground-400">
                Os números entre parênteses indicam quantas notas compõem a média. A evolução compara
                a primeira e a última pesquisa selecionadas que responderam à pergunta.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}