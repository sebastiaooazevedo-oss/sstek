import { useEffect, useRef, useState, type DragEvent } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import type { CipaAta } from "@/mocks/cipa";
import type { DossierAttachment, DossierParts } from "@/mocks/documents";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

function iconForAttachment(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "ri-file-pdf-2-line";
  if (["doc", "docx", "rtf", "odt"].includes(ext)) return "ri-file-word-2-line";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "ri-file-excel-2-line";
  if (IMAGE_EXTENSIONS.includes(ext)) return "ri-image-line";
  return "ri-file-line";
}

interface DossierModalProps {
  open: boolean;
  onClose: () => void;
  electionTitle: string;
  cipaName: string;
  ata?: CipaAta;
  ataApproved: boolean;
  onConfirm: (parts: DossierParts, attachments: DossierAttachment[]) => void | Promise<void>;
  /** Seleção persistida do último dossiê gerado (pré-preenche o modal). */
  initialParts?: DossierParts;
  initialAttachments?: string[];
}

export default function DossierModal({
  open,
  onClose,
  electionTitle,
  cipaName,
  ata,
  ataApproved,
  onConfirm,
  initialParts,
  initialAttachments,
}: DossierModalProps) {
  const [parts, setParts] = useState<DossierParts>({
    convocacao: true,
    ata: true,
    resultado: true,
    posse: true,
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  // Pré-visualização (data URL) apenas para arquivos de imagem, por nome.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  // Enquanto o dossiê é chancelado no servidor, o botão trava e avisa.
  const [sealing, setSealing] = useState(false);

  // Guarda a última seleção recebida por props; o modal a lê no momento em que
  // abre (sem resetar enquanto estiver aberto).
  const lastSelection = useRef({ initialParts, initialAttachments });
  lastSelection.current = { initialParts, initialAttachments };

  // Sem ata localizada, a peça começa desmarcada (nada para incluir).
  useEffect(() => {
    if (!open) return;
    const preset = lastSelection.current;
    setParts(preset.initialParts ?? { convocacao: true, ata: Boolean(ata), resultado: true, posse: true });
    setAttachments(preset.initialAttachments ?? []);
    setPreviews({});
    setLightbox(null);
    setDragActive(false);
  }, [open, ata]);

  const toggle = (key: keyof DossierParts, disabled = false) => {
    if (disabled) return;
    setParts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const ataDescription = !ata
    ? "Nenhuma ata da comissão foi localizada para este processo."
    : ataApproved
      ? `Ata "${ata.title}" aprovada e assinada pela comissão.`
      : `Ata "${ata.title}" ainda pendente de aprovação/assinatura.`;

  const items: { key: keyof DossierParts; icon: string; title: string; description: string; disabled: boolean; disabledHint?: string }[] = [
    {
      key: "convocacao",
      icon: "ri-megaphone-line",
      title: "Edital de Convocação",
      description: "Convocação, prazo de inscrição e regras do processo eleitoral.",
      disabled: false,
    },
    {
      key: "ata",
      icon: "ri-file-text-line",
      title: "Ata da Comissão Eleitoral",
      description: ataDescription,
      disabled: !ata,
      disabledHint: !ata ? "Sem ata vinculada" : undefined,
    },
    {
      key: "resultado",
      icon: "ri-award-line",
      title: "Edital de Resultado / Publicação",
      description: "Apuração e relação oficial dos eleitos, com o carimbo de publicado.",
      disabled: false,
    },
    {
      key: "posse",
      icon: "ri-user-star-line",
      title: "Termo de Posse",
      description: "Posse dos eleitos para o mandato de 1 (um) ano, com campos de assinatura.",
      disabled: false,
    },
  ];

  const selectedCount = items.filter((item) => parts[item.key]).length;

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setAttachments((prev) => Array.from(new Set([...prev, ...files.map((f) => f.name)])));
    files.forEach((file) => {
      if (!isImageFile(file)) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setPreviews((prev) => ({ ...prev, [file.name]: result }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (name: string) => {
    setAttachments((prev) => prev.filter((f) => f !== name));
    setPreviews((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setLightbox((current) => (current === name ? null : current));
  };

  // Reordena um anexo na lista — a ordem da lista é a ordem em que os arquivos
  // entram no índice de anexos do dossiê.
  const moveAttachment = (name: string, direction: -1 | 1) => {
    setAttachments((prev) => {
      const index = prev.indexOf(name);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const moved = next[index];
      if (moved === undefined) return prev;
      next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    addFiles(event.dataTransfer?.files ?? null);
  };

  const handleConfirm = async () => {
    if (sealing) return;
    setSealing(true);
    try {
      await onConfirm(
        parts,
        attachments.map((name) => ({ name, previewDataUrl: previews[name] }))
      );
    } finally {
      setSealing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar Dossiê do Processo Eleitoral"
      subtitle={`${electionTitle || "Eleição da CIPA"} · ${cipaName}`}
      icon="ri-folder-shield-2-line"
      size="lg"
      footer={
        <>
          <span className="mr-auto text-xs font-medium text-foreground-500">
            {selectedCount} peça(s) selecionada(s)
          </span>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line" disabled={sealing}>
            Cancelar
          </ModalButton>
          <ModalButton
            onClick={() => void handleConfirm()}
            icon={sealing ? "ri-loader-4-line animate-spin" : "ri-file-pdf-2-line"}
            disabled={sealing}
          >
            {sealing ? "Chancelando…" : "Gerar dossiê"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-foreground-600">
          Escolha quais peças entram no dossiê. Cada uma é impressa em sua própria página, precedida de uma capa
          com o índice do conteúdo selecionado. Ao gerar, o dossiê é chancelado com QR-Code, código de verificação e
          hash do conteúdo — igual ao arquivo do pleito encerrado.
        </p>

        <div className="flex flex-col gap-2.5">
          {items.map((item) => {
            const checked = parts[item.key] && !item.disabled;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggle(item.key, item.disabled)}
                disabled={item.disabled}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  item.disabled
                    ? "cursor-not-allowed border-background-200 bg-background-100/60 opacity-70"
                    : checked
                      ? "border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950"
                      : "border-background-200 bg-background-50 hover:border-background-300"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    checked ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300 bg-background-50"
                  }`}
                >
                  {checked && <i className="ri-check-line text-xs"></i>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <i className={`${item.icon} text-base text-primary-700`}></i>
                    <span className="text-sm font-semibold text-foreground-950">{item.title}</span>
                    {item.key === "ata" && ata && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ataApproved ? "bg-secondary-100 text-secondary-800" : "bg-accent-100 text-accent-800"
                        }`}
                      >
                        {ataApproved ? "Aprovada" : "Aguardando aprovação"}
                      </span>
                    )}
                    {item.disabledHint && (
                      <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                        {item.disabledHint}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-foreground-600">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedCount === 0 && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-alert-line mt-0.5 text-base"></i>
            <span>Selecione ao menos uma peça para compor o dossiê.</span>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-background-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <i className="ri-attachment-2 text-base text-primary-700"></i>
              <span className="text-sm font-semibold text-foreground-950">Anexos externos</span>
              <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                opcional
              </span>
            </div>
            {attachments.length > 0 && (
              <span className="text-xs font-medium text-foreground-500">{attachments.length} arquivo(s)</span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-foreground-600">
            Anexe arquivos que não são gerados pelo sistema (ex.: edital assinado em papel, foto da ata física).
            Cada arquivo é arquivado em <strong className="font-semibold text-foreground-800">Documentos</strong>,
            vinculado a esta eleição, e passa a constar no índice de anexos do dossiê. Use as setas para definir a
            ordem em que os arquivos entram no índice.
          </p>

          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-3.5 transition-colors ${
              dragActive
                ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
                : "border-background-300 bg-background-100 hover:border-primary-400"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                dragActive ? "bg-primary-500 text-background-50" : "bg-primary-100 text-primary-700"
              }`}
            >
              <i className={`${dragActive ? "ri-drag-drop-line" : "ri-upload-cloud-2-line"} text-lg`}></i>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground-800">
                {dragActive ? "Solte os arquivos para anexar" : "Arraste arquivos aqui ou clique para anexar"}
              </span>
              <span className="block text-xs text-foreground-500">PDF, DOCX, XLSX ou imagem</span>
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {attachments.length > 0 && (
            <ul className="flex flex-col gap-2">
              {attachments.map((name, index) => {
                const preview = previews[name];
                return (
                  <li
                    key={name}
                    className="flex items-center gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background-200 text-[11px] font-bold text-foreground-600">
                      {index + 1}
                    </span>
                    {preview ? (
                      <button
                        type="button"
                        aria-label={`Ampliar ${name}`}
                        onClick={() => setLightbox(name)}
                        className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-100"
                      >
                        <img src={preview} alt={name} className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-foreground-950/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <i className="ri-zoom-in-line text-sm text-background-50"></i>
                        </span>
                      </button>
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-background-200 bg-background-100 text-foreground-500">
                        <i className={`${iconForAttachment(name)} text-lg`}></i>
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground-800">{name}</span>
                      <span className="block text-[11px] text-foreground-500">
                        {preview ? "Imagem · clique para ampliar" : "Arquivo anexado"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`Mover ${name} para cima`}
                        title="Mover para cima"
                        onClick={() => moveAttachment(name, -1)}
                        disabled={index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground-500"
                      >
                        <i className="ri-arrow-up-line text-base"></i>
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover ${name} para baixo`}
                        title="Mover para baixo"
                        onClick={() => moveAttachment(name, 1)}
                        disabled={index === attachments.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground-500"
                      >
                        <i className="ri-arrow-down-line text-base"></i>
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${name}`}
                      onClick={() => removeFile(name)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700"
                    >
                      <i className="ri-close-line text-base"></i>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {lightbox && previews[lightbox] && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-foreground-950/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex max-h-[80vh] max-w-[90vw] flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-background-200 px-4 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground-800">{lightbox}</span>
              <button
                type="button"
                aria-label="Fechar pré-visualização"
                onClick={() => setLightbox(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <img src={previews[lightbox]} alt={lightbox} className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
    </Modal>
  );
}