import { useEffect, type ReactNode } from "react";
import { StatusPill } from "@/pages/app/components/ui";
import {
  canBeReplaced,
  canRequestRenewal,
  daysUntilExpiry,
  expiryDaysLabel,
  fileIcon,
  fileIconTone,
} from "@/pages/app/modules/documentos/documentUtils";
import type { DocumentRecord } from "@/mocks/documents";

interface QuickReviewPanelProps {
  open: boolean;
  /** Documentos vencidos, na ordem em que devem ser conferidos. */
  documents: DocumentRecord[];
  index: number;
  /** Documentos já renovados durante esta conferência. */
  renewedIds?: string[];
  unitOf: (doc: DocumentRecord) => string;
  warningDays: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onRenew: (doc: DocumentRecord) => void;
  /** Anexa o documento novo no lugar do vencido (quando o tipo permite). */
  onReplace: (doc: DocumentRecord) => void;
  onOpenFile: (doc: DocumentRecord) => void;
}

interface InfoProps {
  label: string;
  icon: string;
  children: ReactNode;
}

function Info({ label, icon, children }: InfoProps) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
        <i className={`${icon} text-xs`}></i>
        {label}
      </p>
      <div className="mt-1 truncate text-sm leading-snug text-foreground-800">{children}</div>
    </div>
  );
}

/**
 * Conferência rápida de vencidos.
 *
 * Percorre apenas os documentos vencidos, um por um, com a abertura da
 * solicitação disponível ali mesmo. A lista é uma fotografia do momento em que
 * a conferência começou.
 */
