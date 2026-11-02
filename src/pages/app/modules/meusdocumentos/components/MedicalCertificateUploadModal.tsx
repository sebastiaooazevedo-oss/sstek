import { useEffect, useRef, useState } from "react";
import Modal, { Field, inputClass, ModalButton, selectClass } from "@/pages/app/components/Modal";
import {
  addMedicalCertificate,
  medicalCertificateTypes,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";

interface MedicalCertificateUploadModalProps {
  open: boolean;
  onClose: () => void;
  collaboratorId: string;
  collaboratorName: string;
  area: string;
  establishment: string;
  createdBy: string;
  onCreated: () => void;
  /** Id do atestado a corrigir. Quando presente, cria uma NOVA VERSÃO. */
  replacesId?: string | null;
  /** Resumo da versão original, exibido no modo correção. */
  originalLabel?: string;
}

const MAX_FILE_SIZE = 12 * 1024 * 1024;

export default function MedicalCertificateUploadModal({
  open,
  onClose,
  collaboratorId,
  collaboratorName,
  area,
  establishment,
  createdBy,
  onCreated,
  replacesId = null,
  originalLabel = "",
}: MedicalCertificateUploadModalProps) {
  const [certificateType, setCertificateType] = useState(medicalCertificateTypes[0]);
  const [issuedOn, setIssuedOn] = useState("");
  const [leaveDays, setLeaveDays] = useState("0");
  const [cid, setCid] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCertificateType(medicalCertificateTypes[0]);
    setIssuedOn("");
    setLeaveDays("0");
    setCid("");
    setNotes("");
    setFile(null);
    setPreview("");
    setError("");
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Envie uma foto ou imagem do atestado (JPG, PNG ou HEIC).");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("A imagem deve ter no máximo 12 MB.");
      return;
    }
    setError("");
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Anexe a foto do atestado médico.");
      return;
    }
    if (!issuedOn) {
      setError("Informe a data do atestado.");
      return;
    }
    if (!cid.trim()) {
      setError("Informe o CID do atestado.");
      return;
    }
    if (leaveDays === "" || Number.isNaN(Number(leaveDays)) || Number(leaveDays) < 0) {
      setError("Informe os dias de afastamento (0 se não houver).");
      return;
    }
    setSaving(true);
    const result = await addMedicalCertificate({
      collaboratorId,
      collaboratorName,
      area,
      establishment,
      certificateType,
      issuedOn,
      leaveDays: Number(leaveDays),
      cid,
      notes,
      file,
      createdBy,
      replacesId,
    });
    setSaving(false);
    if (result.ok === false) {
      // O rascunho digitado e o arquivo escolhido permanecem na tela:
      // nada foi finalizado e a nova tentativa é possível sem retrabalho.
      setError(result.error || "Não foi possível cadastrar o atestado médico.");
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={replacesId ? "Corrigir atestado médico" : "Cadastrar atestado médico"}
      subtitle={
        replacesId
          ? "A correção gera uma nova versão. O atestado original e o arquivo original são preservados no histórico."
          : "O arquivo é enviado primeiro; o cadastro só é concluído quando o envio é confirmado."
      }
      icon="ri-stethoscope-line"
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={() => void handleSubmit()} icon="ri-upload-cloud-2-line" disabled={saving}>
            {saving ? "Enviando..." : replacesId ? "Registrar correção" : "Cadastrar atestado"}
          </ModalButton>
        </>
      }
    >
      {replacesId && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-secondary-200 bg-secondary-100 px-3 py-2.5 text-[11px] leading-relaxed text-secondary-900">
          <i className="ri-git-branch-line mt-0.5 text-sm"></i>
          <span>
            Você está registrando uma nova versão
            {originalLabel ? ` do atestado de ${originalLabel}` : ""}. O registro anterior continua acessível no
            histórico e não pode ser editado nem excluído.
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Tipo de documento" required>
          <div className="relative">
            <select
              className={selectClass}
              value={certificateType}
              onChange={(e) => setCertificateType(e.target.value)}
            >
              {medicalCertificateTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Data do atestado" required>
          <input
            type="date"
            className={inputClass}
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </Field>

        <Field label="Dias de afastamento" required hint="Use 0 quando não houver afastamento.">
          <input
            type="number"
            min={0}
            max={365}
            className={inputClass}
            value={leaveDays}
            onChange={(e) => setLeaveDays(e.target.value)}
          />
        </Field>

        <Field label="CID" required hint="Código informado no atestado.">
          <input
            className={inputClass}
            value={cid}
            onChange={(e) => setCid(e.target.value.toUpperCase())}
            placeholder="Ex.: M54.5"
            maxLength={12}
          />
        </Field>

        <div className="md:col-span-2">
          <span className="text-xs font-semibold text-foreground-700">
            Foto do atestado<span className="ml-0.5 text-accent-600">*</span>
          </span>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground-400">
            Tire uma foto legível do documento. O arquivo fica armazenado com segurança e não pode ser excluído
            depois do cadastro. Se o envio falhar, nenhum registro é criado e você pode tentar de novo.
          </p>

          <div className="mt-2 rounded-lg border border-dashed border-background-300 bg-background-100 p-3">
            {preview ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-32 w-40 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-50">
                  <img src={preview} alt="Prévia do atestado" className="h-full w-full object-top" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-900">{file?.name}</p>
                  <p className="mt-0.5 text-xs text-foreground-500">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-refresh-line"></i>
                      Trocar foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold text-foreground-500 transition-colors hover:text-accent-700"
                    >
                      <i className="ri-delete-bin-line"></i>
                      Remover seleção
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 px-4 py-8 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <i className="ri-camera-line text-2xl"></i>
                </span>
                <span className="text-sm font-semibold text-foreground-900">Tirar foto ou escolher imagem</span>
                <span className="text-xs text-foreground-500">JPG, PNG ou HEIC · até 12 MB</span>
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <Field label="Observações" className="md:col-span-2" hint="Opcional · máximo de 500 caracteres.">
          <textarea
            className={`${inputClass} min-h-[88px] resize-y`}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações complementares, período de repouso, contato do médico..."
          />
        </Field>
      </div>
    </Modal>
  );
}