import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QrSticker, { type QrStickerFormat } from "@/pages/app/modules/qrcodes/components/QrSticker";
import type { HelmetCaInfo } from "@/pages/app/modules/qrcodes/qrStickerData";
import type { Collaborator } from "@/mocks/collaborators";

/** Colunas × linhas da folha A4 adesiva (3 × 8 = 24 adesivos por folha). */
export const SHEET_COLUMNS = 3;
export const SHEET_ROWS = 8;
export const SHEET_PER_PAGE = SHEET_COLUMNS * SHEET_ROWS;

interface QrPrintSheetProps {
  collaborators: Collaborator[];
  companyName: string;
  subdomain: string;
  format: QrStickerFormat;
  helmetCaMap?: Record<string, HelmetCaInfo | null>;
  sesmtPhone?: string | null;
  onDone: () => void;
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages.length > 0 ? pages : [[]];
}

/**
 * Folha de impressão dos adesivos de fiscalização.
 *
 * É montada fora do painel (portal no body) e fica invisível na tela: aparece
 * apenas na caixa de impressão do navegador, com cada QR-Code em 3 × 3 cm —
 * medida padrão para colar no capacete e no crachá.
 *
 * No modo `sheet` a saída é a **folha A4 adesiva** com posições fixas: grade de
 * 3 colunas × 8 linhas (24 adesivos), quebrando página a cada 24 unidades.
 */
export default function QrPrintSheet({
  collaborators,
  companyName,
  subdomain,
  format,
  helmetCaMap = {},
  sesmtPhone = null,
  onDone,
}: QrPrintSheetProps) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const handleAfterPrint = () => doneRef.current();
    window.addEventListener("afterprint", handleAfterPrint);

    // Marca o body para que as regras de impressão escondam o app somente
    // enquanto a folha de adesivos estiver montada (a impressão da página
    // pública de fiscalização continua funcionando normalmente).
    document.body.classList.add("printing-labels");
    if (format === "sheet") document.body.classList.add("printing-label-sheet");

    const timer = window.setTimeout(() => window.print(), 350);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("printing-labels");
      document.body.classList.remove("printing-label-sheet");
    };
  }, [format]);

  const stickerFor = (collaborator: Collaborator) => (
    <QrSticker
      key={collaborator.id}
      collaborator={collaborator}
      companyName={companyName}
      subdomain={subdomain}
      format={format}
      helmetCa={helmetCaMap[collaborator.id] ?? null}
      sesmtPhone={sesmtPhone}
    />
  );

  // Folha A4 adesiva: 3 colunas de 63 mm (189 mm) × 8 linhas de 34,5 mm
  // (276 mm) dentro da área imprimível de 190 × 277 mm do A4 com margem 10 mm.
  if (format === "sheet") {
    return createPortal(
      <div className="print-area bg-white">
        {chunk(collaborators, SHEET_PER_PAGE).map((pageItems, pageIndex) => (
          <div key={pageIndex} className="qr-label-page">
            <div className="grid grid-cols-[63mm_63mm_63mm]">
              {pageItems.map((collaborator) => stickerFor(collaborator))}
            </div>
          </div>
        ))}
      </div>,
      document.body,
    );
  }

  // A folha precisa caber na area imprimivel do A4 (190 mm com margem de 10 mm).
  // Se o conteudo estourar a largura, o navegador reduz a pagina inteira e o
  // QR do colaborador sai menor que 3 x 3 cm — o que estoura cracha e capacete.
  // 4 selos de 45 mm + 3 espacos de 1,5 mm = 184,5 mm (folga segura).
  const gridClass =
    format === "seal"
      ? "grid grid-cols-4 gap-x-[1.5mm] gap-y-[4mm]"
      : "grid grid-cols-3 gap-x-[5mm] gap-y-[6mm]";

  return createPortal(
    <div className="print-area bg-white">
      <div className="mb-[4mm] flex items-end justify-between border-b border-[#d7dde0] pb-[2mm]">
        <div>
          <p className="text-[9pt] font-bold uppercase tracking-wide text-black">
            {format === "seal" ? "Selos circulares de fiscalização" : "Etiquetas de fiscalização"}
          </p>
          <p className="text-[7pt] text-[#5b6b70]">
            {companyName} · {collaborators.length} adesivo(s) · QR-Code 3 × 3 cm
          </p>
        </div>
        <p className="text-[7pt] font-semibold text-[#5b6b70]">sstek.com/{subdomain}</p>
      </div>

      <div className={gridClass}>{collaborators.map((collaborator) => stickerFor(collaborator))}</div>
    </div>,
    document.body,
  );
}