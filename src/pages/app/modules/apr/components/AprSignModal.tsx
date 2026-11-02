import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignatureCapture from "@/pages/app/components/SignatureCapture";
import { callSignatureEngine } from "@/pages/app/signature/signatureService";
import type { AprRecord } from "@/mocks/apr";
import { riskLevel } from "@/pages/app/modules/apr/aprUtils";

interface AprSignModalProps {
  record: AprRecord | null;
  collaboratorId: string;
  collaboratorName: string;
  onClose: () => void;
  onSign: (aprId: string, collaboratorId: string, signature: string) => void;
}

const levelTone: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-800",
  accent: "bg-accent-100 text-accent-800",
};

export default function AprSignModal({
  record,
  collaboratorId,
  collaboratorName,
  onClose,
  onSign,
}: AprSignModalProps) {
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setSignature("");
      setError("");
      setSaving(false);
    }
  }, [record]);

  if (!record) return null;

  const handleConfirm = async () => {
    if (!signature) {
      setError("Assine no quadro acima para registrar o aceite.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // Validação e registro no servidor (bloqueios, hash, evidências).
      await callSignatureEngine(
        "sign_document",
        { collaboratorRef: collaboratorId, collaboratorName },
        {
          documentType: "apr",
          documentRef: record.id,
          documentVersion: 1,
          payload: {
            title: record.title,
            activity: record.activity,
            area: record.area,
            date: record.date,
            signature,
          },
        }
      );
      onSign(record.id, collaboratorId, signature);
    } catch (err) {
      setError((err as Error).message || "Não foi possível registrar a assinatura no servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title="Assinar aceite da APR"
      subtitle={`${record.title} · ${record.date}`}
      icon="ri-clipboard-line"
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleConfirm} icon="ri-pen-nib-line">
            {saving ? "Registrando..." : "Confirmar aceite"}
          </ModalButton>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 bg-background-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
            {record.activity}
          </span>
          <span className="rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
            {record.area}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Local</p>
            <p className="mt-0.5 text-sm text-foreground-800">{record.location}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Responsável</p>
            <p className="mt-0.5 text-sm text-foreground-800">{record.responsible}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="font-heading text-sm font-bold text-foreground-950">Riscos e medidas de controle</h4>
        <ul className="mt-3 flex flex-col gap-2">
          {record.risks.map((risk) => {
            const level = riskLevel(risk.severity, risk.probability);
            return (
              <li
                key={risk.id}
                className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-900">
                    {risk.risk} <span className="font-normal text-foreground-500">· {risk.hazard}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-500">{risk.control || "Sem medidas informadas"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${levelTone[level.tone]}`}>
                  {level.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground-700">Aceite por assinatura</span>
          <span className="text-[11px] text-foreground-500">{collaboratorName}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground-400">
          Ao assinar, você declara ter participado da análise e estar ciente dos riscos e das medidas de controle
          desta atividade.
        </p>
        <div className="mt-2">
          <SignatureCapture
            collaboratorId={collaboratorId}
            collaboratorName={collaboratorName}
            onChange={setSignature}
          />
        </div>
      </div>
    </Modal>
  );
}