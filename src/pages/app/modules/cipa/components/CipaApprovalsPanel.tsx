import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/pages/app/components/ui";
import { useAtas, useCipas } from "@/pages/app/modules/cipa/cipaStore";
import { isAtaFullyApproved } from "@/pages/app/modules/cipa/cipaUtils";

interface ApprovalRow {
  id: string;
  name: string;
  unit: string;
  approved: number;
  pending: number;
  total: number;
}

/**
 * Bloco de aprovações da CIPA exibido no dashboard do Administrador.
 * Mostra o total de atas aprovadas x pendentes por comissão, uma barra de
 * progresso geral e o detalhe de cada CIPA, com atalho para o módulo.
 */
export default function CipaApprovalsPanel() {
  const cipas = useCipas();
  const atas = useAtas();

  const rows: ApprovalRow[] = cipas
    .map((cipa) => {
      const cipaAtas = atas.filter((a) => a.cipaId === cipa.id);
      const approved = cipaAtas.filter(isAtaFullyApproved).length;
      const total = cipaAtas.length;
      return {
        id: cipa.id,
        name: cipa.name,
        unit: cipa.city,
        approved,
        pending: total - approved,
        total,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));

  const [filterId, setFilterId] = useState<string>("todas");
  const activeFilter = filterId !== "todas" && rows.some((row) => row.id === filterId) ? filterId : "todas";
  const scopedRows = activeFilter === "todas" ? rows : rows.filter((row) => row.id === activeFilter);

  const totalApproved = scopedRows.reduce((sum, row) => sum + row.approved, 0);
  const totalPending = scopedRows.reduce((sum, row) => sum + row.pending, 0);
  const totalAtas = totalApproved + totalPending;
  const approvedPct = totalAtas > 0 ? Math.round((totalApproved / totalAtas) * 100) : 0;

  const summary = [
    { label: "Atas aprovadas", value: totalApproved, icon: "ri-verified-badge-line", tone: "primary" as const },
    { label: "Aguardando aprovação", value: totalPending, icon: "ri-timer-line", tone: "accent" as const },
    { label: "Comissões monitoradas", value: scopedRows.length, icon: "ri-government-line", tone: "secondary" as const },
  ];

  const toneClass: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    accent: "bg-accent-100 text-accent-800",
    secondary: "bg-secondary-100 text-secondary-800",
  };

  return (
    <SectionCard
      title="Aprovações da CIPA"
      subtitle="Atas aprovadas x pendentes por comissão"
      action={
        <Link
          to="/app/cipa"
          className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
        >
          <i className="ri-arrow-right-line"></i>
          Abrir CIPA
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-200 text-foreground-400">
            <i className="ri-government-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma ata registrada ainda</p>
          <p className="text-xs text-foreground-500">As atas das comissões aparecerão aqui conforme forem criadas.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-1.5 rounded-full border border-background-300 bg-background-50 p-1">
            <button
              type="button"
              onClick={() => setFilterId("todas")}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === "todas" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"
              }`}
            >
              <i className="ri-list-check-2 text-base"></i>
              Todas as comissões
            </button>
            {rows.map((row) => {
              const active = activeFilter === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setFilterId(row.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"
                  }`}
                >
                  <i className="ri-government-line text-base"></i>
                  {row.name}
                  {row.pending > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      {row.pending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {summary.map((item) => (
              <div key={item.label} className="rounded-lg border border-background-200 bg-background-100 p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass[item.tone]}`}>
                  <i className={`${item.icon} text-base`}></i>
                </span>
                <p className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground-500">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground-800">
                <i className="ri-progress-5-line text-primary-600"></i>
                Progresso geral de aprovação
              </span>
              <span className="text-sm font-bold text-foreground-950">{approvedPct}%</span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-background-300/60">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${approvedPct}%` }}></div>
            </div>
            <p className="mt-2 text-xs text-foreground-500">
              {totalApproved} de {totalAtas} ata(s) aprovada(s) por completo (presidente + secretário).
            </p>
          </div>

          <ul className="mt-5 flex flex-col gap-3">
            {scopedRows.map((row) => {
              const pct = row.total > 0 ? Math.round((row.approved / row.total) * 100) : 0;
              return (
                <li key={row.id} className="rounded-lg border border-background-200 bg-background-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                        <i className="ri-government-line text-lg"></i>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground-950">{row.name}</p>
                        <p className="truncate text-xs text-foreground-500">{row.unit}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                        <i className="ri-verified-badge-line"></i>
                        {row.approved} aprovada(s)
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
                        <i className="ri-timer-line"></i>
                        {row.pending} pendente(s)
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background-300/60">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }}></div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}