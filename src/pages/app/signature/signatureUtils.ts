import { getSignatureFont, type SignatureFontId } from "./signatureFonts";

/** Como o nome é usado na assinatura. */
export type SignatureNameStyle = "full" | "partial";

export interface SignatureRenderOptions {
  /** Cor do traço da assinatura. */
  color?: string;
  /** Tamanho da fonte na imagem gerada. */
  fontSize?: number;
}

/**
 * Resolve o texto que será exibido na assinatura:
 * - "full": o nome completo do colaborador;
 * - "partial": primeiro nome + último nome (ex.: "Carlos Menezes").
 */
export function resolveSignatureName(fullName: string, style: SignatureNameStyle): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (style === "partial" && parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return parts.join(" ");
}

/**
 * Renderiza a assinatura (texto + modelo de escrita) em um PNG (data URL),
 * pronto para ser guardado junto do aceite do documento — mantendo o mesmo
 * formato das assinaturas coletadas hoje.
 */
export async function renderSignaturePng(
  text: string,
  fontId: SignatureFontId,
  options: SignatureRenderOptions = {}
): Promise<string> {
  const content = text.trim();
  if (!content) return "";

  const font = getSignatureFont(fontId);
  const fontSize = options.fontSize ?? 72;
  const color = options.color ?? "#1c2a33";
  const padding = 48;
  const fontStack = `${fontSize}px "${font.family}", cursive`;

  try {
    await document.fonts.load(fontStack, content);
  } catch {
    /* segue com a fonte de fallback */
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.font = fontStack;
  const textWidth = Math.ceil(ctx.measureText(content).width) || fontSize * content.length;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + padding * 2;

  ctx.font = fontStack;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(content, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL("image/png");
}