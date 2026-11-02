import { useEffect, useState } from "react";
import SignaturePad from "@/components/base/SignaturePad";
import SignatureStamp from "@/components/base/SignatureStamp";
import { useCollaboratorSignature } from "@/pages/app/signature/signatureStore";
import { renderSignaturePng, resolveSignatureName } from "@/pages/app/signature/signatureUtils";

interface SignatureCaptureProps {
  collaboratorId: string;
  collaboratorName: string;
  onChange: (dataUrl: string) => void;
}

/**
 * Área de assinatura dos documentos (EPI, APR, DDS...).
 * Quando o colaborador já criou a assinatura no perfil, ela aparece pronta
 * para confirmação. Ainda é possível (opcionalmente) assinar manualmente.
 */
export default function SignatureCapture({
  collaboratorId,
  collaboratorName,
  onChange,
}: SignatureCaptureProps) {
  const config = useCollaboratorSignature(collaboratorId);
  const [mode, setMode] = useState<"profile" | "manual">("manual");
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (config) setMode("profile");
  }, [config]);

  useEffect(() => {
    if (mode !== "profile" || !config) return;
    // Representação desenhada: usa a imagem exatamente como registrada.
    if (config.kind === "draw" && config.imageData) {
      onChange(config.imageData);
      return;
    }
    let active = true;
    void renderSignaturePng(
      resolveSignatureName(collaboratorName, config.nameStyle),
      config.fontModel
    ).then((url) => {
      if (active) onChange(url);
    });
    return () => {
      active = false;
    };
  }, [mode, config, collaboratorName, onChange]);

  const handleManual = (url: string) => {
    setManual(url);
    onChange(url);
  };

  const startManual = () => {
    setManual("");
    setMode("manual");
    onChange("");
  };

  const startProfile = () => {
    setMode("profile");
    onChange("");
  };

  if (!config) {
    return (
      <div>
        <div className="mb-3 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900">
          <i className="ri-information-line mt-0.5 text-base"></i>
          <span>
            Você ainda não criou a sua assinatura. Assine abaixo ou defina uma assinatura em{" "}
            <strong className="font-semibold">Meus dados › Criar assinatura</strong> para usá-la em todos os
            documentos.
          </span>
        </div>
        <SignaturePad value={manual} onChange={handleManual} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-background-100 px-1 py-1">
        <button
          type="button"
          onClick={startProfile}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
            mode === "profile" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
          }`}
        >
          <i className="ri-user-follow-line"></i>
          Assinatura do meu perfil
        </button>
        <button
          type="button"
          onClick={startManual}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
            mode === "manual" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
          }`}
        >
          <i className="ri-pen-nib-line"></i>
          Assinar manualmente
        </button>
      </div>

      {mode === "profile" ? (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">
              Assinatura pré-definida
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700">
              <i className="ri-verified-badge-line"></i>
              {resolveSignatureName(collaboratorName, config.nameStyle)}
            </span>
          </div>
          <div className="mt-3 flex min-h-[80px] items-center justify-center rounded-md border border-dashed border-primary-300 bg-background-50 px-6 py-3">
            <SignatureStamp name={collaboratorName} font={config.fontModel} nameStyle={config.nameStyle} size={40} />
          </div>
          <p className="mt-2 text-center text-[11px] text-foreground-500">
            Esta é a assinatura registrada no seu perfil e será usada neste documento.
          </p>
        </div>
      ) : (
        <SignaturePad value={manual} onChange={handleManual} />
      )}
    </div>
  );
}