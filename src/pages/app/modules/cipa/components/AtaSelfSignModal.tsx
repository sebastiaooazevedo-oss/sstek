import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignatureCapture from "@/pages/app/components/SignatureCapture";
import { generateSignatureUid } from "@/pages/app/modules/cipa/cipaUtils";
import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";
import type { CipaAta } from "@/mocks/cipa";

interface AtaSelfSignModalProps {
  ata: CipaAta | null;
  cipaName?: string;
  collaboratorId: string;
  collaboratorName: string;
  onClose: () => void;
  onSign: (ata: CipaAta) => void;
}

/**
 * Assinatura da ata pelo próprio signatário (presidente, secretário ou
 * responsável técnico). É o espelho, na área do colaborador, da coleta feita
 * pela gestão da CIPA — a assinatura registrada no perfil é reaproveitada.
 */
export default function AtaSelfSignModal({
  ata,
  cipaName,
  collaboratorId,
  collaboratorName,
  onClose,
  onSign,
}: AtaSelfSignModalProps) {
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSignature("");
    setError("");
  }, [ata]);

  if (!ata) return null;

  const mine = ata.approvals.find(
    (a) => (collaboratorId && a.collaboratorId === collaboratorId) || a.name === collaboratorName
  );

  const handleSave = () => {
    if (!signature) {
      setError("Confirme a sua assinatura para aprovar a ata.");
      return;
    }
    if (!mine) {
      setError("Não encontramos o seu papel como signatário desta ata.");
      return;
    }
    const signedAt = new Date().toISOString();
    onSign({
      ...ata,
      approvals: ata.approvals.map((a) =>
        a.id === mine.id
          ? {
              ...a,
              representationSnapshot: signature,
              signedAt,
              signatureUid: a.signatureUid || generateSignatureUid(),
            }
          : a
      ),
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Assinar ata da CIPA"
      subtitle={`${ata.title} · ${ata.date}`}
      icon="ri-quill-pen-line"
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSave} icon="ri-check-double-line">
            Assinar eletronicamente
          </ModalButton>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 bg-background-100 p-4">
        <p className="text-sm font-semibold text-foreground-950">{ata.title}</p>
        <p className="mt-1 text-xs text-foreground-500">
          {cipaName || "CIPA"} · Ata nº {ata.number || "—"} · {ata.date}
        </p>
        {mine && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
            <i className="ri-user-follow-line"></i>
            Sua assinatura como {mine.role}
          </p>
        )}
        {mine && (mine.signedAt || mine.representationSnapshot) && (
          <p className="mt-2 text-[11px] font-medium text-primary-700">
            Já assinada em {formatSignatureTimestamp(mine.signedAt)}.
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
          Sua assinatura eletrônica
        </p>
        <SignatureCapture
          collaboratorId={collaboratorId || collaboratorName}
          collaboratorName={collaboratorName}
          onChange={setSignature}
        />
      </div>
    </Modal>
  );
}