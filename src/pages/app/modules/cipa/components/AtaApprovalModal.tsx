import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignatureCapture from "@/pages/app/components/SignatureCapture";
import { getInitials } from "@/pages/app/context";
import { ataApprovers, generateId, generateSignatureUid, type AtaApprover } from "@/pages/app/modules/cipa/cipaUtils";
import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";
import type { Cipa, CipaAta, CipaAtaSignature } from "@/mocks/cipa";

interface AtaApprovalModalProps {
  ata: CipaAta | null;
  cipa?: Cipa;
  /** Responsável Técnico de Segurança do Trabalho (assinatura obrigatória). */
  technicalResponsible?: AtaApprover | null;
  onClose: () => void;
  onSave: (ata: CipaAta) => void;
}

const roleTone: Record<CipaAtaSignature["role"], string> = {
  Presidente: "bg-primary-100 text-primary-700",
  Secretário: "bg-accent-100 text-accent-800",
  "Responsável Técnico": "bg-secondary-100 text-secondary-900",
};

function buildDrafts(
  ata: CipaAta,
  cipa?: Cipa,
  technicalResponsible?: AtaApprover | null
): CipaAtaSignature[] {
  const drafts: CipaAtaSignature[] = ata.approvals.map((a) => ({ ...a }));
  ataApprovers(cipa, technicalResponsible).forEach((approver) => {
    if (drafts.some((d) => d.role === approver.role)) return;
    drafts.push({
      id: generateId("ataappr"),
      role: approver.role,
      name: approver.name,
      collaboratorId: approver.collaboratorId,
      signedAt: null,
      signatureUid: null,
      representationSnapshot: null,
    });
  });
  return drafts;
}

export default function AtaApprovalModal({
  ata,
  cipa,
  technicalResponsible,
  onClose,
  onSave,
}: AtaApprovalModalProps) {
  const [drafts, setDrafts] = useState<CipaAtaSignature[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ata) return;
    setDrafts(buildDrafts(ata, cipa, technicalResponsible));
    setError("");
  }, [ata, cipa, technicalResponsible]);

  if (!ata) return null;

  const signedCount = drafts.filter((d) => d.representationSnapshot || d.signedAt).length;

  const handleCapture = (id: string, dataUrl: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        if (!dataUrl) {
          return { ...d, representationSnapshot: null, signedAt: null, signatureUid: null };
        }
        return {
          ...d,
          representationSnapshot: dataUrl,
          signedAt: d.signedAt || new Date().toISOString(),
          signatureUid: d.signatureUid || generateSignatureUid(),
        };
      })
    );
  };

  const handleSave = () => {
    if (signedCount === 0) {
      setError("Colete ao menos uma assinatura para formalizar a aprovação.");
      return;
    }
    setError("");
    onSave({ ...ata, approvals: drafts });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Aprovação da ata"
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
            Salvar aprovação
          </ModalButton>
        </>
      }
    >
      <div className="flex items-start gap-2.5 rounded-md border border-secondary-200 bg-secondary-50 px-4 py-3 text-xs text-secondary-900 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-100">
        <i className="ri-information-line mt-0.5 text-base"></i>
        <span>
          A aprovação é formalizada com a <strong className="font-semibold">assinatura pessoal do perfil</strong> do
          presidente, do secretário e do <strong className="font-semibold">Responsável Técnico de Segurança do
          Trabalho</strong>. Ao abrir, a assinatura registrada no perfil já aparece para confirmação; se a pessoa
          ainda não criou a assinatura, é possível assinar manualmente no quadro.
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {drafts.length === 0 && (
          <p className="rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-sm text-foreground-500">
            A comissão selecionada ainda não tem presidente e secretário definidos na composição.
          </p>
        )}

        {drafts.map((draft) => {
          const signed = Boolean(draft.representationSnapshot || draft.signedAt);
          return (
            <div key={draft.id} className="rounded-lg border border-background-200 bg-background-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-100 text-[11px] font-bold text-secondary-900">
                    {getInitials(draft.name)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-950">{draft.name}</p>
                    <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleTone[draft.role]}`}>
                      {draft.role}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    signed ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  <i className={signed ? "ri-verified-badge-line" : "ri-timer-line"}></i>
                  {signed ? "Assinatura coletada" : "Aguardando assinatura"}
                </span>
              </div>

              <div className="mt-3">
                <SignatureCapture
                  collaboratorId={draft.collaboratorId || draft.name}
                  collaboratorName={draft.name}
                  onChange={(url) => handleCapture(draft.id, url)}
                />
              </div>

              {signed && (
                <p className="mt-3 border-t border-background-100 pt-3 text-[11px] text-foreground-500">
                  Registrado em {formatSignatureTimestamp(draft.signedAt)} · ID da assinatura: {draft.signatureUid}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}