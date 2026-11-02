import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import {
  formatSurveyDateTime,
  surveyAudienceLabel,
  surveyQuestionTypeLabels,
  surveyStatus,
  surveyStatusMeta,
  type Survey,
  type SurveyQuestion,
  type SurveyResponse,
} from "@/pages/app/modules/pesquisas/surveyTypes";
import {
  adherenceForSurvey,
  type SurveyPerson,
} from "@/pages/app/modules/pesquisas/surveyAnalysis";
import {
  exportSurveyCsv,
  exportSurveyPdf,
} from "@/pages/app/modules/pesquisas/surveyExport";

interface SurveyDetailModalProps {
  survey: Survey | null;
  responses: SurveyResponse[];
  roster: SurveyPerson[];
  onClose: () => void;
  onClosed: (message: string) => Promise<void> | void;
}

function answerFor(response: SurveyResponse, questionId: string) {
  return response.answers.find((answer) => answer.questionId === questionId);
}

function QuestionResult({
  question,
  index,
  responses,
  anonymous,
}: {
  question: SurveyQuestion;
  index: number;
  responses: SurveyResponse[];
  anonymous: boolean;
}) {
  const answered = responses.filter((response) => {
    const answer = answerFor(response, question.id);
    if (!answer) return false;
    return answer.values.length > 0 || Boolean(answer.text && answer.text.trim());
  });
  const total = Math.max(responses.length, 1);

  return (
    <div className="rounded-lg border border-background-200 bg-background-100 p-3.5">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary-200 text-[11px] font-bold text-secondary-900">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground-950">{question.text}</p>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            {surveyQuestionTypeLabels[question.type]} · {answered.length} resposta(s)
          </p>
        </div>
      </div>

      {(question.type === "unica" || question.type === "multipla") && (
        <div className="mt-3 flex flex-col gap-2">
          {question.options.map((option) => {
            const count = responses.filter((response) =>
              answerFor(response, question.id)?.values.includes(option)
            ).length;
            const percent = Math.round((count / total) * 100);
            return (
              <div key={option}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-xs text-foreground-700">{option}</span>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-foreground-600">
                    {count} · {percent}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {question.type === "escala" && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {["1", "2", "3", "4", "5"].map((value) => {
            const count = responses.filter(
              (response) => answerFor(response, question.id)?.values[0] === value
            ).length;
            return (
              <div
                key={value}
                className="flex flex-col items-center rounded-md border border-background-200 bg-background-50 py-2"
              >
                <span className="font-heading text-sm font-bold text-foreground-950">{count}</span>
                <span className="text-[10px] text-foreground-500">nota {value}</span>
              </div>
            );
          })}
        </div>
      )}

      {question.type === "texto" && (
        <div className="mt-3">
          {anonymous ? (
            <p className="rounded-md bg-secondary-50 px-3 py-2 text-[11px] leading-relaxed text-secondary-900">
              {answered.length} resposta(s) livre(s) registrada(s). O conteúdo não é exibido
              individualmente para preservar o anonimato.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {answered.slice(0, 5).map((response) => {
                const answer = answerFor(response, question.id);
                return (
                  <li
                    key={response.id}
                    className="rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[11px] leading-relaxed text-foreground-700"
                  >
                    <span className="font-semibold text-foreground-900">
                      {response.collaboratorName || "Colaborador"}:
                    </span>{" "}
                    {answer?.text || "—"}
                  </li>
                );
              })}
              {answered.length > 5 && (
                <li className="text-[11px] text-foreground-400">
                  + {answered.length - 5} resposta(s) não exibida(s)
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function SurveyDetailModal({
  survey,
  responses,
  roster,
  onClose,
  onClosed,
}: SurveyDetailModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setConfirming(false);
    setClosing(false);
    setError("");
  }, [survey?.id]);

  if (!survey) return null;

  const status = surveyStatus(survey);
  const meta = surveyStatusMeta[status];
  const surveyResponses = responses.filter((response) => response.surveyId === survey.id);
  const canClose = status !== "encerrada";
  const adherence = survey.anonymous
    ? null
    : adherenceForSurvey(survey, surveyResponses, roster);

  const handleClose = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError("");
    setClosing(true);
    try {
      await onClosed(survey.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível encerrar a pesquisa.");
      setClosing(false);
      setConfirming(false);
    }
  };

  return (
    <Modal
      open={Boolean(survey)}
      onClose={onClose}
      title={survey.title}
      subtitle={`Pesquisa ${survey.id}`}
      icon="ri-survey-line"
      size="xl"
      footer={
        <>
          <div className="mr-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportSurveyPdf(survey, surveyResponses, roster)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-file-pdf-2-line text-base text-accent-700"></i>
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => exportSurveyCsv(survey, surveyResponses, roster)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-file-excel-2-line text-base text-primary-700"></i>
              Exportar CSV
            </button>
          </div>
          {error && (
            <span className="text-xs font-medium text-accent-800">{error}</span>
          )}
          {canClose && (
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                confirming
                  ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                  : "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
              }`}
            >
              <i className={closing ? "ri-loader-4-line animate-spin" : "ri-stop-circle-line"}></i>
              {closing
                ? "Encerrando..."
                : confirming
                  ? "Confirmar encerramento"
                  : "Encerrar pesquisa"}
            </button>
          )}
          <ModalButton variant="ghost" onClick={onClose}>
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${meta.chip}`}>
            <i className={meta.icon}></i>
            {meta.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
              survey.anonymous
                ? "bg-primary-100 text-primary-700"
                : "bg-secondary-100 text-secondary-900"
            }`}
          >
            <i className={survey.anonymous ? "ri-eye-off-line" : "ri-user-follow-line"}></i>
            {survey.anonymous ? "Anônima" : "Identificada"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
            <i className="ri-question-line"></i>
            {survey.questions.length} pergunta(s)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
            <i className="ri-file-list-3-line"></i>
            {surveyResponses.length} resposta(s)
          </span>
        </div>

        {survey.description && (
          <p className="rounded-md bg-background-100 px-3.5 py-3 text-xs leading-relaxed text-foreground-600">
            {survey.description}
          </p>
        )}

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
              Início
            </dt>
            <dd className="mt-0.5 text-xs font-semibold text-foreground-900">
              {formatSurveyDateTime(survey.startAt)}
            </dd>
          </div>
          <div className="rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
              Término
            </dt>
            <dd className="mt-0.5 text-xs font-semibold text-foreground-900">
              {formatSurveyDateTime(survey.endAt)}
            </dd>
          </div>
          <div className="rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
              Público-alvo
            </dt>
            <dd className="mt-0.5 text-xs font-semibold text-foreground-900">
              {surveyAudienceLabel(survey)}
            </dd>
            {survey.audienceType === "function" && survey.audienceFunctions.length > 0 && (
              <dd className="mt-1 flex flex-wrap gap-1">
                {survey.audienceFunctions.map((value) => (
                  <span
                    key={value}
                    className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-medium text-secondary-900"
                  >
                    {value}
                  </span>
                ))}
              </dd>
            )}
          </div>
          <div className="rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
              Criada por
            </dt>
            <dd className="mt-0.5 text-xs font-semibold text-foreground-900">
              {survey.createdBy || "—"}
            </dd>
            <dd className="text-[10px] text-foreground-400">
              Publicada em {formatSurveyDateTime(survey.publishedAt || "")}
            </dd>
          </div>
        </dl>

        {survey.anonymous && (
          <div className="flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3">
            <i className="ri-shield-check-line mt-0.5 text-base text-primary-700"></i>
            <div>
              <p className="text-xs font-semibold text-primary-900">Anonimato garantido</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-primary-800">
                As respostas são gravadas sem nome, id ou função. Nem a gestão consegue identificar
                quem respondeu — apenas os totais são exibidos.
              </p>
            </div>
          </div>
        )}

        {adherence && (
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground-500">
                Painel de adesão
              </h3>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                <i className="ri-user-follow-line"></i>
                {adherence.responded.length} de {adherence.audience.length} responderam
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background-200">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${adherence.percent}%` }}
                ></div>
              </div>
              <span className="font-heading text-sm font-extrabold text-foreground-950">
                {adherence.percent}%
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-background-200 bg-background-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Público-alvo
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground-950">
                  {adherence.audience.length}
                </p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Responderam
                </p>
                <p className="mt-0.5 text-sm font-bold text-primary-700">
                  {adherence.responded.length}
                </p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Faltam
                </p>
                <p className="mt-0.5 text-sm font-bold text-accent-700">
                  {adherence.pending.length}
                </p>
              </div>
            </div>

            <h4 className="mt-4 text-[11px] font-bold uppercase tracking-wide text-foreground-500">
              Quem ainda falta responder
            </h4>
            {adherence.pending.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2.5 text-[11px] font-medium text-primary-800">
                <i className="ri-checkbox-circle-line text-base"></i>
                Todos os colaboradores do público-alvo já responderam esta pesquisa.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {adherence.pending.map((person) => (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground-950">
                        {person.name}
                      </p>
                      <p className="truncate text-[11px] text-foreground-500">
                        {person.role} · {person.area || "—"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-semibold text-accent-900">
                      <i className="ri-time-line"></i>
                      Aguardando resposta
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-foreground-500">
            Resultados por pergunta
          </h3>
          {survey.questions.map((question, index) => (
            <QuestionResult
              key={question.id}
              question={question}
              index={index}
              responses={surveyResponses}
              anonymous={survey.anonymous}
            />
          ))}
          {survey.questions.length === 0 && (
            <p className="rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
              Esta pesquisa não possui perguntas.
            </p>
          )}
        </div>

        {!survey.anonymous && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-foreground-500">
              Quem respondeu ({surveyResponses.length})
            </h3>
            {surveyResponses.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-background-300 px-4 py-5 text-center text-xs text-foreground-500">
                Nenhuma resposta registrada até o momento.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {surveyResponses.map((response) => (
                  <li
                    key={response.id}
                    className="flex flex-col gap-1 rounded-md border border-background-200 bg-background-100 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground-950">
                        {response.collaboratorName || "Colaborador"}
                      </p>
                      <p className="truncate text-[11px] text-foreground-500">
                        {response.collaboratorRole || "—"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-foreground-500">
                      <i className="ri-time-line"></i>
                      {formatSurveyDateTime(response.submittedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}