import { useMemo, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { collaborators as seedCollaborators } from "@/mocks/collaborators";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { KpiCard, SectionCard } from "@/pages/app/components/ui";
import ExportMenu from "@/pages/app/components/ExportMenu";
import {
  closeSurveyNow,
  createSurvey,
  nextSurveyRef,
  openSurveysFor,
  responsesForSurvey,
  submitSurveyResponse,
  useSurveyResponses,
  useSurveys,
  type CreateSurveyInput,
} from "@/pages/app/modules/pesquisas/surveyStore";
import {
  formatSurveyDateTime,
  surveyAudienceLabel,
  surveyStatus,
  surveyStatusMeta,
  type Survey,
  type SurveyAnswer,
  type SurveyStatus,
} from "@/pages/app/modules/pesquisas/surveyTypes";
import SurveyBuilderModal from "@/pages/app/modules/pesquisas/components/SurveyBuilderModal";
import SurveyDetailModal from "@/pages/app/modules/pesquisas/components/SurveyDetailModal";
import SurveyRespondModal from "@/pages/app/modules/pesquisas/components/SurveyRespondModal";
import SurveyCompareModal from "@/pages/app/modules/pesquisas/components/SurveyCompareModal";
import {
  daysUntilEnd,
  isReminderDue,
  reminderOptions,
  setSurveyReminderDays,
  useSurveyReminderDays,
} from "@/pages/app/modules/pesquisas/surveyReminders";
import {
  exportSurveyCsv,
  exportSurveyPdf,
} from "@/pages/app/modules/pesquisas/surveyExport";
import { adherenceForSurvey } from "@/pages/app/modules/pesquisas/surveyAnalysis";

type StatusFilter = "todas" | SurveyStatus;
type TypeFilter = "todas" | "anonima" | "identificada";

const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "vigente", label: "Vigentes" },
  { id: "agendada", label: "Agendadas" },
  { id: "encerrada", label: "Encerradas" },
];

