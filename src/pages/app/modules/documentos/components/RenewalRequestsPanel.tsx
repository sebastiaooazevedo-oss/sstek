import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppSession } from "@/pages/app/context";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import RenewalRequestRow from "@/pages/app/modules/documentos/components/RenewalRequestRow";
import {
  isDelegatedTo,
  isOwnedBy,
  reloadRenewalRequests,
  renewalDueSoonInfo,
  renewalExpiryTs,
  renewalIdleInfo,
  renewalSlaInfo,
  useRenewalSync,
  type RenewalRequest,
} from "@/pages/app/modules/documentos/renewalStore";

interface RenewalRequestsPanelProps {
  requests: RenewalRequest[];
  onOpen: (request: RenewalRequest) => void;
  onOpenReport: () => void;
  /** Abre a escolha de documento para uma nova solicitação antecipada. */
  onCreateNew: () => void;
}

type PanelTab = "andamento" | "concluidas";
type OwnerFilter = "todas" | "minhas" | "delegadas";
type AttentionFilter = "todas" | "paradas" | "atrasadas" | "vencendo";
/** Janela de vencimento do documento (vencendo por período). */
type ExpiryWindow = "todos" | "7" | "30" | "60" | "90" | "custom";

const ownerFilters: { id: OwnerFilter; label: string; icon: string }[] = [
  { id: "todas", label: "Todas", icon: "ri-list-check-3" },
  { id: "minhas", label: "Minhas tratativas", icon: "ri-user-star-line" },
  { id: "delegadas", label: "Delegadas a mim", icon: "ri-git-branch-line" },
];

const expiryWindows: { id: ExpiryWindow; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "60", label: "60 dias" },
  { id: "90", label: "90 dias" },
  { id: "custom", label: "Período" },
];

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Painel das solicitações de renovação.
 *
 * Documento de segurança não renova por edição de data: ele entra aqui como
 * uma tratativa com número próprio, responsável obrigatório, prazo (SLA) por
 * tipo de documento, tarefas e anexos até a conclusão. A fila fica no banco,
 * então a equipe acompanha a mesma visão de qualquer dispositivo.
 */
