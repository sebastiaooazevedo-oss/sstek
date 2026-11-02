import { useMemo, useState } from "react";
import { addAction, updateAction, useActions, useCipas } from "@/pages/app/modules/cipa/cipaStore";
import ActionFormModal from "@/pages/app/modules/cipa/components/ActionFormModal";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { actionStatusClass, priorityClass } from "@/pages/app/modules/cipa/cipaUtils";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv } from "@/pages/app/utils/exportTable";
import { actionPriorities, actionStatuses, type CipaAction } from "@/mocks/cipa";

interface ActionsTabProps {
  cipaId: string;
}

export default function ActionsTab({ cipaId }: ActionsTabProps) {
  const actions = useActions();
  const cipas = useCipas();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CipaAction | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return actions
      .filter((a) => (!cipaId || a.cipaId === cipaId))
      .filter((a) => !term || a.title.toLowerCase().includes(term) || a.responsible.toLowerCase().includes(term))
      .filter((a) => !statusFilter || a.status === statusFilter)
      .filter((a) => !priorityFilter || a.priority === priorityFilter);
  }, [actions, cipaId, search, statusFilter, priorityFilter]);

  const handleSave = (action: CipaAction) => {
    if (actions.some((a) => a.id === action.id)) updateAction(action);
    else addAction(action);
  };

  const buildRows = () =>
    filtered.map((a) => [
      a.title,
      a.origin,
      a.responsible || "—",
      a.dueDate || "—",
      a.priority,
      a.status,
      cipas.find((c) => c.id === a.cipaId)?.name || "—",
    ]);

  const exportHeaders = ["Ação", "Origem", "Responsável", "Prazo", "Prioridade", "Situação", "CIPA"];

  const handleExportPdf = () => {
    const rows = buildRows();
    const body = `${pdfHeader("Plano de Ação da CIPA")}
      <h1>Plano de ação — CIPA</h1>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>Ações no filtro</span></div>
        <div class="kpi"><b>${filtered.filter((a) => a.status !== "Concluída").length}</b><span>Em aberto</span></div>
        <div class="kpi"><b>${filtered.filter((a) => a.status === "Atrasada").length}</b><span>Atrasadas</span></div>
      </div>
      <table><thead><tr>${exportHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>
      ${pdfFooter()}`;
    printHtml("Plano de Ação da CIPA", body);
  };

  const handleExportCsv = () => downloadCsv("plano-acao-cipa.csv", exportHeaders, buildRows());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Plano de ação</h2>
          <p className="mt-0.5 text-sm text-foreground-600">Ações originadas das atas, reuniões e inspeções, com responsável e prazo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} disabled={filtered.length === 0} />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Nova ação
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ação ou responsável..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-72"
            />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-44">
              <option value="">Todas as situações</option>
              {actionStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
          <div className="relative">
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-44">
              <option value="">Todas as prioridades</option>
              {actionPriorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ação</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Origem</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Responsável</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Prazo</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Prioridade</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Situação</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-background-100 transition-colors last:border-0 hover:bg-background-50">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-foreground-950">{a.title}</p>
                    {a.description && <p className="mt-0.5 line-clamp-1 max-w-[320px] text-xs text-foreground-500">{a.description}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-medium text-foreground-700">{a.origin}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-foreground-700">{a.responsible || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-sm text-foreground-700">{a.dueDate || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityClass(a.priority)}`}>{a.priority}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={a.status}
                      onChange={(e) => updateAction({ ...a, status: e.target.value as CipaAction["status"] })}
                      className={`cursor-pointer appearance-none rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold outline-none ${actionStatusClass(a.status)}`}
                    >
                      {actionStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(a);
                        setFormOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-edit-line text-base"></i>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-task-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhuma ação encontrada</p>
            <p className="text-xs text-foreground-500">Ajuste os filtros ou crie uma nova ação.</p>
          </div>
        )}
      </div>

      <ActionFormModal open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} cipas={cipas} editing={editing} />
    </div>
  );
}