import type { CSSProperties } from "react";
import QrCode, { fiscalizacaoUrl } from "@/pages/app/modules/qrcodes/components/QrCode";
import type { HelmetCaInfo } from "@/pages/app/modules/qrcodes/qrStickerData";
import type { Collaborator } from "@/mocks/collaborators";

export type QrStickerFormat = "label" | "seal" | "sheet";

interface QrStickerProps {
  collaborator: Collaborator;
  companyName: string;
  subdomain: string;
  format: QrStickerFormat;
  /** Validade do CA do capacete entregue ao colaborador (selo e folha A4). */
  helmetCa?: HelmetCaInfo | null;
  /** Telefone do SESMT (CIPA com área SESMT ou cadastro nas Configurações). */
  sesmtPhone?: string | null;
}

/** Fundo e traço do selo quando o CA está vencido (destaque para o fiscal). */
const EXPIRED_STYLE = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as CSSProperties;

/**
 * Adesivo de fiscalização do colaborador.
 *
 * - `label`: etiqueta quadrada para crachá e ficha;
 * - `seal`: selo circular para colar no capacete, com validade do CA e SESMT;
 * - `sheet`: célula da folha A4 adesiva (grade 3 × 8) — layout horizontal,
 *   com o QR à esquerda e as informações à direita.
 *
 * Quando a validade do CA do capacete já passou, o selo inteiro muda para
 * vermelho e a linha do CA passa a começar com "CA VENCIDO" — leitura imediata
 * em campo, sem precisar interpretar data.
 *
 * As medidas usam cm/mm de verdade, então o mesmo componente serve para a
 * pré-visualização em tela e para a impressão.
 */
export default function QrSticker({
  collaborator,
  companyName,
  subdomain,
  format,
  helmetCa,
  sesmtPhone,
}: QrStickerProps) {
  const url = fiscalizacaoUrl(subdomain, collaborator.id);
  const caExpired = Boolean(helmetCa?.expired);
  const caLine = helmetCa
    ? caExpired
      ? `CA VENCIDO · ${helmetCa.ca}`
      : `CA ${helmetCa.ca}${helmetCa.validity ? ` · ${helmetCa.validity}` : ""}`
    : "";

  const baseBorder = caExpired ? "border-solid border-[#c02626]" : "border-dashed border-[#c7cdd1]";

  if (format === "sheet") {
    return (
      <div
        className={`flex h-[34.5mm] w-[63mm] items-center gap-[2mm] overflow-hidden border ${baseBorder} px-[1.5mm] py-[1mm] ${
          caExpired ? "bg-[#fdf3f3]" : "bg-white"
        }`}
        style={caExpired ? EXPIRED_STYLE : undefined}
      >
        <QrCode value={url} frameless className="shrink-0 p-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[7pt] font-bold leading-tight text-black">{collaborator.name}</p>
          <p className="truncate text-[5pt] leading-tight text-[#5b6b70]">{collaborator.role}</p>
          <p className="truncate text-[5pt] leading-tight text-[#5b6b70]">{companyName}</p>
          {caLine && (
            <p
              className={`truncate text-[5pt] font-semibold leading-tight ${
                caExpired ? "text-[#c02626]" : "text-black"
              }`}
            >
              {caExpired && helmetCa?.validity
                ? `${caLine} · ${helmetCa.validity}`
                : caLine}
            </p>
          )}
          {sesmtPhone && (
            <p className="truncate text-[5pt] leading-tight text-[#33474d]">SESMT {sesmtPhone}</p>
          )}
        </div>
      </div>
    );
  }

  if (format === "seal") {
    return (
      <div
        className={`flex h-[4.5cm] w-[4.5cm] flex-col items-center justify-center gap-[0.4mm] overflow-hidden rounded-full border ${baseBorder} px-[2.5mm] text-center ${
          caExpired ? "bg-[#fdf3f3]" : "bg-white"
        }`}
        style={caExpired ? EXPIRED_STYLE : undefined}
      >
        {/* O QR do colaborador tem tamanho fixo (3 x 3 cm) em tela e no papel:
            e a medida que encaixa no cracha e na face do capacete. */}
        <QrCode value={url} frameless className="shrink-0 p-0" />
        <p className="w-full truncate text-[5.8pt] font-bold leading-tight text-black">{collaborator.name}</p>
        <p className="w-full truncate text-[4.2pt] leading-tight text-[#5b6b70]">{companyName}</p>
        {caLine && (
          <p
            className={`w-full truncate text-[4.5pt] leading-tight ${
              caExpired ? "font-bold text-[#c02626]" : "font-semibold text-black"
            }`}
          >
            {caLine}
          </p>
        )}
        {sesmtPhone && (
          <p className="w-full truncate text-[4.5pt] leading-tight text-[#33474d]">SESMT {sesmtPhone}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex w-[3.6cm] flex-col items-center gap-[1.5mm] border bg-white px-[1mm] py-[1.5mm] ${baseBorder}`}
    >
      <QrCode value={url} frameless className="p-0" />
      <p className="w-full truncate text-center text-[7pt] font-bold leading-tight text-black">{collaborator.name}</p>
      <p className="w-full truncate text-center text-[5.5pt] leading-tight text-[#5b6b70]">
        {companyName} · {collaborator.area}
      </p>
    </div>
  );
}