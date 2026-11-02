import { useEffect, useState, type ReactNode } from "react";
import { StatusPill } from "@/pages/app/components/ui";
import {
  canRequestRenewal,
  daysUntilExpiry,
  expiryDaysLabel,
  fileIcon,
  fileIconTone,
  isElectionDossierDocument,
  isPermanentDocument,
  isTypeWithoutValidity,
} from "@/pages/app/modules/documentos/documentUtils";
import type { DocumentRecord } from "@/mocks/documents";
import { renewalStatusMeta, type RenewalRequest } from "@/pages/app/modules/documentos/renewalStore";
import ReplacementTimeline from "@/pages/app/modules/documentos/components/ReplacementTimeline";
import { formatSwapMoment } from "@/pages/app/modules/documentos/documentChain";

interface DocumentPreviewDrawerProps {
  record: DocumentRecord | null;
  /** Unidade efetiva do documento (própria ou a do cadastro do colaborador). */
  unit: string;
  /** Janela de antecedência parametrizada, usada no destaque de vencimento. */
  warningDays: number;
  onClose: () => void;
  onOpenFile: (doc: DocumentRecord, download?: boolean) => void;
  onEditValidity: (doc: DocumentRecord) => void;
  /** Abre (ou cria) a solicitação de renovação do documento. */
  onRequestRenewal: (doc: DocumentRecord) => void;
  /** Solicitação em andamento do documento, quando existir. */
  renewalRequest?: RenewalRequest | null;
  onPrintQr: (doc: DocumentRecord) => void;
  /** Posição do documento dentro da lista filtrada/ordenada. */
  position?: { index: number; total: number };
  /** Navega para o documento anterior (-1) ou próximo (1) sem fechar a gaveta. */
  onNavigate?: (direction: 1 | -1) => void;
  /** Cadeia de substituição do documento (antigo ↔ novo). */
  chain?: DocumentRecord[];
  /** Abre outro documento da cadeia sem sair da gaveta. */
  onOpenChainDoc?: (doc: DocumentRecord) => void;
  /** Atalho para registrar a substituição deste documento. */
  onReplace?: (doc: DocumentRecord) => void;
}

interface DetailProps {
  label: string;
  icon: string;
  children: ReactNode;
}

function Detail({ label, icon, children }: DetailProps) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
        <i className={`${icon} text-xs`}></i>
        {label}
      </p>
      <div className="mt-1 text-sm leading-snug text-foreground-800">{children}</div>
    </div>
  );
}

/**
 * Pré-visualização lateral do documento.
 *
 * Abre ao clicar na linha da tabela, sem tirar o usuário da lista: dá para ler
 * os dados principais, conferir a validade e disparar as ações em sequência.
 * Fecha com Esc, clique no fundo ou no botão de fechar — e mantém o último
 * documento em tela durante a animação de saída.
 */
