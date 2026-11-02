import { useEffect } from "react";

interface BatchPdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  url?: string;
  fileName: string;
  pageCount: number;
  onDownload: () => void;
}

/**
 * Pré-visualização do PDF gerado. O visualizador do navegador permite rolar
 * por todas as páginas antes de qualquer impressão.
 */
export default function BatchPdfPreviewModal({
  open,
  onClose,
  url,
  fileName,
  pageCount,
  onDownload,
}: BatchPdfPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-foreground-950/70 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground-950">{fileName}</p>
            <p className="truncate text-[11px] text-foreground-500">
              {pageCount} página(s) · conferência antes da impressão
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-download-2-line"></i>
              Baixar
            </button>
            <button
              type="button"
              aria-label="Fechar pré-visualização"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-background-100">
          {url ? (
            <iframe src={url} title={`Pré-visualização — ${fileName}`} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
                <i className="ri-file-warning-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Pré-visualização indisponível</p>
              <p className="text-xs text-foreground-500">
                Este navegador não exibiu o PDF aqui. Use “Baixar” para abrir o arquivo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}