export default function PesquisasPage() {
  const session = useAppSession();
  const surveys = useSurveys();
  const responses = useSurveyResponses();
  const collaboratorStore = useCollaboratorsList();
  const roster = collaboratorStore.length > 0 ? collaboratorStore : seedCollaborators;
  const me =
    roster.find((person) => person.name === session.name) ||
    seedCollaborators.find((person) => person.name === session.name) ||
    null;
  const isManager = session.role === "admin" || session.role === "super";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todas");
  const [notice, setNotice] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [template, setTemplate] = useState<Survey | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detail, setDetail] = useState<Survey | null>(null);
  const [responding, setResponding] = useState<Survey | null>(null);
  const reminderDays = useSurveyReminderDays();

  const functions = useMemo(
    () =>
      Array.from(new Set(roster.map((person) => person.role).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [roster]
  );

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      todas: surveys.length,
      vigente: 0,
      agendada: 0,
      encerrada: 0,
    };
    surveys.forEach((survey) => {
      base[surveyStatus(survey)] += 1;
    });
    return base;
  }, [surveys]);

  const totalResponses = responses.length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return surveys.filter((survey) => {
      const status = surveyStatus(survey);
      if (statusFilter !== "todas" && status !== statusFilter) return false;
      if (typeFilter === "anonima" && !survey.anonymous) return false;
      if (typeFilter === "identificada" && survey.anonymous) return false;
      if (!term) return true;
      return (
        survey.title.toLowerCase().includes(term) ||
        survey.description.toLowerCase().includes(term) ||
        survey.id.toLowerCase().includes(term)
      );
    });
  }, [surveys, search, statusFilter, typeFilter]);

  const handlePublish = async (input: CreateSurveyInput) => {
    const ref = await createSurvey({ ...input, createdBy: session.name });
    setBuilderOpen(false);
    setTemplate(null);
    setNotice(`Pesquisa ${ref} publicada com sucesso. O ID foi gerado automaticamente.`);
  };

  const openBuilder = (model: Survey | null = null) => {
    setTemplate(model);
    setBuilderOpen(true);
  };

  const handleCloseSurvey = async (surveyId: string) => {
    await closeSurveyNow(surveyId);
    setNotice(`Pesquisa ${surveyId} encerrada. Todo o histórico foi preservado.`);
  };

  const handleSubmitResponse = async (answers: SurveyAnswer[]) => {
    if (!responding || !me) return;
    await submitSurveyResponse({
      survey: responding,
      answers,
      collaboratorId: me.id,
      collaboratorName: me.name,
      collaboratorRole: me.role,
    });
    const message = responding.anonymous
      ? `Respostas enviadas com anonimato garantido. Obrigado por participar!`
      : `Respostas de "${responding.title}" enviadas com sucesso.`;
    setResponding(null);
    setNotice(message);
  };

  /* --------------------------- Gestão --------------------------- */

  const renderManager = () => (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-survey-line"></i>
            Pesquisas internas
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Pesquisas
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-foreground-600">
            Crie formulários com ID automático, período de vigência, público por função e anonimato
            garantido. Todas as pesquisas publicadas ficam preservadas no histórico.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-line-chart-line text-base"></i>
            Comparar pesquisas
          </button>
          <button
            type="button"
            onClick={() => openBuilder()}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Criar Pesquisa
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          icon="ri-survey-line"
          label="Pesquisas cadastradas"
          value={String(counts.todas)}
          delta="histórico preservado"
          trend="up"
          tone="primary"
        />
        <KpiCard
          icon="ri-play-circle-line"
          label="Vigentes agora"
          value={String(counts.vigente)}
          delta="recebendo respostas"
          trend="up"
          tone="secondary"
        />
        <KpiCard
          icon="ri-calendar-schedule-line"
          label="Agendadas"
          value={String(counts.agendada)}
          delta="aguardando início"
          trend="up"
          tone="secondary"
        />
        <KpiCard
          icon="ri-file-list-3-line"
          label="Respostas recebidas"
          value={String(totalResponses)}
          delta={`${counts.encerrada} encerrada(s)`}
          trend="up"
          tone="accent"
        />
      </div>

      <div className="mt-6 rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título, descrição ou ID..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-80"
            />
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-60"
            >
              <option value="todas">Todos os tipos</option>
              <option value="anonima">Somente anônimas</option>
              <option value="identificada">Somente identificadas</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          {(search || typeFilter !== "todas" || statusFilter !== "todas") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("todas");
                setStatusFilter("todas");
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100 lg:ml-auto"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar filtros
            </button>
          )}
        </div>

        <div className="mt-3 inline-flex flex-wrap gap-1 rounded-full border border-background-200 bg-background-100 p-1">
          {statusFilters.map((item) => {
            const active = statusFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:bg-background-50 hover:text-foreground-900"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-primary-600 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {counts[item.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-background-200 pt-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
            <i className="ri-alarm-warning-line text-base"></i>
          </span>
          <p className="text-xs text-foreground-600">
            <strong className="font-semibold text-foreground-900">Lembrete no sino</strong> para
            quem ainda não respondeu
          </p>
          <div className="relative">
            <select
              value={reminderDays}
              onChange={(event) => setSurveyReminderDays(Number(event.target.value))}
              aria-label="Dias antes do encerramento para lembrar"
              className="appearance-none rounded-md border border-background-300 bg-background-50 py-1.5 pl-2.5 pr-8 text-xs font-semibold text-foreground-900 outline-none focus:border-primary-400"
            >
              {reminderOptions.map((option) => (
                <option key={option} value={option}>
                  {option} dia(s) antes
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
          <span className="text-xs text-foreground-500">do encerramento.</span>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filtered.map((survey) => {
            const status = surveyStatus(survey);
            const meta = surveyStatusMeta[status];
            const surveyResponses = responsesForSurvey(responses, survey.id);
            const responseCount = surveyResponses.length;
            const adherence = survey.anonymous
              ? null
              : adherenceForSurvey(survey, surveyResponses, roster);
            const daysLeft = Math.max(0, daysUntilEnd(survey.endAt));
            const reminderDue = status === "vigente" && isReminderDue(survey, reminderDays);
            return (
              <article
                key={survey.id}
                className="flex flex-col rounded-lg border border-background-200 bg-background-50 p-5 transition-colors hover:border-primary-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-md bg-background-100 px-2 py-1 font-mono text-[11px] font-bold text-foreground-600">
                    {survey.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}
                  >
                    <i className={meta.icon}></i>
                    {meta.label}
                  </span>
                </div>

                <h3 className="mt-2.5 font-heading text-base font-bold leading-snug text-foreground-950">
                  {survey.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground-500">
                  {survey.description || "Sem descrição."}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      survey.anonymous
                        ? "bg-primary-100 text-primary-700"
                        : "bg-secondary-100 text-secondary-900"
                    }`}
                  >
                    <i className={survey.anonymous ? "ri-eye-off-line" : "ri-user-follow-line"}></i>
                    {survey.anonymous ? "Anônima" : "Identificada"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-700">
                    <i className="ri-group-line"></i>
                    {surveyAudienceLabel(survey)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-700">
                    <i className="ri-question-line"></i>
                    {survey.questions.length} pergunta(s)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-700">
                    <i className="ri-file-list-3-line"></i>
                    {responseCount} resposta(s)
                  </span>
                  {adherence && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        adherence.pending.length > 0
                          ? "bg-accent-100 text-accent-900"
                          : "bg-primary-100 text-primary-700"
                      }`}
                    >
                      <i className="ri-user-follow-line"></i>
                      {adherence.percent}% de adesão · {adherence.pending.length} pendente(s)
                    </span>
                  )}
                  {reminderDue && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-semibold text-accent-900">
                      <i className="ri-alarm-warning-line"></i>
                      {daysLeft <= 0 ? "Encerra hoje" : `Encerra em ${daysLeft} dia(s)`}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-foreground-500">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-play-line text-foreground-400"></i>
                    {formatSurveyDateTime(survey.startAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-stop-line text-foreground-400"></i>
                    {formatSurveyDateTime(survey.endAt)}
                  </span>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                  <ExportMenu
                    compact
                    onExportPdf={() =>
                      exportSurveyPdf(survey, responsesForSurvey(responses, survey.id), roster)
                    }
                    onExportCsv={() =>
                      exportSurveyCsv(survey, responsesForSurvey(responses, survey.id), roster)
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openBuilder(survey)}
                      title="Reaproveitar as perguntas desta pesquisa em uma nova"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-file-copy-line text-base"></i>
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetail(survey)}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-eye-line text-base"></i>
                      Ver pesquisa
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-survey-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma pesquisa encontrada</p>
          <p className="text-xs text-foreground-500">
            Ajuste os filtros ou crie uma nova pesquisa para começar.
          </p>
          <button
            type="button"
            onClick={() => openBuilder()}
            className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line"></i>
            Criar Pesquisa
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-foreground-500">
          Mostrando <strong className="font-semibold text-foreground-800">{filtered.length}</strong> de{" "}
          {surveys.length} pesquisa(s) cadastrada(s).
        </p>
      )}
    </>
  );

  /* ------------------------- Colaborador ------------------------- */

  const renderCollaborator = () => {
    if (!me) {
      return (
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-survey-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Pesquisas</p>
          <p className="mt-1 text-xs text-foreground-500">
            Esta área é exibida para usuários com o papel de Colaborador.
          </p>
        </div>
      );
    }

    // Só aparecem aqui as pesquisas disponíveis para responder agora:
    // vigentes, direcionadas à função do colaborador e ainda não respondidas.
    // Agendadas, encerradas e já respondidas ficam apenas no painel de gestão.
    const pending = openSurveysFor(surveys, responses, me, session.subdomain);
    const directed = pending;

    return (
      <>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-survey-line"></i>
            Desenvolvimento
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Pesquisas
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Responda as pesquisas direcionadas à sua função. Nas pesquisas anônimas, nada que
            identifique você é registrado.
          </p>
        </div>

        {notice && (
          <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setNotice("")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        <div
          className={`mt-6 flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center ${
            pending.length > 0 ? "border-accent-300 bg-accent-50" : "border-primary-200 bg-primary-50"
          }`}
        >
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${
              pending.length > 0 ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
            }`}
          >
            <i className={pending.length > 0 ? "ri-survey-line text-2xl" : "ri-checkbox-circle-line text-2xl"}></i>
          </span>
          <div className="min-w-0">
            <p className="font-heading text-lg font-extrabold tracking-tight text-foreground-950">
              {pending.length > 0
                ? `${pending.length} pesquisa(s) aguardando sua resposta`
                : "Você está em dia com as pesquisas"}
            </p>
            <p className="mt-0.5 text-sm text-foreground-600">
              {pending.length > 0
                ? "Abra a pesquisa, responda as perguntas e envie. O anonimato é garantido quando indicado."
                : "Quando a gestão publicar uma pesquisa para o seu perfil, ela aparece aqui."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SectionCard
            title="Pesquisas disponíveis para você"
            subtitle="Somente pesquisas abertas e ainda não respondidas"
            action={
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                <i className="ri-file-list-3-line"></i>
                {directed.length} pesquisa(s)
              </span>
            }
          >
            {directed.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                  <i className="ri-inbox-line text-2xl"></i>
                </span>
                <p className="text-sm font-semibold text-foreground-800">Nenhuma pesquisa disponível</p>
                <p className="text-xs text-foreground-500">
                  Só aparecem aqui pesquisas abertas para a sua função. Ao enviar suas respostas,
                  a pesquisa deixa esta lista automaticamente.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {directed.map((survey) => {
                  const meta = surveyStatusMeta.vigente;
                  return (
                    <li
                      key={survey.id}
                      className="flex flex-col gap-3 rounded-lg border border-accent-200 bg-accent-50 p-4 sm:flex-row sm:items-center"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                        <i className={survey.anonymous ? "ri-eye-off-line text-lg" : "ri-user-follow-line text-lg"}></i>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${meta.chip}`}>
                            {meta.label}
                          </span>
                          <span className="rounded-full bg-background-200 px-2.5 py-0.5 text-[10px] font-semibold text-foreground-700">
                            {survey.anonymous ? "Anônima" : "Identificada"}
                          </span>
                          <span className="font-mono text-[10px] text-foreground-400">{survey.id}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground-950">
                          {survey.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-foreground-500">
                          {survey.questions.length} pergunta(s) · até {formatSurveyDateTime(survey.endAt)}
                        </p>
                        {isReminderDue(survey, 7) && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900">
                            <i className="ri-alarm-warning-line"></i>
                            {daysUntilEnd(survey.endAt) <= 0
                              ? "Último dia para responder"
                              : `Faltam ${daysUntilEnd(survey.endAt)} dia(s) para o encerramento`}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setResponding(survey)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                      >
                        <i className="ri-edit-line"></i>
                        Responder
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </>
    );
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      {isManager ? renderManager() : renderCollaborator()}

      {isManager && (
        <SurveyBuilderModal
          open={builderOpen}
          onClose={() => {
            setBuilderOpen(false);
            setTemplate(null);
          }}
          nextRef={nextSurveyRef(surveys)}
          functions={functions}
          template={template}
          onPublish={handlePublish}
        />
      )}

      {isManager && (
        <SurveyCompareModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          surveys={surveys}
          responses={responses}
        />
      )}

      <SurveyDetailModal
        survey={detail}
        responses={responses}
        roster={roster}
        onClose={() => setDetail(null)}
        onClosed={handleCloseSurvey}
      />

      <SurveyRespondModal
        survey={responding}
        onClose={() => setResponding(null)}
        onSubmit={handleSubmitResponse}
      />
    </div>
  );
}