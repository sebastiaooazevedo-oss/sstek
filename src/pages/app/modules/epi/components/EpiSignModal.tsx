import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignatureCapture from "@/pages/app/components/SignatureCapture";
import { callSignatureEngine } from "@/pages/app/signature/signatureService";
import type { EpiDelivery } from "@/mocks/epi";

interface EpiSignModalProps {
  delivery: EpiDelivery | null;
  collaboratorName: string;
  onClose: () => void;
  onSign: (deliveryId: string, signature: string) => void;
}

export default function EpiSignModal({
  delivery,
  collaboratorName,
  onClose,
  onSign,
}: EpiSignModalProps) {
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (delivery) {
      setSignature("");
      setError("");
      setSaving(false);
    }
  }, [delivery]);

  if (!delivery) return null;

  const totalItems = delivery.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirm = async () => {
    if (!signature) {
      setError("Assine no quadro acima para registrar o aceite do EPI.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // Validação e registro no servidor (bloqueios, hash, evidências).
      await callSignatureEngine(
        "sign_document",
        { collaboratorRef: delivery.collaboratorId, collaboratorName: delivery.collaboratorName },
        {
          documentType: "epi",
          documentRef: delivery.id,
          documentVersion: 1,
          payload: {
            date: delivery.date,
            reason: delivery.reason,
            items: delivery.items,
            signature,
          },
        }
      );
      onSign(delivery.id, signature);
    } catch (err) {
      setError((err as Error).message || "Não foi possível registrar a assinatura no servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!delivery}
      onClose={onClose}
      title="Assinar aceite da Ficha de EPI"
      subtitle={`${delivery.date} · ${delivery.reason}`}
      icon="ri-shirt-line"
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
            {delivery.collaboratorRole || "—"}
          </span>
          <span className="rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
            {delivery.area || "—"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Itens entregues</p>
            <p className="mt-0.5 text-sm text-foreground-800">{delivery.items.length} tipo(s) · {totalItems} unidade(s)</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Motivo</p>
            <p className="mt-0.5 text-sm text-foreground-800">{delivery.reason}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="font-heading text-sm font-bold text-foreground-950">Equipamentos entregues</h4>
        <ul className="mt-3 flex flex-col gap-2">
          {delivery.items.map((item, index) => (
            <li
              key={`${item.ca}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-shirt-line text-base"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-900">{item.name}</p>
                <p className="truncate text-xs text-foreground-500">CA {item.ca}</p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                {item.quantity}x
              </span>
            </li>
          ))}
        </ul>
      </div>

      {delivery.notes && (
        <div className="mt-5 rounded-lg border border-background-200 bg-background-100 p-4">
          <h4 className="text-sm font-bold text-foreground-950">Observações</h4>
          <p className="mt-2 text-sm leading-relaxed text-foreground-600">{delivery.notes}</p>
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground-700">Aceite por assinatura</span>
          <span className="text-[11px] text-foreground-500">{collaboratorName}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground-400">
          Ao assinar, você declara ter recebido os Equipamentos de Proteção Individual acima e as orientações
          quanto ao uso correto, guarda e conservação.
        </p>
        <div className="mt-2">
          <SignatureCapture
            collaboratorId={delivery.collaboratorId}
            collaboratorName={delivery.collaboratorName}
            onChange={setSignature}
          />
        </div>
      </div>
    </Modal>
  );
}