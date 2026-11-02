import { useState } from "react";
import {
  formatHistoryDate,
  type BatchHistoryGroup,
  type BatchHistoryRow,
} from "@/pages/app/modules/documentos/batchPrintHistory";

const sourceLabels: Record<string, string> = {
  arquivo: "Arquivo original",
  imagem: "Imagem digitalizada",
  cadastro: "Dados do cadastro",
  "sem-arquivo": "Sem arquivo digital",
};

interface BatchHistoryCardProps {
  group: BatchHistoryGroup;
  defaultExpanded?: boolean;
  onRepeat?: (group: BatchHistoryGroup) => void;
}

function CollaboratorRow({ row }: { row: BatchHistoryRow }) {
  const [openItems, setOpenItems] = useState(false);
  const failed = row.status === "falha";

  return (
    <div className="border-b border-background-100 last:border-0">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            failed ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
          }`}
        >
          <i className={failed ? "ri-error-warning-line" : "ri-file-pdf-2-line"}></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground-950">{row.collaboratorName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-foreground-500">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-foreground-700">
              <i className="ri-attachment-2"></i>
              {row.fileName}
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-file-copy-2-line"></i>
              {row.pageCount} página(s)
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-stack-line"></i>
              {row.items.length} documento(s)
            </span>
            {failed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900">
                <i className="ri-close-circle-line"></i>
                Falhou
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenItems((prev) => !prev)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className={openItems ? "ri-eye-off-line" : "ri-eye-line"}></i>
          {openItems ? "Ocultar documentos" : "Ver documentos"}
        </button>
      </div>

      {openItems && (
        <div className="px-4 pb-3.5">
          <ol className="flex flex-col gap-1.5">
            {row.items.map((item, index) => (
              <li
                key={`${item.typeId}-${item.ref}-${index}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[10px] font-bold text-secondary-900">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground-900">{item.typeName}</span>
                  <span className="block truncate text-[11px] text-foreground-500">
                    {item.name} · {item.version} · emitido em {item.issuedAt}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-medium text-foreground-600">
                  {sourceLabels[item.source] || item.source}
                </span>
                <span className="shrink-0 text-[10px] text-foreground-500">{item.pages} pág.</span>
              </li>
            ))}
            {row.items.length === 0 && (
              <li className="rounded-md border border-background-200 bg-background-100 px-3 py-2 text-[11px] text-foreground-500">
                Este registro não teve documentos incluídos — a geração falhou.
              </li>
            )}
          </ol>

          {row.pendencies.length > 0 && (
            <div className="mt-2 rounded-md border border-accent-200 bg-accent-50/70 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-accent-800">Pendências e avisos</p>
              <ul className="mt-1 flex flex-col gap-1">
                {row.pendencies.map((pendency) => (
                  <li key={pendency} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-accent-900">
                    <i className="ri-information-line mt-0.5"></i>
                    <span>{pendency}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Um lote gerado: resumo + colaboradores (um dossiê por linha). */
export default function BatchHistoryCard({ group, defaultExpanded = false, onRepeat }: BatchHistoryCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const failureCount = group.rows.filter((row) => row.status === "falha").length;

  return (
    <div className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex flex-wrap items-center gap-3 border-b border-background-200 bg-background-100 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-printer-cloud-line"></i>
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-xs font-bold text-foreground-950">{group.batchRef}</span>
            <span className="mt-0.5 block truncate text-[11px] text-foreground-500">
              {formatHistoryDate(group.generatedAt)}
              {group.generatedByName ? ` · por ${group.generatedByName}` : ""}
              {group.rows.length ? ` · ${group.rows.length} colaborador(es)` : ""}
              {` · ${group.totalPages} página(s)`}
              {failureCount > 0 ? ` · ${failureCount} falha(s)` : ""}
            </span>
          </span>
          <i
            className={`ml-auto shrink-0 text-base text-foreground-400 transition-transform ${
              expanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"
            }`}
          ></i>
        </button>

        {onRepeat && (
          <button
            type="button"
            onClick={() => onRepeat(group)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-repeat-line"></i>
            Repetir seleção
          </button>
        )}
      </div>

      {expanded && (
        <div>
          {group.rows.map((row) => (
            <CollaboratorRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}