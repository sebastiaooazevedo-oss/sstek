import { useMemo } from "react";
import { useActions, useAtas, useCipas, useElections, useInspections, useMeetings } from "@/pages/app/modules/cipa/cipaStore";
import { actionStatusClass, brDateToTime, electionStatusClass, meetingStatusClass, priorityClass } from "@/pages/app/modules/cipa/cipaUtils";

interface OverviewTabProps {
  cipaId: string;
  onGoTab: (tab: string) => void;
}

interface Kpi {
  label: string;
  value: string;
  icon: string;
  tone: string;
}

export default function OverviewTab({ cipaId, onGoTab }: OverviewTabProps) {
  const cipas = useCipas();
  const meetings = useMeetings();
  const actions = useActions();
  const atas = useAtas();
  const elections = useElections();
  const inspections = useInspections();

  const scoped = <T extends { cipaId: string }>(items: T[]) => (cipaId ? items.filter((i) => i.cipaId === cipaId) : items);

  const filteredCipas = cipaId ? cipas.filter((c) => c.id === cipaId) : cipas;
  const filteredMeetings = scoped(meetings);
  const filteredActions = scoped(actions);
  const filteredAtas = scoped(atas);
  const filteredElections = scoped(elections);
  const filteredInspections = scoped(inspections);

  const totalMembers = filteredCipas.reduce((sum, c) => sum + c.members.length, 0);
  const openActions = filteredActions.filter((a) => a.status !== "Concluída");
  const upcoming = filteredMeetings
    .filter((m) => m.status === "Agendada")
    .sort((a, b) => brDateToTime(a.date) - brDateToTime(b.date))
    .slice(0, 4);

  const kpis: Kpi[] = [
    { label: "CIPAs cadastradas", value: String(filteredCipas.length), icon: "ri-government-line", tone: "bg-primary-100 text-primary-700" },
    { label: "Membros em mandato", value: String(totalMembers), icon: "ri-group-line", tone: "bg-secondary-100 text-secondary-800" },
    { label: "Compromissos agendados", value: String(upcoming.length), icon: "ri-calendar-event-line", tone: "bg-accent-100 text-accent-800" },
    { label: "Ações em aberto", value: String(openActions.length), icon: "ri-task-line", tone: "bg-primary-100 text-primary-700" },
    { label: "Eleições em andamento", value: String(filteredElections.filter((e) => e.status === "Em votação" || e.status === "Inscrições").length), icon: "ri-checkbox-multiple-line", tone: "bg-accent-100 text-accent-800" },
  ];

  const recentAtas = useMemo(() => [...filteredAtas].sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date)).slice(0, 3), [filteredAtas]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-background-200 bg-background-50 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.tone}`}>
              <i className={`${k.icon} text-lg`}></i>
            </span>
            <p className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{k.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Próximos compromissos */}
        <section className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-foreground-950">
              <i className="ri-calendar-schedule-line text-primary-700"></i>
              Próximos compromissos
            </h3>
            <button type="button" onClick={() => onGoTab("agenda")} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
              Ver agenda
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {upcoming.length === 0 && <p className="text-sm text-foreground-500">Nenhum compromisso agendado.</p>}
            {upcoming.map((m) => {
              const cipa = cipas.find((c) => c.id === m.cipaId);
              return (
                <div key={m.id} className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-100/50 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                    <i className="ri-calendar-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">{m.title}</p>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      {m.date} {m.time && `às ${m.time}`} · {cipa?.name || "—"}
                    </p>
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${meetingStatusClass(m.status)}`}>{m.status}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ações em aberto */}
        <section className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-foreground-950">
              <i className="ri-task-line text-primary-700"></i>
              Plano de ação em aberto
            </h3>
            <button type="button" onClick={() => onGoTab("acoes")} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
              Ver ações
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {openActions.length === 0 && <p className="text-sm text-foreground-500">Nenhuma ação em aberto.</p>}
            {openActions.slice(0, 4).map((a) => (
              <div key={a.id} className="rounded-lg border border-background-200 bg-background-100/50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground-950">{a.title}</p>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityClass(a.priority)}`}>{a.priority}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground-500">
                  <span className="flex items-center gap-1">
                    <i className="ri-user-line"></i>
                    {a.responsible || "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line"></i>
                    {a.dueDate || "sem prazo"}
                  </span>
                  <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionStatusClass(a.status)}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Últimas atas */}
        <section className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-foreground-950">
              <i className="ri-file-text-line text-primary-700"></i>
              Últimas atas
            </h3>
            <button type="button" onClick={() => onGoTab("atas")} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
              Ver atas
            </button>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-background-100">
            {recentAtas.length === 0 && <p className="py-2 text-sm text-foreground-500">Nenhuma ata registrada.</p>}
            {recentAtas.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                  <i className="ri-file-text-line"></i>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground-950">{a.title}</p>
                  <p className="mt-0.5 text-xs text-foreground-500">
                    {a.date} · {a.number || "sem número"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Inspeções recentes */}
        <section className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-foreground-950">
              <i className="ri-clipboard-line text-primary-700"></i>
              Inspeções recentes
            </h3>
            <button type="button" onClick={() => onGoTab("inspecoes")} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
              Ver inspeções
            </button>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-background-100">
            {filteredInspections.length === 0 && <p className="py-2 text-sm text-foreground-500">Nenhuma inspeção registrada.</p>}
            {filteredInspections.slice(0, 3).map((i) => (
              <div key={i.id} className="flex items-start gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                  <i className="ri-clipboard-line"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{i.title}</p>
                  <p className="mt-0.5 text-xs text-foreground-500">
                    {i.date} · {i.area || "—"} · {i.photos.length} foto(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Eleições */}
      {filteredElections.length > 0 && (
        <section className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-base font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-primary-700"></i>
              Processos eleitorais
            </h3>
            <button type="button" onClick={() => onGoTab("eleicoes")} className="text-xs font-semibold text-primary-700 hover:text-primary-800">
              Ver eleições
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredElections.map((e) => {
              const cipa = cipas.find((c) => c.id === e.cipaId);
              return (
                <div key={e.id} className="rounded-lg border border-background-200 bg-background-100/50 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground-950">{e.title}</p>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${electionStatusClass(e.status)}`}>{e.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground-500">
                    {cipa?.name || "—"} · votação em {e.voteDate || "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}