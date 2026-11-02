import ElectronicSignatureBlock from "@/components/base/ElectronicSignatureBlock";
import {
  declarationTextFor,
  documentStatusLabels,
  documentTypeLabels,
  type SignatureDocument,
} from "@/pages/app/signature/documentService";
import type { SignatureDisplay } from "@/pages/app/signature/signatureDisplay";
import { documentSealFor } from "@/pages/app/signature/documentPdf";
import AuthenticitySeal from "@/components/feature/AuthenticitySeal";
import { contentRows, formatDateTime } from "@/pages/app/signature/documentPdf";

interface DocumentSheetProps {
  doc: SignatureDocument;
  signaturesBySignatory?: Record<string, SignatureDisplay>;
  interactive?: boolean;
  activeSignatoryId?: string | null;
  onPlace?: (signatoryId: string, x: number, y: number) => void;
}

/**
 * Folha do documento (proporção A4). Mostra os dados, a declaração e as
 * assinaturas na posição escolhida no rascunho. Quando `interactive`, clicar
 * na folha define a posição do signatário ativo (page = 1).
 */
export default function DocumentSheet({
  doc,
  signaturesBySignatory = {},
  interactive = false,
  activeSignatoryId = null,
  onPlace,
}: DocumentSheetProps) {
  const rows = contentRows(doc);
  const declaration = doc.declarationText || declarationTextFor(doc.declarationType);
  const seal = documentSealFor(doc);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !activeSignatoryId || !onPlace) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onPlace(activeSignatoryId, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  return (
    <>
    <div
      className={`relative w-full overflow-hidden rounded-md border border-background-300 bg-background-50 shadow-sm ${
        interactive ? "cursor-crosshair" : ""
      }`}
      style={{ aspectRatio: "1 / 1.414" }}
      onClick={handleClick}
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 border-b-2 border-primary-500 pb-3">
          <div>
            <h4 className="font-heading text-base font-bold tracking-tight text-foreground-950">{doc.title}</h4>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              {documentTypeLabels[doc.docType]} · Versão {doc.version} · {documentStatusLabels[doc.status]}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-semibold text-secondary-900">
            SHA-256 no servidor
          </span>
        </div>

        {rows.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="text-[11px] text-foreground-700">
                <span className="font-semibold text-foreground-900">{r.label}:</span> {r.value}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Declaração</p>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground-700">{declaration}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-foreground-500">
          <span>Congelado: {formatDateTime(doc.submittedAt)}</span>
          <span>Prazo: {formatDateTime(doc.dueAt)}</span>
        </div>
      </div>

      {doc.signatories.map((s) => {
        const display = signaturesBySignatory[s.id];
        const active = activeSignatoryId === s.id || activeSignatoryId === s.collaboratorRef;
        return (
          <div
            key={s.id}
            className={`absolute w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1.5 ${
              active
                ? "border-primary-500 bg-primary-50"
                : display
                  ? "border-primary-300 bg-background-50"
                  : "border-dashed border-background-300 bg-background-50/90"
            }`}
            style={{ left: `${s.positionX}%`, top: `${s.positionY}%` }}
          >
            {display ? (
              <ElectronicSignatureBlock signature={display} variant="compact" />
            ) : (
              <div className="text-center">
                <div className="h-7" />
                <div className="mt-0.5 border-t border-background-300 pt-0.5">
                  <p className="truncate text-[9px] font-semibold text-foreground-800">{s.name}</p>
                  <p className="truncate text-[8px] text-foreground-500">{s.roleLabel || "—"}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    {seal && <AuthenticitySeal seal={seal} compact className="mt-2" />}
    </>
  );
}