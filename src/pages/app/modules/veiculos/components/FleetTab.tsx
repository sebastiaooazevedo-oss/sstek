import { useMemo, useState } from "react";
import {
  openDeliveryFor,
  requirementsForVehicle,
  summarizeVehicleDocuments,
  vehicleStatusMeta,
  vehicleStatusOptions,
  type Vehicle,
  type VehicleCheckin,
  type VehicleDocument,
  type VehicleRequirement,
  type VehicleStatus,
} from "@/pages/app/modules/veiculos/vehicleTypes";

interface Props {
  vehicles: Vehicle[];
  documents: VehicleDocument[];
  requirements: VehicleRequirement[];
  checkins: VehicleCheckin[];
  canCreate: boolean;
  canEdit: boolean;
  onNew: () => void;
  onOpen: (vehicle: Vehicle) => void;
  onEdit: (vehicle: Vehicle) => void;
}

export default function FleetTab({
  vehicles,
  documents,
  requirements,
  checkins,
  canCreate,
  canEdit,
  onNew,
  onOpen,
  onEdit,
}: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VehicleStatus | "todos">("todos");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      if (status !== "todos" && vehicle.status !== status) return false;
      if (!term) return true;
      return [vehicle.plate, vehicle.brand, vehicle.model, vehicle.internalCode, vehicle.establishment]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [vehicles, search, status]);

  const countByStatus = (value: VehicleStatus) =>
    vehicles.filter((vehicle) => vehicle.status === value).length;

  return (
    <section className="rounded-xl border border-background-200 bg-background-50">
      <div className="flex flex-col gap-3 border-b border-background-200 px-4 py-3.5 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatus("todos")}
            className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              status === "todos"
                ? "bg-primary-600 text-background-50"
                : "bg-background-100 text-foreground-600 hover:bg-background-200"
            }`}
          >
            Toda a frota ({vehicles.length})
          </button>
          {vehicleStatusOptions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === item
                  ? "bg-primary-600 text-background-50"
                  : "bg-background-100 text-foreground-600 hover:bg-background-200"
              }`}
            >
              {vehicleStatusMeta[item].label} ({countByStatus(item)})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Placa, modelo, identificação..."
              className="w-full rounded-md border border-background-300 bg-background-50 py-2 pl-9 pr-3 text-sm text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-primary-400 md:w-72"
            />
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-700 md:hidden"
            >
              <i className="ri-add-line"></i>
              Novo
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background-100 text-foreground-400">
            <i className="ri-truck-line text-2xl"></i>
          </span>
          <div>
            <p className="font-heading text-sm font-bold text-foreground-900">
              {vehicles.length === 0 ? "Nenhum veículo cadastrado" : "Nenhum veículo encontrado"}
            </p>
            <p className="mt-1 text-xs text-foreground-500">
              {vehicles.length === 0
                ? "Cadastre o primeiro veículo para começar a controlar documentos e vencimentos."
                : "Ajuste a busca ou o filtro de situação."}
            </p>
          </div>
          {vehicles.length === 0 && canCreate && (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-4 py-2.5 text-xs font-semibold text-background-50 hover:bg-primary-700"
            >
              <i className="ri-add-line"></i>
              Cadastrar veículo
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-background-200 bg-background-100 text-left">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Veículo</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Categoria</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Situação</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Hodômetro</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Documentos</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Exigências</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => {
                const summary = summarizeVehicleDocuments(vehicle, documents, requirements);
                const applicable = requirementsForVehicle(requirements, vehicle).length;
                const statusMeta = vehicleStatusMeta[vehicle.status];
                const driver = openDeliveryFor(checkins, vehicle.ref);
                return (
                  <tr key={vehicle.ref} className="border-b border-background-100 transition-colors hover:bg-background-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpen(vehicle)}
                        className="cursor-pointer text-left"
                      >
                        <span className="font-mono text-sm font-bold tracking-wider text-foreground-950 hover:text-primary-700">
                          {vehicle.plate}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-foreground-500">
                          {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—"}
                          {vehicle.internalCode ? ` · ${vehicle.internalCode}` : ""}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">
                      {vehicle.category || "—"}
                      <span className="mt-0.5 block text-[11px] text-foreground-400">
                        {vehicle.establishment || "sem estabelecimento"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                      {driver ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-accent-800">
                          <i className="ri-user-star-line"></i>
                          <span className="truncate">{driver.responsibleName || "condutor"}</span>
                        </span>
                      ) : (
                        <span className="mt-1 block text-[10px] text-foreground-400">sem condutor</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-foreground-700">
                      {vehicle.odometer === null ? "—" : `${vehicle.odometer.toLocaleString("pt-BR")} km`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs font-semibold text-foreground-800">{summary.total} vigente(s)</span>
                        {summary.vencidos > 0 && (
                          <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold text-danger-800">
                            {summary.vencidos} vencido(s)
                          </span>
                        )}
                        {summary.vencendo > 0 && (
                          <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
                            {summary.vencendo} vencendo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">
                      {applicable === 0 ? (
                        <span className="text-foreground-400">sem exigência</span>
                      ) : summary.ausentes > 0 ? (
                        <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-bold text-danger-800">
                          {summary.ausentes} ausente(s)
                        </span>
                      ) : (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                          completo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpen(vehicle)}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-file-list-3-line"></i>
                          Ficha
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            aria-label={`Editar ${vehicle.plate}`}
                            onClick={() => onEdit(vehicle)}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
                          >
                            <i className="ri-edit-line text-sm"></i>
                          </button>
                        )}
                      </div>
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