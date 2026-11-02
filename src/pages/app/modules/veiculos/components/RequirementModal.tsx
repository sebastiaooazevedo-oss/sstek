import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  vehicleCategories,
  vehicleDocumentTypeLabel,
  vehicleDocumentTypes,
  vehiclePurposes,
  type VehicleRequirement,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { salvarExigencia } from "@/pages/app/modules/veiculos/vehiclesStore";

interface Props {
  open: boolean;
  requirement: VehicleRequirement | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  category: string;
  purpose: string;
  typeKey: string;
  customLabel: string;
  required: boolean;
  hasExpiry: boolean;
  alertDays: string;
  responsible: string;
  notes: string;
  active: boolean;
}

const emptyForm = (): FormState => ({
  category: "*",
  purpose: "*",
  typeKey: "crlv",
  customLabel: "",
  required: true,
  hasExpiry: true,
  alertDays: "30",
  responsible: "",
  notes: "",
  active: true,
});

const fromRequirement = (item: VehicleRequirement): FormState => ({
  category: item.category,
  purpose: item.purpose || "*",
  typeKey: item.typeKey,
  customLabel: vehicleDocumentTypes.some((type) => type.key === item.typeKey) ? "" : item.typeLabel,
  required: item.required,
  hasExpiry: item.hasExpiry,
  alertDays: String(item.alertDays ?? 0),
  responsible: item.responsible,
  notes: item.notes,
  active: item.active,
});

export default function RequirementModal({ open, requirement, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(requirement ? fromRequirement(requirement) : emptyForm());
    setError("");
    setSaving(false);
  }, [open, requirement]);

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));
  const isCustomType = form.typeKey === "outro";

  const submit = async () => {
    setError("");
    if (isCustomType && !form.customLabel.trim()) {
      setError("Informe o nome do tipo de documento exigido.");
      return;
    }
    const alertDays = Number(form.alertDays || 0);
    if (!Number.isInteger(alertDays) || alertDays < 0 || alertDays > 365) {
      setError("A antecedência do aviso deve estar entre 0 e 365 dias.");
      return;
    }

    setSaving(true);
    const result = await salvarExigencia({
      ref: requirement?.ref ?? "",
      category: form.category,
      purpose: form.purpose,
      typeKey: form.typeKey,
      typeLabel: isCustomType ? form.customLabel.trim() : vehicleDocumentTypeLabel(form.typeKey),
      required: form.required,
      hasExpiry: form.hasExpiry,
      alertDays,
      responsible: form.responsible,
      notes: form.notes,
      active: form.active,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível salvar a exigência.");
      return;
    }
    onSaved(result.detail || "Exigência salva.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-list-check-2"
      title={requirement ? "Editar exigência documental" : "Nova exigência documental"}
      subtitle="A exigência vale por categoria e finalidade de uso. Nada é obrigatório por padrão — quem define é a empresa."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-save-3-line" disabled={saving}>
            {saving ? "Salvando..." : "Salvar exigência"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-xs font-medium text-danger-800">
            <i className="ri-error-warning-line mt-0.5 text-sm"></i>
            <span>{error}</span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Categoria do veículo" required>
            <select
              className={selectClass}
              value={form.category}
              onChange={(event) => patch({ category: event.target.value })}
            >
              <option value="*">Todas as categorias</option>
              {vehicleCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Finalidade de uso"
            hint="A exigência é aplicada pela categoria. A finalidade passa a filtrar quando o veículo tiver finalidade de uso cadastrada."
          >
            <select
              className={selectClass}
              value={form.purpose}
              onChange={(event) => patch({ purpose: event.target.value })}
            >
              {vehiclePurposes.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de documento" required>
            <select
              className={selectClass}
              value={form.typeKey}
              onChange={(event) => patch({ typeKey: event.target.value })}
            >
              {vehicleDocumentTypes.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {isCustomType && (
            <Field label="Nome do documento" required>
              <input
                className={inputClass}
                value={form.customLabel}
                onChange={(event) => patch({ customLabel: event.target.value })}
                placeholder="Ex.: Certificado de tacógrafo"
              />
            </Field>
          )}
          <Field label="Antecedência do aviso (dias)" hint="0 a 365 dias antes do vencimento">
            <input
              className={inputClass}
              value={form.alertDays}
              onChange={(event) => patch({ alertDays: event.target.value.replace(/\D/g, "").slice(0, 3) })}
              placeholder="30"
              disabled={!form.hasExpiry}
            />
          </Field>
          <Field label="Responsável pela tratativa">
            <input
              className={inputClass}
              value={form.responsible}
              onChange={(event) => patch({ responsible: event.target.value })}
              placeholder="Quem acompanha esse documento"
            />
          </Field>
          <Field label="Observações">
            <input
              className={inputClass}
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value.slice(0, 1000) })}
              placeholder="Condições de aplicação"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-background-200 bg-background-100 p-3.5 sm:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground-700">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(event) => patch({ required: event.target.checked })}
              className="h-4 w-4 cursor-pointer rounded border-background-300 accent-primary-600"
            />
            Exigência obrigatória
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground-700">
            <input
              type="checkbox"
              checked={form.hasExpiry}
              onChange={(event) => patch({ hasExpiry: event.target.checked })}
              className="h-4 w-4 cursor-pointer rounded border-background-300 accent-primary-600"
            />
            Documento tem vencimento
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => patch({ active: event.target.checked })}
              className="h-4 w-4 cursor-pointer rounded border-background-300 accent-primary-600"
            />
            Exigência ativa
          </label>
        </div>
      </div>
    </Modal>
  );
}