export default function DocumentPreviewDrawer({
  record,
  unit,
  warningDays,
  onClose,
  onOpenFile,
  onEditValidity,
  onRequestRenewal,
  renewalRequest,
  onPrintQr,
  position,
  onNavigate,
  chain,
  onOpenChainDoc,
  onReplace,
}: DocumentPreviewDrawerProps) {
  const [lastRecord, setLastRecord] = useState<DocumentRecord | null>(record);

  useEffect(() => {
    if (record) setLastRecord(record);
  }, [record]);

  const open = Boolean(record);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // O visualizador de arquivo abre por cima: enquanto estiver ativo, o Esc
      // e as setas são dele, e a gaveta continua aberta atrás.
      if (document.querySelector("[data-file-viewer]")) return;
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Setas trocam de documento sem sair da pré-visualização.
      if (!onNavigate || !position) return;
      if (event.key === "ArrowRight" && position.index < position.total - 1) onNavigate(1);
      if (event.key === "ArrowLeft" && position.index > 0) onNavigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onNavigate, position]);

  const doc = record ?? lastRecord;
  if (!doc) return null;

  const days = daysUntilExpiry(doc.expiresAt);
  const permanent = isPermanentDocument(doc.expiresAt);
  // Registro datado (ata, edital de resultado, termo de posse, dossiê, ordem de
  // serviço, aferição, DDS, ficha de presença, inspeção de campo, atestado
  // médico): não tem validade e não pode ser substituído.
  const noValidityType = isTypeWithoutValidity(doc.typeId, doc.typeName);
  // Peça de processo eleitoral da CIPA (edital de convocação): o pleito tem
  // data para começar e terminar, então o documento não renova nem é trocado —
  // a próxima edição é um novo edital, dentro de um novo processo eleitoral.
  const electionDossier = isElectionDossierDocument(doc.typeId, doc.typeName);
  const renewalAllowed = canRequestRenewal(doc);
  const windowDays = Number.isFinite(warningDays) ? Math.max(1, Math.round(warningDays)) : 30;
  const inWindow = days !== null && days <= windowDays;

  const fileLabel = doc.attachedPdfHtml
    ? "PDF gerado pelo sistema"
    : doc.storagePath
      ? "Arquivo no Storage"
      : doc.previewDataUrl
        ? "Imagem digitalizada"
        : "Sem arquivo anexado";

  // Elo vigente da cadeia: destino do atalho "Ver vigente".
  const chainVigente = chain && chain.length > 1
    ? [...chain].reverse().find((node) => !node.supersededByRef)
    : undefined;
  const canJumpToVigente = Boolean(
    doc.supersededByRef && chainVigente && chainVigente.id !== doc.id && onOpenChainDoc
  );

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[54] bg-foreground-950/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label={`Pré-visualização de ${doc.name}`}
        className={`fixed inset-y-0 right-0 z-[55] flex w-full max-w-[520px] flex-col border-l border-background-200 bg-background-50 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 border-b border-background-200 px-5 py-4">
          {doc.previewDataUrl ? (
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-background-200 bg-background-100">
              <img src={doc.previewDataUrl} alt={doc.name} className="h-full w-full object-cover" />
            </span>
          ) : (
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${fileIconTone[doc.fileType]}`}
            >
              <i className={`${fileIcon[doc.fileType]} text-xl`}></i>
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Pré-visualização
            </p>
            <h2 className="mt-0.5 font-heading text-base font-bold leading-snug text-foreground-950">
              {doc.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill status={doc.status} />
              {renewalRequest && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${renewalStatusMeta[renewalRequest.status].chip}`}
                >
                  <i className={renewalStatusMeta[renewalRequest.status].icon}></i>
                  {renewalStatusMeta[renewalRequest.status].label}
                </span>
              )}
              <span className="rounded-md bg-background-100 px-2 py-1 text-[11px] font-medium text-foreground-600">
                {doc.typeName}
              </span>
              {doc.approvalStatus && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                    doc.approvalStatus === "aprovada"
                      ? "bg-primary-100 text-primary-700"
                      : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  <i
                    className={
                      doc.approvalStatus === "aprovada" ? "ri-verified-badge-line" : "ri-timer-line"
                    }
                  ></i>
                  {doc.approvalStatus === "aprovada" ? "Aprovada" : "Aguardando aprovação"}
                </span>
              )}
              {doc.supersededByRef && (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2 py-1 text-[10px] font-semibold text-danger-800">
                  <i className="ri-arrow-go-back-line"></i>
                  Substituído
                </span>
              )}
              {doc.replacesRef && !doc.supersededByRef && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-1 text-[10px] font-semibold text-background-50">
                  <i className="ri-verified-badge-line"></i>
                  Vigente
                </span>
              )}
              {doc.replacesRef && doc.supersededByRef && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-1 text-[10px] font-semibold text-primary-800">
                  <i className="ri-swap-box-line"></i>
                  Substituição
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar pré-visualização"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Navegação entre documentos: revisa a lista inteira sem fechar */}
        {position && position.total > 1 && (
          <div className="flex items-center justify-between gap-2 border-b border-background-200 bg-background-100 px-4 py-2">
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

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {doc.supersededByRef && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger-300 bg-danger-100 px-3.5 py-3">
              <i className="ri-arrow-go-back-line mt-0.5 text-base text-danger-800"></i>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-danger-900">Documento substituído</p>
                <p className="mt-0.5 text-[11px] leading-snug text-danger-800">
                  Este registro foi trocado por um documento novo e permanece apenas para consulta e
                  histórico. A renovação é feita no documento que o substituiu.
                </p>
                {doc.supersededAt && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-danger-800">
                    <i className="ri-history-line"></i>
                    Trocado em {formatSwapMoment(doc.supersededAt)}
                  </p>
                )}
                {canJumpToVigente && chainVigente && (
                  <button
                    type="button"
                    onClick={() => onOpenChainDoc?.(chainVigente)}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                  >
                    <i className="ri-verified-badge-line"></i>
                    Ver vigente
                    <i className="ri-arrow-right-line"></i>
                  </button>
                )}
              </div>
            </div>
          )}

          {doc.replacesRef && (
            <div
              className={`mb-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${
                doc.supersededByRef
                  ? "border-primary-200 bg-primary-50"
                  : "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
              }`}
            >
              <i
                className={`mt-0.5 text-base ${
                  doc.supersededByRef ? "ri-swap-box-line text-primary-700" : "ri-verified-badge-line text-primary-700"
                }`}
              ></i>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-primary-900">
                  {doc.supersededByRef
                    ? "Registrado como substituição"
                    : "Vigente — registrado como substituição"}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-primary-800">
                  {doc.replacesName
                    ? `Substitui o documento "${doc.replacesName}", que passou para Vencido no histórico.`
                    : "Substitui um documento anterior, que passou para Vencido no histórico."}
                </p>
                {!doc.supersededByRef && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-background-50">
                    <i className="ri-verified-badge-line"></i>
                    Documento vigente da cadeia
                  </p>
                )}
                {doc.replacementReason && (
                  <p className="mt-1.5 rounded-md border border-primary-200 bg-background-50 px-2.5 py-2 text-[11px] leading-snug text-foreground-700">
                    <span className="font-semibold text-primary-900">Justificativa da validade: </span>
                    {doc.replacementReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cadeia de substituição: antigo ↔ novo */}
          {chain && onOpenChainDoc && (
            <ReplacementTimeline
              chain={chain}
              activeId={doc.id}
              onOpenDoc={onOpenChainDoc}
              className="mb-4"
            />
          )}

          {/* Peça de pleito: prazo próprio, sem renovação e sem substituição */}
          {electionDossier && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-secondary-300 bg-secondary-100 px-3.5 py-3">
              <i className="ri-government-line mt-0.5 text-base text-secondary-900"></i>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-secondary-900">
                  Peça de processo eleitoral — sem renovação
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-foreground-700">
                  Este edital abre um pleito com data e hora para terminar. Ele não é renovado nem
                  substituído: encerrado o processo, abra um novo processo eleitoral da CIPA e emita um
                  novo edital.
                </p>
              </div>
            </div>
          )}

          {/* Destaque de validade */}
          {permanent ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-3">
              <i className="ri-calendar-check-line mt-0.5 text-base text-primary-700"></i>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-primary-900">
                  {noValidityType ? "Documento sem validade" : "Documento permanente"}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-primary-800">
                  {noValidityType
                    ? "Este tipo de documento registra um fato datado: não vence, não entra nos alertas de vencimento e não pode ser substituído."
                    : "Sem data de validade definida. Cadastre uma data para que ele entre nos alertas de vencimento."}
                </p>
                {!noValidityType && (
                  <button
                    type="button"
                    onClick={() => onEditValidity(doc)}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-700"
                  >
                    <i className="ri-calendar-2-line"></i>
                    Definir validade
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${
                days !== null && days < 0
                  ? "border-danger-300 bg-danger-100"
                  : inWindow
                    ? "border-accent-200 bg-accent-50"
                    : "border-background-200 bg-background-100"
              }`}
            >
              <i
                className={`mt-0.5 text-base ${
                  days !== null && days < 0
                    ? "ri-error-warning-line text-danger-800"
                    : "ri-timer-line text-foreground-500"
                }`}
              ></i>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground-900">
                  {days !== null ? expiryDaysLabel(days) : doc.expiresAt}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-foreground-600">
                  Validade em <strong className="font-semibold">{doc.expiresAt}</strong>
                  {inWindow && days !== null && days >= 0
                    ? ` · dentro da janela de ${windowDays} dias de antecedência`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditValidity(doc)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-50 hover:text-primary-700"
                title="Corrigir a data de validade cadastrada (para renovar, use a solicitação)"
                aria-label="Corrigir data de validade cadastrada"
              >
                <i className="ri-edit-line text-sm"></i>
              </button>
            </div>
          )}

          {/* Dados principais */}
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
            <Detail label="Vínculo" icon="ri-link">
              {doc.scope === "empresa" ? "Empresa" : "Colaborador"}
            </Detail>
            <Detail label="Unidade" icon="ri-building-line">
              {unit || "Corporativo"}
            </Detail>
            <Detail label="Emissão" icon="ri-calendar-line">
              {doc.issuedAt}
            </Detail>
            <Detail label="Validade" icon="ri-calendar-check-line">
              {noValidityType ? "Não se aplica" : permanent ? "Sem validade" : doc.expiresAt}
            </Detail>
            {doc.scope === "colaborador" && (
              <Detail label="Colaborador" icon="ri-user-line">
                <span className="block truncate font-medium">{doc.collaboratorName || "—"}</span>
                {doc.collaboratorRole && (
                  <span className="mt-0.5 block truncate text-[11px] text-foreground-500">
                    {doc.collaboratorRole}
                  </span>
                )}
              </Detail>
            )}
            <Detail label="Tamanho" icon="ri-hard-drive-2-line">
              {doc.size}
            </Detail>
            <Detail label="Arquivo" icon="ri-attachment-2">
              {fileLabel}
            </Detail>
            <Detail label="Visibilidade" icon="ri-eye-line">
              {doc.visibleToCollaborator ? "Visível ao colaborador" : "Uso interno"}
            </Detail>
          </div>

          {/* Ações rápidas */}
          <div className="mt-6 border-t border-background-200 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Ações
            </p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onOpenFile(doc)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-3.5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-eye-line text-base"></i>
                Abrir arquivo
              </button>
              <button
                type="button"
                onClick={() => onOpenFile(doc, true)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-download-2-line text-base"></i>
                Baixar
              </button>
              {!doc.supersededByRef && renewalAllowed && (
                <button
                  type="button"
                  onClick={() => onRequestRenewal(doc)}
                  className={`inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    renewalRequest
                      ? "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                      : "bg-danger-600 text-background-50 hover:bg-danger-700"
                  }`}
                >
                  <i className={renewalRequest ? "ri-arrow-right-line text-base" : "ri-loop-right-line text-base"}></i>
                  {renewalRequest ? "Abrir solicitação" : "Solicitar renovação"}
                </button>
              )}
              {!doc.supersededByRef && onReplace && renewalAllowed && (
                <button
                  type="button"
                  onClick={() => onReplace(doc)}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-primary-300 bg-primary-50 px-3.5 py-2.5 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100 sm:col-span-2"
                >
                  <i className="ri-swap-box-line text-base"></i>
                  Substituir este documento
                </button>
              )}
              <button
                type="button"
                onClick={() => onPrintQr(doc)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-qr-code-line text-base"></i>
                Imprimir QR-Code
              </button>
            </div>
          </div>

          {/* Prévia da imagem, quando existir */}
          {doc.previewDataUrl && (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                Prévia do arquivo
              </p>
              <div className="mt-2 overflow-hidden rounded-lg border border-background-200 bg-background-100">
                <img
                  src={doc.previewDataUrl}
                  alt={doc.name}
                  className="max-h-[240px] w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-background-200 bg-background-100 px-5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-foreground-500">
            <i className="ri-information-line"></i>
            Pressione <kbd className="rounded border border-background-300 bg-background-50 px-1 py-0.5 text-[10px] font-semibold">Esc</kbd>
            para fechar ou as setas <kbd className="rounded border border-background-300 bg-background-50 px-1 py-0.5 text-[10px] font-semibold">←</kbd>
            <kbd className="rounded border border-background-300 bg-background-50 px-1 py-0.5 text-[10px] font-semibold">→</kbd>
            para navegar.
          </p>
        </div>
      </aside>
    </>
  );
}