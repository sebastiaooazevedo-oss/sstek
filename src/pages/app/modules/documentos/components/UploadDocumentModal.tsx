import { useEffect, useMemo, useRef, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { StatusPill } from "@/pages/app/components/ui";
import { documentTypes, type DocumentRecord, type DocumentScope } from "@/mocks/documents";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  canBeReplaced,
  computeStatus,
  fileIcon,
  fileIconTone,
  fileTypeFromName,
  formatDateInput,
  isElectionDossierDocument,
  isTypeWithoutValidity,
  parseValidityDate,
} from "@/pages/app/modules/documentos/documentUtils";
import { uploadDocumentFile, useDocuments } from "@/pages/app/modules/documentos/documentsStore";

/** Documento escolhido como alvo de uma substituição. */
export interface UploadReplacementTarget {
  id: string;
  name: string;
}

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (docs: DocumentRecord[], replacement?: UploadReplacementTarget) => void;
  /** Documento já escolhido como alvo da substituição (atalho "Substituir este documento"). */
  initialReplacementId?: string;
}

type UploadMode = "novo" | "substituicao";

/** Data de hoje no formato do input date (aaaa-mm-dd). */
function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

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

const modeMeta: { id: UploadMode; title: string; description: string; icon: string }[] = [
  {
    id: "novo",
    title: "Novo documento",
    description: "Um registro inédito no acervo da empresa.",
    icon: "ri-file-add-line",
  },
  {
    id: "substituicao",
    title: "Substituição",
    description: "Este arquivo entra no lugar de um documento existente.",
    icon: "ri-swap-box-line",
  },
];

