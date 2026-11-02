import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

/**
 * URL publica de validacao (token aleatorio nao enumeravel). Nao inclui dados
 * pessoais: qualquer pessoa com o link ve apenas as informacoes minimas.
 */
export function buildValidationUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const rawBase = typeof __BASE_PATH__ !== "undefined" ? __BASE_PATH__ : "";
  const basePath = String(rawBase || "").replace(/\/$/, "");
  return `${origin}${basePath}/validar/${token}`;
}

/** Gera o QR-Code como data URL (para tela e para o PDF impresso). */
export function validationQrDataUrl(token: string, size = 120): string {
  const svg = renderToStaticMarkup(
    <QRCodeSVG
      value={buildValidationUrl(token)}
      size={size}
      level="M"
      marginSize={0}
      fgColor="#0f1a10"
      bgColor="#ffffff"
    />
  );
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}