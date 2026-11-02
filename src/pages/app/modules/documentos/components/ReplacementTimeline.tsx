import { StatusPill } from "@/pages/app/components/ui";
import type { DocumentRecord } from "@/mocks/documents";
import { fileIcon, fileIconTone } from "@/pages/app/modules/documentos/documentUtils";

interface ReplacementTimelineProps {
  /** Cadeia completa (do documento original ao mais recente). */
  chain: DocumentRecord[];
  /** Documento que está aberto no momento — recebe destaque. */
  activeId: string;
  /** Abre outro documento da cadeia sem sair da tela. */
  onOpenDoc: (doc: DocumentRecord) => void;
  className?: string;
}

/**
 * Linha do tempo da cadeia de substituição (documento antigo ↔ documento novo).
 *
 * Mostra a trilha completa: cada documento que ocupou o lugar do anterior, com
 * tipo, validade e situação. Clicar em qualquer etapa abre aquele documento.
 */
export default function ReplacementTimeline({
  chain,
  activeId,
  onOpenDoc,
  className = "",
}: ReplacementTimelineProps) {
  if (chain.length < 2) return null;

  return (
    <section
      className={`rounded-xl border border-background-200 bg-background-50 p-3.5 ${className}`}
      aria-label="Cadeia de substituição do documento"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
          <i className="ri-git-branch-line text-xs"></i>
          Cadeia de substituição
        </p>
        <span className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
          {chain.length} documento(s)
        </span>
      </div>

      <ol className="mt-2.5 flex items-stretch gap-1 overflow-x-auto pb-1">
        {chain.map((node, index) => {
          const active = node.id === activeId;
          const oldest = index === 0;
          const newest = index === chain.length - 1;
          // O último elo da cadeia é o documento que ocupa o lugar hoje.
          const vigente = newest && !node.supersededByRef;
          return (
            <li key={node.id} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenDoc(node)}
                aria-current={active ? "true" : undefined}
                title={`Abrir ${node.name}`}
                className={`flex w-[196px] cursor-pointer flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                    : vigente
                      ? "border-primary-300 bg-primary-50/70 hover:border-primary-400 hover:bg-primary-50"
                      : "border-background-200 bg-background-100/60 hover:border-primary-300 hover:bg-background-100"
                }`}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      vigente
                        ? "bg-primary-600 text-background-50"
                        : oldest
                          ? "bg-secondary-100 text-secondary-900"
                          : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    <i
                      className={
                        vigente
                          ? "ri-verified-badge-line"
                          : oldest
                            ? "ri-flag-line"
                            : "ri-swap-box-line"
                      }
                    ></i>
                    {vigente ? "Vigente" : oldest ? "Original" : "Etapa"}
                  </span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md ${fileIconTone[node.fileType]}`}>
                    <i className={`${fileIcon[node.fileType]} text-xs`}></i>
                  </span>
                </span>

                <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground-900">
                  {node.name}
                </span>
                <span className="truncate text-[10px] text-foreground-500">{node.typeName}</span>
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] text-foreground-500">
                    Validade {node.expiresAt || "—"}
                  </span>
                  <StatusPill status={node.status} />
                </span>
              </button>
              {index < chain.length - 1 && (
                <i className="ri-arrow-right-line shrink-0 text-sm text-foreground-400" aria-hidden="true"></i>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}