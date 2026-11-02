import { useEffect, useRef, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { StatusPill } from "@/pages/app/components/ui";
import type { DocumentRecord } from "@/mocks/documents";
import { resolveDocumentUrl } from "@/pages/app/modules/documentos/documentsStore";
import { fileIcon, fileIconTone } from "@/pages/app/modules/documentos/documentUtils";
import { printHtml } from "@/pages/app/utils/exportPdf";

interface DocumentViewerModalProps {
  doc: DocumentRecord | null;
  onClose: () => void;
  /** Disparado ao abrir o documento: registra a ciência e remove o alerta. */
  onViewed: (doc: DocumentRecord) => void;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground-900">{value}</p>
    </div>
  );
}

export default function DocumentViewerModal({ doc, onClose, onViewed }: DocumentViewerModalProps) {
  const lastViewed = useRef<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (!doc) {
      setError("");
      setOpening(false);
      setImageOpen(false);
      return;
    }
    if (lastViewed.current === doc.id) return;
    lastViewed.current = doc.id;
    onViewed(doc);
  }, [doc, onViewed]);

  if (!doc) return null;

  const hasFile = Boolean(doc.attachedPdfHtml || doc.storagePath || doc.fileUrl || doc.previewDataUrl);

  const handleOpenFile = async () => {
    if (opening) return;
    if (doc.attachedPdfHtml) {
      printHtml(doc.name, doc.attachedPdfHtml);
      return;
    }
    setOpening(true);
    setError("");
    try {
      const url = await resolveDocumentUrl(doc);
      if (!url) {
        setError("Este documento não possui arquivo anexado para abertura.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="ri-file-text-line"
      title={doc.name}
      subtitle={`${doc.typeName} · documento direcionado a você`}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>
            Fechar
          </ModalButton>
          {hasFile && !doc.previewDataUrl && (
            <ModalButton icon={opening ? "ri-loader-4-line" : "ri-external-link-line"} onClick={handleOpenFile} disabled={opening}>
              {opening ? "Abrindo..." : "Abrir arquivo"}
            </ModalButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
            {doc.typeName}
          </span>
          <StatusPill status={doc.status} />
          {doc.collaboratorRole && (
            <span className="rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-medium text-foreground-600">
              {doc.collaboratorRole}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-background-200 bg-background-100 p-4 sm:grid-cols-2 md:grid-cols-3">
          <InfoLine label="Emitido em" value={doc.issuedAt || "—"} />
          <InfoLine label="Validade" value={doc.expiresAt || "Permanente"} />
          <InfoLine label="Arquivo" value={doc.size} />
          <InfoLine label="Vínculo" value={doc.collaboratorName || "Colaborador"} />
          <InfoLine label="Unidade" value={doc.establishment || "Corporativo"} />
          <InfoLine
            label="Formato"
            value={doc.fileType === "img" ? "Imagem" : doc.fileType.toUpperCase()}
          />
        </div>

        <div className="rounded-lg border border-background-200 bg-background-50 p-4">
          {doc.previewDataUrl ? (
            <div className="flex flex-col gap-3">
              <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-md border border-background-200 bg-background-100">
                <img
                  src={doc.previewDataUrl}
                  alt={doc.name}
                  title={`${doc.name} · ${doc.typeName}`}
                  className="h-full w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setImageOpen(true)}
                className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-zoom-in-line text-base"></i>
                Ampliar imagem
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${fileIconTone[doc.fileType]}`}>
                <i className={`${fileIcon[doc.fileType]} text-2xl`}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground-900">
                  {hasFile ? "Arquivo disponível para leitura" : "Sem arquivo anexado"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                  {hasFile
                    ? "Abra o arquivo para conferir o conteúdo completo deste documento."
                    : "O documento foi registrado apenas com os dados cadastrais. Fale com o SESMT se precisar da versão em arquivo."}
                </p>
              </div>
              {hasFile && (
                <button
                  type="button"
                  onClick={handleOpenFile}
                  disabled={opening}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                >
                  <i className={opening ? "ri-loader-4-line" : "ri-external-link-line"}></i>
                  {opening ? "Abrindo..." : "Abrir arquivo"}
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span>
            Documento visualizado. O alerta foi removido — ele continua disponível em
            <strong className="font-semibold"> “Documentos já visualizados”</strong>.
          </span>
        </div>
      </div>

      {imageOpen && doc.previewDataUrl && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-foreground-950/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setImageOpen(false)}
        >
          <div
            className="flex max-h-[80vh] max-w-[90vw] flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-background-200 px-4 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground-800">{doc.name}</span>
              <button
                type="button"
                aria-label="Fechar imagem"
                onClick={() => setImageOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <img src={doc.previewDataUrl} alt={doc.name} className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
    </Modal>
  );
}