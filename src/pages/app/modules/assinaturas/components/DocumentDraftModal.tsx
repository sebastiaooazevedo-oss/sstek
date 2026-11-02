import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import type { SignatureActor } from "@/pages/app/signature/signatureService";
import {
  createDocumentAction,
  submitDocumentAction,
  updateDocumentAction,
} from "@/pages/app/signature/documentStore";
import {
  categoryTemplates,
  declarationOptions,
  declarationTextFor,
  documentTypeLabels,
  type DeclarationOption,
  type SignatureDeclarationType,
  type SignatureDocType,
  type SignatureDocument,
} from "@/pages/app/signature/documentService";
import DocumentSheet from "./DocumentSheet";

interface DraftSignatory {
  collaboratorRef: string;
  name: string;
  role: string;
  email: string;
  positionX: number;
  positionY: number;
}

interface DraftField {
  label: string;
  value: string;
}

interface DocumentDraftModalProps {
  open: boolean;
  onClose: () => void;
  actor: SignatureActor;
  editing: SignatureDocument | null;
  onSaved: (message: string) => void;
}

const emptyField: DraftField = { label: "", value: "" };

const defaultFields: DraftField[] = [
  { label: "Colaborador", value: "" },
  { label: "Matrícula", value: "" },
  { label: "Data", value: new Date().toLocaleDateString("pt-BR") },
];

const typeOptions: SignatureDocType[] = ["epi", "dds", "certificado", "apr", "outro"];

