import { useEffect, useMemo, useState } from "react";
import Modal, { Field, inputClass, selectClass, ModalButton } from "@/pages/app/components/Modal";
import SignaturePad from "@/components/base/SignaturePad";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { epiReasons, type EpiDelivery, type EpiDeliveryItem } from "@/mocks/epi";
import { buildEpiAcceptanceBody, caValidityStatus, epiSealHtml, toBrDate } from "@/pages/app/modules/epi/epiUtils";
import { consultarCaOficial, type CaConsultaResult } from "@/pages/app/modules/epi/caService";
import ConsultaCaModal from "@/pages/app/modules/epi/components/ConsultaCaModal";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";

interface EpiDeliveryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (delivery: EpiDelivery) => void;
  /** Pré-preenchimento usado ao atender um pedido de substituição. */
  initialCollaboratorId?: string;
  initialItems?: EpiDeliveryItem[];
  initialReason?: string;
}

const emptyForm = {
  collaboratorId: "",
  date: "",
  reason: epiReasons[0],
  notes: "",
};

type CaValidationState = {
  ca: string;
  loading: boolean;
  result: CaConsultaResult | null;
  checked: boolean;
};

const emptyValidation: CaValidationState = { ca: "", loading: false, result: null, checked: false };

export default function EpiDeliveryModal({
  open,
  onClose,
  onCreate,
  initialCollaboratorId,
  initialItems,
  initialReason,
}: EpiDeliveryModalProps) {
  const { permitirCaNaoEncontrado, permitirCaVencido } = useSystemSettings();
  const collaborators = useCollaboratorsList();
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<EpiDeliveryItem[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftCa, setDraftCa] = useState("");
  const [draftQty, setDraftQty] = useState("1");
  const [validation, setValidation] = useState<CaValidationState>(emptyValidation);
  const [signature, setSignature] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [caOpen, setCaOpen] = useState(false);

  const initialItemsKey = initialItems ? initialItems.map((item) => `${item.ca}:${item.quantity}`).join("|") : "";

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm,
        collaboratorId: initialCollaboratorId || "",
        reason: initialReason || epiReasons[0],
      });
      setItems(initialItems ? initialItems.map((item) => ({ ...item })) : []);
      setDraftName("");
      setDraftCa("");
      setDraftQty("1");
      setValidation(emptyValidation);
      setSignature("");
      setPhoto("");
      setError("");
    }
  }, [open, initialCollaboratorId, initialReason, initialItemsKey]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectedCollaborator = useMemo(
    () => collaborators.find((c) => c.id === form.collaboratorId) || null,
    [collaborators, form.collaboratorId]
  );

  const canSubmit = useMemo(
    () =>
      form.collaboratorId !== "" &&
      form.date !== "" &&
      items.length > 0 &&
      signature !== "",
    [form.collaboratorId, form.date, items.length, signature]
  );

  const handleValidateCa = async () => {
    const ca = draftCa.trim();
    if (!ca) {
      setError("Informe o numero do CA antes de validar.");
      return;
    }
    setError("");
    setValidation({ ca, loading: true, result: null, checked: false });
    try {
      const result = await consultarCaOficial(ca);
      setValidation({ ca, loading: false, result, checked: true });
      if (result.found && result.name && !draftName.trim()) {
        setDraftName(result.name);
      }
    } catch {
      setValidation({
        ca,
        loading: false,
        result: { found: false, ca, active: null, name: "", fields: [], source: "oficial" },
        checked: true,
      });
    }
  };

  const evaluateCaStatus = (result: CaConsultaResult | null) => {
    if (!result) return { found: false, expired: false };
    if (!result.found) return { found: false, expired: false };
    const expired = result.active === false || (result.validity ? caValidityStatus(result.validity) === "Vencido" : false);
    return { found: true, expired };
  };

  const addItem = async () => {
    const name = draftName.trim();
    const ca = draftCa.trim();
    const quantity = Math.max(1, Number(draftQty) || 1);

    if (!name || !ca) {
      setError("Informe o nome do EPI e o numero do CA para adicionar o equipamento.");
      return;
    }

    let check = validation.ca === ca && validation.checked ? validation.result : null;
    if (!check) {
      setValidation({ ca, loading: true, result: null, checked: false });
      try {
        check = await consultarCaOficial(ca);
      } catch {
        check = { found: false, ca, active: null, name: "", fields: [], source: "oficial" };
      }
      setValidation({ ca, loading: false, result: check, checked: true });
    }

    const { found, expired } = evaluateCaStatus(check);

    if (!found && !permitirCaNaoEncontrado) {
      setError(
        `O CA ${ca} nao foi localizado no portal oficial do CAEPI. A inclusao de equipamentos com CA nao encontrado ` +
          "esta desativada nas Configuracoes do sistema."
      );
      return;
    }
    if (found && expired && !permitirCaVencido) {
      setError(
        `O CA ${ca} esta vencido/inativo. A inclusao de equipamentos com CA vencido esta desativada nas ` +
          "Configuracoes do sistema."
      );
      return;
    }

    setError("");
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.ca === ca);
      if (existing >= 0) {
        return prev.map((i, index) => (index === existing ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { name, ca, quantity }];
    });
    setDraftName("");
    setDraftCa("");
    setDraftQty("1");
    setValidation(emptyValidation);
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handlePhoto = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const buildCurrent = (status: EpiDelivery["status"]): EpiDelivery => ({
    id: `dep-${Date.now()}`,
    collaboratorId: form.collaboratorId,
    collaboratorName: selectedCollaborator?.name || "—",
    collaboratorRole: selectedCollaborator?.role || "",
    area: selectedCollaborator?.area || "",
    date: toBrDate(form.date),
    reason: form.reason,
    items,
    signature,
    status,
    notes: form.notes.trim(),
    photo: photo || "",
    establishment: selectedCollaborator?.establishment || "",
  });

  const handleExport = async () => {
    if (!selectedCollaborator || form.date === "" || items.length === 0) {
      setError("Selecione o colaborador, a data e ao menos um EPI para exportar o termo em PDF.");
      return;
    }
    setError("");
    const delivery = buildCurrent(signature ? "Assinada" : "Pendente");
    const sealHtml = await epiSealHtml(delivery);
    printHtml(
      `Ficha de EPI — ${delivery.collaboratorName}`,
      buildEpiAcceptanceBody(delivery, sealHtml)
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setError("Informe o colaborador, a data, ao menos um EPI e a assinatura de aceite.");
      return;
    }
    onCreate(buildCurrent("Assinada"));
    onClose();
  };

  const validationBadge = () => {
    if (validation.loading) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
          <i className="ri-loader-4-line animate-spin"></i>
          Consultando CA...
        </span>
      );
    }
    if (!validation.checked || !validation.result) return null;
    const { found, expired } = evaluateCaStatus(validation.result);
    if (!found) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-900">
          <i className="ri-error-warning-line"></i>
          CA nao encontrado
        </span>
      );
    }
    if (expired) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-900">
          <i className="ri-shield-cross-line"></i>
          CA vencido/inativo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
        <i className="ri-shield-check-line"></i>
        CA ativo{validation.result.validity ? ` · até ${validation.result.validity}` : ""}
      </span>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova entrega de EPI"
      subtitle="Registre os equipamentos entregues e colete o aceite por assinatura do colaborador."
      icon="ri-shirt-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton variant="ghost" onClick={() => void handleExport()} icon="ri-file-pdf-2-line">
            Exportar PDF
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-check-line">
            Registrar entrega
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Colaborador" required>
          <div className="relative">
            <select
              className={selectClass}
              value={form.collaboratorId}
              onChange={(e) => set("collaboratorId", e.target.value)}
            >
              <option value="">Selecione o colaborador...</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.role}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Data da entrega" required>
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
        </Field>

        {selectedCollaborator && (
          <div className="md:col-span-2 rounded-md border border-secondary-200 bg-secondary-100/70 px-4 py-3 text-xs text-secondary-900">
            <i className="ri-user-line mr-1.5"></i>
            <strong className="font-semibold">{selectedCollaborator.name}</strong> · {selectedCollaborator.role} ·{" "}
            {selectedCollaborator.area} · CPF {selectedCollaborator.cpf}
          </div>
        )}

        <Field label="Motivo da entrega">
          <div className="relative">
            <select className={selectClass} value={form.reason} onChange={(e) => set("reason", e.target.value)}>
              {epiReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Observações" hint="Máximo de 500 caracteres.">
          <input
            className={inputClass}
            maxLength={500}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Ex.: orientado sobre guarda e conservação"
          />
        </Field>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground-700">
              Equipamentos entregues<span className="ml-0.5 text-accent-600">*</span>
            </span>
            <button
              type="button"
              onClick={() => setCaOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-secondary-200 bg-secondary-100/70 px-3 py-1.5 text-xs font-semibold text-secondary-900 transition-colors hover:bg-secondary-100"
            >
              <i className="ri-search-eye-line text-base"></i>
              Consultar CA
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Nome do EPI (ex.: Capacete de segurança classe B)"
                aria-label="Nome do EPI"
                className={`${inputClass} sm:flex-[2]`}
              />
              <input
                value={draftCa}
                onChange={(e) => {
                  setDraftCa(e.target.value);
                  if (validation.checked) setValidation(emptyValidation);
                }}
                placeholder="CA (ex.: 31.469)"
                aria-label="Número do CA"
                className={`${inputClass} sm:w-36`}
              />
              <input
                type="number"
                min={1}
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                aria-label="Quantidade"
                className={`${inputClass} sm:w-24`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleValidateCa()}
                disabled={validation.loading}
                className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-secondary-200 bg-secondary-100/70 px-4 py-2.5 text-xs font-semibold text-secondary-900 transition-colors hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className={validation.loading ? "ri-loader-4-line animate-spin text-base" : "ri-shield-check-line text-base"}></i>
                Validar CA
              </button>
              <button
                type="button"
                onClick={() => void addItem()}
                className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-add-line text-base"></i>
                Adicionar
              </button>
              {validationBadge()}
            </div>
            <p className="text-[11px] text-foreground-400">
              A validação consulta o portal oficial do CAEPI (caepi.trabalho.gov.br). Se o CA não for encontrado ou
              estiver vencido, a inclusão só é permitida conforme a parametrização em Configurações.
            </p>
          </div>

          {items.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((item, index) => (
                <li
                  key={`${item.ca}-${index}`}
                  className="flex items-center gap-3 rounded-md border border-background-200 bg-background-100 px-3 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                    <i className="ri-shirt-line text-base"></i>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground-900">{item.name}</span>
                    <span className="block text-xs text-foreground-500">CA {item.ca}</span>
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-semibold text-secondary-900">
                    {item.quantity}x
                  </span>
                  <button
                    type="button"
                    aria-label={`Remover ${item.name}`}
                    onClick={() => removeItem(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2">
          <Field label="Foto do equipamento / entrega" hint="Opcional. Anexe uma foto do EPI entregue ou do momento da entrega.">
            {photo ? (
              <div className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-50">
                  <img src={photo} alt="Foto da entrega de EPI" className="h-full w-full object-cover object-top" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-900">Foto anexada</p>
                  <p className="mt-0.5 text-xs text-foreground-500">Ela aparecerá na ficha de EPI e no PDF exportado.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhoto("")}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-delete-bin-line"></i>
                  Remover
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-5 py-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50">
                <i className="ri-camera-line text-2xl text-primary-600"></i>
                <span className="text-sm font-semibold text-foreground-800">Clique para anexar uma foto</span>
                <span className="text-xs text-foreground-500">PNG ou JPG · opcional</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handlePhoto(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </Field>
        </div>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground-700">
              Aceite do colaborador<span className="ml-0.5 text-accent-600">*</span>
            </span>
            <span className="text-[11px] text-foreground-400">
              {signature ? "Assinatura coletada" : "Ainda não assinada"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-foreground-400">
            O colaborador assina confirmando o recebimento e as orientações de uso dos EPIs.
          </p>
          <div className="mt-2 rounded-lg border border-background-200 bg-background-100 p-3">
            <SignaturePad value={signature} onChange={setSignature} />
          </div>
        </div>

        <div className="md:col-span-2 rounded-lg border border-background-200 bg-background-100 p-4">
          <div className="mb-4 flex items-center gap-2">
            <i className="ri-pen-nib-line text-base text-primary-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">Assinatura do responsável técnico</h3>
          </div>
          <SignatureFooter />
        </div>
      </div>

      <ConsultaCaModal
        open={caOpen}
        onClose={() => setCaOpen(false)}
        onAdd={(item) => {
          setDraftName(item.name);
          setDraftCa(item.ca);
          setValidation(emptyValidation);
        }}
      />
    </Modal>
  );
}