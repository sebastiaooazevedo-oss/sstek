import type { CaepiImportJob } from "@/pages/app/modules/config/caepiBaseStore";

interface ImportProgressStepProps {
  job: CaepiImportJob;
  cancelling: boolean;
  onCancel: () => void;
}

const counters = [
  { key: "rowCount", label: "Gravados no lote", icon: "ri-database-2-line", tone: "text-secondary-800 bg-secondary-100" },
  { key: "inserted", label: "Inseridos", icon: "ri-add-circle-line", tone: "text-primary-700 bg-primary-100" },
  { key: "updated", label: "Atualizados", icon: "ri-refresh-line", tone: "text-accent-800 bg-accent-100" },
  { key: "rejected", label: "Rejeitados", icon: "ri-close-circle-line", tone: "text-foreground-700 bg-background-200" },
] as const;

export default function ImportProgressStep({ job, cancelling, onCancel }: ImportProgressStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-2 font-medium text-foreground-800">
            <i className="ri-loader-4-line animate-spin text-secondary-700"></i>
            <span className="truncate">{job.message || "Processando…"}</span>
          </span>
          {job.pct !== null && (
            <span className="text-sm font-bold tabular-nums text-foreground-950">{job.pct}%</span>
          )}
        </div>
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-background-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={job.pct ?? undefined}
        >
          {job.pct !== null ? (
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${job.pct}%` }}
            ></div>
          ) : (
            <div className="caepi-progress-indeterminate h-full w-1/3 rounded-full bg-primary-500/70"></div>
          )}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-foreground-500">
          <i className="ri-information-line mt-0.5"></i>
          <span>
            Os registros são validados antes de gravar. A base ativa atual continua no ar até a importação terminar
            com sucesso — nada é apagado no meio do processo.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {counters.map((counter) => (
          <div key={counter.key} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${counter.tone}`}>
              <i className={`${counter.icon} text-sm`}></i>
            </span>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-foreground-950">
              {(job[counter.key] ?? 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-[11px] text-foreground-500">{counter.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background-100 px-3.5 py-3">
        <span className="text-[11px] text-foreground-600">
          Pode levar alguns minutos em bases grandes. Se a conexão cair, o progresso fica salvo para retomar.
        </span>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <i className={cancelling ? "ri-loader-4-line animate-spin" : "ri-stop-circle-line"}></i>
          {cancelling ? "Cancelando…" : "Cancelar importação"}
        </button>
      </div>
    </div>
  );
}