import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/pages/app/components/ui";
import type { DocumentRecord } from "@/mocks/documents";
import { resolveDocumentUrl } from "@/pages/app/modules/documentos/documentsStore";
import { buildDocumentFileModel } from "@/pages/app/modules/documentos/documentFileModel";
import { canBeReplaced, fileIcon, fileIconTone } from "@/pages/app/modules/documentos/documentUtils";
import { buildDocumentPreviewHtml, printHtml } from "@/pages/app/utils/exportPdf";
import ReplacementTimeline from "@/pages/app/modules/documentos/components/ReplacementTimeline";
import { formatSwapMoment } from "@/pages/app/modules/documentos/documentChain";

interface DocumentFileViewerModalProps {
  record: DocumentRecord | null;
  /** Unidade efetiva do documento (própria ou herdada do colaborador). */
  unit?: string;
  /** Posição do documento dentro da lista navegável. */
  position?: { index: number; total: number };
  /** Navega para o anterior (-1) ou próximo (1) sem fechar o visualizador. */
  onNavigate?: (direction: 1 | -1) => void;
  /** Cadeia de substituição do documento (antigo ↔ novo). */
  chain?: DocumentRecord[];
  /** Abre outro documento da cadeia sem fechar o visualizador. */
  onOpenChainDoc?: (doc: DocumentRecord) => void;
  /** Atalho para registrar a substituição deste documento. */
  onReplace?: (doc: DocumentRecord) => void;
  onClose: () => void;
}

type ViewerSource =
  | { kind: "html"; body: string; model: boolean }
  | { kind: "url"; url: string; image: boolean };

const BASE_WIDTH = 820;
const BASE_HEIGHT = 1120;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

/**
 * Visualizador do arquivo do documento.
 *
 * Abre em camada própria (acima da conferência rápida e da pré-visualização
 * lateral) com zoom, download e impressão. Quando o registro ainda não tem
 * arquivo anexado, mostra a ficha gerada a partir do cadastro — nunca uma tela
 * vazia.
 */
