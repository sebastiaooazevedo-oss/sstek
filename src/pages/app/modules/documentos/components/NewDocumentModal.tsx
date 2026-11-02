import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { documentTypes, type DocumentRecord, type DocumentScope } from "@/mocks/documents";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { computeStatus, fileTypeFromName, formatDateInput } from "@/pages/app/modules/documentos/documentUtils";
import { uploadDocumentFile } from "@/pages/app/modules/documentos/documentsStore";

interface NewDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (doc: DocumentRecord) => void;
  defaultScope?: DocumentScope;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Formata o tamanho do arquivo em KB/MB. */
function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lê um arquivo como data URL (usado para a miniatura de imagens). */
function readAsDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

export default function NewDocumentModal({ open, onClose, onCreate, defaultScope = "colaborador" }: NewDocumentModalProps) {
  const collaborators = useCollaboratorsList();
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [scope, setScope] = useState<DocumentScope>(defaultScope);
  const [collaboratorId, setCollaboratorId] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [hasValidity, setHasValidity] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [otherTypeName, setOtherTypeName] = useState("");
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setTypeId("");
    setScope(defaultScope);
    setCollaboratorId("");
    setIssuedAt("");
    setHasValidity(false);
    setExpiresAt("");
    setOtherTypeName("");
    setVisible(true);
    setFile(null);
    setBusy(false);
    setError("");
  }, [open, defaultScope]);

  const typeOptions = useMemo(() => documentTypes.filter((t) => t.scope === scope), [scope]);
  const isOtherType = typeId === "outro-colaborador";

  const handleScope = (next: DocumentScope) => {
    setScope(next);
    setTypeId("");
    setCollaboratorId("");
    setOtherTypeName("");
  };

  const handlePickFile = (selected: File | null) => {
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setError("O arquivo excede o limite de 25 MB.");
      return;
    }
    setError("");
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError("Informe o nome do documento.");
      return;
    }
    if (!typeId) {
      setError("Selecione o tipo do documento.");
      return;
    }
    if (isOtherType && !otherTypeName.trim()) {
      setError("Informe qual é o tipo do documento.");
      return;
    }
    if (hasValidity && !expiresAt) {
      setError("Informe a data de vencimento do documento.");
      return;
    }
    if (scope === "colaborador" && !collaboratorId) {
      setError("Selecione o colaborador ao qual o documento será vinculado.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const type = typeOptions.find((t) => t.id === typeId);
      const collaborator = collaborators.find((c) => c.id === collaboratorId);
      const typeName = isOtherType ? otherTypeName.trim() : type?.name || "Documento";

      // Envia o arquivo real para o Storage privado e guarda o caminho salvo.
      let storagePath: string | undefined;
      let fileUrl: string | null = null;
      let previewDataUrl: string | undefined;
      if (file) {
        const uploaded = await uploadDocumentFile(file, 0);
        storagePath = uploaded?.path;
        fileUrl = uploaded?.url ?? null;
        if (file.type.startsWith("image/")) previewDataUrl = await readAsDataUrl(file);
      }

      const doc: DocumentRecord = {
        id: `d-${Date.now()}`,
        name: name.trim(),
        typeId,
        typeName,
        scope,
        collaboratorId: scope === "colaborador" ? collaboratorId : undefined,
        collaboratorName: scope === "colaborador" ? collaborator?.name : undefined,
        collaboratorRole: scope === "colaborador" ? collaborator?.role : undefined,
        issuedAt: formatDateInput(issuedAt),
        expiresAt: formatDateInput(hasValidity ? expiresAt : ""),
        status: computeStatus(hasValidity ? expiresAt : ""),
        size: file ? formatBytes(file.size) : "—",
        fileType: file ? fileTypeFromName(file.name) : "pdf",
        visibleToCollaborator: visible,
        storagePath,
        fileUrl: fileUrl ?? undefined,
        previewDataUrl,
      };
      onCreate(doc);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-file-add-line"
      title="Novo documento"
      subtitle="Registre o documento, escolha o tipo e defina o destinatário (Empresa ou Colaborador)."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </ModalButton>
          <ModalButton icon={busy ? "ri-loader-4-line" : "ri-check-line"} onClick={handleSubmit} disabled={busy}>
            {busy ? "Enviando..." : "Registrar documento"}
          </ModalButton>
        </>
      }
    >
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <Field label="Nome do documento" required>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: ASO Periódico 2026 — Carlos Menezes"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground-700">
            Destinatário <span className="text-accent-600">*</span>
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["colaborador", "empresa"] as DocumentScope[]).map((option) => {
              const active = scope === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleScope(option)}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                    active ? "border-primary-400 bg-primary-50" : "border-background-300 bg-background-50 hover:bg-background-100"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                      active ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600"
                    }`}
                  >
                    <i className={`${option === "colaborador" ? "ri-user-line" : "ri-building-2-line"} text-lg`}></i>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground-950">
                      {option === "colaborador" ? "Colaborador" : "Empresa"}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-foreground-500">
                      {option === "colaborador"
                        ? "ASO, EPI, PPP, Ordem de Serviço, certificados..."
                        : "PCMSO, LTCAT, PGR, AET, Mapa de Risco, acordos..."}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de documento" required>
            <div className="relative">
              <select className={selectClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Selecione o tipo</option>
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.required ? " (obrigatório)" : ""}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>

          {scope === "colaborador" ? (
            <Field label="Colaborador" required>
              <div className="relative">
                <select className={selectClass} value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)}>
                  <option value="">Selecione o colaborador</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.role}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
          ) : (
            <Field label="Vinculado à empresa">
              <div className="flex items-center gap-3 rounded-md border border-background-200 bg-background-100 px-3 py-2.5">
                <i className="ri-building-2-line text-lg text-secondary-700"></i>
                <span className="text-sm text-foreground-700">Metalúrgica Vega</span>
              </div>
            </Field>
          )}

          <Field label="Data de emissão">
            <input type="date" className={inputClass} value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </Field>
        </div>

        {isOtherType && (
          <Field label="Qual é o tipo do documento?" required hint="Descreva o tipo do documento personalizado.">
            <input
              type="text"
              className={inputClass}
              value={otherTypeName}
              onChange={(e) => setOtherTypeName(e.target.value)}
              placeholder="Ex.: Contrato de trabalho, Ficha de vacinação, Carteira de motorista..."
            />
          </Field>
        )}

        <div className="rounded-lg border border-background-200 bg-background-50 p-4">
          <label htmlFor="newdoc-validity-toggle" className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-calendar-check-line text-base"></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground-900">Este documento possui validade?</span>
                <span className="block text-xs text-foreground-500">
                  {hasValidity
                    ? "Informe a data de vencimento — ela é obrigatória."
                    : "Sem validade: o documento é tratado como permanente."}
                </span>
              </span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input
                id="newdoc-validity-toggle"
                type="checkbox"
                checked={hasValidity}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasValidity(checked);
                  if (!checked) setExpiresAt("");
                }}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-background-300 transition-colors peer-checked:bg-primary-500"></span>
              <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background-50 transition-transform peer-checked:translate-x-5"></span>
            </span>
          </label>

          {hasValidity && (
            <div className="mt-3.5">
              <span className="text-xs font-semibold text-foreground-700">
                Data de vencimento <span className="text-accent-600">*</span>
              </span>
              <input
                type="date"
                className="mt-1.5 w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:max-w-xs"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          )}
        </div>

        <Field label="Arquivo (opcional)" hint="O arquivo é salvo no armazenamento seguro e pode ser visualizado/baixado depois.">
          {file ? (
            <div className="flex items-center gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
              <i className="ri-file-line text-lg text-foreground-500"></i>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground-800">{file.name}</span>
              <span className="whitespace-nowrap text-xs text-foreground-400">{formatBytes(file.size)}</span>
              <button
                type="button"
                aria-label="Remover arquivo"
                disabled={busy}
                onClick={() => setFile(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700 disabled:opacity-50"
              >
                <i className="ri-close-line text-base"></i>
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-3.5 transition-colors hover:border-primary-400">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-upload-cloud-2-line text-lg"></i>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground-800">
                  Selecionar arquivo (PDF, DOCX, imagem)
                </span>
                <span className="block text-xs text-foreground-500">Tamanho máximo 25 MB</span>
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  handlePickFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-background-200 bg-background-50 px-4 py-3">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="h-4 w-4 accent-primary-500"
          />
          <span className="text-sm text-foreground-700">
            Visível ao colaborador
            <span className="ml-1 text-xs text-foreground-400">(conforme parametrização)</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}