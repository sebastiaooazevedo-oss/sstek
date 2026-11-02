import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  criticalityMeta,
  criticalityOptions,
  vehicleCategories,
  type ChecklistCriticality,
  type ChecklistItem,
  type ChecklistTemplate,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { salvarChecklist } from "@/pages/app/modules/veiculos/vehiclesStore";

interface Props {
  open: boolean;
  template: ChecklistTemplate | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface DraftItem {
  key: string;
  label: string;
  criticality: ChecklistCriticality;
  photoRequired: boolean;
  requiresBlock: boolean;
  justificationRequired: boolean;
}

const suggestions = [
  "Pneus e estepe",
  "Freios",
  "Iluminação e sinalização",
  "Cintos de segurança",
  "Vidros e para-brisa",
  "Retrovisores",
  "Vazamentos de fluidos",
  "Equipamentos exigidos para a aplicação",
];

const newItem = (index: number): DraftItem => ({
  key: `it-${Date.now().toString(36)}-${index}`,
  label: "",
  criticality: "media",
  photoRequired: false,
  requiresBlock: false,
  justificationRequired: true,
});

const blankItems = (): DraftItem[] => [
  { ...newItem(1), key: "it-1", label: "Pneus e estepe", criticality: "critica", photoRequired: true, requiresBlock: true },
  { ...newItem(2), key: "it-2", label: "Freios", criticality: "critica", photoRequired: true, requiresBlock: true },
  { ...newItem(3), key: "it-3", label: "Iluminação e sinalização", criticality: "alta", photoRequired: true, requiresBlock: false },
];

const fromTemplate = (template: ChecklistTemplate): DraftItem[] =>
  template.items.map((item, index) => ({
    key: item.key || `it-${index + 1}`,
    label: item.label,
    criticality: item.criticality,
    photoRequired: item.photoRequired,
    requiresBlock: item.requiresBlock,
    justificationRequired: item.justificationRequired,
  }));

export default function ChecklistTemplateModal({ open, template, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("*");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>(blankItems);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setCategory(template?.category ?? "*");
    setNotes(template?.notes ?? "");
    setItems(template ? fromTemplate(template) : blankItems());
    setError("");
    setSaving(false);
  }, [open, template]);

  const patchItem = (index: number, values: Partial<DraftItem>) =>
    setItems((prev) => prev.map((item, position) => (position === index ? { ...item, ...values } : item)));

  const removeItem = (index: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, position) => position !== index)));

  const addItem = (label = "") => setItems((prev) => [...prev, { ...newItem(prev.length + 1), label }]);

  const submit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Informe o nome do checklist.");
      return;
    }
    const filled = items.filter((item) => item.label.trim());
    if (filled.length === 0) {
      setError("Inclua ao menos um item com descrição.");
      return;
    }
    setSaving(true);
    const payload: ChecklistItem[] = filled.map((item) => ({
      key: item.key,
      label: item.label.trim(),
      criticality: item.criticality,
      photoRequired: item.photoRequired,
      requiresBlock: item.requiresBlock || item.criticality === "critica",
      justificationRequired: item.justificationRequired,
    }));
    const result = await salvarChecklist({
      templateRef: template?.templateRef ?? "",
      name: name.trim(),
      category,
      notes: notes.trim(),
      items: payload,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível salvar o checklist.");
      return;
    }
    onSaved(result.detail || "Checklist salvo.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-clipboard-line"
      title={template ? `Editar checklist (nova versão de v${template.version})` : "Novo checklist de inspeção"}
      subtitle="Alterar o modelo cria uma nova versão. As inspeções já respondidas continuam mostrando exatamente o checklist que foi aplicado."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-save-3-line" disabled={saving}>
            {saving ? "Salvando..." : template ? "Criar nova versão" : "Criar checklist"}
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
          <Field label="Nome do checklist" required>
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 140))}
              placeholder="Ex.: Inspeção diária — veículos leves"
            />
          </Field>
          <Field label="Categoria do veículo" hint="O modelo é oferecido para veículos desta categoria.">
            <select className={selectClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="*">Todas as categorias</option>
              {vehicleCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Observações do modelo">
          <input
            className={inputClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
            placeholder="Aplicação, responsável técnico, referência interna"
          />
        </Field>

        <div className="rounded-lg border border-accent-200 bg-accent-50 px-3.5 py-3 text-[11px] leading-relaxed text-accent-900">
          <strong className="font-bold">Este checklist é uma ferramenta interna.</strong> Ele não substitui
          inspeções legais nem garante conformidade automática. A empresa define os itens e a criticidade
          conforme a aplicação real de cada veículo.
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-sm font-bold text-foreground-950">
              Itens ({items.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => addItem(label)}
                  className="cursor-pointer whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-2.5 py-1 text-[10px] font-semibold text-foreground-600 hover:border-primary-300 hover:text-primary-700"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {items.map((item, index) => (
              <div key={item.key} className="rounded-lg border border-background-200 bg-background-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background-200 text-[10px] font-bold text-foreground-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      className={inputClass}
                      value={item.label}
                      onChange={(event) => patchItem(index, { label: event.target.value.slice(0, 160) })}
                      placeholder="Descrição do item inspecionado"
                    />
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <select
                        className={selectClass}
                        value={item.criticality}
                        onChange={(event) =>
                          patchItem(index, { criticality: event.target.value as ChecklistCriticality })
                        }
                      >
                        {criticalityOptions.map((option) => (
                          <option key={option} value={option}>
                            Criticidade: {criticalityMeta[option].label}
                          </option>
                        ))}
                      </select>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-medium text-foreground-700">
                        <input
                          type="checkbox"
                          checked={item.photoRequired}
                          onChange={(event) => patchItem(index, { photoRequired: event.target.checked })}
                          className="h-4 w-4 cursor-pointer accent-primary-600"
                        />
                        Foto obrigatória
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-medium text-foreground-700">
                        <input
                          type="checkbox"
                          checked={item.requiresBlock}
                          onChange={(event) => patchItem(index, { requiresBlock: event.target.checked })}
                          className="h-4 w-4 cursor-pointer accent-primary-600"
                        />
                        Bloqueia veículo
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-medium text-foreground-700">
                        <input
                          type="checkbox"
                          checked={item.justificationRequired}
                          onChange={(event) =>
                            patchItem(index, { justificationRequired: event.target.checked })
                          }
                          className="h-4 w-4 cursor-pointer accent-primary-600"
                        />
                        Exige motivo em N/A
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover item ${index + 1}`}
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    className="mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-danger-50 hover:text-danger-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addItem()}
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-background-300 px-3 py-2 text-xs font-semibold text-foreground-600 hover:border-primary-300 hover:text-primary-700"
          >
            <i className="ri-add-line"></i>
            Adicionar item
          </button>
        </div>
      </div>
    </Modal>
  );
}