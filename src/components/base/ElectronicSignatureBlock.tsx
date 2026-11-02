import type { SignatureDisplay } from "@/pages/app/signature/signatureDisplay";
import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";

interface ElectronicSignatureBlockProps {
  signature: SignatureDisplay;
  variant?: "default" | "compact";
  showDivider?: boolean;
  className?: string;
}

/**
 * Bloco de assinatura eletronica exibido sempre na mesma ordem:
 * representacao visual, texto padrao, nome completo, data/hora UTC-03:00
 * e o ID da assinatura (UUID do ato).
 */
export default function ElectronicSignatureBlock({
  signature,
  variant = "default",
  showDivider = true,
  className = "",
}: ElectronicSignatureBlockProps) {
  const compact = variant === "compact";
  const name = signature.signerName?.trim() || "—";

  return (
    <div className={`text-center ${className}`}>
      <div className={`flex items-center justify-center ${compact ? "h-9" : "h-12"}`}>
        {signature.representationSnapshot ? (
          <img
            src={signature.representationSnapshot}
            alt={`Representação visual preservada da assinatura de ${name}`}
            className={`${compact ? "max-h-9" : "max-h-12"} object-contain`}
          />
        ) : (
          <span className="text-[9px] italic text-foreground-400">Representação visual preservada</span>
        )}
      </div>
      <div className={showDivider ? "mt-1 border-t border-foreground-300 pt-1" : "mt-1"}>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground-500">
          Assinado eletronicamente por
        </p>
        <p className={`font-bold uppercase tracking-tight text-foreground-950 ${compact ? "text-[11px]" : "text-xs"}`}>
          {name}
        </p>
        <p className="text-[9px] text-foreground-500">
          Data: {formatSignatureTimestamp(signature.signedAt, signature.timezoneDisplay)}
        </p>
        <p className="break-all text-[9px] text-foreground-500">
          ID da assinatura: {signature.signatureUid || "—"}
        </p>
        {signature.level && (
          <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-secondary-100 px-1.5 py-0.5 text-[8px] font-semibold text-secondary-800">
            <i className="ri-shield-check-line"></i>
            {levelLabel(signature.level)}
          </p>
        )}
      </div>
    </div>
  );
}

function levelLabel(level: string): string {
  if (level === "qualificada") return "Assinatura qualificada (ICP-Brasil)";
  if (level === "avancada") return "Assinatura avançada";
  return "Assinatura eletrônica simples";
}