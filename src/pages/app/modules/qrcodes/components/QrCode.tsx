import { QRCodeCanvas } from "qrcode.react";

/** 3 cm em px de tela (1 cm = 96/2,54 px) — mesma medida usada na impressão. */
export const QR_SIZE_PX = 113;

interface QrCodeProps {
  value: string;
  /** Tamanho na tela em px. Na impressão a etiqueta sempre sai em 3 × 3 cm. */
  size?: number;
  className?: string;
  /** Remove borda/fundo do cartucho (usado nas etiquetas de impressão). */
  frameless?: boolean;
  /** Mostra a marca do sistema no centro do código. */
  brandMark?: boolean;
}

/**
 * QR-Code real (canvas) no tamanho padrão de 3 × 3 cm, pronto para crachá e
 * capacete. Usa correção de erro alta (nível H) justamente para suportar a
 * marca do sistema no centro sem prejudicar a leitura.
 */
export default function QrCode({
  value,
  size = QR_SIZE_PX,
  className = "",
  frameless = false,
  brandMark = true,
}: QrCodeProps) {
  const frame = frameless ? "" : "rounded-lg border border-background-200 bg-white p-1.5";

  return (
    <div className={`inline-flex items-center justify-center ${frame} ${className}`}>
      <div className="qr-code-box relative" style={{ width: size, height: size }}>
        <QRCodeCanvas
          value={value}
          size={Math.round(size * 4)}
          level="H"
          marginSize={2}
          fgColor="#0f1a10"
          bgColor="#ffffff"
          style={{ width: "100%", height: "100%" }}
        />
        {brandMark && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 flex aspect-square w-[24%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[3px] bg-white"
          >
            <span
              className="font-heading font-extrabold leading-none"
              style={{ color: "#0b2545", fontSize: Math.round(size * 0.13) }}
            >
              S
            </span>
            <span
              className="mt-[2px] rounded-full"
              style={{
                backgroundColor: "#16a34a",
                width: Math.round(size * 0.1),
                height: Math.max(1, Math.round(size * 0.016)),
              }}
            ></span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Endereço público da ficha de fiscalização gravado dentro do QR-Code.
 * A lógica fica em `publicBase` (endereço configurado pela empresa ou o
 * endereço atual + caminho de publicação). Reexportada aqui para manter os
 * imports existentes funcionando.
 */
export { fiscalizacaoUrl } from "@/pages/app/modules/qrcodes/publicBase";

/**
 * Gera a imagem PNG do QR-Code já com a marca do sistema no centro.
 * Usado nas exportações (PDF) em que o canvas é copiado como imagem.
 */
export function brandQrDataUrl(source: HTMLCanvasElement): string {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);

  const side = out.width;
  const plate = side * 0.24;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect((side - plate) / 2, (side - plate) / 2, plate, plate);

  ctx.fillStyle = "#0b2545";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(side * 0.13)}px Sora, Arial, sans-serif`;
  ctx.fillText("S", side / 2, side / 2 - side * 0.012);

  const barW = side * 0.1;
  ctx.fillStyle = "#16a34a";
  ctx.fillRect((side - barW) / 2, side / 2 + side * 0.06, barW, Math.max(1, side * 0.016));

  return out.toDataURL("image/png");
}