export default function QuickReviewPanel({
  open,
  documents,
  index,
  renewedIds = [],
  unitOf,
  warningDays,
  onIndexChange,
  onClose,
  onRenew,
  onReplace,
  onOpenFile,
}: QuickReviewPanelProps) {
  const total = documents.length;
  const current = index < total ? documents[index] : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Enquanto o visualizador de arquivo ou o envio/substituição estiverem
      // por cima, o Esc e as setas pertencem a eles — a conferência não pode
      // fechar junto.
      if (document.querySelector("[data-file-viewer]")) return;
      if (document.querySelector("[data-modal-overlay]")) return;
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight" && index < total) onIndexChange(index + 1);
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, total, onClose, onIndexChange]);

  if (!open) return null;

  const done = !current;
  const reviewed = Math.min(index, total);
  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 100;
  const renewedCount = documents.filter((doc) => renewedIds.includes(doc.id)).length;
  const days = current ? daysUntilExpiry(current.expiresAt) : null;
  // ASO, certificados de treinamento e demais documentos renováveis aceitam
  // substituição; registros datados (atas, editais, termos de posse, atestados
  // médicos etc.) seguem sem essa opção.
  const replaceable = current ? canBeReplaced(current) : false;
  // Peça de processo eleitoral (edital de convocação): o pleito tem prazo
  // próprio, então o documento não renova nem é substituído na conferência.
  const renewalAllowed = current ? canRequestRenewal(current) : false;
  const windowDays = Number.isFinite(warningDays) ? Math.max(1, Math.round(warningDays)) : 30;

  return (
    <div
      className="fixed inset-0 z-[58] flex items-start justify-center overflow-y-auto bg-foreground-950/60 p-3 py-6 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Conferência rápida de documentos vencidos"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-background-200 bg-background-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-800">
              <i className="ri-play-list-2-line text-xl"></i>
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-bold tracking-tight text-foreground-950">
                Conferência rápida
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                Só os documentos vencidos, um por um — abra a solicitação sem sair da sequência.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Encerrar conferência"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Progresso */}
        <div className="border-b border-background-200 bg-background-100 px-5 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-foreground-600">
              {done ? "Conferência concluída" : `Documento ${index + 1} de ${total}`}
            </p>
            <p className="text-[11px] font-semibold text-foreground-500">
              {reviewed} revisado(s){renewedCount > 0 ? ` · ${renewedCount} renovado(s)` : ""}
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        {/* Corpo */}
        <div className="max-h-[62vh] overflow-y-auto px-5 py-5 md:px-6">
          {done ? (
            <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
                <i className="ri-checkbox-circle-line text-2xl"></i>
              </span>
              <p className="mt-1 text-base font-semibold text-foreground-900">
                Você revisou {total} documento(s) vencido(s)
              </p>
              <p className="max-w-md text-xs leading-relaxed text-foreground-500">
                {renewedCount > 0
                  ? `${renewedCount} documento(s) tiveram a validade atualizada nesta conferência. Os que continuam vencidos seguem nos alertas.`
                  : "As solicitações abertas ficam no painel de renovação até o documento novo ser anexado e a validade atualizada."}
              </p>
            </div>
          ) : (
            <>
              {/* Destaque do vencimento */}
              <div className="flex items-start gap-3 rounded-xl border border-danger-300 bg-danger-100 px-4 py-3.5">
                <i className="ri-error-warning-line mt-0.5 text-lg text-danger-800"></i>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground-950">
                    {days !== null ? expiryDaysLabel(days) : "Documento vencido"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-foreground-700">
                    Validade em <strong className="font-semibold">{current.expiresAt}</strong> · janela
                    de alerta de {windowDays} dias
                  </p>
                </div>
                <StatusPill status={current.status} />
              </div>

              {/* Identificação */}
              <div className="mt-4 flex items-start gap-3">
                {current.previewDataUrl ? (
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-background-200 bg-background-100">
                    <img src={current.previewDataUrl} alt={current.name} className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${fileIconTone[current.fileType]}`}
                  >
                    <i className={`${fileIcon[current.fileType]} text-2xl`}></i>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-base font-bold leading-snug text-foreground-950">
                    {current.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-[11px] font-medium text-foreground-600">
                      {current.typeName}
                    </span>
                    <span className="rounded-md bg-secondary-100 px-2 py-1 text-[11px] font-semibold text-secondary-900">
                      {unitOf(current) || "Corporativo"}
                    </span>
                    {renewedIds.includes(current.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-1 text-[10px] font-semibold text-primary-700">
                        <i className="ri-checkbox-circle-line"></i>
                        Renovado nesta conferência
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-background-200 pt-4">
                <Info label="Vínculo" icon="ri-link">
                  {current.scope === "empresa" ? "Empresa" : "Colaborador"}
                </Info>
                <Info label="Emissão" icon="ri-calendar-line">
                  {current.issuedAt}
                </Info>
                {current.scope === "colaborador" && (
                  <Info label="Colaborador" icon="ri-user-line">
                    {current.collaboratorName || "—"}
                  </Info>
                )}
                <Info label="Tamanho" icon="ri-hard-drive-2-line">
                  {current.size}
                </Info>
              </div>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-3 border-t border-background-200 bg-background-50 px-5 py-4 md:px-6">
          {done ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => onIndexChange(Math.max(0, total - 1))}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-arrow-left-line text-base"></i>
                  Revisar novamente
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-check-line text-base"></i>
                Concluir conferência
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {replaceable && (
                  <button
                    type="button"
                    onClick={() => onReplace(current)}
                    title="Anexar o documento novo no lugar deste; o anterior passa a Substituído no histórico"
                    className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-swap-box-line text-base"></i>
                    Substituir este documento
                  </button>
                )}
                {renewalAllowed && (
                  <button
                    type="button"
                    onClick={() => onRenew(current)}
                    className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      replaceable
                        ? "border border-danger-300 bg-background-50 text-danger-800 hover:bg-danger-100"
                        : "bg-danger-600 text-background-50 hover:bg-danger-700"
                    }`}
                  >
                    <i className="ri-loop-right-line text-base"></i>
                    Solicitar renovação
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenFile(current)}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-eye-line text-base"></i>
                  Abrir arquivo
                </button>
                <button
                  type="button"
                  onClick={() => onIndexChange(index + 1)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground-600 transition-colors hover:bg-background-100 hover:text-foreground-900"
                >
                  Pular este
                  <i className="ri-skip-right-line text-base"></i>
                </button>
              </div>

              {replaceable && (
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground-500">
                  <i className="ri-information-line mt-px text-xs text-foreground-400"></i>
                  Ao substituir, o documento novo assume vínculo, tipo e unidade deste — e a conferência
                  emenda automaticamente no próximo vencido.
                </p>
              )}

              {current && !renewalAllowed && (
                <p className="flex items-start gap-1.5 rounded-md border border-secondary-200 bg-secondary-100 px-3 py-2.5 text-[11px] leading-snug text-secondary-900">
                  <i className="ri-government-line mt-px text-xs"></i>
                  Peça de processo eleitoral da CIPA: o pleito tem data e hora para terminar, então este
                  documento não renova nem é substituído. Encerrado o pleito, abra um novo processo
                  eleitoral e emita um novo edital.
                </p>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-background-200 pt-3">
                <button
                  type="button"
                  onClick={() => onIndexChange(index - 1)}
                  disabled={index <= 0}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <i className="ri-arrow-left-s-line text-base"></i>
                  Anterior
                </button>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-400">
                  <kbd className="rounded border border-background-300 bg-background-100 px-1 py-0.5 text-[10px] font-semibold">
                    ←
                  </kbd>
                  <kbd className="rounded border border-background-300 bg-background-100 px-1 py-0.5 text-[10px] font-semibold">
                    →
                  </kbd>
                  para navegar
                </span>
                <button
                  type="button"
                  onClick={() => onIndexChange(index + 1)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  Próximo
                  <i className="ri-arrow-right-s-line text-base"></i>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}