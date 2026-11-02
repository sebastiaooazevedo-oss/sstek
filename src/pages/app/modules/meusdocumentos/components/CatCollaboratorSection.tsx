import { useMemo } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { buildStructuredPdfBody, toBrDate } from "@/pages/app/modules/documentos/structured/structuredPdf";
import { useStructuredDocuments } from "@/pages/app/modules/documentos/structured/structuredStore";
import { catBelongsToCollaborator } from "@/pages/app/modules/documentos/structured/cat/catInvestigation";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatCollaboratorSectionProps {
  collaboratorId: string;
  cpf: string;
}

/**
 * CAT no portal do colaborador.
 *
 * Mostra as Comunicações de Acidente de Trabalho emitidas no nome do próprio
 * trabalhador (vinculadas pelo cadastro ou pelo CPF), com download da **via da
 * CAT** e do **recibo de entrega** anexado pela empresa — o comprovante que a
 * Lei 8.213/91, art. 22, §2º, obriga a entregar ao trabalhador.
 */
export default function CatCollaboratorSection({ collaboratorId, cpf }: CatCollaboratorSectionProps) {
  const records = useStructuredDocuments();

  const myCats = useMemo(
    () =>
      records.filter(
        (record) =>
          record.kind === "cat" &&
          catBelongsToCollaborator(record.payload as CatPayload, collaboratorId, cpf)
      ),
    [records, collaboratorId, cpf]
  );

  if (myCats.length === 0) return null;

  const handleDownloadCat = (title: string, body: string) => {
    printHtml(`CAT — ${title}`, body);
  };

  return (
    <div className="mt-6">
      <SectionCard
        title="CAT · Comunicação de Acidente de Trabalho"
        subtitle="Sua via do documento e o recibo de entrega — guarde os dois como comprovante"
      >
        <p className="mb-4 flex items-start gap-2 rounded-md bg-secondary-100 px-3 py-2.5 text-[11px] leading-relaxed text-secondary-900">
          <i className="ri-information-line mt-0.5 text-sm"></i>
          A empresa é obrigada a entregar o recibo da CAT ao trabalhador (Lei 8.213/91, art. 22, §2º). Se o recibo
          ainda não estiver disponível, procure o SESMT da sua empresa.
        </p>

        <ul className="flex flex-col gap-3">
          {myCats.map((record) => {
            const cat = record.payload as CatPayload;
            const hasReceipt = Boolean(cat.receiptName && cat.receiptDataUrl);
            return (
              <li
                key={record.id}
                className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 lg:flex-row lg:items-center"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                  <i className="ri-first-aid-kit-line text-lg"></i>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-950">
                    <span className="truncate">{cat.accidentType}</span>
                    <span className="rounded-full bg-background-50 px-2 py-0.5 font-mono text-[10px] font-bold text-foreground-600">
                      {cat.protocol || record.id}
                    </span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-500">
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-calendar-event-line"></i>
                      {toBrDate(cat.accidentDate)}
                    </span>
                    {cat.cid && (
                      <>
                        <span className="text-foreground-300">·</span>
                        <span>CID {cat.cid}</span>
                      </>
                    )}
                    {cat.consequence && (
                      <>
                        <span className="text-foreground-300">·</span>
                        <span className="truncate">{cat.consequence}</span>
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {cat.catNumber ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-800">
                        <i className="ri-hashtag"></i>
                        Nº oficial {cat.catNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-semibold text-accent-800">
                        <i className="ri-time-line"></i>
                        Nº oficial em processamento
                      </span>
                    )}
                    {hasReceipt ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-800">
                        <i className="ri-attachment-2"></i>
                        Recibo disponível
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-semibold text-accent-800">
                        <i className="ri-receipt-line"></i>
                        Recibo pendente
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadCat(
                        cat.workerName || record.title,
                        buildStructuredPdfBody(record)
                      )
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-download-2-line"></i>
                    Baixar via da CAT
                  </button>
                  {hasReceipt ? (
                    <a
                      href={cat.receiptDataUrl}
                      download={cat.receiptName}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-receipt-line"></i>
                      Baixar recibo
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-background-300 bg-background-50 px-3.5 py-2 text-xs font-medium text-foreground-400">
                      <i className="ri-receipt-line"></i>
                      Recibo pendente
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}