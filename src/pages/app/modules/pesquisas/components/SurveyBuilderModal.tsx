import { useEffect, useState, type ReactNode } from "react";
import Modal, { ModalButton, inputClass } from "@/pages/app/components/Modal";
import {
  generateQuestionId,
  type CreateSurveyInput,
} from "@/pages/app/modules/pesquisas/surveyStore";
import {
  surveyQuestionTypeLabels,
  toDateTimeInput,
  type Survey,
  type SurveyQuestionType,
} from "@/pages/app/modules/pesquisas/surveyTypes";

interface DraftQuestion {
  key: string;
  text: string;
  type: SurveyQuestionType;
  options: string[];
  required: boolean;
}

interface SurveyBuilderModalProps {
  open: boolean;
  onClose: () => void;
  nextRef: string;
  functions: string[];
  template?: Survey | null;
  onPublish: (input: CreateSurveyInput) => Promise<void>;
}

function newQuestion(): DraftQuestion {
  return {
    key: generateQuestionId(),
    text: "",
    type: "unica",
    options: ["", ""],
    required: true,
  };
}

function BuilderSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
          {step}
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-bold text-foreground-950">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default function SurveyBuilderModal({
  open,
  onClose,
  nextRef,
  functions,
  template = null,
  onPublish,
}: SurveyBuilderModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "function">("all");
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setTitle(template ? `Cópia de ${template.title}`.slice(0, 120) : "");
    setDescription(template?.description ?? "");
    setStartAt(toDateTimeInput(now));
    setEndAt(toDateTimeInput(inSevenDays));
    setAudienceType(template?.audienceType ?? "all");
    setSelectedFunctions(template ? [...template.audienceFunctions] : []);
    setAnonymous(template ? template.anonymous : true);
    setQuestions(
      template && template.questions.length > 0
        ? template.questions.map((question) => ({
            key: generateQuestionId(),
            text: question.text,
            type: question.type,
            options:
              question.type === "unica" || question.type === "multipla"
                ? [...question.options]
                : [],
            required: question.required,
          }))
        : [newQuestion()]
    );
    setError("");
    setSaving(false);
  }, [open, template]);

  const updateQuestion = (key: string, patch: Partial<DraftQuestion>) => {
    setQuestions((current) =>
      current.map((question) => (question.key === key ? { ...question, ...patch } : question))
    );
  };

  const updateOption = (key: string, index: number, value: string) => {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key
          ? {
              ...question,
              options: question.options.map((option, i) => (i === index ? value : option)),
            }
          : question
      )
    );
  };

  const addOption = (key: string) => {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key && question.options.length < 5
          ? { ...question, options: [...question.options, ""] }
          : question
      )
    );
  };

  const removeOption = (key: string, index: number) => {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key && question.options.length > 1
          ? { ...question, options: question.options.filter((_, i) => i !== index) }
          : question
      )
    );
  };

  const removeQuestion = (key: string) => {
    setQuestions((current) =>
      current.length > 1 ? current.filter((question) => question.key !== key) : current
    );
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const toggleFunction = (value: string) => {
    setSelectedFunctions((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handlePublish = async () => {
    const problems: string[] = [];
    if (!title.trim()) problems.push("Informe o título da pesquisa.");
    if (!startAt || !endAt) {
      problems.push("Informe a data e hora de início e de término.");
    } else if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      problems.push("O término precisa ser depois do início.");
    }
    if (audienceType === "function" && selectedFunctions.length === 0) {
      problems.push("Selecione ao menos uma função para o envio.");
    }
    if (questions.length === 0) problems.push("Adicione ao menos uma pergunta.");

    questions.forEach((question, index) => {
      if (!question.text.trim()) {
        problems.push(`Pergunta ${index + 1}: descreva o enunciado.`);
      }
      if (question.type === "unica" || question.type === "multipla") {
        const filled = question.options.map((option) => option.trim()).filter(Boolean);
        if (filled.length < 2) {
          problems.push(`Pergunta ${index + 1}: informe pelo menos 2 opções.`);
        }
      }
      if (
        (question.type === "unica" || question.type === "multipla") &&
        question.options.filter((option) => option.trim()).length > 5
      ) {
        problems.push(`Pergunta ${index + 1}: o limite é de 5 opções.`);
      }
    });

    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onPublish({
        title: title.trim(),
        description: description.trim(),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        audienceType,
        audienceFunctions: selectedFunctions,
        anonymous,
        questions: questions.map((question) => ({
          id: generateQuestionId(),
          text: question.text.trim(),
          type: question.type,
          options:
            question.type === "unica" || question.type === "multipla"
              ? question.options.map((option) => option.trim()).filter(Boolean)
              : [],
          required: question.required,
        })),
        createdBy: null,
      });
    } catch (err) {
      setError((err as Error).message || "Não foi possível publicar a pesquisa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "Duplicar pesquisa" : "Nova pesquisa"}
      subtitle={
        template
          ? "Perguntas, público e anonimato reaproveitados do modelo. Revise e publique."
          : "Monte o formulário, defina o período, o público e o anonimato."
      }
      icon="ri-survey-line"
      size="xl"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton
            icon={saving ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}
            onClick={handlePublish}
            disabled={saving}
          >
            {saving ? "Publicando..." : "Publicar Pesquisa"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {template && (
          <div className="flex items-start gap-2.5 rounded-md border border-secondary-200 bg-secondary-50 px-4 py-3 text-[11px] leading-relaxed text-secondary-900">
            <i className="ri-file-copy-line mt-0.5 text-base"></i>
            <span>
              Modelo duplicado de <strong className="font-mono">{template.id}</strong> —{" "}
              {template.title}. As perguntas, o público-alvo e o anonimato foram reaproveitados.
              Ajuste o período e publique: o ID será gerado automaticamente para a nova pesquisa.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span className="flex-1">{error}</span>
          </div>
        )}

        <BuilderSection
          step={1}
          title="Identificação"
          description="O ID da pesquisa é gerado automaticamente ao publicar."
        >
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-secondary-900">
              ID automático
            </span>
            <span className="font-mono text-sm font-bold text-secondary-900">{nextRef}</span>
            <span className="text-[11px] text-foreground-500">
              (sequencial por empresa e ano)
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">
              Título da pesquisa<span className="ml-0.5 text-accent-600">*</span>
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Ex.: Clima organizacional 2026"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">Descrição (opcional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 500))}
              rows={2}
              placeholder="Explique o objetivo da pesquisa para quem vai responder."
              className={`${inputClass} resize-none`}
            />
            <span className="self-end text-[11px] text-foreground-400">
              {description.length}/500
            </span>
          </label>
        </BuilderSection>

        <BuilderSection
          step={2}
          title="Período de vigência"
          description="A pesquisa fica agendada antes do início e encerrada após o término."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground-700">
                Início<span className="ml-0.5 text-accent-600">*</span>
              </span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground-700">
                Término<span className="ml-0.5 text-accent-600">*</span>
              </span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </BuilderSection>

        <BuilderSection
          step={3}
          title="Público-alvo"
          description="Envie para todos os colaboradores ou selecione as funções."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAudienceType("all")}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                audienceType === "all"
                  ? "border-primary-400 bg-primary-50"
                  : "border-background-300 bg-background-50 hover:bg-background-100"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  audienceType === "all"
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                <i className="ri-group-line text-base"></i>
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground-950">
                  Todos os colaboradores
                </span>
                <span className="mt-0.5 block text-[11px] text-foreground-500">
                  A pesquisa fica visível para toda a empresa.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAudienceType("function")}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                audienceType === "function"
                  ? "border-primary-400 bg-primary-50"
                  : "border-background-300 bg-background-50 hover:bg-background-100"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  audienceType === "function"
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                <i className="ri-user-star-line text-base"></i>
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground-950">Por função</span>
                <span className="mt-0.5 block text-[11px] text-foreground-500">
                  Escolha quais funções recebem a pesquisa.
                </span>
              </span>
            </button>
          </div>

          {audienceType === "function" && (
            <div className="rounded-md border border-background-200 bg-background-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                Funções selecionadas ({selectedFunctions.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {functions.map((value) => {
                  const active = selectedFunctions.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleFunction(value)}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary-400 bg-primary-500 text-background-50"
                          : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                      }`}
                    >
                      <i className={active ? "ri-checkbox-circle-fill" : "ri-add-circle-line"}></i>
                      {value}
                    </button>
                  );
                })}
                {functions.length === 0 && (
                  <p className="text-xs text-foreground-500">
                    Nenhuma função cadastrada nos colaboradores.
                  </p>
                )}
              </div>
            </div>
          )}
        </BuilderSection>

        <BuilderSection
          step={4}
          title="Anonimato das respostas"
          description="Esta escolha define o que a gestão consegue ver."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAnonymous(true)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                anonymous
                  ? "border-primary-400 bg-primary-50"
                  : "border-background-300 bg-background-50 hover:bg-background-100"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  anonymous
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                <i className="ri-eye-off-line text-base"></i>
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground-950">
                  Pesquisa anônima
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-foreground-500">
                  Nenhum nome, id ou função é gravado junto às respostas.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAnonymous(false)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                !anonymous
                  ? "border-primary-400 bg-primary-50"
                  : "border-background-300 bg-background-50 hover:bg-background-100"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  !anonymous
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                <i className="ri-user-follow-line text-base"></i>
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground-950">
                  Pesquisa identificada
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-foreground-500">
                  A gestão vê quem respondeu e a data do envio.
                </span>
              </span>
            </button>
          </div>

          <div
            className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[11px] leading-relaxed ${
              anonymous
                ? "border-primary-200 bg-primary-50 text-primary-800"
                : "border-secondary-200 bg-secondary-50 text-secondary-900"
            }`}
          >
            <i className={anonymous ? "ri-shield-check-line mt-0.5" : "ri-information-line mt-0.5"}></i>
            <span>
              {anonymous
                ? "Anonimato garantido: as respostas são gravadas sem qualquer vínculo com o colaborador, inclusive para a gestão."
                : "As respostas ficam vinculadas ao colaborador. Cada pessoa pode responder uma única vez."}
            </span>
          </div>
        </BuilderSection>

        <BuilderSection
          step={5}
          title={`Perguntas (${questions.length})`}
          description="Cada pergunta aceita no máximo 5 opções de resposta."
        >
          {questions.map((question, index) => {
            const isChoice = question.type === "unica" || question.type === "multipla";
            return (
              <div
                key={question.key}
                className="rounded-lg border border-background-200 bg-background-100 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground-500">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary-200 text-secondary-900">
                      {index + 1}
                    </span>
                    Pergunta
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover pergunta para cima"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900 disabled:opacity-40"
                    >
                      <i className="ri-arrow-up-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === questions.length - 1}
                      aria-label="Mover pergunta para baixo"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900 disabled:opacity-40"
                    >
                      <i className="ri-arrow-down-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(question.key)}
                      disabled={questions.length === 1}
                      aria-label="Remover pergunta"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-accent-700 transition-colors hover:bg-accent-100 disabled:opacity-40"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-col gap-2.5">
                  <input
                    value={question.text}
                    onChange={(event) =>
                      updateQuestion(question.key, { text: event.target.value })
                    }
                    maxLength={200}
                    placeholder="Escreva o enunciado da pergunta"
                    className={inputClass}
                  />

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <select
                        value={question.type}
                        onChange={(event) => {
                          const type = event.target.value as SurveyQuestionType;
                          updateQuestion(question.key, {
                            type,
                            options:
                              type === "unica" || type === "multipla"
                                ? question.options.length
                                  ? question.options
                                  : ["", ""]
                                : [],
                          });
                        }}
                        className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                      >
                        {Object.entries(surveyQuestionTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                    </div>

                    <label className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-medium text-foreground-700">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestion(question.key, { required: event.target.checked })
                        }
                        className="h-4 w-4 accent-primary-600"
                      />
                      Obrigatória
                    </label>
                  </div>

                  {isChoice && (
                    <div className="flex flex-col gap-2">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background-200 text-[11px] font-bold text-foreground-600">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <input
                            value={option}
                            onChange={(event) =>
                              updateOption(question.key, optionIndex, event.target.value)
                            }
                            maxLength={120}
                            placeholder={`Opção ${optionIndex + 1}`}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(question.key, optionIndex)}
                            disabled={question.options.length <= 1}
                            aria-label="Remover opção"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-200 hover:text-foreground-900 disabled:opacity-40"
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addOption(question.key)}
                          disabled={question.options.length >= 5}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <i className="ri-add-line"></i>
                          Adicionar opção
                        </button>
                        <span
                          className={`text-[11px] font-medium ${
                            question.options.length >= 5
                              ? "text-accent-700"
                              : "text-foreground-400"
                          }`}
                        >
                          {question.options.length} de 5 opções
                        </span>
                      </div>
                    </div>
                  )}

                  {question.type === "escala" && (
                    <p className="rounded-md bg-background-200 px-3 py-2 text-[11px] text-foreground-600">
                      A escala vai de 1 a 5 e não precisa de opções cadastradas.
                    </p>
                  )}

                  {question.type === "texto" && (
                    <p className="rounded-md bg-background-200 px-3 py-2 text-[11px] text-foreground-600">
                      Resposta livre, limitada a 500 caracteres.
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setQuestions((current) => [...current, newQuestion()])}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-dashed border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-add-circle-line text-base"></i>
            Adicionar pergunta
          </button>
        </BuilderSection>
      </div>
    </Modal>
  );
}