export default function UploadDocumentModal({
  open,
  onClose,
  onUpload,
  initialReplacementId,
}: UploadDocumentModalProps) {
  const collaborators = useCollaboratorsList();
  const existingDocuments = useDocuments();
  const [mode, setMode] = useState<UploadMode>("novo");
  const [files, setFiles] = useState<File[]>([]);
  const [scope, setScope] = useState<DocumentScope>("colaborador");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [hasValidity, setHasValidity] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [issuedAt, setIssuedAt] = useState(todayInput());
  const [otherTypeName, setOtherTypeName] = useState("");
  // Busca e documento-alvo da substituição.
  const [replacementQuery, setReplacementQuery] = useState("");
  const [replacementId, setReplacementId] = useState("");
  // Alvo fixado pelo atalho "Substituir este documento": o documento já estava
  // aberto, então não faz sentido listar outros para escolher.
  const [lockedTarget, setLockedTarget] = useState(false);
  // Conferência lado a lado confirmada antes de registrar a substituição.
  const [comparisonConfirmed, setComparisonConfirmed] = useState(false);
  // Justificativa registrada quando a nova validade não avança em relação à anterior.
  const [regressionReason, setRegressionReason] = useState("");
  // Evita sinalizar "não avança" antes de o usuário tocar na validade do novo documento.
  const [validityTouched, setValidityTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prefillRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("novo");
    setFiles([]);
    setScope("colaborador");
    setCollaboratorId("");
    setTypeId("");
    setHasValidity(false);
    setExpiresAt("");
    setIssuedAt(todayInput());
    setOtherTypeName("");
    setReplacementQuery("");
    setReplacementId("");
    setLockedTarget(false);
    setComparisonConfirmed(false);
    setRegressionReason("");
    setValidityTouched(false);
    setBusy(false);
    setError("");
    prefillRef.current = null;
  }, [open]);

  const typeOptions = useMemo(() => documentTypes.filter((t) => t.scope === scope), [scope]);
  const selectedType = typeOptions.find((t) => t.id === typeId);
  const isOtherType = typeId === "outro-colaborador" || typeId === "outro-empresa";
  const isReplacement = mode === "substituicao";

  /** Unidade efetiva do documento (própria ou a do cadastro do colaborador). */
  const unitOf = (doc: DocumentRecord): string => {
    if (doc.establishment) return doc.establishment;
    if (!doc.collaboratorId) return "";
    return collaborators.find((c) => c.id === doc.collaboratorId)?.establishment || "";
  };

  // Candidatos à substituição: só documentos ativos (o que já foi substituído
  // não pode ser substituído de novo).
  const replacementCandidates = useMemo(() => {
    const term = replacementQuery.trim().toLowerCase();
    return existingDocuments
      .filter((doc) => canBeReplaced(doc))
      .filter((doc) => {
        if (!term) return true;
        return (
          doc.name.toLowerCase().includes(term) ||
          doc.typeName.toLowerCase().includes(term) ||
          (doc.collaboratorName || "").toLowerCase().includes(term) ||
          unitOf(doc).toLowerCase().includes(term)
        );
      })
      .slice(0, 60);
  }, [existingDocuments, replacementQuery, collaborators]);

  const selectedReplacement = existingDocuments.find((doc) => doc.id === replacementId) || null;
  // Substituição disparada com o documento já aberto: alvo travado, sem lista.
  const targetLocked = lockedTarget && Boolean(selectedReplacement);

  // Tipo escolhido no envio (inclui o alvo travado pelo atalho de substituição).
  const chosenTypeId = targetLocked && selectedReplacement ? selectedReplacement.typeId : typeId;
  const chosenTypeName =
    targetLocked && selectedReplacement
      ? selectedReplacement.typeName
      : isOtherType
        ? otherTypeName
        : selectedType?.name || "";
  // Registro datado: não tem validade e não pode ser substituído.
  const typeWithoutValidity = isTypeWithoutValidity(chosenTypeId, chosenTypeName);
  // Peça de processo eleitoral da CIPA (edital de convocação): não é renovada
  // nem substituída — a próxima edição é um novo edital, em outro pleito.
  const electionDossierType = isElectionDossierDocument(chosenTypeId, chosenTypeName);
  const noReplacementType = typeWithoutValidity || electionDossierType;

  // Valores do documento novo usados na conferência lado a lado.
  const newTypeLabel =
    targetLocked && selectedReplacement
      ? selectedReplacement.typeName
      : isOtherType
        ? otherTypeName.trim()
        : typeOptions.find((t) => t.id === typeId)?.name || "";
  const newIssuedLabel = issuedAt ? formatDateInput(issuedAt) : "—";
  const newExpiryLabel = !hasValidity
    ? "Sem validade"
    : expiresAt
      ? formatDateInput(expiresAt)
      : "A definir";
  const oldTypeLabel = selectedReplacement?.typeName || "—";
  const oldExpiryLabel = selectedReplacement?.expiresAt || "Sem validade";
  const typeDiverges = Boolean(
    selectedReplacement && newTypeLabel && newTypeLabel.trim() !== oldTypeLabel.trim()
  );
  const newExpiryDate = parseValidityDate(hasValidity ? expiresAt : "");
  const oldExpiryDate = selectedReplacement ? parseValidityDate(selectedReplacement.expiresAt) : null;
  // "Não avança" cobre os dois casos: nova data igual/anterior à anterior e
  // documento que tinha validade sendo registrado como permanente.
  const expiryRegressed = Boolean(
    oldExpiryDate &&
      ((hasValidity && newExpiryDate && newExpiryDate.getTime() <= oldExpiryDate.getTime()) ||
        (!hasValidity && validityTouched))
  );
  const missingNewData = !newTypeLabel || !issuedAt || (hasValidity && !expiresAt);
  const missingReason = expiryRegressed && regressionReason.trim().length < 15;

  const handleMode = (next: UploadMode) => {
    setMode(next);
    setLockedTarget(false);
    setReplacementId("");
    setReplacementQuery("");
    setComparisonConfirmed(false);
    setRegressionReason("");
    // Substituição trabalha com um único arquivo.
    if (next === "substituicao") setFiles((prev) => prev.slice(0, 1));
    setError("");
  };

  const handleScope = (next: DocumentScope) => {
    setScope(next);
    setTypeId("");
    setCollaboratorId("");
    setOtherTypeName("");
  };

  const handlePickReplacement = (doc: DocumentRecord) => {
    setLockedTarget(false);
    setReplacementId(doc.id);
    setScope(doc.scope);
    const typeExists = documentTypes.some((t) => t.id === doc.typeId && t.scope === doc.scope);
    if (typeExists) {
      setTypeId(doc.typeId);
      setOtherTypeName("");
    } else {
      setTypeId(doc.scope === "colaborador" ? "outro-colaborador" : "outro-empresa");
      setOtherTypeName(doc.typeName);
    }
    setCollaboratorId(doc.collaboratorId || "");
    setHasValidity(false);
    setExpiresAt("");
    setComparisonConfirmed(false);
    setRegressionReason("");
    setValidityTouched(false);
    setError("");
  };

  // Atalho "Substituir este documento": abre já no modo substituição com o
  // alvo preenchido, sem precisar buscar de novo.
  useEffect(() => {
    if (!open || !initialReplacementId) return;
    if (prefillRef.current === initialReplacementId) return;
    const target = existingDocuments.find((doc) => doc.id === initialReplacementId);
    if (!target) return;
    prefillRef.current = initialReplacementId;
    setMode("substituicao");
    setFiles((prev) => prev.slice(0, 1));
    handlePickReplacement(target);
    setLockedTarget(true);
  }, [open, initialReplacementId, existingDocuments]);

  // Registros datados (atas, editais de resultado, termos de posse, dossiês,
  // ordens de serviço, aferições, DDS, fichas de presença, inspeções de campo e
  // atestados médicos) não têm validade nem substituição: ao escolher um desses
  // tipos, o envio volta para "Novo documento" e a validade é limpa.
  useEffect(() => {
    if (!typeWithoutValidity) return;
    setHasValidity(false);
    setExpiresAt("");
    setValidityTouched(false);
  }, [typeWithoutValidity]);

  // Peças de pleito e registros datados nunca entram no modo substituição.
  useEffect(() => {
    if (!noReplacementType) return;
    setComparisonConfirmed(false);
    if (mode === "substituicao") {
      setMode("novo");
      setLockedTarget(false);
      setReplacementId("");
      setReplacementQuery("");
      setRegressionReason("");
    }
  }, [noReplacementType, mode]);

  const handleFiles = (selected: File[]) => {    if (selected.length === 0) return;
    // Substituição é sempre um documento por vez: um arquivo, um substituído.
    setFiles((prev) => (isReplacement ? [selected[0]] : [...prev, ...selected]));
    setError("");
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (isReplacement && !replacementId) {
      setError("Informe qual documento está sendo substituído. Busque por colaborador, documento ou filial.");
      return;
    }
    if (isReplacement && !comparisonConfirmed) {
      setError("Confira lado a lado o tipo, a emissão e a validade do documento novo com o anterior antes de confirmar.");
      return;
    }
    if (isReplacement && expiryRegressed && regressionReason.trim().length < 15) {
      setError(
        "A nova validade não avança em relação à do documento substituído. Registre a justificativa (mínimo 15 caracteres) para concluir."
      );
      return;
    }
    if (!issuedAt) {
      setError("Informe a data de emissão do documento.");
      return;
    }
    if (files.length === 0) {
      setError("Adicione ao menos um arquivo para enviar.");
      return;
    }
    if (isReplacement && files.length > 1) {
      setError("Na substituição, envie um arquivo por vez.");
      return;
    }
    // Com o alvo fixado pelo atalho, o novo documento herda vínculo, tipo,
    // colaborador e unidade do atual: ele assume exatamente o mesmo lugar.
    const effectiveScope: DocumentScope =
      targetLocked && selectedReplacement ? selectedReplacement.scope : scope;
    const effectiveTypeId =
      targetLocked && selectedReplacement ? selectedReplacement.typeId : typeId;
    const effectiveCollaboratorId =
      targetLocked && selectedReplacement
        ? selectedReplacement.collaboratorId || ""
        : effectiveScope === "colaborador"
          ? collaboratorId
          : "";

    const effectiveTypeName =
      targetLocked && selectedReplacement
        ? selectedReplacement.typeName
        : isOtherType
          ? otherTypeName.trim()
          : typeOptions.find((t) => t.id === effectiveTypeId)?.name || "Documento";
    // Registro datado nunca recebe validade, mesmo que o estado tenha sobrado
    // de uma seleção anterior.
    const usesValidity =
      hasValidity && !isTypeWithoutValidity(effectiveTypeId, effectiveTypeName);

    if (!effectiveTypeId) {
      setError("Selecione o tipo dos documentos enviados.");
      return;
    }
    if (!targetLocked && isOtherType && !otherTypeName.trim()) {
      setError("Informe qual é o tipo do documento enviado.");
      return;
    }
    if (usesValidity && !expiresAt) {
      setError("Informe a data de vencimento do documento.");
      return;
    }
    if (effectiveScope === "colaborador" && !effectiveCollaboratorId) {
      setError("Selecione o colaborador (vínculo) dos arquivos enviados.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const collaborator = collaborators.find((c) => c.id === effectiveCollaboratorId);
      const typeName = effectiveTypeName;
      const docs: DocumentRecord[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        // Envia o arquivo real para o Storage privado e guarda o caminho salvo.
        const uploaded = await uploadDocumentFile(file, index);
        const previewDataUrl = file.type.startsWith("image/") ? await readAsDataUrl(file) : undefined;
        docs.push({
          id: `d-up-${Date.now()}-${index}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          typeId: effectiveTypeId,
          typeName,
          scope: effectiveScope,
          collaboratorId: effectiveScope === "colaborador" ? effectiveCollaboratorId : undefined,
          collaboratorName:
            effectiveScope === "colaborador"
              ? targetLocked && selectedReplacement
                ? selectedReplacement.collaboratorName
                : collaborator?.name
              : undefined,
          collaboratorRole:
            effectiveScope === "colaborador"
              ? targetLocked && selectedReplacement
                ? selectedReplacement.collaboratorRole
                : collaborator?.role
              : undefined,
          issuedAt: formatDateInput(issuedAt),
          expiresAt: formatDateInput(usesValidity ? expiresAt : ""),
          status: computeStatus(usesValidity ? expiresAt : ""),
          size: formatBytes(file.size),
          fileType: fileTypeFromName(file.name),
          visibleToCollaborator: effectiveScope === "colaborador",
          establishment:
            (selectedReplacement ? unitOf(selectedReplacement) : "") ||
            (effectiveScope === "colaborador" ? collaborator?.establishment : "") ||
            undefined,
          storagePath: uploaded?.path,
          fileUrl: uploaded?.url ?? undefined,
          previewDataUrl,
          replacesRef: isReplacement ? selectedReplacement?.id : undefined,
          replacesName: isReplacement ? selectedReplacement?.name : undefined,
          replacementReason:
            isReplacement && expiryRegressed ? regressionReason.trim() : undefined,
        });
      }
      onUpload(
        docs,
        isReplacement && selectedReplacement
          ? { id: selectedReplacement.id, name: selectedReplacement.name }
          : undefined
      );
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
      icon={isReplacement ? "ri-swap-box-line" : "ri-upload-cloud-2-line"}
      title={isReplacement ? "Substituir documento" : "Enviar arquivos"}
      subtitle={
        isReplacement
          ? targetLocked
            ? "Este é o documento aberto: o arquivo novo entra no mesmo lugar e passa a ser o vigente."
            : "Escolha o documento que está sendo trocado. Ele fica marcado como Vencido e o novo assume o acervo."
          : "Faça o upload dos arquivos e selecione o vínculo (Empresa ou Colaborador)."
      }
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </ModalButton>
          <ModalButton
            icon={busy ? "ri-loader-4-line" : isReplacement ? "ri-swap-box-line" : "ri-upload-2-line"}
            onClick={handleSubmit}
            disabled={
              busy ||
              (isReplacement && (!comparisonConfirmed || missingNewData || missingReason))
            }
          >
            {busy
              ? "Enviando..."
              : isReplacement
                ? "Registrar substituição"
                : `Enviar ${files.length > 0 ? `${files.length} arquivo(s)` : "arquivos"}`}
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

      {/* Tipo de envio: novo documento x substituição */}
      {!targetLocked && (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground-700">
          Este envio é <span className="text-accent-600">*</span>
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {modeMeta.filter((option) => !(noReplacementType && option.id === "substituicao")).map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleMode(option.id)}
                aria-pressed={active}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? "border-primary-400 bg-primary-50"
                    : "border-background-300 bg-background-50 hover:bg-background-100"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                    active ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600"
                  }`}
                >
                  <i className={`${option.icon} text-lg`}></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground-950">{option.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-foreground-500">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {typeWithoutValidity && (
          <div className="flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
            <i className="ri-lock-line mt-0.5 text-sm text-foreground-500"></i>
            <span className="min-w-0">
              <strong className="font-semibold text-foreground-900">{chosenTypeName || "Este tipo"}</strong>{" "}
              registra um fato datado: <strong className="font-semibold text-foreground-900">não possui data de
              validade</strong> e <strong className="font-semibold text-foreground-900">não pode ser substituído</strong>.
              Cada ocorrência entra como um novo documento no acervo.
            </span>
          </div>
        )}

        {electionDossierType && (
          <div className="flex items-start gap-2.5 rounded-lg border border-secondary-200 bg-secondary-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-700">
            <i className="ri-government-line mt-0.5 text-sm text-secondary-900"></i>
            <span className="min-w-0">
              <strong className="font-semibold text-foreground-900">{chosenTypeName || "Este tipo"}</strong>{" "}
              pertence a um processo eleitoral com data e hora para terminar:{" "}
              <strong className="font-semibold text-foreground-900">não é renovado nem substituído</strong>.
              Encerrado o pleito, emita um novo edital dentro de um novo processo eleitoral da CIPA.
            </span>
          </div>
        )}
      </div>
      )}

      {/* Seleção do documento substituído */}
      {isReplacement && (
        <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
              <i className={targetLocked ? "ri-lock-line text-base" : "ri-search-eye-line text-base"}></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-900">
                {targetLocked ? "Documento sendo substituído" : "Qual documento está sendo substituído?"}{" "}
                {!targetLocked && <span className="text-accent-600">*</span>}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                {targetLocked
                  ? "O alvo já vem do documento que estava aberto — sem precisar buscar de novo."
                  : "Busque por nome do colaborador, nome do documento ou filial."}
              </p>
            </div>
          </div>

          {targetLocked && selectedReplacement ? (
            <div className="mt-3 rounded-lg border border-primary-300 bg-primary-50 px-3.5 py-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${fileIconTone[selectedReplacement.fileType]}`}
                >
                  <i className={`${fileIcon[selectedReplacement.fileType]} text-base`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">
                    {selectedReplacement.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground-600">
                    <span className="rounded bg-background-50 px-1.5 py-0.5 font-medium text-foreground-700">
                      {selectedReplacement.typeName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i
                        className={
                          selectedReplacement.scope === "empresa"
                            ? "ri-building-2-line"
                            : "ri-user-line"
                        }
                      ></i>
                      {selectedReplacement.scope === "empresa"
                        ? "Empresa"
                        : selectedReplacement.collaboratorName || "Colaborador"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      {unitOf(selectedReplacement) || "Corporativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-foreground-500">
                    Validade atual{" "}
                    <strong className="font-semibold text-foreground-700">
                      {selectedReplacement.expiresAt}
                    </strong>
                  </p>
                </div>
                <StatusPill status={computeStatus(selectedReplacement.expiresAt)} />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-primary-200 pt-2">
                <p className="text-[11px] leading-relaxed text-primary-900">
                  <i className="ri-arrow-right-down-line mr-1"></i>
                  O arquivo novo entra exatamente neste lugar e passa a ser o documento vigente.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLockedTarget(false);
                    setComparisonConfirmed(false);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                >
                  <i className="ri-file-search-line text-xs"></i>
                  Trocar o documento-alvo
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="mt-3 flex items-center rounded-lg border border-background-300 bg-background-50 pl-1 pr-2 transition-colors focus-within:border-primary-400">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="search"
              value={replacementQuery}
              onChange={(e) => setReplacementQuery(e.target.value)}
              placeholder="Ex.: Carlos Menezes, ASO, Filial Campinas..."
              className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
            {replacementQuery && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setReplacementQuery("")}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-foreground-700"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>

          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {replacementCandidates.map((doc) => {
              const active = doc.id === replacementId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => handlePickReplacement(doc)}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                      active
                        ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                        : "border-background-200 bg-background-50 hover:border-primary-300 hover:bg-background-100"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        active ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500"
                      }`}
                    >
                      <i className={active ? "ri-check-line text-base" : "ri-file-text-line text-base"}></i>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground-950">
                        {doc.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-foreground-500">
                        <span className="rounded bg-background-100 px-1.5 py-0.5 font-medium text-foreground-600">
                          {doc.typeName}
                        </span>
                        {doc.collaboratorName && <span>{doc.collaboratorName}</span>}
                        <span>· {unitOf(doc) || "Corporativo"}</span>
                        <span>· validade {doc.expiresAt}</span>
                      </span>
                    </span>
                    <StatusPill status={computeStatus(doc.expiresAt)} />
                  </button>
                </li>
              );
            })}
          </ul>

          {replacementCandidates.length === 0 && (
            <div className="mt-3 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center">
              <i className="ri-file-search-line text-xl text-foreground-400"></i>
              <p className="text-sm font-semibold text-foreground-800">Nenhum documento encontrado</p>
              <p className="text-xs text-foreground-500">
                Ajuste a busca ou marque o envio como "Novo documento".
              </p>
            </div>
          )}
            </>
          )}

          {selectedReplacement && (
            <div className="mt-3 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
              <i className="ri-information-line mt-0.5 text-sm"></i>
              <span className="min-w-0">
                Ao registrar, <strong className="font-semibold">{selectedReplacement.name}</strong> passa para
                a situação <strong className="font-semibold">Vencido</strong> e continua consultável no
                histórico por colaborador, filial e filtros de vencidos.{" "}
                {targetLocked
                  ? "O arquivo novo assume o lugar dele e passa a ser o documento vigente — basta anexar o arquivo, informar a emissão e a validade."
                  : "Preencha todos os dados do novo documento normalmente."}
              </span>
            </div>
          )}
        </div>
      )}

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-8 text-center transition-colors hover:border-primary-400">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-drag-drop-line text-2xl"></i>
        </span>
        <span className="mt-1 text-sm font-semibold text-foreground-900">Arraste os arquivos ou clique para selecionar</span>
        <span className="text-xs text-foreground-500">
          PDF, DOCX, XLSX ou imagens · até 25 MB por arquivo
          {isReplacement ? " · substituição aceita 1 arquivo por envio" : ""}
        </span>
        <input
          type="file"
          multiple={!isReplacement}
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5"
            >
              <i className="ri-file-line text-lg text-foreground-500"></i>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground-800">{file.name}</span>
              <span className="whitespace-nowrap text-xs text-foreground-400">{formatBytes(file.size)}</span>
              <button
                type="button"
                aria-label="Remover arquivo"
                disabled={busy}
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700 disabled:opacity-50"
              >
                <i className="ri-close-line text-base"></i>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {targetLocked && selectedReplacement ? (
          <div className="rounded-lg border border-background-200 bg-background-100/70 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                <i className="ri-map-pin-2-line text-base"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-900">Destino do documento novo</p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                  O envio mantém vínculo, tipo, colaborador e unidade do documento atual — nada muda de lugar.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Vínculo</p>
                <p className="mt-0.5 truncate text-sm text-foreground-800">
                  {selectedReplacement.scope === "empresa" ? "Empresa" : "Colaborador"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Tipo</p>
                <p className="mt-0.5 truncate text-sm text-foreground-800">{selectedReplacement.typeName}</p>
              </div>
              {selectedReplacement.scope === "colaborador" && (
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Colaborador</p>
                  <p className="mt-0.5 truncate text-sm text-foreground-800">
                    {selectedReplacement.collaboratorName || "—"}
                  </p>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Unidade</p>
                <p className="mt-0.5 truncate text-sm text-foreground-800">
                  {unitOf(selectedReplacement) || "Corporativo"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground-700">
            Vínculo do documento <span className="text-accent-600">*</span>
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["colaborador", "empresa"] as DocumentScope[]).map((option) => {
              const active = scope === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleScope(option)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
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
                  <span className="text-sm font-semibold text-foreground-950">
                    {option === "colaborador" ? "Documento do colaborador" : "Documento da empresa"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo do documento" required>
            <div className="relative">
              <select className={selectClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Selecione o tipo</option>
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>

          {scope === "colaborador" ? (
            <Field label="Vincular ao colaborador" required>
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
        </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Data de emissão"
            required
            hint="Data em que o documento foi emitido — usada na conferência da substituição."
          >
            <input
              type="date"
              className={inputClass}
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </Field>
          <Field label="Situação do envio">
            <div className="flex items-center gap-2.5 rounded-md border border-background-200 bg-background-100 px-3 py-2.5">
              <i
                className={`${isReplacement ? "ri-swap-box-line" : "ri-file-add-line"} text-lg ${isReplacement ? "text-accent-700" : "text-primary-700"}`}
              ></i>
              <span className="text-sm text-foreground-700">
                {isReplacement
                  ? "Substituição — o anterior passa para Vencido"
                  : "Novo documento no acervo"}
              </span>
            </div>
          </Field>
        </div>

        {selectedType?.description && (
          <div className="-mt-1 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900">
            <i className="ri-information-line mt-0.5 text-sm"></i>
            <span className="min-w-0">
              <strong className="font-semibold">{selectedType.name.split(" — ")[0]}</strong>
              {" · "}
              {selectedType.description}
            </span>
          </div>
        )}

        {isOtherType && !targetLocked && (
          <Field
            label="Qual é o tipo do documento?"
            required
            hint="Descreva o tipo do documento personalizado enviado."
          >
            <input
              type="text"
              className={inputClass}
              value={otherTypeName}
              onChange={(e) => setOtherTypeName(e.target.value)}
              placeholder="Ex.: Contrato de trabalho, Ficha de vacinação, Carteira de motorista..."
            />
          </Field>
        )}

        {typeWithoutValidity ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
              <i className="ri-file-shield-2-line text-base"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-900">Documento sem data de validade</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
                Este tipo de documento não vence: fica sempre em dia, não entra nos alertas de
                vencimento e não abre solicitação de renovação.
              </p>
            </div>
          </div>
        ) : (
        <div className="rounded-lg border border-background-200 bg-background-50 p-4">
          <label htmlFor="validity-toggle" className="flex cursor-pointer items-center justify-between gap-3">
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
                id="validity-toggle"
                type="checkbox"
                checked={hasValidity}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasValidity(checked);
                  setValidityTouched(true);
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
                onChange={(e) => {
                  setExpiresAt(e.target.value);
                  setValidityTouched(true);
                }}
              />
            </div>
          )}
        </div>
        )}

        {isReplacement && selectedReplacement && (
          <div className="rounded-lg border border-primary-200 bg-background-50 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-layout-column-line text-base"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-900">
                  Conferência lado a lado <span className="text-accent-600">*</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                  Compare tipo, emissão e validade do documento novo com o que será substituído antes de
                  confirmar.
                </p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[440px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-background-200">
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Campo
                    </th>
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      Documento substituído
                    </th>
                    <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-primary-700">
                      Novo documento
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <tr className="border-b border-background-100">
                    <td className="px-2 py-2.5 font-semibold text-foreground-600">Tipo</td>
                    <td className="px-2 py-2.5 text-foreground-800">{oldTypeLabel}</td>
                    <td
                      className={`px-2 py-2.5 ${typeDiverges ? "font-semibold text-accent-800" : "text-foreground-900"}`}
                    >
                      {newTypeLabel || "—"}
                      {typeDiverges && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-800">
                          <i className="ri-error-warning-line"></i>
                          Diferente
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-background-100">
                    <td className="px-2 py-2.5 font-semibold text-foreground-600">Emissão</td>
                    <td className="px-2 py-2.5 text-foreground-800">{selectedReplacement.issuedAt || "—"}</td>
                    <td className="px-2 py-2.5 text-foreground-900">{newIssuedLabel}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2.5 font-semibold text-foreground-600">Validade</td>
                    <td className="px-2 py-2.5 text-foreground-800">{oldExpiryLabel}</td>
                    <td
                      className={`px-2 py-2.5 ${expiryRegressed ? "font-semibold text-accent-800" : "text-foreground-900"}`}
                    >
                      {newExpiryLabel}
                      {expiryRegressed && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-800">
                          <i className="ri-error-warning-line"></i>
                          Não avança
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {(typeDiverges || expiryRegressed) && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5 text-[11px] leading-relaxed text-accent-900">
                <i className="ri-alert-line mt-0.5 text-sm"></i>
                <span className="min-w-0">
                  {typeDiverges && <span className="block">O tipo do documento novo é diferente do substituído.</span>}
                  {expiryRegressed && (
                    <span className="block">
                      A nova validade não avança em relação à do documento substituído. O registro continua
                      como consta no arquivo enviado e exige justificativa abaixo.
                    </span>
                  )}
                </span>
              </div>
            )}

            {expiryRegressed && (
              <div className="mt-3 rounded-md border border-accent-300 bg-accent-50 p-3">
                <label htmlFor="regression-reason" className="block text-xs font-semibold text-accent-900">
                  Justificativa da validade que não avança <span className="text-accent-700">*</span>
                </label>
                <p className="mt-0.5 text-[11px] leading-relaxed text-accent-800">
                  Explique por que o documento novo mantém ou reduz a validade anterior (ex.: exigência do
                  órgão emissor, reaproveitamento de laudo, correção de data). Fica registrada no histórico
                  da troca.
                </p>
                <textarea
                  id="regression-reason"
                  value={regressionReason}
                  onChange={(e) => setRegressionReason(e.target.value.slice(0, 300))}
                  rows={3}
                  maxLength={300}
                  placeholder="Descreva o motivo da validade não avançar..."
                  className="mt-2 w-full resize-none rounded-md border border-accent-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-accent-500"
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-accent-800">
                  <span>
                    {regressionReason.trim().length < 15
                      ? `Faltam ${15 - regressionReason.trim().length} caractere(s) para liberar o registro.`
                      : "Justificativa registrada no histórico da substituição."}
                  </span>
                  <span className="whitespace-nowrap">{regressionReason.length}/300</span>
                </div>
              </div>
            )}

            <label
              htmlFor="replacement-confirmation"
              className={`mt-3 flex items-start gap-2.5 rounded-md border px-3 py-2.5 ${
                comparisonConfirmed ? "border-primary-300 bg-primary-50" : "border-background-300 bg-background-50"
              } ${missingNewData ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
            >
              <input
                id="replacement-confirmation"
                type="checkbox"
                checked={comparisonConfirmed}
                disabled={missingNewData}
                onChange={(e) => setComparisonConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
              />
              <span className="min-w-0 text-[11px] leading-relaxed text-foreground-700">
                <strong className="font-semibold text-foreground-900">Confirmo a conferência.</strong>{" "}
                Tipo, emissão e validade do novo documento foram comparados com o anterior, e os dados do
                novo documento estão preenchidos corretamente.
                {missingNewData && (
                  <span className="mt-1 block text-accent-800">
                    Preencha tipo, emissão e (se houver) validade do novo documento para liberar a confirmação.
                  </span>
                )}
              </span>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}