import { useEffect, useRef, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  vehicleDocumentTypeLabel,
  vehicleDocumentTypes,
  vehiclePurposes,
  type Vehicle,
  type VehicleDocument,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import {
  salvarDocumentoVeiculo,
  uploadVehicleFile,
} from "@/pages/app/modules/veiculos/vehiclesStore";

interface Props {
  open: boolean;
  vehicle: Vehicle | null;
  replacing: VehicleDocument | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  typeKey: string;
  customLabel: string;
  purpose: string;
  number: string;
  issuedAt: string;
  expiresAt: string;
  responsible: string;
  notes: string;
  replacementReason: string;
  storagePath: string;
  fileType: string;
  fileSize: string;
  fileName: string;
}

const emptyForm = (): FormState => ({
  typeKey: "crlv",
  customLabel: "",
  purpose: "*",
  number: "",
  issuedAt: "",
  expiresAt: "",
  responsible: "",
  notes: "",
  replacementReason: "",
  storagePath: "",
  fileType: "",
  fileSize: "",
  fileName: "",
});

const fromDocument = (doc: VehicleDocument): FormState => ({
  typeKey: doc.typeKey,
  customLabel: vehicleDocumentTypes.some((item) => item.key === doc.typeKey) ? "" : doc.typeLabel,
  purpose: doc.purpose || "*",
  number: doc.number,
  issuedAt: doc.issuedAt ? doc.issuedAt.slice(0, 10) : "",
  expiresAt: doc.expiresAt ? doc.expiresAt.slice(0, 10) : "",
  responsible: doc.responsible,
  notes: doc.notes,
  replacementReason: "",
  storagePath: doc.storagePath,
  fileType: doc.fileType,
  fileSize: doc.fileSize,
  fileName: doc.storagePath ? doc.storagePath.split("/").pop() ?? "" : "",
});

export default function VehicleDocumentModal({
  open,
  vehicle,
  replacing,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(replacing ? fromDocument(replacing) : emptyForm());
    setError("");
    setSaving(false);
  }, [open, replacing, vehicle]);

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));

  const isCustomType = form.typeKey === "outro";

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    const result = await uploadVehicleFile(file);
    setUploading(false);
    if (!result) {
      setError("Falha no envio do arquivo. Verifique o formato e tente novamente.");
      return;
    }
    patch({
      storagePath: result.path,
      fileType: file.type || "",
      fileSize: file.size > 1024 * 1024 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
      fileName: file.name,
    });
  };

  const submit = async () => {
    setError("");
    if (!vehicle) {
      setError("Selecione o veículo.");
      return;
    }
    if (isCustomType && !form.customLabel.trim()) {
      setError("Informe o nome do tipo de documento.");
      return;
    }
    if (form.issuedAt && form.expiresAt && form.expiresAt < form.issuedAt) {
      setError("O vencimento não pode ser anterior à emissão.");
      return;
    }
    if (replacing && !form.replacementReason.trim()) {
      setError("Informe o motivo da substituição — ele fica registrado na auditoria.");
      return;
    }

    setSaving(true);
    const typeLabel = isCustomType ? form.customLabel.trim() : vehicleDocumentTypeLabel(form.typeKey);
    const result = await salvarDocumentoVeiculo({
      vehicleRef: vehicle.ref,
      typeKey: form.typeKey,
      typeLabel,
      purpose: form.purpose === "*" ? "" : form.purpose,
      number: form.number,
      issuedAt: form.issuedAt,
      expiresAt: form.expiresAt,
      responsible: form.responsible,
      fileUrl: "",
      storagePath: form.storagePath,
      fileType: form.fileType,
      fileSize: form.fileSize,
      notes: form.notes,
      replacesRef: replacing?.ref ?? "",
      replacementReason: form.replacementReason,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível salvar o documento.");
      return;
    }
    onSaved(result.detail || "Documento salvo.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-file-shield-2-line"
      title={replacing ? "Substituir documento" : "Anexar documento"}
      subtitle={
        vehicle
          ? `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}`.trim()
          : "Selecione um veículo"
      }
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-save-3-line" disabled={saving || uploading}>
            {saving ? "Salvando..." : replacing ? "Registrar nova versão" : "Salvar documento"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {replacing && (
          <p className="flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5 text-xs leading-relaxed text-accent-900">
            <i className="ri-history-line mt-0.5 text-sm"></i>
            <span>
              Você está criando a versão <strong>{replacing.version + 1}</strong> de{" "}
              {replacing.typeLabel}. A versão atual (v{replacing.version}) é preservada e marcada como
              substituída — nada é apagado.
            </span>
          </p>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-xs font-medium text-danger-800">
            <i className="ri-error-warning-line mt-0.5 text-sm"></i>
            <span>{error}</span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          {isCustomType ? (
            <Field label="Nome do documento" required>
              <input
                className={inputClass}
                value={form.customLabel}
                onChange={(event) => patch({ customLabel: event.target.value })}
                placeholder="Ex.: Laudo de tacógrafo"
              />
            </Field>
          ) : (
            <Field label="Finalidade de uso" hint="Opcional — usado no cruzamento com as exigências">
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
          )}
          <Field label="Número do documento">
            <input
              className={inputClass}
              value={form.number}
              onChange={(event) => patch({ number: event.target.value })}
              placeholder="Apólice, certificado, contrato..."
            />
          </Field>
          <Field label="Responsável">
            <input
              className={inputClass}
              value={form.responsible}
              onChange={(event) => patch({ responsible: event.target.value })}
              placeholder="Quem responde por este documento"
            />
          </Field>
          <Field label="Emissão">
            <input
              type="date"
              className={inputClass}
              value={form.issuedAt}
              onChange={(event) => patch({ issuedAt: event.target.value })}
            />
          </Field>
          <Field label="Vencimento" hint="Deixe vazio para documentos sem vencimento">
            <input
              type="date"
              className={inputClass}
              value={form.expiresAt}
              onChange={(event) => patch({ expiresAt: event.target.value })}
            />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <textarea
              className={`${inputClass} min-h-[70px] resize-y`}
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value.slice(0, 2000) })}
              placeholder="Coberturas, contato de sinistro, condições..."
            ></textarea>
          </Field>
          {replacing && (
            <Field label="Motivo da substituição" required className="md:col-span-2">
              <input
                className={inputClass}
                value={form.replacementReason}
                onChange={(event) => patch({ replacementReason: event.target.value })}
                placeholder="Ex.: renovação anual da apólice"
              />
            </Field>
          )}
        </div>

        <div className="rounded-lg border border-background-200 bg-background-100 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground-800">Arquivo do documento</p>
              <p className="truncate text-[11px] text-foreground-500">
                {form.fileName || "Nenhum arquivo anexado — o registro pode existir sem arquivo."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className={uploading ? "ri-loader-4-line animate-spin" : "ri-upload-2-line"}></i>
              {uploading ? "Enviando..." : form.storagePath ? "Trocar arquivo" : "Anexar arquivo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}