export default function RenewalRequestsPanel({
  requests,
  onOpen,
  onOpenReport,
  onCreateNew,
}: RenewalRequestsPanelProps) {
  const [tab, setTab] = useState<PanelTab>("andamento");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("todas");
  const [searchParams, setSearchParams] = useSearchParams();
  // Atalhos de urgência: abertos pelo chip ou por um link do sino
  // (?renovacao=paradas / ?renovacao=atrasadas / ?renovacao=vencendo).
  const [attention, setAttention] = useState<AttentionFilter>(() => {
    const value = searchParams.get("renovacao");
    return value === "paradas" || value === "atrasadas" || value === "vencendo" ? value : "todas";
  });
  const [search, setSearch] = useState("");
  const [expiryWindow, setExpiryWindow] = useState<ExpiryWindow>("todos");
  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const sync = useRenewalSync();
  const session = useAppSession();
  const me = session.name;
  const settings = useSystemSettings();
  const idleAlertDays = Math.max(1, Math.round(settings.documentRenewalIdleDays));
  // Antecedência do aviso de prazo próximo ao responsável da tratativa
  // (0 = aviso antecipado desligado). O gestor tem uma janela própria no sino.
  const warningDays = Math.max(0, Math.round(settings.documentRenewalSlaWarningDays));

  const open = useMemo(
    () =>
      requests
        .filter((request) => request.status !== "concluida")
        .sort((a, b) => {
          const lateA = renewalSlaInfo(a)?.late ? 0 : 1;
          const lateB = renewalSlaInfo(b)?.late ? 0 : 1;
          if (lateA !== lateB) return lateA - lateB;
          if (a.status !== b.status) return a.status === "aberta" ? -1 : 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [requests]
  );
  const done = useMemo(
    () =>
      requests
        .filter((request) => request.status === "concluida")
        .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")),
    [requests]
  );

  // O endereço manda: chegar pelo sino com ?renovacao=paradas já abre a fila
  // filtrada, sem precisar clicar em nada.
  useEffect(() => {
    const value = searchParams.get("renovacao");
    if (value === "paradas" || value === "atrasadas" || value === "vencendo") {
      setAttention(value);
      setTab("andamento");
    } else if (!value) {
      setAttention("todas");
    }
  }, [searchParams]);

  const changeAttention = (next: AttentionFilter) => {
    setAttention(next);
    if (next !== "todas") setTab("andamento");
    const params = new URLSearchParams(searchParams);
    if (next === "todas") params.delete("renovacao");
    else params.set("renovacao", next);
    setSearchParams(params, { replace: true });
  };

  // Limite da janela de vencimento escolhida (documento, não SLA da tratativa).
  const expiryRange = useMemo(() => {
    if (expiryWindow === "todos") return null;
    if (expiryWindow === "custom") {
      const from = expiryFrom ? new Date(`${expiryFrom}T00:00:00`).getTime() : null;
      const to = expiryTo ? new Date(`${expiryTo}T00:00:00`).getTime() : null;
      if (from === null && to === null) return null;
      return { from, to };
    }
    const days = Math.max(1, Number(expiryWindow));
    return { from: startOfToday(), to: startOfToday() + days * 86400000 };
  }, [expiryWindow, expiryFrom, expiryTo]);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = search.replace(/\D/g, "");

    let source = tab === "andamento" ? open : done;
    if (tab === "andamento" && attention === "paradas") {
      source = source.filter((request) => renewalIdleInfo(request, idleAlertDays)?.idle);
    }
    if (tab === "andamento" && attention === "atrasadas") {
      source = source.filter((request) => renewalSlaInfo(request)?.late);
    }
    if (tab === "andamento" && attention === "vencendo") {
      source = source.filter((request) => renewalDueSoonInfo(request, warningDays)?.dueSoon);
    }
    if (ownerFilter === "minhas") source = source.filter((request) => isOwnedBy(request, me));
    if (ownerFilter === "delegadas") {
      source = source.filter((request) => isDelegatedTo(request, me));
    }

    if (term) {
      source = source.filter((request) => {
        const haystack = [
          request.code,
          request.documentName,
          request.documentTypeName,
          request.collaboratorName,
          request.collaboratorCpf,
          request.unit,
          request.ownerName,
        ];
        const matchText = haystack.some((value) => (value || "").toLowerCase().includes(term));
        const matchCpf =
          digits.length >= 3 && (request.collaboratorCpf || "").replace(/\D/g, "").includes(digits);
        return matchText || matchCpf;
      });
    }

    if (expiryRange) {
      source = source.filter((request) => {
        const due = renewalExpiryTs(request);
        if (due === null) return false;
        if (expiryRange.from !== null && due < expiryRange.from) return false;
        if (expiryRange.to !== null && due > expiryRange.to) return false;
        return true;
      });
    }

    return source;
  }, [
    tab,
    ownerFilter,
    attention,
    idleAlertDays,
    warningDays,
    open,
    done,
    me,
    search,
    expiryRange,
  ]);

  const filterCounts = useMemo(
    () => ({
      todas: open.length,
      minhas: open.filter((request) => isOwnedBy(request, me)).length,
      delegadas: open.filter((request) => isDelegatedTo(request, me)).length,
    }),
    [open, me]
  );
  const awaiting = open.filter((request) => request.status === "aguardando-exames").length;
  const withoutOwner = open.filter((request) => !request.ownerName).length;
  const overdue = open.filter((request) => renewalSlaInfo(request)?.late).length;
  const dueSoon =
    warningDays > 0
      ? open.filter((request) => renewalDueSoonInfo(request, warningDays)?.dueSoon).length
      : 0;
  const stalled = open.filter((request) => renewalIdleInfo(request, idleAlertDays)?.idle).length;
  const hasListFilter = Boolean(search.trim()) || Boolean(expiryRange);

  const kpis: { label: string; value: number; icon: string; tone: string; hint: string }[] = [
    {
      label: "Em andamento",
      value: open.length,
      icon: "ri-folder-open-line",
      tone: "bg-secondary-100 text-secondary-800",
      hint: "Tratativas abertas ou em execução",
    },
    {
      label: "Vencendo",
      value: dueSoon,
      icon: "ri-time-line",
      tone: "bg-accent-100 text-accent-900",
      hint: warningDays > 0 ? `Prazo vencendo em até ${warningDays} dia(s)` : "Aviso antecipado desligado",
    },
    {
      label: "SLA estourado",
      value: overdue,
      icon: "ri-alarm-warning-line",
      tone: "bg-danger-100 text-danger-800",
      hint: "Passaram do prazo parametrizado",
    },
    {
      label: "Concluídas",
      value: done.length,
      icon: "ri-checkbox-circle-line",
      tone: "bg-primary-100 text-primary-800",
      hint: "Renovações encerradas com registro",
    },
  ];

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-sm">
      <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500"></div>

      <div className="flex flex-col gap-4 border-b border-background-200 px-4 py-4 md:px-5 md:py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-background-50 shadow-sm shadow-primary-600/25">
            <i className="ri-loop-right-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-heading text-lg font-bold leading-tight tracking-tight text-foreground-950">
                Solicitações de renovação
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-900">
                <i className="ri-database-2-line text-[11px]"></i>
                Fila sincronizada
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-600">
              Cada solicitação tem número próprio (RS-ano-sequência), responsável, prazo e tarefas até o
              documento novo ser anexado. A equipe inteira acompanha a mesma fila.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCreateNew}
              title="Abrir solicitação de renovação para um documento que ainda não venceu"
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-600 px-4 text-sm font-semibold text-background-50 shadow-sm shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-md hover:shadow-primary-600/30 active:translate-y-px"
            >
              <i className="ri-add-line text-base"></i>
              Nova Solicitação
            </button>
            <button
              type="button"
              onClick={onOpenReport}
              title="Relatório de renovações por unidade e tempo médio de conclusão"
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3.5 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
            >
              <i className="ri-bar-chart-box-line text-base"></i>
              Relatório
            </button>
          </div>

          <div className="inline-flex w-full items-center gap-1 rounded-lg border border-background-200 bg-background-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setTab("andamento")}
              aria-pressed={tab === "andamento"}
              className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none ${
                tab === "andamento"
                  ? "bg-background-50 text-foreground-950 shadow-sm"
                  : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              <i className="ri-folder-open-line text-sm"></i>
              Em andamento
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === "andamento"
                    ? "bg-primary-100 text-primary-800"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                {open.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("concluidas");
                if (attention !== "todas") changeAttention("todas");
              }}
              aria-pressed={tab === "concluidas"}
              className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all sm:flex-none ${
                tab === "concluidas"
                  ? "bg-background-50 text-foreground-950 shadow-sm"
                  : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              <i className="ri-checkbox-circle-line text-sm"></i>
              Concluídas
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === "concluidas"
                    ? "bg-primary-100 text-primary-800"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                {done.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Indicadores: também funcionam como atalhos da fila */}
      <div className="grid grid-cols-2 gap-2.5 border-b border-background-200 bg-background-100/40 px-4 py-3.5 md:grid-cols-4 md:px-5">
        {kpis.map((kpi) => {
          const active =
            (kpi.label === "Vencendo" && attention === "vencendo") ||
            (kpi.label === "SLA estourado" && attention === "atrasadas") ||
            (kpi.label === "Concluídas" && tab === "concluidas") ||
            (kpi.label === "Em andamento" && tab === "andamento" && attention === "todas");
          const bar =
            kpi.label === "SLA estourado"
              ? "bg-danger-500"
              : kpi.label === "Vencendo"
                ? "bg-accent-500"
                : kpi.label === "Concluídas"
                  ? "bg-primary-500"
                  : "bg-secondary-500";
          return (
            <button
              key={kpi.label}
              type="button"
              title={kpi.hint}
              onClick={() => {
                if (kpi.label === "Concluídas") {
                  setTab("concluidas");
                  if (attention !== "todas") changeAttention("todas");
                  return;
                }
                setTab("andamento");
                if (kpi.label === "Vencendo") changeAttention(attention === "vencendo" ? "todas" : "vencendo");
                else if (kpi.label === "SLA estourado") {
                  changeAttention(attention === "atrasadas" ? "todas" : "atrasadas");
                } else changeAttention("todas");
              }}
              className={`group relative cursor-pointer overflow-hidden rounded-lg border py-2.5 pl-3.5 pr-3 text-left transition-all ${
                active
                  ? "border-primary-300 bg-background-50 shadow-sm ring-1 ring-primary-200"
                  : "border-background-200 bg-background-50 hover:-translate-y-px hover:border-primary-200 hover:shadow-sm"
              }`}
            >
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${bar}`}></span>
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${kpi.tone}`}>
                  <i className={`${kpi.icon} text-sm`}></i>
                </span>
                <span className="font-heading text-2xl font-extrabold leading-none tracking-tight text-foreground-950">
                  {kpi.value}
                </span>
              </div>
              <span className="mt-2 block truncate text-[11px] font-bold uppercase tracking-wide text-foreground-600">
                {kpi.label}
              </span>
              <span className="mt-0.5 block truncate text-[10px] leading-snug text-foreground-400">{kpi.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 border-b border-background-200 bg-background-50 px-4 py-2.5 md:px-5">
        <div className="flex flex-wrap items-center gap-1">
          {ownerFilters.map((filter) => {
            const active = ownerFilter === filter.id;
            const count = filterCounts[filter.id];
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setOwnerFilter(filter.id)}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-primary-300 bg-primary-100 text-primary-800"
                    : "border-background-200 bg-background-50 text-foreground-600 hover:border-background-300 hover:bg-background-100"
                }`}
              >
                <i className={`${filter.icon} text-xs`}></i>
                {filter.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-primary-200 text-primary-900" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {tab === "andamento" && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-background-200/70 pt-2">
            <span className="pr-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Urgência
            </span>
            <button
              type="button"
              onClick={() => changeAttention(attention === "paradas" ? "todas" : "paradas")}
              aria-pressed={attention === "paradas"}
              disabled={stalled === 0 && attention !== "paradas"}
              title={`Tratativas sem movimentação há ${idleAlertDays} dia(s) ou mais`}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                attention === "paradas"
                  ? "border-accent-400 bg-accent-100 text-accent-900"
                  : "border-background-200 bg-background-50 text-foreground-600 hover:border-accent-300 hover:bg-accent-50"
              }`}
            >
              <i className="ri-pause-circle-line text-xs"></i>
              Paradas
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  attention === "paradas" ? "bg-accent-200 text-accent-900" : "bg-background-200 text-foreground-600"
                }`}
              >
                {stalled}
              </span>
            </button>
            <button
              type="button"
              onClick={() => changeAttention(attention === "vencendo" ? "todas" : "vencendo")}
              aria-pressed={attention === "vencendo"}
              disabled={dueSoon === 0 && attention !== "vencendo"}
              title={
                warningDays > 0
                  ? `Tratativas com prazo vencendo em até ${warningDays} dia(s)`
                  : "Aviso antecipado desligado na parametrização"
              }
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                attention === "vencendo"
                  ? "border-accent-400 bg-accent-100 text-accent-900"
                  : "border-background-200 bg-background-50 text-foreground-600 hover:border-accent-300 hover:bg-accent-50"
              }`}
            >
              <i className="ri-time-line text-xs"></i>
              Vencendo
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  attention === "vencendo" ? "bg-accent-200 text-accent-900" : "bg-background-200 text-foreground-600"
                }`}
              >
                {dueSoon}
              </span>
            </button>
            <button
              type="button"
              onClick={() => changeAttention(attention === "atrasadas" ? "todas" : "atrasadas")}
              aria-pressed={attention === "atrasadas"}
              disabled={overdue === 0 && attention !== "atrasadas"}
              title="Tratativas que passaram do prazo (SLA) parametrizado"
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                attention === "atrasadas"
                  ? "border-danger-400 bg-danger-100 text-danger-800"
                  : "border-background-200 bg-background-50 text-foreground-600 hover:border-danger-300 hover:bg-danger-50"
              }`}
            >
              <i className="ri-alarm-warning-line text-xs"></i>
              SLA estourado
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  attention === "atrasadas" ? "bg-danger-200 text-danger-900" : "bg-background-200 text-foreground-600"
                }`}
              >
                {overdue}
              </span>
            </button>
            {attention !== "todas" && (
              <button
                type="button"
                onClick={() => changeAttention("todas")}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-800"
              >
                <i className="ri-close-line text-xs"></i>
                Limpar atalho
              </button>
            )}
            {withoutOwner > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-800">
                <i className="ri-user-unfollow-line"></i>
                {withoutOwner} sem responsável
              </span>
            )}
            {awaiting > 0 && (
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900 ${
                  withoutOwner > 0 ? "" : "ml-auto"
                }`}
              >
                <i className="ri-flask-line"></i>
                {awaiting} aguardando exames
              </span>
            )}
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-foreground-500">
          {attention === "paradas"
            ? `Mostrando só as tratativas sem movimentação há ${idleAlertDays} dia(s) ou mais.`
            : attention === "atrasadas"
              ? "Mostrando só as tratativas que passaram do prazo (SLA)."
              : attention === "vencendo"
                ? warningDays > 0
                  ? `Mostrando só as tratativas com prazo vencendo em até ${warningDays} dia(s) — janela do responsável pela tratativa.`
                  : "Aviso antecipado de prazo ao responsável está desligado na parametrização."
                : ownerFilter === "minhas"
                  ? "Tratativas em que você é o responsável atual."
                  : ownerFilter === "delegadas"
                    ? "Tratativas que outra pessoa delegou para você conduzir."
                    : `Sem movimentação há ${idleAlertDays} dia(s) a tratativa aparece como parada.`}
        </p>
      </div>

      {/* Busca por número, CPF, tipo de documento + vencimento por período */}
      <div className="flex flex-col gap-2.5 border-b border-background-200 bg-background-100/40 px-4 py-3 md:px-5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center rounded-lg border border-background-300 bg-background-50 pl-1 pr-2 transition-colors focus-within:border-primary-400 xl:w-[420px]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por número (RS-2026-0001), CPF, colaborador, tipo de documento..."
              className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
              aria-label="Buscar solicitações por número, CPF, colaborador ou tipo de documento"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-foreground-700"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 pr-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              <i className="ri-calendar-event-line text-xs"></i>
              Vencimento do documento
            </span>
            {expiryWindows.map((option) => {
              const active = expiryWindow === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setExpiryWindow(option.id)}
                  aria-pressed={active}
                  className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? "border-secondary-300 bg-secondary-100 text-secondary-900"
                      : "border-background-200 bg-background-50 text-foreground-600 hover:border-secondary-200 hover:bg-secondary-50"
                  }`}
                >
                  {option.id === "custom" && <i className="ri-calendar-2-line text-xs"></i>}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {expiryWindow === "custom" && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-background-200 bg-background-50 px-2.5 py-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold text-foreground-500">De</span>
              <input
                type="date"
                value={expiryFrom}
                onChange={(event) => setExpiryFrom(event.target.value)}
                className="w-full rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold text-foreground-500">Até</span>
              <input
                type="date"
                value={expiryTo}
                onChange={(event) => setExpiryTo(event.target.value)}
                className="w-full rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setExpiryFrom("");
                setExpiryTo("");
                setExpiryWindow("todos");
              }}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[10px] font-semibold text-foreground-600 transition-colors hover:bg-background-100 hover:text-foreground-900"
            >
              <i className="ri-close-line"></i>
              Limpar período
            </button>
          </div>
        )}

        {hasListFilter && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-50 px-2 py-1 text-[10px] font-semibold text-foreground-600 ring-1 ring-inset ring-background-200">
              <i className="ri-filter-3-line"></i>
              {list.length} de {(tab === "andamento" ? open : done).length} solicitação(ões)
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setExpiryWindow("todos");
                setExpiryFrom("");
                setExpiryTo("");
              }}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold text-primary-700 transition-colors hover:bg-primary-50"
            >
              <i className="ri-refresh-line"></i>
              Limpar busca e período
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-6 py-9 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-background-100 text-foreground-500">
            <i className={tab === "andamento" ? "ri-inbox-line" : "ri-checkbox-circle-line"}></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">
            {hasListFilter
              ? "Nenhuma solicitação com esses filtros"
              : attention === "paradas"
                ? "Nenhuma tratativa parada"
                : attention === "atrasadas"
                  ? "Nenhuma tratativa com SLA estourado"
                  : attention === "vencendo"
                    ? "Nenhuma tratativa com prazo próximo"
                    : ownerFilter === "minhas"
                      ? "Nenhuma tratativa sua nesta aba"
                      : ownerFilter === "delegadas"
                        ? "Nenhuma tratativa delegada a você"
                        : tab === "andamento"
                          ? "Nenhuma solicitação em andamento"
                          : "Nenhuma renovação concluída"}
          </p>
          <p className="max-w-md text-xs leading-relaxed text-foreground-500">
            {hasListFilter
              ? "Ajuste o número, o CPF, o tipo de documento ou a janela de vencimento para encontrar a solicitação."
              : attention === "paradas"
                ? `Todas as tratativas em andamento tiveram movimentação nos últimos ${idleAlertDays} dia(s).`
                : attention === "atrasadas"
                  ? "Todas as tratativas em andamento estão dentro do prazo (SLA) parametrizado."
                  : attention === "vencendo"
                    ? warningDays > 0
                      ? `Nenhuma tratativa está dentro da janela de ${warningDays} dia(s) antes do vencimento do prazo do responsável.`
                      : "Defina a antecedência do aviso em Configurações → Prazo (SLA) de renovação de documentos."
                    : ownerFilter !== "todas"
                      ? "Troque o filtro para \"Todas\" ou assuma uma solicitação sem responsável na fila completa."
                      : tab === "andamento"
                        ? "Todo documento vencido abre uma solicitação automaticamente. Use \"Nova Solicitação\" para antecipar a renovação de um documento que ainda vai vencer."
                        : "Ao concluir uma solicitação, ela fica registrada aqui com número, data, responsável e anexos — sem possibilidade de edição posterior."}
          </p>
          {!hasListFilter && tab === "andamento" && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-1 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-add-line"></i>
              Nova Solicitação
            </button>
          )}
        </div>
      ) : (
        <ul className="max-h-[440px] divide-y divide-background-200 overflow-y-auto">
          {list.map((request) => (
            <RenewalRequestRow
              key={request.id}
              request={request}
              idleAlertDays={idleAlertDays}
              warningDays={warningDays}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-background-200 bg-background-100 px-4 py-2.5 text-[10px] text-foreground-500 md:px-5">
        {sync.error ? (
          <>
            <i className="ri-error-warning-line text-sm text-danger-700"></i>
            <span className="min-w-0 flex-1 text-danger-700">{sync.error}</span>
            <button
              type="button"
              onClick={() => void reloadRenewalRequests()}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-refresh-line"></i>
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <i className={sync.pending > 0 ? "ri-cloud-line" : "ri-cloud-off-line"}></i>
            <span>
              {sync.loading
                ? "Carregando a fila do banco..."
                : sync.pending > 0
                  ? `Salvando ${sync.pending} alteração(ões)...`
                  : "Sincronizado com o banco · a equipe acompanha de qualquer dispositivo"}
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <i className="ri-lock-2-line"></i>
              Tarefas e conclusão são definitivas: cada etapa registra dia e hora.
            </span>
          </>
        )}
      </div>
    </section>
  );
}