import { useMemo, useState } from "react";
import { addMeeting, updateMeeting, useCipas, useMeetings } from "@/pages/app/modules/cipa/cipaStore";
import MeetingFormModal from "@/pages/app/modules/cipa/components/MeetingFormModal";
import { brDateToTime, meetingStatusClass } from "@/pages/app/modules/cipa/cipaUtils";
import { meetingStatuses, meetingTypes, type CipaMeeting } from "@/mocks/cipa";

interface AgendaTabProps {
  cipaId: string;
}

export default function AgendaTab({ cipaId }: AgendaTabProps) {
  const meetings = useMeetings();
  const cipas = useCipas();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CipaMeeting | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return meetings
      .filter((m) => (!cipaId || m.cipaId === cipaId))
      .filter((m) => !term || m.title.toLowerCase().includes(term) || m.location.toLowerCase().includes(term))
      .filter((m) => !typeFilter || m.type === typeFilter)
      .filter((m) => !statusFilter || m.status === statusFilter)
      .sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date));
  }, [meetings, cipaId, search, typeFilter, statusFilter]);

  const handleSave = (meeting: CipaMeeting) => {
    if (meetings.some((m) => m.id === meeting.id)) updateMeeting(meeting);
    else addMeeting(meeting);
  };

  const markStatus = (meeting: CipaMeeting, status: CipaMeeting["status"]) => updateMeeting({ ...meeting, status });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Agenda de reuniões e eventos</h2>
          <p className="mt-0.5 text-sm text-foreground-600">Planeje reuniões ordinárias, extraordinárias e eventos como a SIPAT.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-add-line text-base"></i>
          Agendar compromisso
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
          <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
            <i className="ri-search-line text-base"></i>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou local..."
            className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
          />
        </div>
        <div className="relative">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-48">
            <option value="">Todos os tipos</option>
            {meetingTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-44">
            <option value="">Todas as situações</option>
            {meetingStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((m) => {
          const cipa = cipas.find((c) => c.id === m.cipaId);
          return (
            <div key={m.id} className="flex flex-col rounded-lg border border-background-200 bg-background-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-100 text-accent-800`}>
                    <i className="ri-calendar-line text-lg"></i>
                  </span>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-foreground-950">{m.title}</h3>
                    <p className="mt-0.5 text-xs text-foreground-500">{cipa?.name || "—"}</p>
                  </div>
                </div>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${meetingStatusClass(m.status)}`}>{m.status}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-foreground-600">
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line text-foreground-400"></i>
                  {m.date} {m.time && `· ${m.time}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-price-tag-3-line text-foreground-400"></i>
                  {m.type}
                </span>
                {m.location && (
                  <span className="flex items-center gap-1.5">
                    <i className="ri-map-pin-2-line text-foreground-400"></i>
                    {m.location}
                  </span>
                )}
              </div>

              {m.agenda.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-background-100 pt-3 text-xs text-foreground-600">
                  {m.agenda.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <i className="ri-checkbox-blank-circle-fill mt-1.5 text-[5px] text-primary-500"></i>
                      <span className="truncate">{item}</span>
                    </li>
                  ))}
                  {m.agenda.length > 3 && <li className="text-foreground-400">+ {m.agenda.length - 3} item(ns) da pauta</li>}
                </ul>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-background-100 pt-4">
                {m.status === "Agendada" && (
                  <button type="button" onClick={() => markStatus(m, "Realizada")} className="inline-flex items-center gap-1.5 rounded-md bg-primary-100 px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-200">
                    <i className="ri-check-line text-base"></i>
                    Marcar realizada
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(m);
                    setFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-edit-line text-base"></i>
                  Editar
                </button>
                {m.status !== "Cancelada" && (
                  <button type="button" onClick={() => markStatus(m, "Cancelada")} className="ml-auto whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium text-foreground-500 transition-colors hover:bg-background-100">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-calendar-schedule-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum compromisso encontrado</p>
          <p className="text-xs text-foreground-500">Agende uma reunião ordinária, extraordinária ou um evento.</p>
        </div>
      )}

      <MeetingFormModal open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} cipas={cipas} editing={editing} />
    </div>
  );
}