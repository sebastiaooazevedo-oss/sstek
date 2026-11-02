import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton } from "@/pages/app/components/Modal";
import type { DocumentRecord } from "@/mocks/documents";
import {
  EXPIRY_WARNING_DAYS,
  daysUntilExpiry,
  expiryDaysLabel,
  formatDateInput,
  isPermanentDocument,
  toDateInputValue,
} from "@/pages/app/modules/documentos/documentUtils";

interface ValidityModalProps {
  open: boolean;
  document: DocumentRecord | null;
  onClose: () => void;
  /** Recebe a data em "dd/mm/aaaa" ou string vazia para tornar permanente. */
  onSave: (documentId: string, expiresAt: string) => void;
}

interface Preset {
  id: string;
  label: string;
  hint: string;
  addDays?: number;
  addMonths?: number;
}

const presets: Preset[] = [
  { id: "30d", label: "+30 dias", hint: "treinamentos e exames", addDays: 30 },
  { id: "6m", label: "+6 meses", hint: "revisões semestrais", addMonths: 6 },
  { id: "1a", label: "+1 ano", hint: "padrão anual", addMonths: 12 },
  { id: "2a", label: "+2 anos", hint: "laudos bienais", addMonths: 24 },
];

function addToToday({ addDays = 0, addMonths = 0 }: Preset): string {
  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + addMonths, base.getDate() + addDays);
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${target.getFullYear()}-${month}-${day}`;
}

/** Data padrão sugerida: um ano a partir de hoje. */
function defaultDateValue(): string {
  return addToToday({ id: "1a", label: "", hint: "", addMonths: 12 });
}

export default function ValidityModal({ open, document: doc, onClose, onSave }: ValidityModalProps) {
  const [dateValue, setDateValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !doc) return;
    setDateValue(toDateInputValue(doc.expiresAt) || defaultDateValue());
    setError("");
  }, [open, doc]);

  const hasValidity = doc ? !isPermanentDocument(doc.expiresAt) : false;
  const formatted = dateValue ? formatDateInput(dateValue) : "";
  const days = useMemo(() => (formatted ? daysUntilExpiry(formatted) : null), [formatted]);

  const handleSubmit = () => {
    if (!doc) return;
    if (!dateValue) {
      setError("Informe a data de validade do documento.");
      return;
    }
    setError("");
    onSave(doc.id, formatted);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon="ri-calendar-check-line"
      title="Validade do documento"
      subtitle={doc ? doc.name : "Defina a data de vencimento do documento."}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>
            Cancelar
          </ModalButton>
          <ModalButton icon="ri-save-3-line" onClick={handleSubmit}>
            Salvar validade
          </ModalButton>
        </>
      }
    >
      {doc && doc.status !== "Em dia" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-[11px] leading-snug text-accent-900">
          <i className="ri-information-line mt-0.5 text-sm"></i>
          <span>
            Este é o ajuste da data cadastrada. Para renovar um documento de segurança, use
            <strong className="font-semibold"> Solicitar renovação</strong> — o processo exige o
            documento novo (e os exames) anexados.
          </span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-100 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <i className="ri-file-text-line text-base"></i>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground-950">{doc?.typeName || "Documento"}</p>
          <p className="mt-0.5 text-xs text-foreground-500">
            Situação atual: {hasValidity ? `válido até ${doc?.expiresAt}` : "sem validade (permanente)"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Field label="Nova data de validade" required hint={`Documentos são sinalizados ${EXPIRY_WARNING_DAYS} dias antes do vencimento.`}>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => {
              setDateValue(e.target.value);
              setError("");
            }}
            className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400 sm:max-w-xs"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground-700">Atalhos</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setDateValue(addToToday(preset));
                setError("");
              }}
              title={`Validade até ${formatDateInput(addToToday(preset))} — ${preset.hint}`}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-800"
            >
              <i className="ri-calendar-line"></i>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {formatted && (
        <div className="mt-5 flex items-center gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
          <i className="ri-information-line text-base"></i>
          <span className="min-w-0">
            Passará a constar como <strong className="font-semibold">{formatted}</strong>
            {days !== null && ` · ${expiryDaysLabel(days)}`}
          </span>
        </div>
      )}

      {hasValidity && (
        <div className="mt-5 border-t border-background-200 pt-4">
          <button
            type="button"
            onClick={() => doc && onSave(doc.id, "")}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100 hover:text-accent-800"
          >
            <i className="ri-close-circle-line"></i>
            Remover validade (documento permanente)
          </button>
        </div>
      )}
    </Modal>
  );
}