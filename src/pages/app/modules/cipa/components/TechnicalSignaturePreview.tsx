import { useMemo } from "react";
import { buildDocumentPreviewHtml } from "@/pages/app/utils/exportPdf";
import { buildTechnicalDocumentPreview } from "@/pages/app/modules/cipa/technicalDocumentPreview";
import type { TechnicalSignatureScope } from "@/pages/app/modules/cipa/technicalSignatureStore";

interface TechnicalSignaturePreviewProps {
  scope: TechnicalSignatureScope;
  referenceRef: string;
  /** Altura do quadro de prévia (classes Tailwind). */
  heightClass?: string;
}

/**
 * Pré-visualização fiel do documento técnico dentro do modal de assinatura do
 * Responsável Técnico. Renderiza o mesmo HTML do PDF em um iframe isolado para
 * que o RT confira o conteúdo antes de assinar eletronicamente.
 */
export default function TechnicalSignaturePreview({
  scope,
  referenceRef,
  heightClass = "h-[52vh]",
}: TechnicalSignaturePreviewProps) {
  const preview = useMemo(
    () => buildTechnicalDocumentPreview(scope, referenceRef),
    [scope, referenceRef]
  );

  if (!preview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-10 text-center">
        <i className="ri-file-unknow-line text-2xl text-foreground-400"></i>
        <p className="text-xs text-foreground-500">
          Não foi possível montar a prévia deste documento. Os dados podem ter sido alterados ou removidos.
        </p>
      </div>
    );
  }

  const html = buildDocumentPreviewHtml(preview.title, preview.bodyHtml);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-background-200 bg-background-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 bg-background-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <i className="ri-eye-line text-sm text-primary-700"></i>
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-foreground-500">
            Prévia do documento
          </span>
        </div>
        <span className="truncate text-[11px] font-medium text-foreground-400">{preview.kindLabel}</span>
      </div>
      <iframe
        title={`Prévia — ${preview.title}`}
        srcDoc={html}
        className={`w-full flex-1 bg-white ${heightClass}`}
      />
      <p className="border-t border-background-200 bg-background-50 px-3 py-2 text-[10px] leading-relaxed text-foreground-400">
        <i className="ri-information-line mr-1"></i>
        Esta é a versão que será emitida após a sua assinatura. Confira os dados antes de confirmar.
      </p>
    </div>
  );
}