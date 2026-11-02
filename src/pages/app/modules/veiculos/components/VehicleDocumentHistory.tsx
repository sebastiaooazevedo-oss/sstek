import { useState } from "react";
import {
  docSituation,
  docSituationMeta,
  daysUntil,
  formatDateBr,
  type Vehicle,
  type VehicleDocument,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";

interface Props {
  vehicle: Vehicle;
  documents: VehicleDocument[];
  canManage: boolean;
  onAdd: () => void;
  onReplace: (doc: VehicleDocument) => void;
  onNotify: (doc: VehicleDocument) => void;
}

/** Documentos do veículo agrupados por tipo, com histórico de versões. */
export default function VehicleDocumentHistory({
  vehicle,
  documents,
  canManage,
  onAdd,
  onReplace,
  onNotify,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const own = documents.filter((doc) => doc.vehicleRef === vehicle.ref);
  const urls = useVehicleFileUrls(own.map((doc) => doc.storagePath).filter(Boolean));
  const current = own.filter((doc) => doc.isCurrent);

  const versionsOf = (doc: VehicleDocument) =>
    own
      .filter((item) => item.typeKey === doc.typeKey && item.ref !== doc.ref)
      .sort((a, b) => b.version - a.version);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-bold text-foreground-950">Documentos e versões</h3>
          <p className="text-[11px] text-foreground-500">
            A versão vigente é única por tipo. Versões anteriores ficam preservadas.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-add-line"></i>
            Anexar documento
          </button>
        )}
      </div>

      {current.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-background-300 bg-background-100 px-3 py-4 text-center text-xs text-foreground-500">
          Nenhum documento anexado a este veículo.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {current.map((doc) => {
            const situation = docSituation(doc);
            const meta = docSituationMeta[situation];
            const days = daysUntil(doc.expiresAt);
            const older = versionsOf(doc);
            const isOpen = expanded === doc.ref;
            return (
              <li key={doc.ref} className="rounded-lg border border-background-200 bg-background-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground-900">
                      {doc.typeLabel}
                      <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-bold text-foreground-600">
                        v{doc.version}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-500">
                      <span>Emissão: {formatDateBr(doc.issuedAt)}</span>
                      <span>Vencimento: {formatDateBr(doc.expiresAt)}</span>
                      {doc.number && <span>Nº {doc.number}</span>}
                      {doc.responsible && <span>Resp.: {doc.responsible}</span>}
                      {days !== null && days >= 0 && (
                        <span className="font-semibold text-foreground-600">
                          {days === 0 ? "vence hoje" : `faltam ${days} dias`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {doc.storagePath && urls[doc.storagePath] && (
                      <a
                        href={urls[doc.storagePath]}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-file-download-line"></i>
                        Arquivo
                      </a>
                    )}
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => onReplace(doc)}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-refresh-line"></i>
                          Substituir
                        </button>
                        <button
                          type="button"
                          onClick={() => onNotify(doc)}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-notification-3-line"></i>
                          Aviso
                        </button>
                      </>
                    )}
                    {older.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : doc.ref)}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
                      >
                        <i className={isOpen ? "ri-arrow-up-s-line" : "ri-history-line"}></i>
                        {older.length} versão(ões)
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-background-200 pt-2.5">
                    {older.map((item) => (
                      <li key={item.ref} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground-600">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-background-200 px-1.5 py-0.5 font-bold text-foreground-600">
                            v{item.version}
                          </span>
                          <span>{formatDateBr(item.issuedAt)} → {formatDateBr(item.expiresAt)}</span>
                          {item.replacementReason && (
                            <span className="italic text-foreground-400">“{item.replacementReason}”</span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-500">
                            substituído
                          </span>
                          {item.storagePath && urls[item.storagePath] && (
                            <a
                              href={urls[item.storagePath]}
                              target="_blank"
                              rel="noreferrer"
                              className="cursor-pointer font-semibold text-primary-700 hover:underline"
                            >
                              abrir
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}