export default function DocumentDraftModal({
  open,
  onClose,
  actor,
  editing,
  onSaved,
}: DocumentDraftModalProps) {
  const collaborators = useCollaboratorsList();
  const [docType, setDocType] = useState<SignatureDocType>("epi");
  const [title, setTitle] = useState("");
  const [declarationType, setDeclarationType] = useState<SignatureDeclarationType>("epi_receipt");
  const [declarationText, setDeclarationText] = useState(declarationTextFor("epi_receipt"));
  const [dueAt, setDueAt] = useState("");
  const [fields, setFields] = useState<DraftField[]>(defaultFields);
  const [signatories, setSignatories] = useState<DraftSignatory[]>([]);
  const [activeSignatoryId, setActiveSignatoryId] = useState<string | null>(null);
  const [pickRef, setPickRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    if (editing) {
      setDocType(editing.docType);
      setTitle(editing.title);
      setDeclarationType(editing.declarationType);
      setDeclarationText(editing.declarationText || declarationTextFor(editing.declarationType));
      setDueAt(editing.dueAt ? editing.dueAt.slice(0, 10) : "");
      const editingFields = (editing.content as { fields?: DraftField[] }).fields;
      setFields(Array.isArray(editingFields) && editingFields.length ? editingFields : defaultFields);
      setSignatories(
        editing.signatories.map((s) => ({
          collaboratorRef: s.collaboratorRef,
          name: s.name,
          role: s.roleLabel || "",
          email: s.email || "",
          positionX: s.positionX,
          positionY: s.positionY,
        }))
      );
      setActiveSignatoryId(editing.signatories[0]?.id ?? null);
    } else {
      setDocType("epi");
      setTitle("");
      setDeclarationType("epi_receipt");
      setDeclarationText(declarationTextFor("epi_receipt"));
      setDueAt("");
      setFields(defaultFields);
      setSignatories([]);
      setActiveSignatoryId(null);
    }
    setPickRef("");
  }, [open, editing]);

  const handleDeclarationType = (id: SignatureDeclarationType) => {
    setDeclarationType(id);
    setDeclarationText(declarationTextFor(id));
  };

  const handleDocType = (type: SignatureDocType) => {
    setDocType(type);
    setFields(categoryTemplates[type].fields.map((f) => ({ ...f })));
  };

  const addSignatory = (ref: string) => {
    if (!ref) return;
    if (signatories.some((s) => s.collaboratorRef === ref)) {
      setError("Este colaborador já está na lista de signatários.");
      return;
    }
    const person = collaborators.find((c) => c.id === ref);
    if (!person) return;
    const index = signatories.length;
    setSignatories([
      ...signatories,
      {
        collaboratorRef: person.id,
        name: person.name,
        role: person.role,
        email: person.email,
        positionX: 50,
        positionY: 68 + index * 8,
      },
    ]);
    setError("");
  };

  const updateSignatory = (ref: string, patch: Partial<DraftSignatory>) => {
    setSignatories((prev) => prev.map((s) => (s.collaboratorRef === ref ? { ...s, ...patch } : s)));
  };

  const removeSignatory = (ref: string) => {
    setSignatories((prev) => prev.filter((s) => s.collaboratorRef !== ref));
  };

  const handlePlace = (ref: string, x: number, y: number) => {
    updateSignatory(ref, { positionX: x, positionY: y });
  };

  const updateField = (index: number, patch: Partial<DraftField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const previewDoc: SignatureDocument = useMemo(
    () => ({
      id: editing?.id ?? "previsto",
      documentUid: editing?.documentUid ?? null,
      docType,
      title: title || "Documento sem título",
      declarationType,
      declarationText,
      content: { fields: fields.filter((f) => f.label.trim()) },
      contentHash: null,
      basePdfHash: null,
      finalPdfHash: null,
      evidenceReportHash: null,
      validationToken: null,
      requiredLevel: editing?.requiredLevel ?? "simples",
      certificateRequired: editing?.certificateRequired ?? false,
      status: "rascunho",
      version: editing?.version ?? 1,
      dueAt: dueAt || null,
      createdByRef: null,
      submittedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledReason: null,
      supersedesDocumentId: null,
      supersededByDocumentId: null,
      createdAt: "",
      signatories: signatories.map((s, i) => ({
        id: s.collaboratorRef,
        collaboratorRef: s.collaboratorRef,
        name: s.name,
        roleLabel: s.role || null,
        email: s.email || null,
        positionPage: 1,
        positionX: s.positionX,
        positionY: s.positionY,
        orderIndex: i,
        status: "pendente" as const,
        signedAt: null,
      })),
    }),
    [editing, docType, title, declarationType, declarationText, fields, dueAt, signatories]
  );

  const persist = async (submit: boolean) => {
    if (!title.trim()) {
      setError("Informe o título do documento.");
      return;
    }
    if (signatories.length === 0) {
      setError("Adicione ao menos um signatário.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = {
        docType,
        title: title.trim(),
        declarationType,
        declarationText,
        content: { fields: fields.filter((f) => f.label.trim()) },
        dueAt: dueAt || null,
        signatories: signatories.map((s) => ({
          collaboratorRef: s.collaboratorRef,
          name: s.name,
          role: s.role || null,
          email: s.email || null,
          positionPage: 1,
          positionX: s.positionX,
          positionY: s.positionY,
        })),
      };
      let docId = editing?.id;
      if (editing) {
        await updateDocumentAction(actor, editing.id, input);
      } else {
        docId = await createDocumentAction(actor, input);
      }
      if (submit && docId) {
        await submitDocumentAction(actor, docId);
        onSaved("Documento enviado. Conteúdo, versão, signatários e posições foram congelados e o PDF-base recebeu hash no servidor.");
      } else {
        onSaved("Rascunho salvo. Você ainda pode editar dados, signatários e posições antes de enviar.");
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível salvar o documento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-file-edit-line"
      title={editing ? "Editar rascunho" : "Novo documento para assinatura"}
      subtitle="Preencha os dados, escolha os signatários, seus papéis e onde cada assinatura aparece."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton variant="ghost" onClick={() => persist(false)} icon="ri-save-3-line">
            {saving ? "Salvando..." : "Salvar rascunho"}
          </ModalButton>
          <ModalButton onClick={() => persist(true)} icon="ri-send-plane-line">
            {saving ? "Enviando..." : "Salvar e enviar"}
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo de documento" required>
              <select value={docType} onChange={(e) => handleDocType(e.target.value as SignatureDocType)} className={selectClass}>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {documentTypeLabels[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prazo limite" hint="Opcional">
              <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} />
            </Field>
          </div>

          <p className="flex items-start gap-1.5 rounded-md bg-background-100 px-3 py-2 text-[11px] leading-relaxed text-foreground-600">
            <i className="ri-information-line mt-0.5 text-secondary-700"></i>
            <span>{categoryTemplates[docType].note}</span>
          </p>

          <Field label="Título do documento" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ficha de EPI — entrega 0291"
              className={inputClass}
            />
          </Field>

          <div>
            <p className="text-xs font-semibold text-foreground-700">Finalidade / declaração</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {declarationOptions.map((option: DeclarationOption) => {
                const active = declarationType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleDeclarationType(option.id)}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      active ? "border-primary-400 bg-primary-50" : "border-background-200 bg-background-50 hover:bg-background-100"
                    }`}
                  >
                    <span className="block font-semibold text-foreground-900">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-foreground-500">{option.hint}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              value={declarationText}
              onChange={(e) => setDeclarationText(e.target.value)}
              maxLength={500}
              rows={3}
              className={`${inputClass} mt-2 resize-none`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground-700">Dados do documento</p>
              <button
                type="button"
                onClick={() => setFields([...fields, { ...emptyField }])}
                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary-700 hover:text-primary-800"
              >
                <i className="ri-add-line"></i>
                Adicionar campo
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="Rótulo"
                    className={`${inputClass} max-w-[40%]`}
                  />
                  <input
                    value={f.value}
                    onChange={(e) => updateField(i, { value: e.target.value })}
                    placeholder="Valor"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    aria-label="Remover campo"
                    onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground-400 hover:bg-accent-50 hover:text-accent-700"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-foreground-700">Signatários e papéis</p>
            <div className="mt-2 flex items-center gap-2">
              <select value={pickRef} onChange={(e) => setPickRef(e.target.value)} className={selectClass}>
                <option value="">Selecione um colaborador…</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.role}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => addSignatory(pickRef)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-secondary-600"
              >
                <i className="ri-user-add-line"></i>
                Incluir
              </button>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {signatories.map((s) => {
                const active = activeSignatoryId === s.collaboratorRef;
                return (
                  <li
                    key={s.collaboratorRef}
                    className={`rounded-md border p-3 transition-colors ${
                      active ? "border-primary-400 bg-primary-50" : "border-background-200 bg-background-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSignatoryId(s.collaboratorRef)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <i className="ri-drag-move-2-line text-foreground-400"></i>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground-900">{s.name}</span>
                          <span className="block truncate text-[11px] text-foreground-500">
                            {active ? "Clique na folha ao lado para posicionar" : "Papel / posição"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Remover signatário"
                        onClick={() => removeSignatory(s.collaboratorRef)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-400 hover:bg-accent-50 hover:text-accent-700"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={s.role}
                        onChange={(e) => updateSignatory(s.collaboratorRef, { role: e.target.value })}
                        placeholder="Papel (ex.: Executante)"
                        className={`${inputClass} py-2 text-xs`}
                      />
                      <input
                        value={s.email}
                        onChange={(e) => updateSignatory(s.collaboratorRef, { email: e.target.value })}
                        placeholder="E-mail de contato verificado"
                        className={`${inputClass} py-2 text-xs`}
                      />
                    </div>
                  </li>
                );
              })}
              {signatories.length === 0 && (
                <li className="rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
                  Nenhum signatário incluído.
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground-700">
              Posição das assinaturas {activeSignatoryId ? "· clique na folha" : "· selecione um signatário"}
            </p>
            <div className="mt-2">
              <DocumentSheet
                doc={previewDoc}
                interactive
                activeSignatoryId={activeSignatoryId}
                onPlace={handlePlace}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}