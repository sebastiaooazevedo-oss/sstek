import { useEffect, useState } from "react";
import SignatureCapture from "@/pages/app/components/SignatureCapture";
import TechnicalSignaturePreview from "@/pages/app/modules/cipa/components/TechnicalSignaturePreview";
import { generateSignatureUid } from "@/pages/app/modules/cipa/cipaUtils";
import { signTechnicalDocument, type TechnicalSignatureScope } from "@/pages/app/modules/cipa/technicalSignatureStore";
import type { TechnicalResponsible } from "@/pages/app/modules/cipa/technicalResponsible";
import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";

export interface TechnicalSignatureRequest {
  scope: TechnicalSignatureScope;
  referenceRef: string;
  label: string;
  description?: string;
}

interface TechnicalSignatureModalProps {
  request: TechnicalSignatureRequest | null;
  responsible: TechnicalResponsible | null;
  onClose: (signed: boolean) => void;
}

/**
 * Assinatura eletrônica do Responsável Técnico em um documento técnico
 * (ficha da CIPA, inspeção ou dossiê eleitoral). Usa a assinatura registrada
 * no perfil do RT e registra o ato para liberar a emissão definitiva.
 *
 * O RT confere o documento na pré-visualização (mesmo layout do PDF emitido)
 * antes de assinar.
 */
export default function TechnicalSignatureModal({
  request,
  responsible,
  onClose,
}: TechnicalSignatureModalProps) {
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSignature("");
    setError("");
    setSaving(false);
  }, [request]);

  if (!request) return null;

  const signerName = responsible?.name || "";

  const handleSave = async () => {
    if (saving) return;
    if (!signerName) {
      setError("Não há Responsável Técnico definido para a empresa.");
      return;
    }
    if (!signature) {
      setError("Confirme a sua assinatura para liberar a emissão do documento.");
      return;
    }
    setSaving(true);
    const record = await signTechnicalDocument({
      scope: request.scope,
      referenceRef: request.referenceRef,
      referenceLabel: request.label,
      signerName,
      signerCollaboratorRef: responsible?.collaboratorId ?? null,
      signatureUid: generateSignatureUid(),
      signatureImage: signature,
    });
    setSaving(false);
    if (!record) {
      setError("Não foi possível registrar a assinatura. Tente novamente.");
      return;
    }
    onClose(true);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-foreground-950/60 p-3 py-6 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose(false)}
    >
      <div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-shield-check-line text-lg"></i>
            </span>
            <div>
              <h2 className="font-heading text-lg font-bold tracking-tight text-foreground-950">
                Assinatura do Responsável Técnico
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                Confira o documento na prévia ao lado. A emissão definitiva fica liberada após a sua assinatura eletrônica.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onClose(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="max-h-[76vh] overflow-y-auto px-5 py-5 md:px-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
            {/* Prévia do documento */}
            <div className="order-2 min-w-0 lg:order-1">
              <TechnicalSignaturePreview
                scope={request.scope}
                referenceRef={request.referenceRef}
                heightClass="h-[46vh]"
              />
            </div>

            {/* Identificação e assinatura */}
            <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
              <div className="rounded-lg border border-background-200 bg-background-100 p-4">
                <p className="text-sm font-semibold text-foreground-950">{request.label}</p>
                {request.description && (
                  <p className="mt-1 text-xs leading-relaxed text-foreground-600">{request.description}</p>
                )}
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                  <i className="ri-user-star-line"></i>
                  {signerName || "Responsável Técnico não definido"}
                </p>
              </div>

              {signerName ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                    Sua assinatura eletrônica
                  </p>
                  <SignatureCapture
                    collaboratorId={responsible?.collaboratorId || signerName}
                    collaboratorName={signerName}
                    onChange={setSignature}
                  />
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-foreground-500">
                    <i className="ri-information-line mt-0.5 text-sm"></i>
                    <span>
                      Ao confirmar, o documento passa a registrar o seu nome, a data/hora do ato e o ID da assinatura,
                      emitido em {formatSignatureTimestamp(new Date().toISOString())}.
                    </span>
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900">
                  <i className="ri-alert-line mt-0.5 text-base"></i>
                  <span>
                    Nenhum colaborador foi marcado como Responsável Técnico. Marque o RT em{" "}
                    <strong className="font-semibold">Colaboradores › editar cadastro</strong> ou informe o nome em{" "}
                    <strong className="font-semibold">Configurações › Dados da empresa</strong>.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-background-200 bg-background-50 px-5 py-4 md:px-6">
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <button
            type="button"
            onClick={() => onClose(false)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-close-line text-base"></i>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !signerName}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={saving ? "ri-loader-4-line animate-spin" : "ri-check-double-line"}></i>
            {saving ? "Registrando…" : "Assinar e liberar"}
          </button>
        </div>
      </div>
    </div>
  );
}