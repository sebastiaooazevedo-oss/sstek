import { useMemo, useState } from "react";
import {
  docSituation,
  docSituationMeta,
  formatDateBr,
  type DocSituation,
  type Vehicle,
  type VehicleDocument,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";

interface Props {
  vehicles: Vehicle[];
  documents: VehicleDocument[];
  canManage: boolean;
  onOpenVehicle: (vehicle: Vehicle) => void;
  onAdd: (vehicle: Vehicle) => void;
  onReplace: (doc: VehicleDocument) => void;
}

type Filter = DocSituation | "vigentes" | "todos";

const filters: { key: Filter; label: string }[] = [
  { key: "vigentes", label: "Vigentes" },
  { key: "vencido", label: "Vencidos" },
  { key: "vencendo", label: "Vencendo" },
  { key: "sem_vencimento", label: "Sem vencimento" },
  { key: "substituido", label: "Substituídos" },
  { key: "todos", label: "Tudo" },
];

export default function DocumentsTab({
  vehicles,
  documents,
  canManage,
  onOpenVehicle,
  onAdd,
  onReplace,
}: Props) {
  const [filter, setFilter] = useState<Filter>("vigentes");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const vehicleByRef = useMemo(() => {
    const map: Record<string, Vehicle> = {};
    vehicles.forEach((vehicle) => {
      map[vehicle.ref] = vehicle;
    });
    return map;
  }, [vehicles]);

  const urls = useVehicleFileUrls(documents.map((doc) => doc.storagePath).filter(Boolean));

  const matchesFilter = (doc: VehicleDocument): boolean => {
    const situation = docSituation(doc);
    if (filter === "todos") return true;
    if (filter === "vigentes") return doc.isCurrent;
    if (filter === "substituido") return !doc.isCurrent;
    return doc.isCurrent && situation === filter;
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents
      .filter((doc) => {
        if (!matchesFilter(doc)) return false;
        if (!term) return true;
        const vehicle = vehicleByRef[doc.vehicleRef];
        return [doc.typeLabel, vehicle?.plate, doc.responsible, doc.number]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, filter, search, vehicleByRef]);

  const countSituation = (target: DocSituation | "vigentes") => {
    if (target === "vigentes") return documents.filter((doc) => doc.isCurrent).length;
    return documents.filter((doc) => docSituation(doc) === target).length;
  };

  return (
    <section className="rounded-xl border border-background-200 bg-background-50">
      <div className="flex flex-col gap-3 border-b border-background-200 px-4 py-3.5 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === item.key
                  ? "bg-primary-600 text-background-50"
                  : "bg-background-100 text-foreground-600 hover:bg-background-200"
              }`}
            >
              {item.label}
              {item.key !== "todos" && ` (${countSituation(item.key as DocSituation | "vigentes")})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Placa, tipo, responsável..."
            className="w-full rounded-md border border-background-300 bg-background-50 py-2 pl-9 pr-3 text-sm text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-primary-400 md:w-72"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-400">
            <i className="ri-file-shield-2-line text-xl"></i>
          </span>
          <p className="font-heading text-sm font-bold text-foreground-900">Nenhum documento neste filtro</p>
          <p className="text-xs text-foreground-500">
            Documentos são anexados na ficha do veículo. Nada é presumido como obrigatório.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-background-200 bg-background-100 text-left">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Veículo</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Documento</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Emissão</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Vencimento</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Situação</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => {
                const vehicle = vehicleByRef[doc.vehicleRef];
                const situation = docSituation(doc);
                const meta = docSituationMeta[situation];
                const older = documents
                  .filter((item) => item.vehicleRef === doc.vehicleRef && item.typeKey === doc.typeKey && item.ref !== doc.ref)
                  .sort((a, b) => b.version - a.version);
                const isOpen = expanded === doc.ref;
                return (
                  <tr key={doc.ref} className="border-b border-background-100 align-top">
                    <td className="px-4 py-3">
                      {vehicle ? (
                        <button
                          type="button"
                          onClick={() => onOpenVehicle(vehicle)}
                          className="cursor-pointer font-mono text-sm font-bold tracking-wider text-foreground-950 hover:text-primary-700"
                        >
                          {vehicle.plate}
                        </button>
                      ) : (
                        <span className="text-xs text-foreground-400">—</span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-foreground-400">
                        {vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") : "veículo não localizado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground-900">
                        {doc.typeLabel}
                        <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-bold text-foreground-600">
                          v{doc.version}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-foreground-400">
                        {doc.number ? `Nº ${doc.number}` : "sem número"}
                        {doc.responsible ? ` · ${doc.responsible}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">{formatDateBr(doc.issuedAt)}</td>
                    <td className="px-4 py-3 text-xs text-foreground-700">{formatDateBr(doc.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {doc.storagePath && urls[doc.storagePath] && (
                          <a
                            href={urls[doc.storagePath]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
                          >
                            <i className="ri-file-download-line"></i>
                            Arquivo
                          </a>
                        )}
                        {canManage && vehicle && doc.isCurrent && (
                          <button
                            type="button"
                            onClick={() => onReplace(doc)}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                          >
                            <i className="ri-refresh-line"></i>
                            Substituir
                          </button>
                        )}
                        {canManage && vehicle && !doc.isCurrent && (
                          <button
                            type="button"
                            onClick={() => onAdd(vehicle)}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                          >
                            <i className="ri-add-line"></i>
                            Novo
                          </button>
                        )}
                        {older.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : doc.ref)}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[11px] font-semibold text-foreground-600 hover:bg-background-100"
                          >
                            <i className={isOpen ? "ri-arrow-up-s-line" : "ri-history-line"}></i>
                            {older.length}
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <ul className="mt-2 flex flex-col gap-1 rounded-md bg-background-100 px-2.5 py-2">
                          {older.map((item) => (
                            <li key={item.ref} className="flex flex-wrap items-center gap-2 text-[10px] text-foreground-600">
                              <span className="rounded-full bg-background-200 px-1.5 py-0.5 font-bold">v{item.version}</span>
                              <span>{formatDateBr(item.issuedAt)} → {formatDateBr(item.expiresAt)}</span>
                              {item.isCurrent ? (
                                <span className="font-semibold text-primary-700">vigente</span>
                              ) : (
                                <span className="text-foreground-400">substituído</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}