export default function DocumentFileViewerModal({
  record,
  unit = "",
  position,
  onNavigate,
  chain,
  onOpenChainDoc,
  onReplace,
  onClose,
}: DocumentFileViewerModalProps) {
  const [source, setSource] = useState<ViewerSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!record) {
      setSource(null);
      return;
    }
    let cancelled = false;
    setZoom(1);
    setError("");
    setSource(null);

    const run = async () => {
      if (record.attachedPdfHtml) {
        if (!cancelled) {
          setSource({ kind: "html", body: record.attachedPdfHtml, model: false });
        }
        return;
      }
      if (record.previewDataUrl && record.fileType === "img") {
        if (!cancelled) {
          setSource({ kind: "url", url: record.previewDataUrl, image: true });
        }
        return;
      }
      setLoading(true);
      try {
        const url = await resolveDocumentUrl(record);
        if (cancelled) return;
        if (url) {
          setSource({ kind: "url", url, image: record.fileType === "img" });
        } else {
          setSource({
            kind: "html",
            body: buildDocumentFileModel(record, { unit }),
            model: true,
          });
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar o arquivo deste documento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [record, unit]);

  useEffect(() => {
    if (!record) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Setas percorrem a lista sem fechar o visualizador.
      if (!onNavigate || !position) return;
      if (event.key === "ArrowRight" && position.index < position.total - 1) onNavigate(1);
      if (event.key === "ArrowLeft" && position.index > 0) onNavigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record, onClose, onNavigate, position]);

  if (!record) return null;

  const canPrintHtml = source?.kind === "html";

  // Elo vigente da cadeia: destino do atalho "Ver vigente" do documento trocado.
  const chainVigente = chain && chain.length > 1
    ? [...chain].reverse().find((node) => !node.supersededByRef)
    : undefined;
  const canJumpToVigente = Boolean(
    record.supersededByRef && chainVigente && chainVigente.id !== record.id && onOpenChainDoc
  );

  const changeZoom = (delta: number) =>
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((prev + delta).toFixed(2)))));

  const fitToWidth = () => {
    const width = viewportRef.current?.clientWidth ?? BASE_WIDTH;
    const next = (width - 48) / BASE_WIDTH;
    setZoom(Number(Math.min(1, Math.max(MIN_ZOOM, next)).toFixed(2)));
  };

  const handlePrint = () => {
    if (source?.kind === "html") {
      printHtml(record.name, source.body);
      return;
    }
    if (source?.kind === "url") {
      window.open(source.url, "_blank", "noopener");
    }
  };

  const handleDownload = () => {
    if (source?.kind === "html") {
      // Sem arquivo binário: o próprio layout de impressão gera o PDF
      // (salvar como PDF na caixa de impressão do navegador).
      printHtml(record.name, source.body);
      return;
    }
    if (source?.kind === "url") {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.download = record.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const previewHtml =
    source?.kind === "html" ? buildDocumentPreviewHtml(record.name, source.body) : "";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground-950/70 p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      data-file-viewer="true"
      aria-label={`Arquivo de ${record.name}`}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden border border-background-200 bg-background-50 shadow-2xl md:h-[92vh] md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-background-200 px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {record.previewDataUrl ? (
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-background-200 bg-background-100">
                <img src={record.previewDataUrl} alt="" className="h-full w-full object-cover" />
              </span>
            ) : (
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${fileIconTone[record.fileType]}`}
              >
                <i className={`${fileIcon[record.fileType]} text-lg`}></i>
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-heading text-sm font-bold text-foreground-950 md:text-base">
                {record.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusPill status={record.status} />
                <span className="rounded-md bg-background-100 px-2 py-0.5 text-[11px] font-medium text-foreground-600">
                  {record.typeName}
                </span>
                <span className="rounded-md bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-900">
                  {unit || "Corporativo"}
                </span>
                {source?.kind === "html" && source.model && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900">
                    <i className="ri-draft-line"></i>
                    Documento modelo
                  </span>
                )}
                {record.replacesRef && !record.supersededByRef && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-background-50">
                    <i className="ri-verified-badge-line"></i>
                    Vigente
                  </span>
                )}
                {record.replacesRef && record.supersededByRef && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-800">
                    <i className="ri-swap-box-line"></i>
                    Substitui documento anterior
                  </span>
                )}
                {record.supersededByRef && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-800">
                    <i className="ri-arrow-go-back-line"></i>
                    Documento substituído
                  </span>
                )}
                {record.supersededByRef && record.supersededAt && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-semibold text-foreground-600"
                    title={`Última troca em ${formatSwapMoment(record.supersededAt)}`}
                  >
                    <i className="ri-history-line"></i>
                    Trocado em {formatSwapMoment(record.supersededAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar visualização"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Navegação entre documentos sem fechar o visualizador */}
        {position && position.total > 1 && (
          <div className="flex items-center justify-between gap-2 border-b border-background-200 bg-background-100 px-3 py-2 md:px-4">
            <button
              type="button"
              onClick={() => onNavigate?.(-1)}
              disabled={position.index <= 0}
              title="Documento anterior"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-200 hover:text-foreground-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <i className="ri-arrow-left-s-line text-base"></i>
              Anterior
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground-600">
                {position.index + 1} de {position.total}
              </span>
              <span className="hidden gap-1 sm:flex">
                <kbd className="rounded border border-background-300 bg-background-50 px-1 py-0.5 text-[10px] font-semibold text-foreground-500">
                  ←
                </kbd>
                <kbd className="rounded border border-background-300 bg-background-50 px-1 py-0.5 text-[10px] font-semibold text-foreground-500">
                  →
                </kbd>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.(1)}
              disabled={position.index >= position.total - 1}
              title="Próximo documento"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-200 hover:text-foreground-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Próximo
              <i className="ri-arrow-right-s-line text-base"></i>
            </button>
          </div>
        )}

        {/* Barra de ferramentas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 bg-background-100 px-4 py-2 md:px-5">
          <div className="flex items-center gap-1 rounded-lg border border-background-300 bg-background-50 p-1">
            <button
              type="button"
              onClick={() => changeZoom(-0.1)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Diminuir zoom"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ri-subtract-line text-sm"></i>
            </button>
            <span className="min-w-[44px] text-center text-[11px] font-bold text-foreground-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => changeZoom(0.1)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Aumentar zoom"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ri-add-line text-sm"></i>
            </button>
            <button
              type="button"
              onClick={fitToWidth}
              aria-label="Ajustar à largura"
              className="ml-1 flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-fullscreen-line text-sm"></i>
              Ajustar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canJumpToVigente && chainVigente && (
              <button
                type="button"
                onClick={() => onOpenChainDoc?.(chainVigente)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-700"
              >
                <i className="ri-verified-badge-line text-base"></i>
                Ver vigente
              </button>
            )}
            {onReplace && canBeReplaced(record) && (
              <button
                type="button"
                onClick={() => onReplace(record)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary-300 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
              >
                <i className="ri-swap-box-line text-base"></i>
                Substituir este documento
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-download-2-line text-base"></i>
              Baixar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-printer-line text-base"></i>
              Imprimir
            </button>
          </div>
        </div>

        {/* Área do arquivo */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-auto bg-foreground-100 px-4 py-4 md:px-6"
        >
          {chain && onOpenChainDoc && chain.length > 1 && (
            <div className="mb-3">
              <ReplacementTimeline chain={chain} activeId={record.id} onOpenDoc={onOpenChainDoc} />
            </div>
          )}

          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400"></i>
              <p className="text-xs font-medium text-foreground-500">Preparando o arquivo…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-100 text-danger-800">
                <i className="ri-error-warning-line text-xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-900">{error}</p>
              <p className="max-w-sm text-xs text-foreground-500">
                Tente novamente ou anexe o arquivo original para visualizar o conteúdo oficial.
              </p>
            </div>
          )}

          {!loading && !error && source?.kind === "html" && (
            <div
              className="mx-auto"
              style={{ width: BASE_WIDTH * zoom, height: BASE_HEIGHT * zoom }}
            >
              <iframe
                title={`Arquivo de ${record.name}`}
                srcDoc={previewHtml}
                className="rounded-md border border-background-300 bg-background-50 shadow-lg"
                style={{
                  width: BASE_WIDTH,
                  height: BASE_HEIGHT,
                  border: 0,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )}

          {!loading && !error && source?.kind === "url" && (
            <div className="mx-auto" style={{ width: BASE_WIDTH * zoom }}>
              {source.image ? (
                <img
                  src={source.url}
                  alt={record.name}
                  className="w-full rounded-md border border-background-300 bg-background-50 object-contain shadow-lg"
                  style={{ height: BASE_HEIGHT * zoom }}
                />
              ) : (
                <iframe
                  title={`Arquivo de ${record.name}`}
                  src={source.url}
                  className="rounded-md border border-background-300 bg-background-50 shadow-lg"
                  style={{ width: BASE_WIDTH, height: BASE_HEIGHT, border: 0, transform: `scale(${zoom})`, transformOrigin: "top left" }}
                />
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-200 bg-background-50 px-4 py-2.5 md:px-5">
          <p className="flex items-center gap-1.5 text-[11px] text-foreground-500">
            <i className="ri-information-line"></i>
            {source?.kind === "html" && source.model
              ? "Ficha gerada a partir do cadastro — o arquivo original ainda não foi anexado."
              : canPrintHtml
                ? "Arquivo gerado pelo sistema."
                : "Arquivo anexado ao registro."}
          </p>
          <p className="text-[11px] text-foreground-400">
            <kbd className="rounded border border-background-300 bg-background-100 px-1 py-0.5 text-[10px] font-semibold">
              Esc
            </kbd>{" "}
            para fechar
            {position && position.total > 1 ? " · ← → para navegar" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}