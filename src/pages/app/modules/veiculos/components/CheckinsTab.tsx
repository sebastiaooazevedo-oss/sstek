import { useMemo, useState, type ReactNode } from "react";
import {
  checkinKindMeta,
  formatDateTimeBr,
  openDeliveryFor,
  type CheckinKind,
  type Vehicle,
  type VehicleCheckin,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";

interface Props {
  vehicles: Vehicle[];
  checkins: VehicleCheckin[];
  canCheckin: boolean;
  onNew: (vehicleRef: string | null, kind: CheckinKind) => void;
}

function SectionTitle({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className={`${icon} text-base`}></i>
        </span>
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground-950">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-foreground-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export default function CheckinsTab({ vehicles, checkins, canCheckin, onNew }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "entrega" | "devolucao" | "uso">("todas");

  const vehicleByRef = (ref: string) => vehicles.find((item) => item.ref === ref) ?? null;
  const openDeliveries = checkins.filter((item) => item.kind === "entrega" && item.status === "aberta");

  const allPaths = useMemo(
    () => Array.from(new Set(checkins.flatMap((item) => item.photos))).filter(Boolean),
    [checkins]
  );
  const urls = useVehicleFileUrls(allPaths);

  const filtered = useMemo(() => {
    if (filter === "uso") return checkins.filter((item) => item.status === "aberta");
    if (filter === "entrega") return checkins.filter((item) => item.kind === "entrega");
    if (filter === "devolucao") return checkins.filter((item) => item.kind === "devolucao");
    return checkins;
  }, [checkins, filter]);

  const eligibleForDelivery = vehicles.filter(
    (vehicle) => vehicle.status !== "inativo" && vehicle.status !== "bloqueado" && !openDeliveryFor(checkins, vehicle.ref)
  );
  const eligibleForReturn = openDeliveries
    .map((item) => vehicleByRef(item.vehicleRef))
    .filter((item): item is Vehicle => Boolean(item));

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-background-200 bg-background-50 p-4">
        <SectionTitle
          icon="ri-exchange-line"
          title="Checklist da frota"
          description="Retirada e devolução do veículo em dois checklists obrigatórios. Quem finaliza a retirada assume o veículo como condutor responsável; na devolução o veículo volta para a empresa sem condutor responsável."
          action={
            canCheckin ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNew(eligibleForDelivery[0]?.ref ?? null, "entrega")}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-primary-700"
                >
                  <i className="ri-logout-box-r-line"></i>
                  Nova retirada
                </button>
                <button
                  type="button"
                  onClick={() => onNew(eligibleForReturn[0]?.ref ?? null, "devolucao")}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                >
                  <i className="ri-login-box-line"></i>
                  Nova devolução
                </button>
              </div>
            ) : undefined
          }
        />

        {openDeliveries.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-600">
            Nenhum veículo em uso no momento. Toda a frota ativa está na empresa.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {openDeliveries.map((delivery) => {
              const vehicle = vehicleByRef(delivery.vehicleRef);
              return (
                <div
                  key={delivery.ref}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-accent-900">
                      <i className="ri-truck-line"></i>
                      {delivery.plateSnapshot || vehicle?.plate || "—"}
                      <span className="rounded-full bg-background-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
                        em uso
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-accent-800">
                      Condutor responsável: <strong className="font-semibold">{delivery.responsibleName}</strong>
                      {delivery.responsibleRole ? ` · ${delivery.responsibleRole}` : ""}
                    </p>
                    <p className="mt-0.5 text-[10px] text-accent-800">
                      Entregue em {formatDateTimeBr(delivery.performedAt)} por {delivery.conferenteName || "—"}
                      {delivery.odometer !== null && ` · ${delivery.odometer.toLocaleString("pt-BR")} km`}
                      {delivery.fuelLevel !== null && ` · tanque ${delivery.fuelLevel}%`}
                    </p>
                  </div>
                  {canCheckin && vehicle && (
                    <button
                      type="button"
                      onClick={() => onNew(vehicle.ref, "devolucao")}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-primary-700"
                    >
                      <i className="ri-login-box-line"></i>
                      Registrar devolução
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-background-200 bg-background-50 p-4">
        <SectionTitle
          icon="ri-history-line"
          title="Histórico de checklists"
          description="Retirada e devolução ficam registradas com autor, condutor responsável, dupla conferência, hodômetro, combustível, condições e fotos. Nada pode ser excluído."
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              { id: "todas", label: "Todos" },
              { id: "uso", label: "Em uso" },
              { id: "entrega", label: "Retiradas" },
              { id: "devolucao", label: "Devoluções" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                filter === option.id
                  ? "bg-primary-600 text-background-50"
                  : "border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-600">
            Nenhum checklist registrado com este filtro.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {filtered.map((checkin) => {
              const meta = checkinKindMeta[checkin.kind];
              const isOpen = expanded === checkin.ref;
              const avarias = checkin.items.filter((item) => item.result === "avaria");
              const linked = checkin.linkedRef
                ? checkins.find((item) => item.ref === checkin.linkedRef) ?? null
                : null;
              return (
                <div key={checkin.ref} className="rounded-lg border border-background-200 bg-background-50">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : checkin.ref)}
                    className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground-950">
                        <i className={`${meta.icon} text-foreground-400`}></i>
                        {checkin.plateSnapshot || "—"}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                          {meta.short}
                        </span>
                        {checkin.status === "aberta" && (
                          <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
                            em uso
                          </span>
                        )}
                        {avarias.length > 0 && (
                          <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold text-danger-800">
                            {avarias.length} avaria(s)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-foreground-500">
                        {formatDateTimeBr(checkin.performedAt)} · {checkin.responsibleName || "—"}
                        {checkin.odometer !== null && ` · ${checkin.odometer.toLocaleString("pt-BR")} km`}
                        {checkin.fuelLevel !== null && ` · tanque ${checkin.fuelLevel}%`}
                      </p>
                    </div>
                    <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                  </button>

                  {isOpen && (
                    <div className="border-t border-background-200 px-3 py-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-600">
                          <p className="font-semibold text-foreground-800">Dupla conferência</p>
                          <p className="mt-0.5">
                            {checkin.kind === "entrega" ? "Condutor responsável" : "Devolvido por"}:
                            {" "}
                            {checkin.responsibleName || "—"}
                            {checkin.responsibleDocument ? ` · ${checkin.responsibleDocument}` : ""}
                          </p>
                          <p>Conferido por: {checkin.conferenteName || "—"}</p>
                          <p>Registrado por: {checkin.performedByName || "—"}</p>
                          {linked && (
                            <p className="mt-0.5">
                              {checkin.kind === "devolucao" ? "Entrega vinculada" : "Devolução vinculada"}:{" "}
                              {formatDateTimeBr(linked.performedAt)}
                            </p>
                          )}
                        </div>
                        <div className="rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-600">
                          <p className="font-semibold text-foreground-800">Condições no momento</p>
                          <p className="mt-0.5">Hodômetro: {checkin.odometer ?? "—"} km</p>
                          <p>Combustível: {checkin.fuelLevel === null ? "—" : `${checkin.fuelLevel}%`}</p>
                          <p>
                            {checkin.items.length - avarias.length} item(ns) conforme(s) · {avarias.length} avaria(s)
                          </p>
                          {checkin.notes && <p className="mt-0.5 italic">“{checkin.notes}”</p>}
                        </div>
                      </div>

                      {checkin.items.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                          {checkin.items.map((item) => (
                            <div
                              key={item.key}
                              className={`rounded-md border px-2 py-1.5 text-[10px] ${
                                item.result === "avaria"
                                  ? "border-danger-200 bg-danger-50 text-danger-800"
                                  : "border-primary-200 bg-primary-50 text-primary-800"
                              }`}
                            >
                              <p className="truncate font-semibold">{item.label}</p>
                              <p className="mt-0.5">{item.result === "avaria" ? "avaria" : "conforme"}</p>
                              {item.observation && <p className="mt-0.5 italic">“{item.observation}”</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {checkin.photos.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">
                            Fotos do check-in
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {checkin.photos.map((path) => (
                              <span
                                key={path}
                                className="h-14 w-20 overflow-hidden rounded-md border border-background-200 bg-background-200"
                              >
                                {urls[path] ? (
                                  <a href={urls[path]} target="_blank" rel="noreferrer">
                                    <img
                                      src={urls[path]}
                                      alt="Foto do check-in do veículo"
                                      className="h-full w-full object-cover"
                                    />
                                  </a>
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-foreground-400">
                                    <i className="ri-image-line"></i>
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}