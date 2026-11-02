import { useEffect, useState } from "react";
import Modal, { ModalButton, inputClass } from "@/pages/app/components/Modal";
import {
  surveyQuestionTypeLabels,
  type Survey,
  type SurveyAnswer,
} from "@/pages/app/modules/pesquisas/surveyTypes";

interface SurveyRespondModalProps {
  survey: Survey | null;
  onClose: () => void;
  onSubmit: (answers: SurveyAnswer[]) => Promise<void>;
}

interface DraftAnswer {
  values: string[];
  text: string;
}

export default function SurveyRespondModal({
  survey,
  onClose,
  onSubmit,
}: SurveyRespondModalProps) {
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setAnswers({});
    setError("");
    setSending(false);
  }, [survey?.id]);

  if (!survey) return null;

  const draftFor = (questionId: string): DraftAnswer =>
    answers[questionId] || { values: [], text: "" };

  const setSingle = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: { values: [value], text: "" } }));
  };

  const toggleMultiple = (questionId: string, value: string) => {
    setAnswers((current) => {
      const draft = current[questionId] || { values: [], text: "" };
      const has = draft.values.includes(value);
      return {
        ...current,
        [questionId]: {
          values: has ? draft.values.filter((item) => item !== value) : [...draft.values, value],
          text: "",
        },
      };
    });
  };

  const setText = (questionId: string, text: string) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: { values: [], text: text.slice(0, 500) },
    }));
  };

  const handleSubmit = async () => {
    const missing = survey.questions.filter((question) => {
      if (!question.required) return false;
      const draft = draftFor(question.id);
      if (question.type === "texto") return !draft.text.trim();
      return draft.values.length === 0;
    });
    if (missing.length > 0) {
      setError("Responda todas as perguntas obrigatórias antes de enviar.");
      return;
    }

    setError("");
    setSending(true);
    try {
      const payload: SurveyAnswer[] = survey.questions.map((question) => {
        const draft = draftFor(question.id);
        return {
          questionId: question.id,
          values: draft.values,
          text: question.type === "texto" ? draft.text.trim() : undefined,
        };
      });
      await onSubmit(payload);
    } catch (err) {
      setError((err as Error).message || "Não foi possível enviar suas respostas.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={Boolean(survey)}
      onClose={onClose}
      title={survey.title}
      subtitle={`Pesquisa ${survey.id} · ${survey.questions.length} pergunta(s)`}
      icon="ri-survey-line"
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </ModalButton>
          <ModalButton
            icon={sending ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}
            onClick={handleSubmit}
            disabled={sending}
          >
            {sending ? "Enviando..." : "Enviar respostas"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span className="flex-1">{error}</span>
          </div>
        )}

        {survey.description && (
          <p className="rounded-md bg-background-100 px-3.5 py-3 text-xs leading-relaxed text-foreground-600">
            {survey.description}
          </p>
        )}

        <div
          className={`flex items-start gap-2.5 rounded-md border px-3.5 py-3 ${
            survey.anonymous
              ? "border-primary-200 bg-primary-50"
              : "border-secondary-200 bg-secondary-50"
          }`}
        >
          <i
            className={`mt-0.5 text-base ${
              survey.anonymous ? "ri-eye-off-line text-primary-700" : "ri-user-follow-line text-secondary-900"
            }`}
          ></i>
          <p className={`text-[11px] leading-relaxed ${survey.anonymous ? "text-primary-800" : "text-secondary-900"}`}>
            {survey.anonymous
              ? "Esta pesquisa é anônima. Suas respostas são gravadas sem nome, id ou função — ninguém consegue identificá-lo."
              : "Esta pesquisa é identificada. Seu nome e função serão registrados junto às respostas."}
          </p>
        </div>

        {survey.questions.map((question, index) => {
          const draft = draftFor(question.id);
          return (
            <div
              key={question.id}
              className="rounded-lg border border-background-200 bg-background-50 p-4"
            >
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-foreground-950">
                    {question.text}
                    {question.required && <span className="ml-0.5 text-accent-600">*</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground-500">
                    {surveyQuestionTypeLabels[question.type]}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                {question.type === "unica" && (
                  <div className="flex flex-col gap-2">
                    {question.options.map((option) => {
                      const active = draft.values.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSingle(question.id, option)}
                          className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                            active
                              ? "border-primary-400 bg-primary-50 text-foreground-950"
                              : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              active ? "border-primary-500" : "border-background-300"
                            }`}
                          >
                            {active && <span className="h-2 w-2 rounded-full bg-primary-500"></span>}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {question.type === "multipla" && (
                  <div className="flex flex-col gap-2">
                    {question.options.map((option) => {
                      const active = draft.values.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleMultiple(question.id, option)}
                          className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                            active
                              ? "border-primary-400 bg-primary-50 text-foreground-950"
                              : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                              active
                                ? "border-primary-500 bg-primary-500 text-background-50"
                                : "border-background-300"
                            }`}
                          >
                            {active && <i className="ri-check-line text-[10px]"></i>}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {question.type === "escala" && (
                  <div className="flex items-center gap-2">
                    {["1", "2", "3", "4", "5"].map((value) => {
                      const active = draft.values[0] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSingle(question.id, value)}
                          className={`flex h-10 flex-1 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                            active
                              ? "border-primary-500 bg-primary-500 text-background-50"
                              : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                )}

                {question.type === "texto" && (
                  <>
                    <textarea
                      value={draft.text}
                      onChange={(event) => setText(question.id, event.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Escreva sua resposta"
                      className={`${inputClass} resize-none`}
                    />
                    <span className="mt-1 block self-end text-right text-[11px] text-foreground-400">
                      {draft.text.length}/500
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}