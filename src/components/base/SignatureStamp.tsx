import { getSignatureFont, type SignatureFontId } from "@/pages/app/signature/signatureFonts";
import { resolveSignatureName, type SignatureNameStyle } from "@/pages/app/signature/signatureUtils";

interface SignatureStampProps {
  /** Nome completo do colaborador. */
  name: string;
  /** Modelo de escrita escolhido. */
  font: SignatureFontId;
  /** Nome completo ou parcial (primeiro + último). */
  nameStyle: SignatureNameStyle;
  /** Imagem da representação visual salva (traço desenhado ou tipográfica). */
  imageData?: string | null;
  /** Tamanho da assinatura em pixels. */
  size?: number;
  className?: string;
}

/**
 * Reproduz visualmente a assinatura do colaborador. Quando existe a imagem da
 * representação salva, ela é exibida exatamente como registrada; caso contrário
 * é usada a prévia tipográfica pelo nome + modelo de escrita.
 */
export default function SignatureStamp({
  name,
  font,
  nameStyle,
  imageData,
  size = 34,
  className = "",
}: SignatureStampProps) {
  if (imageData) {
    return (
      <img
        src={imageData}
        alt={`Assinatura de ${name}`}
        className={`inline-block object-contain ${className}`}
        style={{ height: `${Math.round(size * 1.7)}px` }}
      />
    );
  }

  const text = resolveSignatureName(name, nameStyle);
  const family = getSignatureFont(font).family;

  return (
    <span
      className={`inline-block whitespace-nowrap leading-none text-foreground-950 ${className}`}
      style={{ fontFamily: `'${family}', cursive`, fontSize: `${size}px` }}
    >
      {text || "—"}
    </span>
  );
}