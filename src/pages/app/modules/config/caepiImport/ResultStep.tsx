import type { CaepiImportJob } from "@/pages/app/modules/config/caepiBaseStore";

interface ResultStepProps {
  job: CaepiImportJob;
  errorsStored: number;
  downloading: boolean;
  onDownloadErrors: () => void;
  onFinish: () => void;
}

const summary = [
  { key: "rowCount", label: "Registros gravados", icon: "ri-database-2-line", tone: "bg-secondary-100 text-secondary-900" },
  { key: "inserted", label: "Inseridos", icon: "ri-add-circle-line", tone: "bg-primary-100 text-primary-700" },
  { key: "updated", label: "Atualizados", icon: "ri-refresh-line", tone: "bg-accent-100 text-accent-800" },
  { key: "rejected", label: "Rejeitados", icon: "ri-close-circle-line", tone: "bg-background-200 text-foreground-700" },
] as const;

export default function ResultStep({ job, errorsStored, downloading, onDownloadErrors, onFinish }: ResultStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-500 text-background-50 dark:text-foreground-950">
          <i className="ri-checkbox-circle-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-primary-900">Importação concluída e conferida no banco</p>
          <p className="mt-0.5 text-[11px] text-primary-800">
            {job.fileName} · {Number(job.rowCount ?? 0).toLocaleString("pt-BR")} registros consultáveis agora em
            Consulta de CA. A base anterior foi substituída apenas depois desta validação.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.key} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${item.tone}`}>
              <i className={`${item.icon} text-sm`}></i>
            </span>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-foreground-950">
              {Number(job[item.key] ?? 0).toLocaleString("pt-BR")}
            </p>
            <p className="text-[11px] text-foreground-500">{item.label}</p>
          </div>
        ))}
      </div>

      {job.rejected > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-100 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-foreground-700">
            <p className="font-semibold text-foreground-900">
              {job.rejected.toLocaleString("pt-BR")} linha(s) não passaram na validação
            </p>
            <p className="mt-0.5">
              Elas NÃO foram gravadas. O relatório traz linha, coluna, valor e motivo de cada rejeição
              {errorsStored < job.rejected ? ` (os primeiros ${errorsStored.toLocaleString("pt-BR")} erros ficam registrados)` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadErrors}
            disabled={downloading}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={downloading ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}></i>
            {downloading ? "Gerando…" : "Baixar relatório de erros (.csv)"}
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-foreground-900">Amostra consultada do banco</h3>
        <p className="mt-0.5 text-[11px] text-foreground-500">
          Consulta feita direto na tabela após a gravação, para confirmar que o conteúdo é o do arquivo.
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[720px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-background-100">
                {["CA", "Processo", "CNPJ", "Razão social", "Equipamento", "Situação", "Validade"].map((label) => (
                  <th key={label} className="whitespace-nowrap border-b border-background-200 px-2.5 py-2 text-left font-semibold text-foreground-800">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {job.sample.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-3 text-center text-foreground-500">
                    Nenhuma amostra retornada.
                  </td>
                </tr>
              )}
              {job.sample.map((row, index) => (
                <tr key={`s-${index}`} className="odd:bg-background-50 even:bg-background-100/50">
                  <td className="whitespace-nowrap border-b border-background-200 px-2.5 py-1.5 font-semibold text-foreground-900">
                    {row.ca}
                  </td>
                  <td className="max-w-[130px] truncate border-b border-background-200 px-2.5 py-1.5 text-foreground-700">
                    {row.numero_processo ?? "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-background-200 px-2.5 py-1.5 text-foreground-700">
                    {row.cnpj ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate border-b border-background-200 px-2.5 py-1.5 text-foreground-700" title={row.razao_social ?? ""}>
                    {row.razao_social ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate border-b border-background-200 px-2.5 py-1.5 text-foreground-700" title={row.equipamento ?? ""}>
                    {row.equipamento ?? "—"}
                  </td>
                  <td className="max-w-[130px] truncate border-b border-background-200 px-2.5 py-1.5 text-foreground-700">
                    {row.situacao ?? "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-background-200 px-2.5 py-1.5 text-foreground-700">
                    {row.validade ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onFinish}
          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 dark:text-foreground-950"
        >
          <i className="ri-check-line"></i>
          Concluir
        </button>
      </div>
    </div>
  );
}