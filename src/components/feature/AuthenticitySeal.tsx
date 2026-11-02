import {
  formatSealDate,
  sealCodeOf,
  sealScopeLabels,
  sealUrlOf,
  shortSealHash,
  type SealDisplay,
} from "@/pages/app/signature/authenticitySeal";
import { validationQrDataUrl } from "@/pages/app/signature/validationQr";

interface AuthenticitySealProps {
  seal: SealDisplay;
  /** Versão enxuta para a folha A4 do documento. */
  compact?: boolean;
  className?: string;
}

/**
 * Chancela de autenticidade exibida na prévia do documento (equivalente ao
 * bloco impresso no rodapé do PDF). Mostra o QR-Code de validação pública,
 * o código de verificação, os signatários e o hash do conteúdo.
 */
export default function AuthenticitySeal({ seal, compact = false, className = "" }: AuthenticitySealProps) {
  if (!seal?.token) return null;

  const url = sealUrlOf(seal.token);
  const qrSize = compact ? 64 : 96;

  return (
    <div
      className={`rounded-lg border-2 border-primary-500/50 bg-background-50 ${
        compact ? "px-2.5 py-2" : "px-4 py-3.5"
      } ${className}`}
    >
      <div className="flex items-stretch gap-3">
        <div className="flex shrink-0 flex-col items-center">
          <div
            className="flex items-center justify-center rounded bg-background-50"
            style={{ width: qrSize, height: qrSize }}
          >
            <img
              src={validationQrDataUrl(seal.token, qrSize)}
              alt="QR-Code de autenticidade do documento"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="mt-1 text-[7px] font-semibold uppercase tracking-wide text-foreground-400">
            Leia para validar
          </span>
        </div>

        <div className={`min-w-0 flex-1 border-l border-dashed border-background-300 ${compact ? "pl-2.5" : "pl-3.5"}`}>
          <p className={`font-semibold uppercase tracking-[0.14em] text-secondary-700 ${compact ? "text-[7px]" : "text-[9px]"}`}>
            Chancela de autenticidade{seal.scope ? ` · ${sealScopeLabels[seal.scope]}` : ""}
          </p>
          <p
            className={`mt-0.5 font-heading font-extrabold uppercase leading-tight tracking-wide text-foreground-950 ${
              compact ? "text-[8.5px]" : "text-[12px]"
            }`}
          >
            Documento assinado eletronicamente
          </p>
          <p className={`mt-0.5 truncate text-foreground-700 ${compact ? "text-[7.5px]" : "text-[11px]"}`}>
            {seal.label || "—"}
          </p>

          <div className={`mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 ${compact ? "text-[7px]" : "text-[10px]"}`}>
            <span className="text-foreground-600">
              <strong className="font-semibold text-foreground-900">Código:</strong> {sealCodeOf(seal.token)}
            </span>
            <span className="text-foreground-600">
              <strong className="font-semibold text-foreground-900">Signatários:</strong> {seal.signerCount ?? 0}
            </span>
            <span className="text-foreground-600">
              <strong className="font-semibold text-foreground-900">Emitido em:</strong> {formatSealDate(seal.sealedAt)}
            </span>
            <span className="break-all text-foreground-600">
              <strong className="font-semibold text-foreground-900">SHA-256:</strong> {shortSealHash(seal.contentHash)}
            </span>
          </div>

          {!compact && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[10px] font-semibold text-primary-700 hover:underline"
            >
              <i className="ri-shield-check-line"></i>
              <span className="truncate">{url}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}