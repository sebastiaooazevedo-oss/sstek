import { useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { compressEpiPhoto } from "@/pages/app/modules/epi/epiPhoto";
import {
  setEpiReplacementReturnPhoto,
  type EpiReplacementRequest,
} from "@/pages/app/modules/epi/replacementStore";

interface EpiReturnPhotoFieldProps {
  request: EpiReplacementRequest;
  /** Permitir anexar/trocar (a gestão). */
  canEdit?: boolean;
  onSaved?: (photo: string) => void;
}

/**
 * Foto do EPI antigo devolvido no atendimento da substituição.
 *
 * Fica junto do pedido para que o documento anexado em Documentos mostre o
 * equipamento que voltou para o almoxarifado — separado da foto do EPI que
 * motivou o pedido.
 */
export default function EpiReturnPhotoField({
  request,
  canEdit = true,
  onSaved,
}: EpiReturnPhotoFieldProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  const save = async (photo: string) => {
    setBusy(true);
    setError("");
    const ok = await setEpiReplacementReturnPhoto(request.id, photo);
    setBusy(false);
    if (!ok) {
      setError("Não foi possível salvar a foto do EPI devolvido. Tente novamente.");
      return;
    }
    onSaved?.(photo);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    try {
      const photo = await compressEpiPhoto(file);
      await save(photo);
    } catch {
      setError("Não foi possível processar a foto. Tente outra imagem.");
    }
  };

  return (
    <div className="mt-2 rounded-md border border-background-200 bg-background-100 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-700">
          <i className="ri-arrow-go-back-line"></i>
          EPI antigo devolvido
        </span>
        {!request.returnPhoto && (
          <span className="text-[11px] text-foreground-400">sem foto registrada</span>
        )}
        {busy && (
          <span className="inline-flex items-center gap-1 text-[11px] text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Salvando...
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {request.returnPhoto ? (
          <button
            type="button"
            onClick={() => setPreview(true)}
            title="Ampliar foto do EPI devolvido"
            className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-50"
          >
            <img
              src={request.returnPhoto}
              alt={`EPI antigo devolvido por ${request.collaboratorName}`}
              className="h-full w-full object-cover object-top"
            />
          </button>
        ) : null}

        {canEdit ? (
          <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100">
            <i className={busy ? "ri-loader-4-line animate-spin" : "ri-camera-line"}></i>
            {request.returnPhoto ? "Trocar foto" : "Anexar foto do devolvido"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void handleFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}

        {request.returnPhoto && canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save("")}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100 disabled:opacity-60"
          >
            <i className="ri-delete-bin-line"></i>
            Remover
          </button>
        ) : null}

        <p className="min-w-[180px] flex-1 text-[11px] leading-relaxed text-foreground-500">
          A foto do equipamento devolvido é anexada em Documentos junto da nova Ficha de EPI, com o
          histórico do pedido.
        </p>
      </div>

      {error && <p className="mt-1.5 text-[11px] font-medium text-accent-700">{error}</p>}

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="EPI antigo devolvido"
        subtitle={`Registro de devolução de ${request.epiName} — ${request.collaboratorName}.`}
        icon="ri-arrow-go-back-line"
        size="lg"
        footer={
          <ModalButton variant="ghost" onClick={() => setPreview(false)} icon="ri-close-line">
            Fechar
          </ModalButton>
        }
      >
        {request.returnPhoto && (
          <img
            src={request.returnPhoto}
            alt="Foto do EPI antigo devolvido"
            className="mx-auto max-h-[60vh] w-auto rounded-md border border-background-200 object-contain"
          />
        )}
      </Modal>
    </div>
  );
}