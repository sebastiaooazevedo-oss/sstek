import { useEffect, useMemo, useState } from "react";
import Modal, { Field, inputClass, ModalButton } from "@/pages/app/components/Modal";
import type { MedicalCertificate } from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import {
  getFollowupFor,
  saveFollowup,
  useMedicalFollowups,
} from "@/pages/app/modules/meusdocumentos/followupStore";
import { isoToBr } from "@/pages/app/modules/meusdocumentos/certificateInsights";

interface MedicalFollowupModalProps {
  open: boolean;
  onClose: () => void;
  certificate: MedicalCertificate | null;
  /** Unidade do cadastro, usada quando o atestado não guardou unidade. */
  unit?: string;
  /** Quem está registrando o acompanhamento. */
  actor: string;
}

/** Data de retorno sugerida: início do afastamento + dias informados. */
function suggestedReturn(issuedOn: string, leaveDays: number): string {
  if (!issuedOn || leaveDays <= 0) return "";
  const [y, m, d] = issuedOn.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + leaveDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function stampBr(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MedicalFollowupModal({
  open,
  onClose,
  certificate,
  unit,
  actor,
}: MedicalFollowupModalProps) {
  const followups = useMedicalFollowups();
  const [expectedReturn, setExpectedReturn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const existing = useMemo(
    () => (certificate ? getFollowupFor(certificate.id) : undefined),
    [certificate, followups]
  );

  const suggestion = certificate ? suggestedReturn(certificate.issuedOn, certificate.leaveDays) : "";

  useEffect(() => {
    if (!open || !certificate) return;
    const current = getFollowupFor(certificate.id);
    setExpectedReturn(current?.expectedReturn || suggestedReturn(certificate.issuedOn, certificate.leaveDays));
    setNote(current?.note || "");
    setError("");
    setSaving(false);
  }, [open, certificate]);

  if (!certificate) return null;

  const handleSave = async () => {
    if (!expectedReturn) {
      setError("Informe a data prevista de retorno ao trabalho.");
      return;
    }
    setSaving(true);
    const result = await saveFollowup({
      certificateId: certificate.id,
      collaboratorRef: certificate.collaboratorId,
      expectedReturn,
      note,
      updatedBy: actor,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Não foi possível salvar o acompanhamento.");
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Acompanhamento do afastamento"
      subtitle={`${certificate.collaboratorName} · ${certificate.certificateType}`}
      icon="ri-heart-pulse-line"
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={() => void handleSave()} icon="ri-check-line" disabled={saving}>
            {saving ? "Salvando..." : "Salvar acompanhamento"}
          </ModalButton>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 bg-background-100 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Data do atestado</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{isoToBr(certificate.issuedOn) || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Afastamento</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{certificate.leaveDays} dia(s)</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">CID</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{certificate.cid || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Unidade</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground-900">
              {certificate.establishment || unit || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field
          label="Retorno previsto"
          required
          hint={suggestion ? "Sugestão calculada pelo início do afastamento + dias do atestado." : undefined}
        >
          <input
            type="date"
            className={inputClass}
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(e.target.value)}
          />
          {suggestion && suggestion !== expectedReturn && (
            <button
              type="button"
              onClick={() => setExpectedReturn(suggestion)}
              className="mt-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900 transition-colors hover:bg-secondary-200"
            >
              <i className="ri-magic-line"></i>
              Usar {isoToBr(suggestion)}
            </button>
          )}
        </Field>

        <div className="rounded-lg border border-background-200 bg-background-50 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">Último registro</p>
          {existing ? (
            <>
              <p className="mt-1 text-xs text-foreground-700">
                <strong>Retorno previsto:</strong> {isoToBr(existing.expectedReturn) || "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-foreground-500">
                {existing.updatedBy || "Gestão"} · {stampBr(existing.updatedAt)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-foreground-500">
              Nenhum acompanhamento registrado para este atestado. O retorno previsto pode ser ajustado a qualquer
              momento — o atestado original permanece intacto.
            </p>
          )}
        </div>

        <Field
          label="Observação do acompanhamento"
          className="md:col-span-2"
          hint="Opcional · máximo de 500 caracteres."
        >
          <textarea
            className={`${inputClass} min-h-[88px] resize-y`}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contato realizado, exames solicitados, restrições no retorno, encaminhamento ao INSS..."
          />
        </Field>
      </div>
    </Modal>
  );
}