import Modal from "@/pages/app/components/Modal";

export interface DrilldownColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface DrilldownRow {
  id: string;
  cells: Record<string, string>;
}

interface DashboardDrilldownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  columns: DrilldownColumn[];
  rows: DrilldownRow[];
  /** Linha de contexto exibida acima da tabela (ex.: total, período, unidade). */
  summary?: string;
  emptyLabel?: string;
}

/**
 * Detalhamento aberto ao clicar em um gráfico ou indicador do dashboard.
 * Sempre mostra a lista real por trás do número — nada é apenas "decorativo".
 */
export default function DashboardDrilldownModal({
  open,
  onClose,
  title,
  subtitle,
  icon = "ri-bar-chart-2-line",
  columns,
  rows,
  summary,
  emptyLabel = "Nenhum registro encontrado para este recorte.",
}: DashboardDrilldownModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} icon={icon} size="xl">
      {summary && (
        <p className="mb-4 rounded-md bg-background-100 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-foreground-600">
          {summary}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-inbox-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Sem registros</p>
          <p className="text-xs text-foreground-500">{emptyLabel}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`pb-2.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400 ${
                      column.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-background-100 last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`py-3 pr-3 text-xs text-foreground-700 last:pr-0 ${
                        column.align === "right" ? "text-right font-semibold text-foreground-900" : ""
                      }`}
                    >
                      {row.cells[column.key] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[10px] text-foreground-400">
        <i className="ri-information-line text-sm"></i>
        Total de {rows.length} registro(s) neste recorte.
      </p>
    </Modal>
  );
}